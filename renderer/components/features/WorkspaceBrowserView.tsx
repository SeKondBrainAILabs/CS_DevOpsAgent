/**
 * WorkspaceBrowserView (Epic A / story A5 — MVP)
 *
 * Top-level view rendered when `mainView === 'workspaces'`. Shows the
 * configured workspaces, a switcher, and a grid of RepoStatusCards
 * for the active workspace's discovered repos.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DiscoveredRepo,
  Workspace,
  WorkspaceRepoChangeEvent,
  StorageMetricsOverview,
} from '../../../shared/types';
import {
  DEFAULT_REPO_SORT_KEY,
  getRepoComparator,
  type RepoSortKey,
} from '../../../shared/repo-sort';
import type { RepoStatusBlock } from './RepoStatusCard';
import { AddWorkspaceDialog } from './AddWorkspaceDialog';
import { useUIStore } from '../../store/uiStore';
function formatGiB(bytes: number): string {
  const gib = bytes / (1024 ** 3);
  return `${gib.toFixed(2)} GiB`;
}

function basenameFromPath(repoPath: string): string {
  return repoPath.split('/').filter(Boolean).pop() ?? repoPath;
}

function formatDaysOld(days: number | null): string {
  if (days === null) return 'age unknown';
  if (days <= 0) return '<1 day old';
  if (days === 1) return '1 day old';
  return `${days} days old`;
}

function formatAbandonedReason(
  reason: AbandonedWorktreeEntry['reason']
): string {
  return reason === 'missing-path' ? 'missing path' : 'stale + no active session';
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

const WORKFLOW_VIEW_STATE_KEY = 'kanvas.workspace.workflow-dashboard.v1';
const ONE_GIB = 1024 ** 3;
const WORKFLOW_QUEUE_LIMIT = 7;
const WORKFLOW_SNOOZE_HOURS = 24;

interface PersistedWorkflowViewState {
  dismissedItemIds: string[];
  snoozedUntilByItemId: Record<string, string>;
}
type AbandonedWorktreeEntry = StorageMetricsOverview['local']['abandonedWorktrees'][number];

type WorkflowQueueCategory = 'cleanup' | 'sync' | 'changes';
type WorkspaceRepoSortKey = RepoSortKey | 'priority';
type RepoPriorityLevel = 'critical' | 'attention' | 'healthy';
type WorkflowActionKind =
  | 'open-repo-detail'
  | 'open-terminal'
  | 'new-session'
  | 'copy-repo-cleanup-command'
  | 'copy-abandoned-worktree-command'
  | 'clean-abandoned-worktree'
  | 'clean-missing-worktree-refs';

interface WorkflowActionDefinition {
  kind: WorkflowActionKind;
  label: string;
  repoPath?: string;
  abandonedWorktree?: AbandonedWorktreeEntry;
}

interface WorkflowQueueItem {
  id: string;
  title: string;
  reason: string;
  impactLabel: string;
  score: number;
  category: WorkflowQueueCategory;
  primaryAction: WorkflowActionDefinition;
  secondaryActions?: WorkflowActionDefinition[];
}
interface RepoHealthSnapshot {
  healthScore: number;
  riskPoints: number;
  priority: RepoPriorityLevel;
}

function readWorkflowStateFromStorage(): PersistedWorkflowViewState {
  if (typeof window === 'undefined') {
    return { dismissedItemIds: [], snoozedUntilByItemId: {} };
  }

  try {
    const raw = window.localStorage.getItem(WORKFLOW_VIEW_STATE_KEY);
    if (!raw) return { dismissedItemIds: [], snoozedUntilByItemId: {} };
    const parsed = JSON.parse(raw) as Partial<PersistedWorkflowViewState>;
    return {
      dismissedItemIds: Array.isArray(parsed.dismissedItemIds) ? parsed.dismissedItemIds : [],
      snoozedUntilByItemId:
        parsed.snoozedUntilByItemId && typeof parsed.snoozedUntilByItemId === 'object'
          ? parsed.snoozedUntilByItemId
          : {},
    };
  } catch {
    return { dismissedItemIds: [], snoozedUntilByItemId: {} };
  }
}

function workflowCategoryLabel(category: WorkflowQueueCategory): string {
  if (category === 'cleanup') return 'Cleanup';
  if (category === 'sync') return 'Sync';
  return 'Changes';
}

function getRepoPriorityLevel(riskPoints: number): RepoPriorityLevel {
  if (riskPoints >= 20) return 'critical';
  if (riskPoints >= 10) return 'attention';
  return 'healthy';
}

function formatRepoPriorityLabel(priority: RepoPriorityLevel): string {
  if (priority === 'critical') return 'Critical';
  if (priority === 'attention') return 'Attention';
  return 'Healthy';
}

function repoPriorityBadgeClasses(priority: RepoPriorityLevel): string {
  if (priority === 'critical') {
    return 'border-red-500/40 bg-red-500/10 text-red-500';
  }
  if (priority === 'attention') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-500';
  }
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500';
}

function calculateRepoStalePenalty(discoveredAt: string): number {
  const discoveredAtMs = Date.parse(discoveredAt);
  if (!Number.isFinite(discoveredAtMs)) return 0;
  const ageDays = (Date.now() - discoveredAtMs) / (1000 * 60 * 60 * 24);
  if (ageDays >= 30) return 4;
  if (ageDays >= 14) return 2;
  return 0;
}

export function WorkspaceBrowserView(): React.ReactElement {
  const openCreateAgentWizardForRepo = useUIStore((s) => s.openCreateAgentWizardForRepo);
  const openRepoDetail = useUIStore((s) => s.openRepoDetail);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [repos, setRepos] = useState<DiscoveredRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<WorkspaceRepoSortKey>(DEFAULT_REPO_SORT_KEY);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetricsOverview | null>(null);
  const [storageMetricsLoading, setStorageMetricsLoading] = useState(false);
  const [storageMetricsError, setStorageMetricsError] = useState<string | null>(null);
  const [storageMetricsRefreshNonce, setStorageMetricsRefreshNonce] = useState(0);
  const [copiedCleanupRepoPath, setCopiedCleanupRepoPath] = useState<string | null>(null);
  const [copiedAbandonedWorktreeKey, setCopiedAbandonedWorktreeKey] = useState<string | null>(null);
  const [cleaningAbandonedWorktreeKey, setCleaningAbandonedWorktreeKey] = useState<string | null>(null);
  const [abandonedWorktreeErrors, setAbandonedWorktreeErrors] = useState<Record<string, string>>({});
  const [dismissedWorkflowItemIds, setDismissedWorkflowItemIds] = useState<string[]>([]);
  const [snoozedUntilByWorkflowItemId, setSnoozedUntilByWorkflowItemId] = useState<Record<string, string>>({});
  const [workflowActionInFlightItemId, setWorkflowActionInFlightItemId] = useState<string | null>(null);
  const [workflowActionErrorsByItemId, setWorkflowActionErrorsByItemId] = useState<Record<string, string>>({});
  const [workspaceMutationPendingId, setWorkspaceMutationPendingId] = useState<string | null>(null);
  const [workspaceManagerExpanded, setWorkspaceManagerExpanded] = useState(false);
  /** Per-repoPath status block — populated lazily as we learn about repos. */
  const [statusByPath, setStatusByPath] = useState<Record<string, RepoStatusBlock>>({});

  const [recentReposFallback, setRecentReposFallback] = useState<DiscoveredRepo[]>([]);

  const refreshWorkspaces = useCallback(async () => {
    const listRes = await window.api.workspace.list();
    const list = listRes.success && listRes.data ? listRes.data : [];
    if (listRes.success) setWorkspaces(list);

    const activeRes = await window.api.workspace.getActive();
    if (activeRes.success && activeRes.data) setActiveId(activeRes.data.id);
    else if (list.length) setActiveId(list[0].id);

    // When the user has no workspaces yet but already has recentRepos from
    // their existing Kanvas sessions, surface those so the page isn't empty
    // on first visit. They're not yet a real workspace — there's an inline
    // CTA to "pin parent folder as workspace" in the empty-state UI.
    if (list.length === 0) {
      try {
        const recents = await window.api.instance?.getRecentRepos?.();
        if (recents?.success && Array.isArray(recents.data)) {
          const now = new Date().toISOString();
          setRecentReposFallback(
            recents.data.map((r: { path: string; name: string; lastUsed?: string }) => ({
              workspaceId: '__recent__',
              path: r.path,
              name: r.name,
              depth: 0,
              discoveredAt: r.lastUsed ?? now,
            }))
          );
        }
      } catch {
        // ignore — fallback just stays empty
      }
    } else {
      setRecentReposFallback([]);
    }
  }, []);

  /** Common parent dir (POSIX) of a non-empty list of paths. */
  const commonParent = useCallback((paths: string[]): string | null => {
    if (paths.length === 0) return null;
    const split = paths.map((p) => p.split('/'));
    const head = split[0];
    let i = 0;
    for (; i < head.length; i++) {
      const segment = head[i];
      if (!split.every((parts) => parts[i] === segment)) break;
    }
    if (i === 0) return '/';
    const joined = head.slice(0, i).join('/');
    return joined || '/';
  }, []);

  const scanActive = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.workspace.scan(id);
      if (res.success && res.data) {
        setRepos(res.data.repos);
      } else {
        setError(res.error?.message || 'Scan failed');
        setRepos([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  // Scan when active workspace changes
  useEffect(() => {
    if (!activeId) {
      setRepos([]);
      return;
    }
    void scanActive(activeId);
    // Also start watching for new repos
    void window.api.workspace.startWatching(activeId);
  }, [activeId, scanActive]);

  // Subscribe to repo-change events
  useEffect(() => {
    const unsubscribe = window.api.workspace.onRepoChange((event: WorkspaceRepoChangeEvent) => {
      if (event.workspaceId !== activeId) return;
      setRepos((prev) => {
        if (event.kind === 'repo-added') {
          if (prev.some((r) => r.path === event.repoPath)) return prev;
          const name = event.repoPath.split('/').filter(Boolean).pop() ?? event.repoPath;
          return [
            ...prev,
            {
              workspaceId: event.workspaceId,
              path: event.repoPath,
              name,
              depth: event.depth,
              discoveredAt: event.at,
            },
          ];
        }
        return prev.filter((r) => r.path !== event.repoPath);
      });
    });
    return unsubscribe;
  }, [activeId]);

  // Pre-fetch worktree-mode + active session count + git repo status for
  // each repo so the card shows real branch / ahead-behind / uncommitted /
  // stash / worktree counts in addition to the C5 single-session badge.
  useEffect(() => {
    let cancelled = false;
    const target = workspaces.length === 0 ? recentReposFallback : repos;
    (async () => {
      const updates: Record<string, RepoStatusBlock> = {};
      for (const repo of target) {
        try {
          const [modeRes, countRes, statusRes] = await Promise.all([
            window.api.repoWorkspace.getWorktreeMode(repo.path),
            window.api.repoWorkspace.getActiveSessionCount(repo.path),
            window.api.git.getRepoStatus(repo.path),
          ]);
          const block: RepoStatusBlock = {
            worktreeMode: modeRes.success ? modeRes.data : undefined,
            activeSessionCount: countRes.success ? countRes.data : 0,
          };
          if (statusRes.success && statusRes.data) {
            const s = statusRes.data;
            block.currentBranch = s.currentBranch;
            block.ahead = s.ahead;
            block.behind = s.behind;
            block.unmergedCount = s.unmergedCount;
            block.modifiedCount = s.modifiedCount;
            block.stagedCount = s.stagedCount;
            block.untrackedCount = s.untrackedCount;
            block.stashCount = s.stashCount;
            block.worktreeCount = s.worktreeCount;
          }
          updates[repo.path] = block;
        } catch {
          // ignore — leave block undefined
        }
      }
      if (!cancelled) setStatusByPath((prev) => ({ ...prev, ...updates }));
    })();
    return () => {
      cancelled = true;
    };
  }, [repos, recentReposFallback, workspaces.length]);

  // When no workspace exists, the recent-repos fallback drives the grid
  // so the user immediately sees their work — even before they configure
  // a real workspace folder.
  const showingFallback = workspaces.length === 0 && recentReposFallback.length > 0;
  const sourceRepos = showingFallback ? recentReposFallback : repos;

  useEffect(() => {
    const persistedState = readWorkflowStateFromStorage();
    setDismissedWorkflowItemIds(persistedState.dismissedItemIds);
    setSnoozedUntilByWorkflowItemId(persistedState.snoozedUntilByItemId);
  }, []);

  useEffect(() => {
    const now = Date.now();
    const validEntries = Object.entries(snoozedUntilByWorkflowItemId).filter(([, untilIso]) => {
      const untilMs = Date.parse(untilIso);
      return Number.isFinite(untilMs) && untilMs > now;
    });
    if (validEntries.length === Object.keys(snoozedUntilByWorkflowItemId).length) return;
    setSnoozedUntilByWorkflowItemId(Object.fromEntries(validEntries));
  }, [snoozedUntilByWorkflowItemId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedWorkflowViewState = {
      dismissedItemIds: dismissedWorkflowItemIds,
      snoozedUntilByItemId: snoozedUntilByWorkflowItemId,
    };
    try {
      window.localStorage.setItem(WORKFLOW_VIEW_STATE_KEY, JSON.stringify(payload));
    } catch {
      // Best-effort persistence only.
    }
  }, [dismissedWorkflowItemIds, snoozedUntilByWorkflowItemId]);

  useEffect(() => {
    let cancelled = false;
    const repoPaths = [...new Set(sourceRepos.map((repo) => repo.path))];

    if (repoPaths.length === 0) {
      setStorageMetrics(null);
      setStorageMetricsError(null);
      setStorageMetricsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadStorageMetrics = async (): Promise<void> => {
      setStorageMetricsLoading(true);
      setStorageMetricsError(null);
      try {
        const result = await window.api.cleanup.getStorageMetrics(repoPaths);
        if (cancelled) return;
        if (result.success && result.data) {
          setStorageMetrics(result.data);
        } else {
          setStorageMetrics(null);
          setStorageMetricsError(result.error?.message || 'Failed to load storage metrics');
        }
      } catch (error) {
        if (cancelled) return;
        setStorageMetrics(null);
        setStorageMetricsError(error instanceof Error ? error.message : 'Failed to load storage metrics');
      } finally {
        if (!cancelled) setStorageMetricsLoading(false);
      }
    };

    void loadStorageMetrics();
    return () => {
      cancelled = true;
    };
  }, [sourceRepos, storageMetricsRefreshNonce]);


  const fallbackParent = useMemo(
    () => (showingFallback ? commonParent(recentReposFallback.map((r) => r.path)) : null),
    [showingFallback, recentReposFallback, commonParent]
  );
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null,
    [workspaces, activeId]
  );
  const handleSetActiveWorkspace = useCallback(async (
    nextWorkspaceId: string | null
  ): Promise<void> => {
    setError(null);
    setActiveId(nextWorkspaceId);
    const result = await window.api.workspace.setActive(nextWorkspaceId);
    if (!result.success) {
      setError(result.error?.message || 'Failed to switch workspace');
    }
  }, []);

  const handleRemoveWorkspace = useCallback(async (
    workspaceId: string
  ): Promise<void> => {
    setWorkspaceMutationPendingId(workspaceId);
    setError(null);
    try {
      const result = await window.api.workspace.remove(workspaceId);
      if (!result.success) {
        setError(result.error?.message || 'Failed to delete workspace');
        return;
      }
      await refreshWorkspaces();
    } finally {
      setWorkspaceMutationPendingId((current) => (current === workspaceId ? null : current));
    }
  }, [refreshWorkspaces]);

  const handlePinFallbackParent = useCallback(async () => {
    if (!fallbackParent) return;
    const result = await window.api.workspace.add({ path: fallbackParent });
    if (result.success && result.data) {
      void refreshWorkspaces();
    }
  }, [fallbackParent, refreshWorkspaces]);

  const cleanupTargetsByRepo = useMemo(() => {
    const targetsByRepo = new Map<string, Set<string>>();
    if (!storageMetrics) return targetsByRepo;

    const addTarget = (repoPath: string, targetPath: string): void => {
      const current = targetsByRepo.get(repoPath) ?? new Set<string>();
      current.add(targetPath);
      targetsByRepo.set(repoPath, current);
    };

    for (const entry of storageMetrics.local.nodeModulesByRepo) {
      for (const targetPath of entry.paths) addTarget(entry.repoPath, targetPath);
    }

    for (const entry of storageMetrics.local.pythonEnvsByRepo) {
      for (const targetPath of entry.paths) addTarget(entry.repoPath, targetPath);
    }

    for (const entry of storageMetrics.local.abandonedWorktrees) {
      if (!entry.exists) continue;
      addTarget(entry.repoPath, entry.worktreePath);
    }

    return targetsByRepo;
  }, [storageMetrics]);

  const topPriorityReclaimable = useMemo(
    () => storageMetrics?.local.reclaimableByRepo.slice(0, 3) ?? [],
    [storageMetrics]
  );
  const abandonedWorktreeCountByRepoPath = useMemo(() => {
    const countsByRepoPath = new Map<string, number>();
    if (!storageMetrics) return countsByRepoPath;
    for (const entry of storageMetrics.local.abandonedWorktrees) {
      countsByRepoPath.set(entry.repoPath, (countsByRepoPath.get(entry.repoPath) ?? 0) + 1);
    }
    return countsByRepoPath;
  }, [storageMetrics]);

  const healthByRepoPath = useMemo(() => {
    const snapshotsByRepoPath = new Map<string, RepoHealthSnapshot>();
    for (const repo of sourceRepos) {
      const status = statusByPath[repo.path];
      const behind = status?.behind ?? 0;
      const unmerged = status?.unmergedCount ?? 0;
      const modified = status?.modifiedCount ?? 0;
      const staged = status?.stagedCount ?? 0;
      const untracked = status?.untrackedCount ?? 0;
      const abandonedWorktreeCount = abandonedWorktreeCountByRepoPath.get(repo.path) ?? 0;
      const stalePenalty = calculateRepoStalePenalty(repo.discoveredAt);
      const riskPoints = (
        behind * 3
        + unmerged * 2
        + staged
        + modified
        + untracked
        + abandonedWorktreeCount * 2
        + stalePenalty
      );
      const healthScore = Math.max(0, 100 - Math.min(95, riskPoints * 3));
      snapshotsByRepoPath.set(repo.path, {
        healthScore,
        riskPoints,
        priority: getRepoPriorityLevel(riskPoints),
      });
    }
    return snapshotsByRepoPath;
  }, [sourceRepos, statusByPath, abandonedWorktreeCountByRepoPath]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q
      ? sourceRepos.filter(
          (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
        )
      : [...sourceRepos];
    if (sortKey === 'priority') {
      list.sort((a, b) => {
        const priorityA = healthByRepoPath.get(a.path);
        const priorityB = healthByRepoPath.get(b.path);
        const riskDelta = (priorityB?.riskPoints ?? 0) - (priorityA?.riskPoints ?? 0);
        if (riskDelta !== 0) return riskDelta;
        const healthDelta = (priorityA?.healthScore ?? 100) - (priorityB?.healthScore ?? 100);
        if (healthDelta !== 0) return healthDelta;
        return a.name.localeCompare(b.name);
      });
      return list;
    }
    const cmp = getRepoComparator(sortKey);
    list.sort((a, b) =>
      cmp(
        { name: a.name, workingTreeMtimeMs: Date.parse(a.discoveredAt), lastCommitMs: Date.parse(a.discoveredAt), sizeBytes: 0 },
        { name: b.name, workingTreeMtimeMs: Date.parse(b.discoveredAt), lastCommitMs: Date.parse(b.discoveredAt), sizeBytes: 0 }
      )
    );
    return list;
  }, [sourceRepos, filter, sortKey, healthByRepoPath]);

  const buildCleanupCommand = useCallback((repoPath: string): string | null => {
    const targets = [...(cleanupTargetsByRepo.get(repoPath) ?? [])];
    if (targets.length === 0) return null;
    const quotedTargets = targets.map(shellQuote).join(' ');
    return `du -sh ${quotedTargets}; rm -rf ${quotedTargets}`;
  }, [cleanupTargetsByRepo]);

  const handleCopyCleanupCommand = useCallback(async (repoPath: string): Promise<void> => {
    const command = buildCleanupCommand(repoPath);
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCleanupRepoPath(repoPath);
      window.setTimeout(() => {
        setCopiedCleanupRepoPath((current) => (current === repoPath ? null : current));
      }, 1600);
    } catch {
      setCopiedCleanupRepoPath(null);
    }
  }, [buildCleanupCommand]);

  const buildAbandonedWorktreeKey = useCallback((
    entry: AbandonedWorktreeEntry
  ): string => `${entry.repoPath}::${entry.worktreePath}::${entry.reason}`, []);

  const buildAbandonedWorktreeCleanupCommand = useCallback((
    entry: AbandonedWorktreeEntry
  ): string => {
    const repoPath = shellQuote(entry.repoPath);
    if (entry.reason === 'missing-path') {
      return `git -C ${repoPath} worktree prune`;
    }
    const worktreePath = shellQuote(entry.worktreePath);
    return `git -C ${repoPath} worktree remove --force ${worktreePath} && git -C ${repoPath} worktree prune`;
  }, []);

  const handleCopyAbandonedWorktreeCommand = useCallback(async (
    entry: AbandonedWorktreeEntry
  ): Promise<void> => {
    const command = buildAbandonedWorktreeCleanupCommand(entry);
    const worktreeKey = buildAbandonedWorktreeKey(entry);
    try {
      await navigator.clipboard.writeText(command);
      setCopiedAbandonedWorktreeKey(worktreeKey);
      window.setTimeout(() => {
        setCopiedAbandonedWorktreeKey((current) => (current === worktreeKey ? null : current));
      }, 1600);
    } catch {
      setCopiedAbandonedWorktreeKey(null);
    }
  }, [buildAbandonedWorktreeCleanupCommand, buildAbandonedWorktreeKey]);

  const runWorktreeCleanup = useCallback(async (
    entries: AbandonedWorktreeEntry[]
  ): Promise<void> => {
    const entriesByRepoPath = new Map<string, AbandonedWorktreeEntry[]>();
    for (const entry of entries) {
      const current = entriesByRepoPath.get(entry.repoPath) ?? [];
      current.push(entry);
      entriesByRepoPath.set(entry.repoPath, current);
    }

    for (const [repoPath, repoEntries] of entriesByRepoPath.entries()) {
      const result = await window.api.cleanup.execute(
        {
          repoPath,
          worktreesToRemove: repoEntries.map((entry) => ({
            path: entry.worktreePath,
            branch: entry.branch,
          })),
          branchesToDelete: [],
          branchesToMerge: [],
        },
        {
          removeWorktrees: true,
          deleteMergedBranches: false,
          mergeCompletedBranches: false,
          deleteRemoteBranches: false,
        }
      );

      if (!result.success) {
        throw new Error(result.error?.message || `Failed to clean worktrees in ${repoPath}`);
      }
      if (!result.data?.success) {
        throw new Error(result.data?.errors?.[0] || `Failed to clean worktrees in ${repoPath}`);
      }
    }

    setStorageMetricsRefreshNonce((nonce) => nonce + 1);
  }, []);

  const handleCleanAbandonedWorktree = useCallback(async (
    entry: AbandonedWorktreeEntry
  ): Promise<{ success: boolean; error?: string }> => {
    const worktreeKey = buildAbandonedWorktreeKey(entry);
    setCleaningAbandonedWorktreeKey(worktreeKey);
    setAbandonedWorktreeErrors((current) => {
      if (!(worktreeKey in current)) return current;
      const next = { ...current };
      delete next[worktreeKey];
      return next;
    });

    try {
      await runWorktreeCleanup([entry]);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clean abandoned worktree';
      setAbandonedWorktreeErrors((current) => ({
        ...current,
        [worktreeKey]: message,
      }));
      return { success: false, error: message };
    } finally {
      setCleaningAbandonedWorktreeKey((current) => (current === worktreeKey ? null : current));
    }
  }, [buildAbandonedWorktreeKey, runWorktreeCleanup]);

  const handleCleanMissingPathWorktreeRefs = useCallback(async (): Promise<void> => {
    if (!storageMetrics) return;

    const missingPathEntries = (
      storageMetrics.local.abandonedWorktrees
        .filter((entry) => entry.reason === 'missing-path')
    );
    if (missingPathEntries.length === 0) return;
    await runWorktreeCleanup(missingPathEntries);
  }, [storageMetrics, runWorktreeCleanup]);

  const dismissedWorkflowItemIdSet = useMemo(
    () => new Set(dismissedWorkflowItemIds),
    [dismissedWorkflowItemIds]
  );

  const activeSnoozedUntilByWorkflowItemId = useMemo(() => {
    const now = Date.now();
    const entries = Object.entries(snoozedUntilByWorkflowItemId).filter(([, untilIso]) => {
      const untilMs = Date.parse(untilIso);
      return Number.isFinite(untilMs) && untilMs > now;
    });
    return Object.fromEntries(entries);
  }, [snoozedUntilByWorkflowItemId]);

  const workflowQueueItems = useMemo<WorkflowQueueItem[]>(() => {
    const items: WorkflowQueueItem[] = [];
    const repoNameByPath = new Map(sourceRepos.map((repo) => [repo.path, repo.name]));

    if (storageMetrics) {
      const missingPathEntries = storageMetrics.local.abandonedWorktrees
        .filter((entry) => entry.reason === 'missing-path');
      const missingPathRepoCount = new Set(missingPathEntries.map((entry) => entry.repoPath)).size;

      if (missingPathRepoCount > 0) {
        items.push({
          id: 'cleanup:missing-path-refs',
          title: `Prune missing worktree refs in ${missingPathRepoCount} repo${missingPathRepoCount === 1 ? '' : 's'}`,
          reason: `${missingPathEntries.length} stale worktree reference${missingPathEntries.length === 1 ? '' : 's'} point to directories that no longer exist.`,
          impactLabel: 'Safe cleanup',
          score: 250 + missingPathEntries.length * 10,
          category: 'cleanup',
          primaryAction: {
            kind: 'clean-missing-worktree-refs',
            label: 'Clean safe refs',
          },
          secondaryActions: [{
            kind: 'open-terminal',
            label: 'Open terminal',
            repoPath: missingPathEntries[0]?.repoPath,
          }],
        });
      }

      for (const entry of storageMetrics.local.abandonedWorktrees.filter((row) => row.reason === 'stale-no-session').slice(0, 3)) {
        const staleScore = 180
          + Math.min(40, Math.round((entry.bytes / ONE_GIB) * 7))
          + Math.min(30, entry.daysSinceLastTouched ?? 0);
        const repoName = basenameFromPath(entry.repoPath);
        items.push({
          id: `cleanup:abandoned:${buildAbandonedWorktreeKey(entry)}`,
          title: `Remove abandoned worktree ${entry.branch}`,
          reason: `${repoName} • ${entry.exists ? formatDaysOld(entry.daysSinceLastTouched) : 'missing path'} • ${formatGiB(entry.bytes)} reclaimable`,
          impactLabel: 'Medium impact',
          score: staleScore,
          category: 'cleanup',
          primaryAction: {
            kind: 'clean-abandoned-worktree',
            label: 'Clean now',
            abandonedWorktree: entry,
          },
          secondaryActions: [{
            kind: 'copy-abandoned-worktree-command',
            label: 'Copy cmd',
            abandonedWorktree: entry,
          }],
        });
      }

      for (const entry of storageMetrics.local.reclaimableByRepo.filter((row) => row.totalReclaimableBytes >= ONE_GIB).slice(0, 3)) {
        const repoPath = entry.repoPath;
        const repoName = repoNameByPath.get(repoPath) ?? basenameFromPath(repoPath);
        items.push({
          id: `cleanup:reclaimable:${repoPath}`,
          title: `Reclaim ${formatGiB(entry.totalReclaimableBytes)} from ${repoName}`,
          reason: `node_modules ${formatGiB(entry.nodeModulesBytes)} • python envs ${formatGiB(entry.pythonEnvsBytes)} • abandoned worktrees ${entry.abandonedWorktreeCount}`,
          impactLabel: 'Disk pressure relief',
          score: 130 + Math.min(45, Math.round((entry.totalReclaimableBytes / ONE_GIB) * 6)),
          category: 'cleanup',
          primaryAction: {
            kind: 'copy-repo-cleanup-command',
            label: 'Copy cleanup cmd',
            repoPath,
          },
          secondaryActions: [{
            kind: 'open-terminal',
            label: 'Open terminal',
            repoPath,
          }],
        });
      }
    }

    const behindRepos = sourceRepos
      .map((repo) => ({ repo, behind: statusByPath[repo.path]?.behind ?? 0 }))
      .filter((row) => row.behind > 0)
      .sort((a, b) => b.behind - a.behind)
      .slice(0, 4);
    for (const { repo, behind } of behindRepos) {
      items.push({
        id: `sync:behind:${repo.path}`,
        title: `${repo.name} is ${behind} commit${behind === 1 ? '' : 's'} behind`,
        reason: 'Staying in sync early lowers rebase and conflict risk later in the day.',
        impactLabel: 'Merge risk reduction',
        score: 170 + Math.min(40, behind * 3),
        category: 'sync',
        primaryAction: {
          kind: 'open-repo-detail',
          label: 'Open repo',
          repoPath: repo.path,
        },
        secondaryActions: [{
          kind: 'open-terminal',
          label: 'Open terminal',
          repoPath: repo.path,
        }],
      });
    }

    const dirtyRepos = sourceRepos
      .map((repo) => ({
        repo,
        uncommitted:
          (statusByPath[repo.path]?.modifiedCount ?? 0) +
          (statusByPath[repo.path]?.stagedCount ?? 0) +
          (statusByPath[repo.path]?.untrackedCount ?? 0),
      }))
      .filter((row) => row.uncommitted > 0)
      .sort((a, b) => b.uncommitted - a.uncommitted)
      .slice(0, 4);
    for (const { repo, uncommitted } of dirtyRepos) {
      items.push({
        id: `changes:dirty:${repo.path}`,
        title: `Review ${uncommitted} uncommitted file${uncommitted === 1 ? '' : 's'} in ${repo.name}`,
        reason: 'Uncommitted local drift is easy to lose and hard to reason about later.',
        impactLabel: 'Context preservation',
        score: 140 + Math.min(30, uncommitted * 2),
        category: 'changes',
        primaryAction: {
          kind: 'open-repo-detail',
          label: 'Inspect changes',
          repoPath: repo.path,
        },
        secondaryActions: [{
          kind: 'new-session',
          label: 'New session',
          repoPath: repo.path,
        }],
      });
    }

    return items
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 12);
  }, [sourceRepos, statusByPath, storageMetrics, buildAbandonedWorktreeKey]);

  const visibleWorkflowQueueItems = useMemo(
    () =>
      workflowQueueItems
        .filter((item) => {
          if (dismissedWorkflowItemIdSet.has(item.id)) return false;
          return !(item.id in activeSnoozedUntilByWorkflowItemId);
        })
        .slice(0, WORKFLOW_QUEUE_LIMIT),
    [workflowQueueItems, dismissedWorkflowItemIdSet, activeSnoozedUntilByWorkflowItemId]
  );

  const hiddenWorkflowItemCount = useMemo(
    () =>
      workflowQueueItems.filter((item) =>
        dismissedWorkflowItemIdSet.has(item.id) || item.id in activeSnoozedUntilByWorkflowItemId
      ).length,
    [workflowQueueItems, dismissedWorkflowItemIdSet, activeSnoozedUntilByWorkflowItemId]
  );

  const handleDismissWorkflowItem = useCallback((itemId: string): void => {
    setDismissedWorkflowItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
    setWorkflowActionErrorsByItemId((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleSnoozeWorkflowItem = useCallback((itemId: string): void => {
    const until = new Date(Date.now() + WORKFLOW_SNOOZE_HOURS * 60 * 60 * 1000).toISOString();
    setSnoozedUntilByWorkflowItemId((current) => ({ ...current, [itemId]: until }));
    setWorkflowActionErrorsByItemId((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleResetWorkflowVisibility = useCallback((): void => {
    setDismissedWorkflowItemIds([]);
    setSnoozedUntilByWorkflowItemId({});
  }, []);

  const executeWorkflowAction = useCallback(async (
    itemId: string,
    action: WorkflowActionDefinition
  ): Promise<void> => {
    setWorkflowActionInFlightItemId(itemId);
    setWorkflowActionErrorsByItemId((current) => {
      if (!(itemId in current)) return current;
      const next = { ...current };
      delete next[itemId];
      return next;
    });

    try {
      if (action.kind === 'open-repo-detail') {
        if (!action.repoPath) throw new Error('No repository selected');
        openRepoDetail(action.repoPath);
      } else if (action.kind === 'open-terminal') {
        if (!action.repoPath) throw new Error('No repository selected');
        await window.api.shell?.openTerminal?.(action.repoPath);
      } else if (action.kind === 'new-session') {
        if (!action.repoPath) throw new Error('No repository selected');
        openCreateAgentWizardForRepo(action.repoPath);
      } else if (action.kind === 'copy-repo-cleanup-command') {
        if (!action.repoPath) throw new Error('No repository selected');
        await handleCopyCleanupCommand(action.repoPath);
      } else if (action.kind === 'copy-abandoned-worktree-command') {
        if (!action.abandonedWorktree) throw new Error('No abandoned worktree selected');
        await handleCopyAbandonedWorktreeCommand(action.abandonedWorktree);
      } else if (action.kind === 'clean-abandoned-worktree') {
        if (!action.abandonedWorktree) throw new Error('No abandoned worktree selected');
        const result = await handleCleanAbandonedWorktree(action.abandonedWorktree);
        if (!result.success) throw new Error(result.error || 'Failed to clean abandoned worktree');
        setDismissedWorkflowItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
      } else if (action.kind === 'clean-missing-worktree-refs') {
        await handleCleanMissingPathWorktreeRefs();
        setDismissedWorkflowItemIds((current) => (current.includes(itemId) ? current : [...current, itemId]));
      }
    } catch (error) {
      setWorkflowActionErrorsByItemId((current) => ({
        ...current,
        [itemId]: error instanceof Error ? error.message : 'Workflow action failed',
      }));
    } finally {
      setWorkflowActionInFlightItemId((current) => (current === itemId ? null : current));
    }
  }, [
    openRepoDetail,
    openCreateAgentWizardForRepo,
    handleCopyCleanupCommand,
    handleCopyAbandonedWorktreeCommand,
    handleCleanAbandonedWorktree,
    handleCleanMissingPathWorktreeRefs,
  ]);

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-surface" data-testid="workspace-browser">
      {/* Header */}
      <div className="border-b border-border bg-surface-secondary">
        <div className="p-4 pb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-text-primary">Workspaces</h1>
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border border-border bg-surface text-text-secondary">
                {activeWorkspace ? activeWorkspace.name : 'No active workspace'}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {sourceRepos.length === 0
                ? 'Add a workspace to discover repositories and workflow actions.'
                : `${sourceRepos.length} repositories${filter.trim() ? ` • ${filtered.length} visible` : ''}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="px-2.5 py-1.5 border border-border rounded-md bg-surface text-text-primary text-sm"
              value={activeId ?? ''}
              onChange={(e) => {
                const next = e.target.value || null;
                void handleSetActiveWorkspace(next);
              }}
              data-testid="workspace-switcher"
            >
              {workspaces.length === 0 && <option value="">— no workspaces —</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="text-sm px-3 py-1.5 border border-kanvas-blue rounded-md bg-kanvas-blue text-white hover:opacity-90"
              data-testid="add-workspace-button"
            >
              + Add local folder
            </button>
            <button
              type="button"
              onClick={() => activeId && void scanActive(activeId)}
              disabled={!activeId || loading}
              className="text-sm px-3 py-1.5 border border-border rounded-md text-text-primary bg-surface hover:bg-surface-tertiary disabled:opacity-50"
              data-testid="rescan-button"
            >
              {loading ? 'Scanning…' : 'Rescan'}
            </button>
          </div>
        </div>

        {/* Filter / sort bar */}
        <div className="px-4 pb-4">
          <div className="flex flex-wrap items-center gap-2 p-2 border border-border rounded-lg bg-surface">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter repos…"
              className="px-2.5 py-1.5 border border-border rounded-md bg-surface-secondary text-text-primary text-sm flex-1 min-w-[220px]"
              data-testid="repo-filter"
            />
            <label className="text-xs text-text-secondary px-1">Sort:</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as WorkspaceRepoSortKey)}
              className="px-2.5 py-1.5 border border-border rounded-md bg-surface-secondary text-text-primary text-sm"
              data-testid="sort-select"
            >
              <option value="priority">Priority score</option>
              <option value="last-touched">Last touched</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="size">Size</option>
            </select>
          </div>
        </div>

        {workspaces.length > 0 && (
          <div className="px-4 pb-4">
            <div
              className="p-2.5 border border-border rounded-lg bg-surface"
              data-testid="workspace-manager-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-text-primary">Workspace folders</p>
                  <span className="text-[11px] text-text-secondary">{workspaces.length} total</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceManagerExpanded((expanded) => !expanded)}
                  className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                  data-testid="workspace-manager-toggle"
                >
                  {workspaceManagerExpanded ? 'Done' : 'Manage'}
                </button>
              </div>
              {!workspaceManagerExpanded && activeWorkspace && (
                <div
                  className="mt-2 flex items-center justify-between gap-3 p-2 rounded border border-border bg-surface-secondary"
                  data-testid="workspace-manager-collapsed-summary"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">{activeWorkspace.name}</p>
                    <p className="text-[11px] text-text-secondary truncate">{activeWorkspace.path}</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded border border-border text-text-secondary">
                    Active
                  </span>
                </div>
              )}
              {workspaceManagerExpanded && (
                <>
                  <div className="mt-2 space-y-2" data-testid="workspace-manager-list">
                    {workspaces.map((workspace) => {
                      const isActiveWorkspace = workspace.id === activeId;
                      const isRemovingWorkspace = workspaceMutationPendingId === workspace.id;
                      return (
                        <div
                          key={workspace.id}
                          className="flex items-center justify-between gap-3 p-2 rounded border border-border bg-surface-secondary"
                          data-testid="workspace-manager-row"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary font-medium truncate">{workspace.name}</p>
                            <p className="text-[11px] text-text-secondary truncate">{workspace.path}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {isActiveWorkspace ? (
                              <span
                                className="text-[10px] px-2 py-1 rounded border border-border text-text-secondary"
                                data-testid={`workspace-manager-active-${workspace.id}`}
                              >
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleSetActiveWorkspace(workspace.id)}
                                className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                                data-testid={`workspace-manager-switch-${workspace.id}`}
                              >
                                Switch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleRemoveWorkspace(workspace.id)}
                              disabled={isRemovingWorkspace}
                              className="text-[11px] px-2 py-1 border border-red-500/40 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              data-testid={`workspace-manager-remove-${workspace.id}`}
                            >
                              {isRemovingWorkspace ? 'Removing…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-text-secondary">
                    Add any local folder (repo root or parent folder) via “+ Add local folder”.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {sourceRepos.length > 0 && (
          <div
            className="mb-4 p-4 border border-border rounded-xl bg-surface-secondary shadow-sm"
            data-testid="workflow-queue-panel"
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Daily workflow queue</h2>
                <p className="text-xs text-text-secondary">
                  Highest-leverage actions for this workspace right now.
                </p>
              </div>
              {hiddenWorkflowItemCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetWorkflowVisibility}
                  className="text-xs px-2.5 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                  data-testid="workflow-queue-reset"
                >
                  Show hidden ({hiddenWorkflowItemCount})
                </button>
              )}
            </div>

            {visibleWorkflowQueueItems.length === 0 ? (
              <p className="text-xs text-text-secondary" data-testid="workflow-queue-empty">
                Queue is clear. Hidden items can be restored with “Show hidden”.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleWorkflowQueueItems.map((item, index) => {
                  const inFlight = workflowActionInFlightItemId === item.id;
                  const actionError = workflowActionErrorsByItemId[item.id];
                  return (
                    <div
                      key={item.id}
                      className="p-3 border border-border rounded-lg bg-surface shadow-sm"
                      data-testid={`workflow-queue-item-${index}`}
                    >
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-secondary">
                              {workflowCategoryLabel(item.category)}
                            </span>
                            <span className="text-[10px] text-text-secondary">{item.impactLabel}</span>
                          </div>
                          <p className="text-sm font-medium text-text-primary">{item.title}</p>
                          <p className="text-xs text-text-secondary">{item.reason}</p>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => void executeWorkflowAction(item.id, item.primaryAction)}
                            disabled={inFlight}
                            className="text-[11px] px-2.5 py-1 rounded-md border border-kanvas-blue bg-kanvas-blue text-white hover:opacity-90 disabled:opacity-50"
                            data-testid={`workflow-queue-primary-${index}`}
                          >
                            {inFlight ? 'Running…' : item.primaryAction.label}
                          </button>
                          {(item.secondaryActions ?? []).slice(0, 2).map((secondaryAction, secondaryIndex) => (
                            <button
                              key={`${item.id}-secondary-${secondaryAction.kind}-${secondaryIndex}`}
                              type="button"
                              onClick={() => void executeWorkflowAction(item.id, secondaryAction)}
                              disabled={inFlight}
                              className="text-[11px] px-2 py-1 rounded-md border border-border text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                              data-testid={`workflow-queue-secondary-${index}-${secondaryIndex}`}
                            >
                              {secondaryAction.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleSnoozeWorkflowItem(item.id)}
                            disabled={inFlight}
                            className="text-[11px] px-2 py-1 rounded-md border border-border text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                            data-testid={`workflow-queue-snooze-${index}`}
                          >
                            Snooze
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissWorkflowItem(item.id)}
                            disabled={inFlight}
                            className="text-[11px] px-2 py-1 rounded-md border border-border text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                            data-testid={`workflow-queue-dismiss-${index}`}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      {actionError && (
                        <p
                          className="mt-2 text-[11px] text-red-500"
                          data-testid={`workflow-queue-error-${index}`}
                        >
                          {actionError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {sourceRepos.length > 0 && (
          <div
            className="mb-4 p-4 border border-border rounded-xl bg-surface-secondary shadow-sm"
            data-testid="storage-metrics-panel"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-text-primary">Disk &amp; Docker usage</h2>
              <button
                type="button"
                onClick={() => setStorageMetricsRefreshNonce((n) => n + 1)}
                disabled={storageMetricsLoading}
                className="text-xs px-2.5 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                data-testid="refresh-storage-metrics"
              >
                {storageMetricsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {storageMetricsLoading && (
              <p className="text-xs text-text-secondary">Analyzing Docker and local storage usage…</p>
            )}

            {!storageMetricsLoading && storageMetricsError && (
              <p className="text-xs text-red-500" data-testid="storage-metrics-error">
                {storageMetricsError}
              </p>
            )}

            {!storageMetricsLoading && storageMetrics && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-text-primary mb-1">Docker</p>
                    {storageMetrics.docker.available ? (
                      <div className="space-y-1 text-xs text-text-secondary">
                        <p data-testid="docker-images-metric">
                          {`${formatGiB(storageMetrics.docker.images.sizeBytes)} images (${storageMetrics.docker.images.reclaimablePercent ?? 0}% of total)`}
                        </p>
                        <p data-testid="docker-volumes-metric">
                          {`${formatGiB(storageMetrics.docker.localVolumes.sizeBytes)} local volumes (${storageMetrics.docker.localVolumes.reclaimablePercent ?? 0}% unused)`}
                        </p>
                        <p data-testid="docker-build-cache-metric">
                          {`${formatGiB(storageMetrics.docker.buildCache.sizeBytes)} build cache`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary">
                        Docker metrics unavailable{storageMetrics.docker.error ? `: ${storageMetrics.docker.error}` : ''}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-text-primary mb-1">Local storage</p>
                    <div className="space-y-1 text-xs text-text-secondary">
                      <p data-testid="local-node-modules-metric">
                        {`${formatGiB(storageMetrics.local.nodeModulesTotalBytes)} node_modules (${storageMetrics.local.nodeModulesByRepo.length} repos)`}
                      </p>
                      <p data-testid="local-python-metric">
                        {`${formatGiB(storageMetrics.local.pythonEnvsTotalBytes)} python envs (${storageMetrics.local.pythonEnvsByRepo.length} repos)`}
                      </p>
                    </div>

                    {(storageMetrics.local.nodeModulesByRepo.length > 0 || storageMetrics.local.pythonEnvsByRepo.length > 0) && (
                      <div className="mt-2 text-[11px] text-text-secondary space-y-1">
                        {storageMetrics.local.nodeModulesByRepo.slice(0, 3).map((entry) => (
                          <p key={`node-${entry.repoPath}`}>
                            {`node_modules: ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.bytes)}`}
                          </p>
                        ))}
                        {storageMetrics.local.pythonEnvsByRepo.slice(0, 3).map((entry) => (
                          <p key={`py-${entry.repoPath}`}>
                            {`python envs: ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.bytes)}`}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {topPriorityReclaimable.length > 0 && (
                  <div
                    className="pt-2 border-t border-border"
                    data-testid="top-priority-actions-section"
                  >
                    <p className="text-xs font-medium text-text-primary mb-1">Top priority actions</p>
                    <div className="space-y-2 text-xs text-text-secondary">
                      {topPriorityReclaimable.map((entry, index) => {
                        const cleanupCommand = buildCleanupCommand(entry.repoPath);
                        return (
                          <div
                            key={`top-action-${entry.repoPath}`}
                            className="flex flex-col gap-1"
                            data-testid={`top-priority-action-row-${index}`}
                          >
                            <p>
                              {`${index + 1}. ${basenameFromPath(entry.repoPath)} — reclaim ${formatGiB(entry.totalReclaimableBytes)}`}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCopyCleanupCommand(entry.repoPath)}
                                disabled={!cleanupCommand}
                                className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                                data-testid={`top-priority-action-copy-${index}`}
                              >
                                {copiedCleanupRepoPath === entry.repoPath ? 'Copied' : 'Copy cleanup cmd'}
                              </button>
                              <button
                                type="button"
                                onClick={() => window.api.shell?.openTerminal?.(entry.repoPath)}
                                className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                                data-testid={`top-priority-action-terminal-${index}`}
                              >
                                Open terminal
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {storageMetrics.local.reclaimableByRepo.length > 0 && (
                  <div
                    className="pt-2 border-t border-border"
                    data-testid="reclaimable-ranking-section"
                  >
                    <p className="text-xs font-medium text-text-primary mb-1">Reclaimable space ranking</p>
                    <div className="space-y-1 text-xs text-text-secondary">
                      {storageMetrics.local.reclaimableByRepo.slice(0, 5).map((entry, index) => (
                        <p
                          key={`reclaim-${entry.repoPath}`}
                          data-testid={`reclaimable-ranking-row-${index}`}
                        >
                          {`${index + 1}. ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.totalReclaimableBytes)} reclaimable`}
                          {` (node_modules ${formatGiB(entry.nodeModulesBytes)}, python ${formatGiB(entry.pythonEnvsBytes)}, abandoned worktrees ${entry.abandonedWorktreeCount})`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="pt-2 border-t border-border"
                  data-testid="abandoned-worktrees-section"
                >
                  <p className="text-xs font-medium text-text-primary mb-1">Abandoned worktrees</p>
                  {storageMetrics.local.abandonedWorktrees.length === 0 ? (
                    <p className="text-xs text-text-secondary">No abandoned worktrees detected.</p>
                  ) : (
                    <div className="space-y-1 text-xs text-text-secondary">
                      {storageMetrics.local.abandonedWorktrees.slice(0, 5).map((entry, index) => {
                        const worktreeKey = buildAbandonedWorktreeKey(entry);
                        const cleanupError = abandonedWorktreeErrors[worktreeKey];
                        const cleaningInProgress = cleaningAbandonedWorktreeKey === worktreeKey;

                        return (
                          <div
                            key={`abandoned-${entry.worktreePath}-${index}`}
                            className="space-y-1"
                            data-testid={`abandoned-worktree-row-${index}`}
                          >
                            <p>
                              {`${basenameFromPath(entry.repoPath)}:${entry.branch} — ${formatAbandonedReason(entry.reason)} • ${entry.exists ? formatDaysOld(entry.daysSinceLastTouched) : 'missing path'} • ${formatGiB(entry.bytes)}`}
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleCleanAbandonedWorktree(entry)}
                                disabled={cleaningInProgress}
                                className="text-[11px] px-2 py-1 border border-kanvas-blue rounded-md bg-kanvas-blue text-white hover:opacity-90 disabled:opacity-50"
                                data-testid={`abandoned-worktree-clean-${index}`}
                              >
                                {cleaningInProgress ? 'Cleaning…' : 'Clean now'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyAbandonedWorktreeCommand(entry)}
                                disabled={cleaningInProgress}
                                className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary disabled:opacity-50"
                                data-testid={`abandoned-worktree-copy-${index}`}
                              >
                                {copiedAbandonedWorktreeKey === worktreeKey ? 'Copied' : 'Copy cmd'}
                              </button>
                            </div>
                            {cleanupError && (
                              <p
                                className="text-[11px] text-red-500"
                                data-testid={`abandoned-worktree-error-${index}`}
                              >
                                {cleanupError}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-sm">
            {error}
          </div>
        )}
        {workspaces.length === 0 && recentReposFallback.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary" data-testid="empty-state-no-workspace">
            <p className="mb-3">No workspaces yet.</p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="px-3 py-1 bg-kanvas-blue text-white rounded text-sm"
            >
              Add your first workspace
            </button>
          </div>
        )}
        {showingFallback && (
          <div
            className="mb-3 p-3 border border-border rounded-lg bg-surface-secondary"
            data-testid="recent-repos-banner"
          >
            <p className="text-sm text-text-primary mb-2">
              Showing {recentReposFallback.length} repos from your recent sessions.
              Add a workspace to enable folder scanning + filesystem watching.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="text-sm px-3 py-1 bg-kanvas-blue text-white rounded"
              >
                + Add local folder
              </button>
              {fallbackParent && (
                <button
                  type="button"
                  onClick={() => void handlePinFallbackParent()}
                  className="text-sm px-3 py-1 border border-border rounded text-text-primary hover:bg-surface-tertiary"
                  data-testid="pin-parent-button"
                  title={`Create a workspace at ${fallbackParent}`}
                >
                  Pin {fallbackParent} as workspace
                </button>
              )}
            </div>
          </div>
        )}
        {workspaces.length > 0 && filtered.length === 0 && !loading && (
          <p className="text-text-secondary text-sm" data-testid="empty-state-no-repos">
            {repos.length === 0
              ? 'No git repositories found in this workspace.'
              : 'No repos match your filter.'}
          </p>
        )}
        {filtered.length > 0 && (
          <div
            className="border border-border rounded-xl bg-surface-secondary overflow-hidden shadow-sm"
            data-testid="repo-list"
          >
            <div className="grid grid-cols-[minmax(220px,2fr)_minmax(130px,0.9fr)_minmax(90px,0.7fr)_minmax(150px,0.9fr)_minmax(220px,1fr)_auto] gap-2 px-3 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-text-secondary bg-surface">
              <span>Repository</span>
              <span>Priority</span>
              <span>Health</span>
              <span>Sync</span>
              <span>Local state</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((repo, index) => {
                const status = statusByPath[repo.path] ?? null;
                const branch = status?.currentBranch || 'unknown';
                const ahead = status?.ahead ?? 0;
                const behind = status?.behind ?? 0;
                const staged = status?.stagedCount ?? 0;
                const modified = status?.modifiedCount ?? 0;
                const untracked = status?.untrackedCount ?? 0;
                const stashCount = status?.stashCount ?? 0;
                const worktreeCount = status?.worktreeCount ?? 0;
                const activeSessions = status?.activeSessionCount ?? 0;
                const worktreeModeLabel = status?.worktreeMode === 'in-place' ? 'In-place mode' : 'Worktree mode';
                const healthSnapshot = healthByRepoPath.get(repo.path) ?? {
                  healthScore: 100,
                  riskPoints: 0,
                  priority: 'healthy' as RepoPriorityLevel,
                };
                const priorityLabel = formatRepoPriorityLabel(healthSnapshot.priority);
                const priorityBadgeClassName = repoPriorityBadgeClasses(healthSnapshot.priority);
                const healthHint = healthSnapshot.healthScore >= 80
                  ? 'Stable'
                  : healthSnapshot.healthScore >= 60
                    ? 'Watch'
                    : 'Needs focus';

                return (
                  <div
                    key={repo.path}
                    className={`grid grid-cols-[minmax(220px,2fr)_minmax(130px,0.9fr)_minmax(90px,0.7fr)_minmax(150px,0.9fr)_minmax(220px,1fr)_auto] gap-2 px-3 py-3 items-start transition-colors hover:bg-surface-tertiary ${index % 2 === 0 ? 'bg-surface' : 'bg-surface-secondary'}`}
                    data-testid="repo-list-row"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => openRepoDetail(repo.path)}
                        className="text-sm font-semibold text-text-primary hover:underline text-left truncate"
                        data-testid={`repo-row-open-${index}`}
                      >
                        {repo.name}
                      </button>
                      <p className="text-xs text-text-secondary truncate">{repo.path}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border text-[10px] text-text-secondary">
                          {`Branch ${branch}`}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border text-[10px] text-text-secondary">
                          {worktreeModeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary space-y-1" data-testid="repo-row-priority">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${priorityBadgeClassName}`}
                        data-testid="repo-row-priority-badge"
                      >
                        {priorityLabel}
                      </span>
                      <p className="text-[11px]" data-testid="repo-row-risk">{`Risk ${healthSnapshot.riskPoints}`}</p>
                    </div>
                    <div className="text-xs text-text-secondary space-y-1" data-testid="repo-row-health">
                      <p className="text-text-primary font-semibold" data-testid="repo-row-health-score">
                        {healthSnapshot.healthScore}
                      </p>
                      <p className="text-[11px]">{healthHint}</p>
                    </div>

                    <div className="text-xs text-text-secondary space-y-1">
                      <p className="text-text-primary font-medium" data-testid="repo-row-sync">{`↓${behind} / ↑${ahead}`}</p>
                      <p className="text-[11px]">{`Stashes ${stashCount} • Worktrees ${worktreeCount}`}</p>
                    </div>
                    <div className="text-xs text-text-secondary space-y-1">
                      <p className="text-[11px]" data-testid="repo-row-changes">{`Staged ${staged} • Modified ${modified} • Untracked ${untracked}`}</p>
                      <p className="text-[11px]" data-testid="repo-row-sessions">{`Sessions ${activeSessions}`}</p>
                    </div>

                    <div className="flex flex-wrap gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => openRepoDetail(repo.path)}
                        className="text-[11px] px-2 py-1 border border-kanvas-blue rounded-md bg-kanvas-blue text-white hover:opacity-90"
                        data-testid={`repo-row-detail-${index}`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => window.api.shell?.openVSCode?.(repo.path)}
                        className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                        data-testid={`repo-row-ide-${index}`}
                      >
                        IDE
                      </button>
                      <button
                        type="button"
                        onClick={() => window.api.shell?.openTerminal?.(repo.path)}
                        className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                        data-testid={`repo-row-terminal-${index}`}
                      >
                        Terminal
                      </button>
                      <button
                        type="button"
                        onClick={() => openCreateAgentWizardForRepo(repo.path)}
                        className="text-[11px] px-2 py-1 border border-border rounded-md text-text-primary hover:bg-surface-tertiary"
                        data-testid={`repo-row-session-${index}`}
                      >
                        New session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AddWorkspaceDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => {
          void refreshWorkspaces();
        }}
      />
    </div>
  );
}
