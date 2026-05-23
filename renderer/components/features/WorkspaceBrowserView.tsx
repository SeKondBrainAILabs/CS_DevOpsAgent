/**
 * WorkspaceBrowserView (Epic A / story A5 — MVP)
 *
 * Top-level view rendered when `mainView === 'workspaces'`. Shows the
 * configured workspaces, a switcher, and a grid of RepoStatusCards
 * for the active workspace's discovered repos.
 *
 * Three inline tabs:
 *   Repos     — discovered repos grid/table
 *   Workflow  — daily workflow queue
 *   Storage   — disk metrics / Docker usage
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DiscoveredRepo,
  Workspace,
  WorkspaceRepoChangeEvent,
  StorageMetricsOverview,
  WorktreeSafetyInfo,
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

// ---------------------------------------------------------------------------
// Amy design system helpers (inline style objects — no new CSS files)
// ---------------------------------------------------------------------------

const amyCard: React.CSSProperties = {
  background: 'radial-gradient(circle at top left, #0f172a, #020617)',
  border: '1px solid rgba(30, 64, 175, 0.4)',
  borderRadius: '1.2rem',
  padding: '1rem',
};

const amyCardTitle: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  fontSize: '0.8rem',
  color: '#cbd5f5',
  fontWeight: 600,
};

const amyCardSubtitle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
};

const amyBodyText: React.CSSProperties = {
  color: '#e5e7eb',
  fontSize: '0.875rem',
};

const amyPrimaryBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
  boxShadow: '0 10px 25px rgba(37, 99, 235, 0.45)',
  borderRadius: '999px',
  border: 'none',
  color: '#fff',
  padding: '0.35rem 0.85rem',
  fontSize: '0.7rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const amyWarningBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
  boxShadow: '0 6px 18px rgba(217, 119, 6, 0.4)',
  borderRadius: '999px',
  border: 'none',
  color: '#fff',
  padding: '0.35rem 0.85rem',
  fontSize: '0.7rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const amyGhostBtn: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(30, 64, 175, 0.35)',
  borderRadius: '999px',
  color: '#cbd5e1',
  padding: '0.35rem 0.85rem',
  fontSize: '0.7rem',
  cursor: 'pointer',
};

// Tab-bar pill styles
const tabInactive: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(30, 64, 175, 0.3)',
  borderRadius: '999px',
  color: '#94a3b8',
  padding: '0.3rem 1rem',
  fontSize: '0.8rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const tabActive: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
  border: 'none',
  borderRadius: '999px',
  color: '#fff',
  padding: '0.3rem 1rem',
  fontSize: '0.8rem',
  cursor: 'pointer',
  fontWeight: 600,
  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.5)',
};

// ---------------------------------------------------------------------------
// Worktree safety badge sub-component
// ---------------------------------------------------------------------------

interface WorktreeSafetyBadgesProps {
  worktreePath: string;
  safetyInfo: WorktreeSafetyInfo | undefined;
  loading: boolean;
}

function WorktreeSafetyBadges({ worktreePath: _worktreePath, safetyInfo, loading }: WorktreeSafetyBadgesProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <span style={{ ...amyCardSubtitle, fontSize: '0.68rem' }}>
        Checking safety…
      </span>
    );
  }
  if (!safetyInfo) return <></>;

  const isSafe = !safetyInfo.hasUncommittedChanges && safetyInfo.unmergedCommitCount === 0;

  return (
    <div style={{ marginTop: '0.4rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
        {/* Uncommitted changes badge */}
        {safetyInfo.hasUncommittedChanges ? (
          <span style={{
            fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171',
          }}>
            {safetyInfo.uncommittedFiles.length} uncommitted file{safetyInfo.uncommittedFiles.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span style={{
            fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)',
            color: '#34d399',
          }}>
            Clean
          </span>
        )}

        {/* Merge safety badge */}
        {safetyInfo.unmergedCommitCount === 0 ? (
          <span style={{
            fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)',
            color: '#34d399',
          }}>
            Fully merged
          </span>
        ) : (
          <span style={{
            fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171',
          }}>
            {safetyInfo.unmergedCommitCount} unmerged commit{safetyInfo.unmergedCommitCount === 1 ? '' : 's'}
          </span>
        )}

        {!isSafe && <span style={{ ...amyCardSubtitle, fontSize: '0.68rem' }}>
          merged into: {safetyInfo.mergedIntoBranches.length > 0 ? safetyInfo.mergedIntoBranches.join(', ') : 'none'}
        </span>}
      </div>

      {safetyInfo.hasUncommittedChanges && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ ...amyGhostBtn, marginTop: '0.35rem', fontSize: '0.68rem' }}
        >
          {expanded ? 'Hide changes' : 'View changes'}
        </button>
      )}

      {expanded && safetyInfo.uncommittedFiles.length > 0 && (
        <div style={{
          marginTop: '0.4rem',
          background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(30,64,175,0.2)',
          borderRadius: '0.6rem',
          padding: '0.5rem 0.75rem',
          maxHeight: '10rem',
          overflowY: 'auto',
        }}>
          {safetyInfo.uncommittedFiles.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.68rem', color: '#e5e7eb', padding: '0.1rem 0' }}>
              <span style={{ color: '#94a3b8', fontFamily: 'monospace', minWidth: '2rem' }}>{f.status}</span>
              <span style={{ fontFamily: 'monospace' }}>{f.path}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  const [statusByPath, setStatusByPath] = useState<Record<string, RepoStatusBlock>>({});
  const [recentReposFallback, setRecentReposFallback] = useState<DiscoveredRepo[]>([]);
  // Tab state
  const [activeTab, setActiveTab] = useState<'repos' | 'workflow' | 'storage'>('repos');
  // Worktree safety info keyed by worktree path
  const [worktreeSafetyByPath, setWorktreeSafetyByPath] = useState<Map<string, WorktreeSafetyInfo>>(new Map());
  const [worktreeSafetyLoadingPaths, setWorktreeSafetyLoadingPaths] = useState<Set<string>>(new Set());
  // Confirmation state for unsafe "Clean now" actions (key = worktreeKey)
  const [confirmCleanWorktreeKey, setConfirmCleanWorktreeKey] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    const listRes = await window.api.workspace.list();
    const list = listRes.success && listRes.data ? listRes.data : [];
    if (listRes.success) setWorkspaces(list);

    const activeRes = await window.api.workspace.getActive();
    if (activeRes.success && activeRes.data) setActiveId(activeRes.data.id);
    else if (list.length) setActiveId(list[0].id);

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

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  useEffect(() => {
    if (!activeId) {
      setRepos([]);
      return;
    }
    void scanActive(activeId);
    void window.api.workspace.startWatching(activeId);
  }, [activeId, scanActive]);

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
          // ignore
        }
      }
      if (!cancelled) setStatusByPath((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [repos, recentReposFallback, workspaces.length]);

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
      return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [sourceRepos, storageMetricsRefreshNonce]);

  // Fetch worktree safety info for stale-no-session abandoned worktrees
  useEffect(() => {
    if (!storageMetrics) return;
    let cancelled = false;
    const staleEntries = storageMetrics.local.abandonedWorktrees.filter(
      (e) => e.reason === 'stale-no-session' && e.exists
    );

    for (const entry of staleEntries) {
      const wtp = entry.worktreePath;
      if (worktreeSafetyByPath.has(wtp) || worktreeSafetyLoadingPaths.has(wtp)) continue;

      setWorktreeSafetyLoadingPaths((prev) => new Set([...prev, wtp]));

      window.api.git.getWorktreeSafetyInfo(wtp).then((res) => {
        if (cancelled) return;
        setWorktreeSafetyLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(wtp);
          return next;
        });
        if (res.success && res.data) {
          setWorktreeSafetyByPath((prev) => {
            const next = new Map(prev);
            next.set(wtp, res.data!);
            return next;
          });
        }
      }).catch(() => {
        if (cancelled) return;
        setWorktreeSafetyLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(wtp);
          return next;
        });
      });
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMetrics]);

  const fallbackParent = useMemo(
    () => (showingFallback ? commonParent(recentReposFallback.map((r) => r.path)) : null),
    [showingFallback, recentReposFallback, commonParent]
  );
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0] ?? null,
    [workspaces, activeId]
  );
  const handleSetActiveWorkspace = useCallback(async (nextWorkspaceId: string | null): Promise<void> => {
    setError(null);
    setActiveId(nextWorkspaceId);
    const result = await window.api.workspace.setActive(nextWorkspaceId);
    if (!result.success) {
      setError(result.error?.message || 'Failed to switch workspace');
    }
  }, []);

  const handleRemoveWorkspace = useCallback(async (workspaceId: string): Promise<void> => {
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

  const buildAbandonedWorktreeKey = useCallback((entry: AbandonedWorktreeEntry): string =>
    `${entry.repoPath}::${entry.worktreePath}::${entry.reason}`, []);

  const buildAbandonedWorktreeCleanupCommand = useCallback((entry: AbandonedWorktreeEntry): string => {
    const repoPath = shellQuote(entry.repoPath);
    if (entry.reason === 'missing-path') {
      return `git -C ${repoPath} worktree prune`;
    }
    const worktreePath = shellQuote(entry.worktreePath);
    return `git -C ${repoPath} worktree remove --force ${worktreePath} && git -C ${repoPath} worktree prune`;
  }, []);

  const handleCopyAbandonedWorktreeCommand = useCallback(async (entry: AbandonedWorktreeEntry): Promise<void> => {
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

  const runWorktreeCleanup = useCallback(async (entries: AbandonedWorktreeEntry[]): Promise<void> => {
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
    const missingPathEntries = storageMetrics.local.abandonedWorktrees.filter((entry) => entry.reason === 'missing-path');
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
      const missingPathEntries = storageMetrics.local.abandonedWorktrees.filter((entry) => entry.reason === 'missing-path');
      const missingPathRepoCount = new Set(missingPathEntries.map((entry) => entry.repoPath)).size;

      if (missingPathRepoCount > 0) {
        items.push({
          id: 'cleanup:missing-path-refs',
          title: `Prune missing worktree refs in ${missingPathRepoCount} repo${missingPathRepoCount === 1 ? '' : 's'}`,
          reason: `${missingPathEntries.length} stale worktree reference${missingPathEntries.length === 1 ? '' : 's'} point to directories that no longer exist.`,
          impactLabel: 'Safe cleanup',
          score: 250 + missingPathEntries.length * 10,
          category: 'cleanup',
          primaryAction: { kind: 'clean-missing-worktree-refs', label: 'Clean safe refs' },
          secondaryActions: [{ kind: 'open-terminal', label: 'Open terminal', repoPath: missingPathEntries[0]?.repoPath }],
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
          primaryAction: { kind: 'clean-abandoned-worktree', label: 'Clean now', abandonedWorktree: entry },
          secondaryActions: [{ kind: 'copy-abandoned-worktree-command', label: 'Copy cmd', abandonedWorktree: entry }],
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
          primaryAction: { kind: 'copy-repo-cleanup-command', label: 'Copy cleanup cmd', repoPath },
          secondaryActions: [{ kind: 'open-terminal', label: 'Open terminal', repoPath }],
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
        primaryAction: { kind: 'open-repo-detail', label: 'Open repo', repoPath: repo.path },
        secondaryActions: [{ kind: 'open-terminal', label: 'Open terminal', repoPath: repo.path }],
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
        primaryAction: { kind: 'open-repo-detail', label: 'Inspect changes', repoPath: repo.path },
        secondaryActions: [{ kind: 'new-session', label: 'New session', repoPath: repo.path }],
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
    action: WorkflowActionDefinition,
    force?: boolean
  ): Promise<void> => {
    // Safety gate: if this is a clean action for an abandoned worktree and not safe, require confirmation
    if (action.kind === 'clean-abandoned-worktree' && action.abandonedWorktree && !force) {
      const wtp = action.abandonedWorktree.worktreePath;
      const info = worktreeSafetyByPath.get(wtp);
      if (info && (info.hasUncommittedChanges || info.unmergedCommitCount > 0)) {
        setConfirmCleanWorktreeKey(buildAbandonedWorktreeKey(action.abandonedWorktree));
        return;
      }
    }

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
    worktreeSafetyByPath,
    buildAbandonedWorktreeKey,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col" style={{ background: '#020617' }} data-testid="workspace-browser">
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(30,64,175,0.3)', background: 'rgba(15,23,42,0.9)' }}>
        <div className="p-4 pb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ ...amyCardTitle, fontSize: '1rem' }}>Workspaces</h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.6rem',
                fontSize: '0.7rem', borderRadius: '999px',
                border: '1px solid rgba(30,64,175,0.4)', color: '#9ca3af',
              }}>
                {activeWorkspace ? activeWorkspace.name : 'No active workspace'}
              </span>
            </div>
            <p style={amyCardSubtitle}>
              {sourceRepos.length === 0
                ? 'Add a workspace to discover repositories and workflow actions.'
                : `${sourceRepos.length} repositories${filter.trim() ? ` • ${filtered.length} visible` : ''}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              style={{
                padding: '0.35rem 0.7rem',
                border: '1px solid rgba(30,64,175,0.4)',
                borderRadius: '0.5rem',
                background: 'rgba(15,23,42,0.8)',
                color: '#e5e7eb',
                fontSize: '0.8rem',
              }}
              value={activeId ?? ''}
              onChange={(e) => {
                const next = e.target.value || null;
                void handleSetActiveWorkspace(next);
              }}
              data-testid="workspace-switcher"
            >
              {workspaces.length === 0 && <option value="">— no workspaces —</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={amyPrimaryBtn}
              data-testid="add-workspace-button"
            >
              + Add local folder
            </button>
            <button
              type="button"
              onClick={() => activeId && void scanActive(activeId)}
              disabled={!activeId || loading}
              style={{ ...amyGhostBtn, opacity: (!activeId || loading) ? 0.5 : 1 }}
              data-testid="rescan-button"
            >
              {loading ? 'Scanning…' : 'Rescan'}
            </button>
          </div>
        </div>

        {/* Workspace manager panel */}
        {workspaces.length > 0 && (
          <div className="px-4 pb-3">
            <div style={{ ...amyCard, padding: '0.6rem 0.85rem' }} data-testid="workspace-manager-panel">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p style={{ ...amyCardTitle, fontSize: '0.72rem' }}>Workspace folders</p>
                  <span style={amyCardSubtitle}>{workspaces.length} total</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWorkspaceManagerExpanded((expanded) => !expanded)}
                  style={amyGhostBtn}
                  data-testid="workspace-manager-toggle"
                >
                  {workspaceManagerExpanded ? 'Done' : 'Manage'}
                </button>
              </div>
              {!workspaceManagerExpanded && activeWorkspace && (
                <div
                  style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: '0.6rem', border: '1px solid rgba(30,64,175,0.25)', background: 'rgba(15,23,42,0.6)' }}
                  data-testid="workspace-manager-collapsed-summary"
                >
                  <div className="min-w-0">
                    <p style={{ ...amyBodyText, fontWeight: 600 }} className="truncate">{activeWorkspace.name}</p>
                    <p style={amyCardSubtitle} className="truncate">{activeWorkspace.path}</p>
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid rgba(30,64,175,0.35)', color: '#94a3b8' }}>Active</span>
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
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.4rem 0.6rem', borderRadius: '0.6rem', border: '1px solid rgba(30,64,175,0.25)', background: 'rgba(15,23,42,0.6)' }}
                          data-testid="workspace-manager-row"
                        >
                          <div className="min-w-0">
                            <p style={{ ...amyBodyText, fontWeight: 600 }} className="truncate">{workspace.name}</p>
                            <p style={amyCardSubtitle} className="truncate">{workspace.path}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {isActiveWorkspace ? (
                              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', borderRadius: '999px', border: '1px solid rgba(30,64,175,0.35)', color: '#94a3b8' }} data-testid={`workspace-manager-active-${workspace.id}`}>
                                Active
                              </span>
                            ) : (
                              <button type="button" onClick={() => void handleSetActiveWorkspace(workspace.id)} style={amyGhostBtn} data-testid={`workspace-manager-switch-${workspace.id}`}>
                                Switch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleRemoveWorkspace(workspace.id)}
                              disabled={isRemovingWorkspace}
                              style={{ ...amyGhostBtn, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', opacity: isRemovingWorkspace ? 0.5 : 1 }}
                              data-testid={`workspace-manager-remove-${workspace.id}`}
                            >
                              {isRemovingWorkspace ? 'Removing…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ ...amyCardSubtitle, marginTop: '0.5rem', fontSize: '0.68rem' }}>
                    Add any local folder (repo root or parent folder) via "+ Add local folder".
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem 0.75rem' }}>
          <button type="button" style={activeTab === 'repos' ? tabActive : tabInactive} onClick={() => setActiveTab('repos')}>
            Repos
          </button>
          <button type="button" style={activeTab === 'workflow' ? tabActive : tabInactive} onClick={() => setActiveTab('workflow')}>
            Workflow
          </button>
          <button type="button" style={activeTab === 'storage' ? tabActive : tabInactive} onClick={() => setActiveTab('storage')}>
            Storage
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        {error && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* ===== REPOS TAB ===== */}
        {activeTab === 'repos' && (
          <>
            {/* Filter / sort bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', border: '1px solid rgba(30,64,175,0.3)', borderRadius: '0.75rem', background: 'rgba(15,23,42,0.6)' }}>
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter repos…"
                  style={{ padding: '0.35rem 0.65rem', border: '1px solid rgba(30,64,175,0.35)', borderRadius: '0.5rem', background: 'rgba(15,23,42,0.8)', color: '#e5e7eb', fontSize: '0.8rem', flex: '1', minWidth: '200px' }}
                  data-testid="repo-filter"
                />
                <label style={amyCardSubtitle}>Sort:</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as WorkspaceRepoSortKey)}
                  style={{ padding: '0.35rem 0.65rem', border: '1px solid rgba(30,64,175,0.35)', borderRadius: '0.5rem', background: 'rgba(15,23,42,0.8)', color: '#e5e7eb', fontSize: '0.8rem' }}
                  data-testid="sort-select"
                >
                  <option value="priority">Priority score</option>
                  <option value="last-touched">Last touched</option>
                  <option value="alphabetical">Alphabetical</option>
                  <option value="size">Size</option>
                </select>
              </div>
            </div>

            {workspaces.length === 0 && recentReposFallback.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '12rem', color: '#9ca3af' }} data-testid="empty-state-no-workspace">
                <p style={{ marginBottom: '0.75rem' }}>No workspaces yet.</p>
                <button type="button" onClick={() => setShowAdd(true)} style={amyPrimaryBtn}>
                  Add your first workspace
                </button>
              </div>
            )}

            {showingFallback && (
              <div style={{ ...amyCard, marginBottom: '1rem' }} data-testid="recent-repos-banner">
                <p style={{ ...amyBodyText, marginBottom: '0.5rem' }}>
                  Showing {recentReposFallback.length} repos from your recent sessions.
                  Add a workspace to enable folder scanning + filesystem watching.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setShowAdd(true)} style={amyPrimaryBtn}>
                    + Add local folder
                  </button>
                  {fallbackParent && (
                    <button
                      type="button"
                      onClick={() => void handlePinFallbackParent()}
                      style={amyGhostBtn}
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
              <p style={amyCardSubtitle} data-testid="empty-state-no-repos">
                {repos.length === 0 ? 'No git repositories found in this workspace.' : 'No repos match your filter.'}
              </p>
            )}

            {filtered.length > 0 && (
              <div style={{ border: '1px solid rgba(30,64,175,0.35)', borderRadius: '1.2rem', overflow: 'hidden', background: 'radial-gradient(circle at top left, #0f172a, #020617)' }} data-testid="repo-list">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) minmax(130px,0.9fr) minmax(90px,0.7fr) minmax(150px,0.9fr) minmax(220px,1fr) auto', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(30,64,175,0.2)', ...amyCardTitle }}>
                  <span>Repository</span>
                  <span>Priority</span>
                  <span>Health</span>
                  <span>Sync</span>
                  <span>Local state</span>
                  <span>Actions</span>
                </div>
                <div>
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
                    const healthSnapshot = healthByRepoPath.get(repo.path) ?? { healthScore: 100, riskPoints: 0, priority: 'healthy' as RepoPriorityLevel };
                    const priorityLabel = formatRepoPriorityLabel(healthSnapshot.priority);
                    const priorityBadgeClassName = repoPriorityBadgeClasses(healthSnapshot.priority);
                    const healthHint = healthSnapshot.healthScore >= 80 ? 'Stable' : healthSnapshot.healthScore >= 60 ? 'Watch' : 'Needs focus';

                    return (
                      <div
                        key={repo.path}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) minmax(130px,0.9fr) minmax(90px,0.7fr) minmax(150px,0.9fr) minmax(220px,1fr) auto', gap: '0.5rem', padding: '0.65rem 0.75rem', alignItems: 'start', borderBottom: index < filtered.length - 1 ? '1px solid rgba(30,64,175,0.15)' : 'none', background: index % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'transparent' }}
                        data-testid="repo-list-row"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => openRepoDetail(repo.path)}
                            style={{ ...amyBodyText, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                            className="truncate hover:underline"
                            data-testid={`repo-row-open-${index}`}
                          >
                            {repo.name}
                          </button>
                          <p style={amyCardSubtitle} className="truncate">{repo.path}</p>
                          <div style={{ marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', border: '1px solid rgba(30,64,175,0.3)', color: '#94a3b8' }}>
                              {`Branch ${branch}`}
                            </span>
                            <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '999px', border: '1px solid rgba(30,64,175,0.3)', color: '#94a3b8' }}>
                              {worktreeModeLabel}
                            </span>
                          </div>
                        </div>
                        <div style={amyCardSubtitle} data-testid="repo-row-priority">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${priorityBadgeClassName}`} data-testid="repo-row-priority-badge">
                            {priorityLabel}
                          </span>
                          <p style={{ fontSize: '0.68rem', marginTop: '0.2rem' }} data-testid="repo-row-risk">{`Risk ${healthSnapshot.riskPoints}`}</p>
                        </div>
                        <div style={amyCardSubtitle} data-testid="repo-row-health">
                          <p style={{ ...amyBodyText, fontWeight: 700 }} data-testid="repo-row-health-score">{healthSnapshot.healthScore}</p>
                          <p style={{ fontSize: '0.68rem' }}>{healthHint}</p>
                        </div>
                        <div style={amyCardSubtitle}>
                          <p style={{ ...amyBodyText, fontWeight: 600 }} data-testid="repo-row-sync">{`↓${behind} / ↑${ahead}`}</p>
                          <p style={{ fontSize: '0.68rem' }}>{`Stashes ${stashCount} • Worktrees ${worktreeCount}`}</p>
                        </div>
                        <div style={amyCardSubtitle}>
                          <p style={{ fontSize: '0.68rem' }} data-testid="repo-row-changes">{`Staged ${staged} • Modified ${modified} • Untracked ${untracked}`}</p>
                          <p style={{ fontSize: '0.68rem' }} data-testid="repo-row-sessions">{`Sessions ${activeSessions}`}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => openRepoDetail(repo.path)} style={amyPrimaryBtn} data-testid={`repo-row-detail-${index}`}>Open</button>
                          <button type="button" onClick={() => window.api.shell?.openVSCode?.(repo.path)} style={amyGhostBtn} data-testid={`repo-row-ide-${index}`}>IDE</button>
                          <button type="button" onClick={() => window.api.shell?.openTerminal?.(repo.path)} style={amyGhostBtn} data-testid={`repo-row-terminal-${index}`}>Terminal</button>
                          <button type="button" onClick={() => openCreateAgentWizardForRepo(repo.path)} style={amyGhostBtn} data-testid={`repo-row-session-${index}`}>New session</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== WORKFLOW TAB ===== */}
        {activeTab === 'workflow' && (
          <div data-testid="workflow-queue-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
              <div>
                <h2 style={amyCardTitle}>Daily workflow queue</h2>
                <p style={amyCardSubtitle}>Highest-leverage actions for this workspace right now.</p>
              </div>
              {hiddenWorkflowItemCount > 0 && (
                <button type="button" onClick={handleResetWorkflowVisibility} style={amyGhostBtn} data-testid="workflow-queue-reset">
                  Show hidden ({hiddenWorkflowItemCount})
                </button>
              )}
            </div>

            {sourceRepos.length === 0 ? (
              <div style={{ ...amyCard, textAlign: 'center' }}>
                <p style={amyCardSubtitle}>Add a workspace to see workflow actions.</p>
              </div>
            ) : visibleWorkflowQueueItems.length === 0 ? (
              <p style={amyCardSubtitle} data-testid="workflow-queue-empty">
                Queue is clear. Hidden items can be restored with "Show hidden".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {visibleWorkflowQueueItems.map((item, index) => {
                  const inFlight = workflowActionInFlightItemId === item.id;
                  const actionError = workflowActionErrorsByItemId[item.id];

                  // For abandoned worktree cleanup items, extract entry + safety info
                  const isAbandonedCleanup = item.primaryAction.kind === 'clean-abandoned-worktree';
                  const abandEntry = item.primaryAction.abandonedWorktree;
                  const wtp = abandEntry?.worktreePath;
                  const safetyInfo = wtp ? worktreeSafetyByPath.get(wtp) : undefined;
                  const safetyLoading = wtp ? worktreeSafetyLoadingPaths.has(wtp) : false;
                  const worktreeKey = abandEntry ? buildAbandonedWorktreeKey(abandEntry) : '';
                  const isSafe = safetyInfo && !safetyInfo.hasUncommittedChanges && safetyInfo.unmergedCommitCount === 0;
                  const confirmingThisItem = confirmCleanWorktreeKey === worktreeKey;

                  return (
                    <div
                      key={item.id}
                      style={amyCard}
                      data-testid={`workflow-queue-item-${index}`}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div className="min-w-0">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: '999px', border: '1px solid rgba(30,64,175,0.4)', color: '#94a3b8' }}>
                                {workflowCategoryLabel(item.category)}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{item.impactLabel}</span>
                            </div>
                            <p style={{ ...amyBodyText, fontWeight: 600 }}>{item.title}</p>
                            <p style={amyCardSubtitle}>{item.reason}</p>

                            {/* Safety badges for abandoned worktree items */}
                            {isAbandonedCleanup && wtp && (
                              <WorktreeSafetyBadges
                                worktreePath={wtp}
                                safetyInfo={safetyInfo}
                                loading={safetyLoading}
                              />
                            )}
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {/* Primary action button — changes colour based on safety */}
                            {confirmingThisItem ? (
                              <>
                                <span style={{ fontSize: '0.7rem', color: '#fbbf24', alignSelf: 'center' }}>Unsafe — confirm?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setConfirmCleanWorktreeKey(null);
                                    await executeWorkflowAction(item.id, item.primaryAction, true);
                                  }}
                                  disabled={inFlight}
                                  style={{ ...amyWarningBtn, opacity: inFlight ? 0.5 : 1 }}
                                  data-testid={`workflow-queue-primary-${index}`}
                                >
                                  {inFlight ? 'Running…' : 'Confirm clean'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmCleanWorktreeKey(null)}
                                  style={amyGhostBtn}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void executeWorkflowAction(item.id, item.primaryAction)}
                                disabled={inFlight}
                                style={{
                                  ...(isAbandonedCleanup && safetyInfo && !isSafe ? amyWarningBtn : amyPrimaryBtn),
                                  opacity: inFlight ? 0.5 : 1,
                                }}
                                data-testid={`workflow-queue-primary-${index}`}
                              >
                                {inFlight ? 'Running…' : item.primaryAction.label}
                              </button>
                            )}
                            {(item.secondaryActions ?? []).slice(0, 2).map((secondaryAction, secondaryIndex) => (
                              <button
                                key={`${item.id}-secondary-${secondaryAction.kind}-${secondaryIndex}`}
                                type="button"
                                onClick={() => void executeWorkflowAction(item.id, secondaryAction)}
                                disabled={inFlight}
                                style={{ ...amyGhostBtn, opacity: inFlight ? 0.5 : 1 }}
                                data-testid={`workflow-queue-secondary-${index}-${secondaryIndex}`}
                              >
                                {secondaryAction.label}
                              </button>
                            ))}
                            <button type="button" onClick={() => handleSnoozeWorkflowItem(item.id)} disabled={inFlight} style={{ ...amyGhostBtn, opacity: inFlight ? 0.5 : 1 }} data-testid={`workflow-queue-snooze-${index}`}>
                              Snooze
                            </button>
                            <button type="button" onClick={() => handleDismissWorkflowItem(item.id)} disabled={inFlight} style={{ ...amyGhostBtn, opacity: inFlight ? 0.5 : 1 }} data-testid={`workflow-queue-dismiss-${index}`}>
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                      {actionError && (
                        <p style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: '#f87171' }} data-testid={`workflow-queue-error-${index}`}>
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

        {/* ===== STORAGE TAB ===== */}
        {activeTab === 'storage' && (
          <div data-testid="storage-metrics-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={amyCardTitle}>Disk &amp; Docker usage</h2>
              <button type="button" onClick={() => setStorageMetricsRefreshNonce((n) => n + 1)} disabled={storageMetricsLoading} style={{ ...amyGhostBtn, opacity: storageMetricsLoading ? 0.5 : 1 }} data-testid="refresh-storage-metrics">
                {storageMetricsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {storageMetricsLoading && (
              <p style={amyCardSubtitle}>Analyzing Docker and local storage usage…</p>
            )}

            {!storageMetricsLoading && storageMetricsError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem' }} data-testid="storage-metrics-error">{storageMetricsError}</p>
            )}

            {!storageMetricsLoading && storageMetrics && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Docker + Local side-by-side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={amyCard}>
                    <p style={{ ...amyCardTitle, marginBottom: '0.5rem' }}>Docker</p>
                    {storageMetrics.docker.available ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <p style={amyBodyText} data-testid="docker-images-metric">{`${formatGiB(storageMetrics.docker.images.sizeBytes)} images (${storageMetrics.docker.images.reclaimablePercent ?? 0}% of total)`}</p>
                        <p style={amyBodyText} data-testid="docker-volumes-metric">{`${formatGiB(storageMetrics.docker.localVolumes.sizeBytes)} local volumes (${storageMetrics.docker.localVolumes.reclaimablePercent ?? 0}% unused)`}</p>
                        <p style={amyBodyText} data-testid="docker-build-cache-metric">{`${formatGiB(storageMetrics.docker.buildCache.sizeBytes)} build cache`}</p>
                      </div>
                    ) : (
                      <p style={amyCardSubtitle}>Docker metrics unavailable{storageMetrics.docker.error ? `: ${storageMetrics.docker.error}` : ''}</p>
                    )}
                  </div>

                  <div style={amyCard}>
                    <p style={{ ...amyCardTitle, marginBottom: '0.5rem' }}>Local storage</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <p style={amyBodyText} data-testid="local-node-modules-metric">{`${formatGiB(storageMetrics.local.nodeModulesTotalBytes)} node_modules (${storageMetrics.local.nodeModulesByRepo.length} repos)`}</p>
                      <p style={amyBodyText} data-testid="local-python-metric">{`${formatGiB(storageMetrics.local.pythonEnvsTotalBytes)} python envs (${storageMetrics.local.pythonEnvsByRepo.length} repos)`}</p>
                    </div>
                    {(storageMetrics.local.nodeModulesByRepo.length > 0 || storageMetrics.local.pythonEnvsByRepo.length > 0) && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {storageMetrics.local.nodeModulesByRepo.slice(0, 3).map((entry) => (
                          <p key={`node-${entry.repoPath}`} style={amyCardSubtitle}>{`node_modules: ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.bytes)}`}</p>
                        ))}
                        {storageMetrics.local.pythonEnvsByRepo.slice(0, 3).map((entry) => (
                          <p key={`py-${entry.repoPath}`} style={amyCardSubtitle}>{`python envs: ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.bytes)}`}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top priority actions */}
                {topPriorityReclaimable.length > 0 && (
                  <div style={amyCard} data-testid="top-priority-actions-section">
                    <p style={{ ...amyCardTitle, marginBottom: '0.5rem' }}>Top priority actions</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {topPriorityReclaimable.map((entry, index) => {
                        const cleanupCommand = buildCleanupCommand(entry.repoPath);
                        return (
                          <div key={`top-action-${entry.repoPath}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }} data-testid={`top-priority-action-row-${index}`}>
                            <p style={amyBodyText}>{`${index + 1}. ${basenameFromPath(entry.repoPath)} — reclaim ${formatGiB(entry.totalReclaimableBytes)}`}</p>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button type="button" onClick={() => void handleCopyCleanupCommand(entry.repoPath)} disabled={!cleanupCommand} style={{ ...amyGhostBtn, opacity: !cleanupCommand ? 0.5 : 1 }} data-testid={`top-priority-action-copy-${index}`}>
                                {copiedCleanupRepoPath === entry.repoPath ? 'Copied' : 'Copy cleanup cmd'}
                              </button>
                              <button type="button" onClick={() => window.api.shell?.openTerminal?.(entry.repoPath)} style={amyGhostBtn} data-testid={`top-priority-action-terminal-${index}`}>
                                Open terminal
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Reclaimable ranking */}
                {storageMetrics.local.reclaimableByRepo.length > 0 && (
                  <div style={amyCard} data-testid="reclaimable-ranking-section">
                    <p style={{ ...amyCardTitle, marginBottom: '0.5rem' }}>Reclaimable space ranking</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {storageMetrics.local.reclaimableByRepo.slice(0, 5).map((entry, index) => (
                        <p key={`reclaim-${entry.repoPath}`} style={amyBodyText} data-testid={`reclaimable-ranking-row-${index}`}>
                          {`${index + 1}. ${basenameFromPath(entry.repoPath)} — ${formatGiB(entry.totalReclaimableBytes)} reclaimable`}
                          {` (node_modules ${formatGiB(entry.nodeModulesBytes)}, python ${formatGiB(entry.pythonEnvsBytes)}, abandoned worktrees ${entry.abandonedWorktreeCount})`}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Abandoned worktrees */}
                <div style={amyCard} data-testid="abandoned-worktrees-section">
                  <p style={{ ...amyCardTitle, marginBottom: '0.5rem' }}>Abandoned worktrees</p>
                  {storageMetrics.local.abandonedWorktrees.length === 0 ? (
                    <p style={amyCardSubtitle}>No abandoned worktrees detected.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {storageMetrics.local.abandonedWorktrees.slice(0, 5).map((entry, index) => {
                        const worktreeKey = buildAbandonedWorktreeKey(entry);
                        const cleanupError = abandonedWorktreeErrors[worktreeKey];
                        const cleaningInProgress = cleaningAbandonedWorktreeKey === worktreeKey;

                        return (
                          <div
                            key={`abandoned-${entry.worktreePath}-${index}`}
                            style={{ padding: '0.6rem 0.75rem', borderRadius: '0.75rem', border: '1px solid rgba(30,64,175,0.25)', background: 'rgba(15,23,42,0.5)' }}
                            data-testid={`abandoned-worktree-row-${index}`}
                          >
                            <p style={amyBodyText}>
                              {`${basenameFromPath(entry.repoPath)}:${entry.branch} — ${formatAbandonedReason(entry.reason)} • ${entry.exists ? formatDaysOld(entry.daysSinceLastTouched) : 'missing path'} • ${formatGiB(entry.bytes)}`}
                            </p>

                            {/* Safety badges in storage panel */}
                            {entry.reason === 'stale-no-session' && entry.exists && (
                              <WorktreeSafetyBadges
                                worktreePath={entry.worktreePath}
                                safetyInfo={worktreeSafetyByPath.get(entry.worktreePath)}
                                loading={worktreeSafetyLoadingPaths.has(entry.worktreePath)}
                              />
                            )}

                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => void handleCleanAbandonedWorktree(entry)}
                                disabled={cleaningInProgress}
                                style={{ ...amyPrimaryBtn, opacity: cleaningInProgress ? 0.5 : 1 }}
                                data-testid={`abandoned-worktree-clean-${index}`}
                              >
                                {cleaningInProgress ? 'Cleaning…' : 'Clean now'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCopyAbandonedWorktreeCommand(entry)}
                                disabled={cleaningInProgress}
                                style={{ ...amyGhostBtn, opacity: cleaningInProgress ? 0.5 : 1 }}
                                data-testid={`abandoned-worktree-copy-${index}`}
                              >
                                {copiedAbandonedWorktreeKey === worktreeKey ? 'Copied' : 'Copy cmd'}
                              </button>
                            </div>
                            {cleanupError && (
                              <p style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: '#f87171' }} data-testid={`abandoned-worktree-error-${index}`}>
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

            {!storageMetricsLoading && !storageMetrics && sourceRepos.length === 0 && (
              <div style={{ ...amyCard, textAlign: 'center' }}>
                <p style={amyCardSubtitle}>Add a workspace to see storage metrics.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <AddWorkspaceDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={() => { void refreshWorkspaces(); }}
      />
    </div>
  );
}
