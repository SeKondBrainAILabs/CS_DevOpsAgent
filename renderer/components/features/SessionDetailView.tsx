/**
 * SessionDetailView Component
 * Shows detailed view of a selected session including prompt, activity, files, and contracts
 */

import React, { useState, useEffect } from 'react';
import type { SessionReport } from '../../../shared/agent-protocol';
import type { AgentInstance, ContractType, Contract, ActivityLogEntry } from '../../../shared/types';
import { useAgentStore } from '../../store/agentStore';

type DetailTab = 'prompt' | 'activity' | 'files' | 'contracts' | 'terminal';

interface SessionDetailViewProps {
  session: SessionReport;
  onBack: () => void;
  onDelete?: (sessionId: string) => void;
  onRestart?: (sessionId: string, session: SessionReport) => Promise<void>;
}

export function SessionDetailView({ session, onBack, onDelete, onRestart }: SessionDetailViewProps): React.ReactElement {
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('prompt');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load instance data to get the prompt
  useEffect(() => {
    async function loadInstance() {
      if (window.api?.instance?.list) {
        const result = await window.api.instance.list();
        if (result.success && result.data) {
          // Find instance matching this session
          const found = result.data.find(inst => inst.sessionId === session.sessionId);
          setInstance(found || null);
        }
      }
    }
    loadInstance();
  }, [session.sessionId]);

  const handleCopyPrompt = async () => {
    const textToCopy = instance?.prompt || generateDefaultPrompt(session);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyInstructions = async () => {
    const textToCopy = instance?.instructions || '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete?.(session.sessionId);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
      // Auto-hide confirm after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const handleRestart = async () => {
    if (restarting) return;
    setRestarting(true);
    setRestartError(null);
    try {
      await onRestart?.(session.sessionId, session);
    } catch (error) {
      setRestartError(error instanceof Error ? error.message : 'Failed to restart session');
      setRestarting(false);
    }
    // Note: on success, the component will unmount as the session changes, so no need to setRestarting(false)
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const repoPath = session.worktreePath || session.repoPath;
      const baseBranch = session.baseBranch || 'main';

      if (!repoPath) {
        setSyncResult({ success: false, message: 'No repository path' });
        return;
      }

      console.log(`[SessionDetail] Syncing ${repoPath} with ${baseBranch}...`);

      // First fetch
      const fetchResult = await window.api?.git?.fetch?.(repoPath, 'origin');
      if (!fetchResult?.success) {
        setSyncResult({ success: false, message: fetchResult?.error?.message || 'Failed to fetch' });
        return;
      }

      // Then rebase
      const rebaseResult = await window.api?.git?.performRebase?.(repoPath, baseBranch);
      if (rebaseResult?.success && rebaseResult.data) {
        setSyncResult({
          success: rebaseResult.data.success,
          message: rebaseResult.data.message || (rebaseResult.data.success ? 'Synced successfully' : 'Rebase failed'),
        });
      } else {
        setSyncResult({
          success: false,
          message: rebaseResult?.error?.message || 'Rebase failed',
        });
      }

      // Clear success message after 5 seconds
      if (rebaseResult?.data?.success) {
        setTimeout(() => setSyncResult(null), 5000);
      }
    } catch (error) {
      console.error('[SessionDetail] Sync error:', error);
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      });
    } finally {
      setSyncing(false);
    }
  };

  const statusColors = {
    active: 'text-green-500',
    idle: 'text-yellow-500',
    error: 'text-red-500',
    completed: 'text-gray-400',
  };

  const repoName = session.repoPath?.split('/').pop() || 'Unknown';

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-surface-secondary transition-colors"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text-primary">
              {session.task || session.branchName || 'Session Details'}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-text-secondary">
              <span className={statusColors[session.status] || 'text-gray-400'}>
                {session.status}
              </span>
              <span>{repoName}</span>
              <span className="font-mono text-xs">{session.branchName}</span>
            </div>
          </div>

          {/* Session Actions */}
          <div className="flex items-center gap-2">
            {/* Sync Result Message */}
            {syncResult && (
              <span className={`text-xs max-w-[200px] truncate ${syncResult.success ? 'text-green-500' : 'text-red-500'}`} title={syncResult.message}>
                {syncResult.message}
              </span>
            )}
            {restartError && (
              <span className="text-xs text-red-500 max-w-[200px] truncate" title={restartError}>
                {restartError}
              </span>
            )}

            {/* Sync Button - Rebase from base branch */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${syncing
                  ? 'bg-blue-500 text-white cursor-wait'
                  : 'bg-surface-secondary text-text-primary hover:bg-blue-50 hover:text-blue-600'
                }`}
              title={syncing ? 'Syncing...' : `Sync with ${session.baseBranch || 'main'} (fetch & rebase)`}
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync'}
            </button>

            {onRestart && (
              <button
                onClick={handleRestart}
                disabled={restarting}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${restarting
                    ? 'bg-kanvas-blue text-white cursor-wait'
                    : 'bg-surface-secondary text-text-primary hover:bg-surface-tertiary'
                  }`}
                title={restarting ? 'Restarting...' : 'Restart session (commits pending changes)'}
              >
                <svg className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {restarting ? 'Restarting...' : 'Restart'}
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${showDeleteConfirm
                    ? 'bg-red-500 text-white'
                    : 'bg-surface-secondary text-text-secondary hover:text-red-500 hover:bg-red-50'
                  }`}
                title={showDeleteConfirm ? 'Click again to confirm' : 'Delete session'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {showDeleteConfirm ? 'Confirm?' : 'Delete'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['prompt', 'activity', 'terminal', 'files', 'contracts'] as DetailTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab
                  ? 'bg-kanvas-blue text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsBar
        worktreePath={instance?.worktreePath || session.worktreePath || session.repoPath}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'prompt' && (
          <PromptTab
            session={session}
            instance={instance}
            onCopyPrompt={handleCopyPrompt}
            onCopyInstructions={handleCopyInstructions}
            copySuccess={copySuccess}
          />
        )}
        {activeTab === 'activity' && (
          <ActivityTab sessionId={session.sessionId} />
        )}
        {activeTab === 'files' && (
          <FilesTab session={session} />
        )}
        {activeTab === 'contracts' && (
          <ContractsTab session={session} />
        )}
        {activeTab === 'terminal' && (
          <TerminalTab sessionId={session.sessionId} />
        )}
      </div>
    </div>
  );
}

interface PromptTabProps {
  session: SessionReport;
  instance: AgentInstance | null;
  onCopyPrompt: () => void;
  onCopyInstructions: () => void;
  copySuccess: boolean;
}

function PromptTab({
  session,
  instance,
  onCopyPrompt,
  onCopyInstructions,
  copySuccess
}: PromptTabProps): React.ReactElement {
  const prompt = instance?.prompt || generateDefaultPrompt(session);

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      {/* Copy buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onCopyPrompt}
          className="flex items-center gap-2 px-4 py-2 bg-kanvas-blue text-white rounded-lg
            hover:bg-kanvas-blue/90 transition-colors"
        >
          {copySuccess ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Prompt
            </>
          )}
        </button>
        {instance?.instructions && (
          <button
            onClick={onCopyInstructions}
            className="flex items-center gap-2 px-4 py-2 bg-surface-secondary text-text-primary rounded-lg
              hover:bg-surface-tertiary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Copy Full Instructions
          </button>
        )}
      </div>

      {/* Session info cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoCard label="Repository" value={session.repoPath || 'Unknown'} mono />
        <InfoCard label="Branch" value={session.branchName} mono />
        <InfoCard label="Session ID" value={session.sessionId.slice(0, 16) + '...'} mono />
        <InfoCard label="Commits" value={String(session.commitCount || 0)} />
      </div>

      {/* Prompt display */}
      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-medium text-text-secondary mb-2">Prompt for Agent</h3>
        <div className="h-full bg-surface-secondary rounded-xl border border-border overflow-auto">
          <pre className="p-4 text-sm text-text-primary whitespace-pre-wrap font-mono">
            {prompt}
          </pre>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): React.ReactElement {
  return (
    <div className="p-3 bg-surface-secondary rounded-lg border border-border">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className={`text-sm text-text-primary truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * ActivityTab - Shows activity log for this session
 * Includes verbose mode toggle to show/hide file changes and debug info
 * Loads historical data from database and shows session resume indicator
 */
function ActivityTab({ sessionId }: { sessionId: string }): React.ReactElement {
  const [verboseMode, setVerboseMode] = useState(false);
  const [historicalLogs, setHistoricalLogs] = useState<ActivityLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 50;

  // Track when this session view was mounted (to separate historical from live)
  const [sessionResumeTime] = useState(() => new Date().toISOString());

  const recentActivity = useAgentStore((state) => state.recentActivity);

  // Load historical logs from database on mount
  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        if (window.api?.activity?.get) {
          const result = await window.api.activity.get(sessionId, PAGE_SIZE);
          if (result.success && result.data) {
            setHistoricalLogs(result.data);
            setHasMore(result.data.length >= PAGE_SIZE);
          }
        }
      } catch (error) {
        console.error('Failed to load activity history:', error);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, [sessionId]);

  // Load more historical logs
  const loadMore = async () => {
    const newOffset = offset + PAGE_SIZE;
    try {
      if (window.api?.activity?.get) {
        const result = await window.api.activity.get(sessionId, PAGE_SIZE);
        if (result.success && result.data) {
          // Filter to get older entries (would need offset support in API)
          // For now, we just indicate there's more
          setOffset(newOffset);
          setHasMore(false); // Disable for now until API supports offset
        }
      }
    } catch (error) {
      console.error('Failed to load more activity:', error);
    }
  };

  // Get live activity (entries received since session resume)
  const liveActivity = recentActivity.filter(
    a => a.sessionId === sessionId && a.timestamp >= sessionResumeTime
  );

  // Filter out entries already in historical logs (by timestamp comparison)
  const historicalTimestamps = new Set(historicalLogs.map(l => l.timestamp));
  const dedupedLiveActivity = liveActivity.filter(a => !historicalTimestamps.has(a.timestamp));

  // Combine: live entries first (newest), then historical
  const allActivity = [...dedupedLiveActivity, ...historicalLogs];

  // In non-verbose mode, hide file changes to reduce noise
  const filteredActivity = verboseMode
    ? allActivity
    : allActivity.filter(a => a.type !== 'file');

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const logTypeStyles: Record<string, { color: string; bg: string; label: string }> = {
    success: { color: 'text-green-600', bg: 'bg-green-50', label: 'Success' },
    error: { color: 'text-red-600', bg: 'bg-red-50', label: 'Error' },
    warning: { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Warning' },
    info: { color: 'text-kanvas-blue', bg: 'bg-kanvas-blue/5', label: 'Info' },
    commit: { color: 'text-purple-600', bg: 'bg-purple-50', label: 'Commit' },
    file: { color: 'text-text-secondary', bg: 'bg-surface-tertiary', label: 'File' },
    git: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Git' },
  };

  const fileChangeCount = allActivity.filter(a => a.type === 'file').length;
  const historicalCount = historicalLogs.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with verbose toggle */}
      <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-primary">Activity Log</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-tertiary text-text-secondary">
            {filteredActivity.length} events
          </span>
          {!verboseMode && fileChangeCount > 0 && (
            <span className="text-xs text-text-secondary">
              ({fileChangeCount} file changes hidden)
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-text-secondary">Verbose</span>
          <div
            onClick={() => setVerboseMode(!verboseMode)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              verboseMode ? 'bg-kanvas-blue' : 'bg-surface-tertiary'
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                verboseMode ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-kanvas-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Activity Yet</h3>
              <p className="text-sm text-text-secondary max-w-xs">
                {verboseMode
                  ? 'Activity will appear here as the agent works.'
                  : 'Enable verbose mode to see file changes, or wait for commits and status updates.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredActivity.map((entry, index) => {
              const style = logTypeStyles[entry.type] || logTypeStyles.info;
              const isHistorical = entry.timestamp < sessionResumeTime;
              const isFirstHistorical = isHistorical &&
                (index === 0 || filteredActivity[index - 1]?.timestamp >= sessionResumeTime);

              return (
                <React.Fragment key={`${entry.timestamp}-${index}`}>
                  {/* Session resume separator */}
                  {isFirstHistorical && dedupedLiveActivity.length > 0 && (
                    <div className="px-4 py-2 bg-surface-secondary border-y border-border">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-text-secondary font-medium">
                          Session resumed {formatDate(sessionResumeTime)}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 hover:bg-surface-secondary transition-colors ${
                      isHistorical ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full ${style.bg} flex items-center justify-center mt-0.5`}>
                        <span className={`text-xs font-bold ${style.color}`}>
                          {entry.type.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-text-primary break-words flex-1">{entry.message}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                            {style.label}
                          </span>
                        </div>
                        <span className="text-xs text-text-secondary">{formatTime(entry.timestamp)}</span>
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <div className="mt-2 p-2 rounded-lg bg-surface-tertiary">
                            <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
                              {JSON.stringify(entry.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Load more button */}
            {hasMore && (
              <div className="px-4 py-3 text-center">
                <button
                  onClick={loadMore}
                  className="text-sm text-kanvas-blue hover:underline"
                >
                  Load more history...
                </button>
              </div>
            )}

            {/* Historical data indicator */}
            {historicalCount > 0 && !hasMore && (
              <div className="px-4 py-2 text-center text-xs text-text-secondary bg-surface-secondary">
                Showing {historicalCount} entries from previous sessions
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FilesTab - Shows files changed in this session
 * Combines git diff data with real-time file watcher events
 * Includes git status (staged/unstaged/committed) and manual commit button
 */
function FilesTab({ session }: { session: SessionReport }): React.ReactElement {
  const [gitFiles, setGitFiles] = useState<Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
    gitState: 'staged' | 'unstaged' | 'committed' | 'untracked';
    commitHash?: string;
    commitShortHash?: string;
    commitMessage?: string;
  }>>([]);
  const [recentChanges, setRecentChanges] = useState<Array<{ path: string; type: string; timestamp: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'git' | 'recent'>('git');
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // Load git diff files with status
  const loadChangedFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use worktreePath if available, otherwise repoPath
      const repoPath = session.worktreePath || session.repoPath;
      // Use baseBranch if set, otherwise default to main
      const baseBranch = session.baseBranch || 'main';

      if (window.api?.git?.getFilesWithStatus && repoPath) {
        const result = await window.api.git.getFilesWithStatus(repoPath, baseBranch);
        if (result.success && result.data) {
          setGitFiles(result.data);
        } else if (result.error) {
          setError(result.error.message || 'Failed to load files');
        }
      } else if (window.api?.git?.getChangedFiles && repoPath) {
        // Fallback to basic getChangedFiles
        const result = await window.api.git.getChangedFiles(repoPath, baseBranch);
        if (result.success && result.data) {
          setGitFiles(result.data.map(f => ({ ...f, gitState: 'unstaged' as const })));
        } else if (result.error) {
          setError(result.error.message || 'Failed to load files');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChangedFiles();
  }, [session.sessionId, session.worktreePath, session.repoPath, session.baseBranch]);

  // Subscribe to real-time file changes
  useEffect(() => {
    const unsubscribe = window.api?.watcher?.onFileChanged?.((event) => {
      if (event.sessionId === session.sessionId) {
        setRecentChanges(prev => [
          { path: event.filePath, type: event.type, timestamp: event.timestamp },
          ...prev.slice(0, 99), // Keep last 100
        ]);
      }
    });

    return () => unsubscribe?.();
  }, [session.sessionId]);

  // Generate AI commit message with actual diff analysis using AI mode system
  const generateCommitMessage = async () => {
    setGeneratingMessage(true);
    setCommitError(null);
    try {
      const uncommittedFiles = gitFiles.filter(f => f.gitState !== 'committed');
      if (uncommittedFiles.length === 0) {
        setCommitError('No uncommitted files to commit');
        return;
      }

      const repoPath = session.worktreePath || session.repoPath;
      if (!repoPath) {
        setCommitError('No repository path');
        return;
      }

      // Get detailed diff summary with actual code changes
      let diffSummary: {
        totalFiles: number;
        totalAdditions: number;
        totalDeletions: number;
        filesByType: Record<string, number>;
        summary: string;
        files: Array<{ path: string; status: string; additions: number; deletions: number; diff: string }>;
      } | null = null;

      console.log('[CommitMessage] Fetching diff summary...');

      if (window.api?.git?.getDiffSummary) {
        const diffResult = await window.api.git.getDiffSummary(repoPath);
        if (diffResult.success && diffResult.data) {
          diffSummary = diffResult.data;
          console.log('[CommitMessage] Got diff summary:', diffSummary.totalFiles, 'files');
        } else {
          console.warn('[CommitMessage] Failed to get diff summary:', diffResult.error);
        }
      }

      // Prepare variables for the AI mode
      const taskContext = session.task || session.branchName || 'development';

      let changeStats = `${uncommittedFiles.length} files`;
      let fileChanges = '';

      if (diffSummary && diffSummary.files.length > 0) {
        changeStats = `${diffSummary.totalFiles} files, +${diffSummary.totalAdditions}/-${diffSummary.totalDeletions} lines`;

        // Build detailed file changes with actual diffs - include ALL files
        fileChanges = diffSummary.files.map(f => {
          let section = `### ${f.path} (${f.status}, +${f.additions}/-${f.deletions})`;
          if (f.diff && f.diff.trim()) {
            // Extract meaningful lines from diff - more context for better analysis
            const diffLines = f.diff.split('\n');
            const meaningfulLines: string[] = [];
            let contextBuffer: string[] = [];

            for (const line of diffLines) {
              // Skip diff headers
              if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) {
                continue;
              }
              // Keep hunk headers for context
              if (line.startsWith('@@')) {
                if (meaningfulLines.length > 0) meaningfulLines.push('');
                meaningfulLines.push(line);
                contextBuffer = [];
                continue;
              }
              // Keep added/removed lines
              if (line.startsWith('+') || line.startsWith('-')) {
                // Add any buffered context first
                meaningfulLines.push(...contextBuffer);
                contextBuffer = [];
                meaningfulLines.push(line);
              } else if (line.startsWith(' ')) {
                // Buffer context lines (keep last 2)
                contextBuffer.push(line);
                if (contextBuffer.length > 2) contextBuffer.shift();
              }
            }

            // Limit to 50 meaningful lines per file
            const truncatedDiff = meaningfulLines.slice(0, 50).join('\n');
            if (truncatedDiff) {
              section += `\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
            }
          }
          return section;
        }).join('\n\n');
      } else {
        // Simple file list if no diff available
        fileChanges = uncommittedFiles.map(f => {
          const stateIcon = f.gitState === 'staged' ? '[staged]' : f.gitState === 'untracked' ? '[new]' : '[modified]';
          return `- ${stateIcon} ${f.path} (+${f.additions}/-${f.deletions})`;
        }).join('\n');
      }

      console.log('[CommitMessage] Calling AI with commit-message mode...');

      // Use the commit-message mode through chatWithMode API
      if (window.api?.ai?.chatWithMode) {
        try {
          const result = await window.api.ai.chatWithMode({
            modeId: 'commit-message',
            promptKey: diffSummary ? 'generate' : 'simple',
            variables: {
              task_context: taskContext,
              change_stats: changeStats,
              file_changes: fileChanges,
              file_list: fileChanges, // For simple mode
            },
          });

          console.log('[CommitMessage] AI mode result:', result);

          if (result.success && result.data) {
            // Clean up the response
            let message = result.data.trim();
            // Remove surrounding quotes if present
            if ((message.startsWith('"') && message.endsWith('"')) ||
                (message.startsWith("'") && message.endsWith("'"))) {
              message = message.slice(1, -1);
            }
            // Remove markdown code blocks if present
            if (message.startsWith('```')) {
              message = message.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
            }
            setCommitMessage(message.trim());
            return;
          } else {
            console.warn('[CommitMessage] AI mode failed:', result.error);
          }
        } catch (aiError) {
          console.error('[CommitMessage] AI mode error:', aiError);
        }
      } else {
        console.warn('[CommitMessage] chatWithMode not available');
      }

      // Intelligent fallback - generate descriptive message without AI
      console.log('[CommitMessage] Using fallback message generator');
      const fallbackMessage = generateFallbackCommitMessage(uncommittedFiles, session, diffSummary);
      setCommitMessage(fallbackMessage);
    } catch (err) {
      console.error('Failed to generate commit message:', err);
      // Intelligent fallback
      const uncommittedFiles = gitFiles.filter(f => f.gitState !== 'committed');
      const fallbackMessage = generateFallbackCommitMessage(uncommittedFiles, session, null);
      setCommitMessage(fallbackMessage);
    } finally {
      setGeneratingMessage(false);
    }
  };

  // Generate a descriptive fallback message based on file analysis
  const generateFallbackCommitMessage = (
    files: typeof gitFiles,
    sessionInfo: typeof session,
    diffSummary: { filesByType: Record<string, number>; totalAdditions: number; totalDeletions: number; files?: Array<{ path: string; diff: string }> } | null
  ): string => {
    const addedFiles = files.filter(f => f.gitState === 'untracked' || f.status === 'added');
    const modifiedFiles = files.filter(f => f.status === 'modified' || f.gitState === 'unstaged' || f.gitState === 'staged');
    const deletedFiles = files.filter(f => f.status === 'deleted');

    // Analyze file paths to determine scope and type
    const hasTests = files.some(f => f.path.includes('test') || f.path.includes('spec') || f.path.includes('__tests__'));
    const hasDocs = files.some(f => f.path.endsWith('.md') || f.path.includes('docs/'));
    const hasConfig = files.some(f =>
      f.path.includes('config') || f.path.endsWith('.json') || f.path.endsWith('.yml') || f.path.endsWith('.yaml') ||
      f.path.includes('tsconfig') || f.path.includes('package.json')
    );
    const hasStyles = files.some(f => f.path.endsWith('.css') || f.path.endsWith('.scss') || f.path.endsWith('.sass'));
    const hasComponents = files.some(f => f.path.includes('components/') || f.path.includes('views/'));
    const hasServices = files.some(f => f.path.includes('services/') || f.path.includes('api/') || f.path.includes('ipc/'));
    const hasElectron = files.some(f => f.path.includes('electron/') || f.path.includes('preload'));
    const hasRenderer = files.some(f => f.path.includes('renderer/'));

    // Find the most common directory to determine scope
    const dirCounts: Record<string, number> = {};
    files.forEach(f => {
      const parts = f.path.split('/');
      if (parts.length > 1) {
        const dir = parts[0];
        dirCounts[dir] = (dirCounts[dir] || 0) + 1;
      }
    });
    const topDir = Object.entries(dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Determine commit type based on changes
    let commitType = 'chore';
    if (hasTests && files.every(f => f.path.includes('test') || f.path.includes('spec'))) {
      commitType = 'test';
    } else if (hasDocs && files.every(f => f.path.endsWith('.md') || f.path.includes('docs/'))) {
      commitType = 'docs';
    } else if (hasStyles && files.every(f => f.path.match(/\.(css|scss|sass)$/))) {
      commitType = 'style';
    } else if (addedFiles.length > 0 && addedFiles.length >= modifiedFiles.length) {
      commitType = 'feat';
    } else if (deletedFiles.length > addedFiles.length && deletedFiles.length > modifiedFiles.length) {
      commitType = 'refactor';
    } else if (sessionInfo.task?.toLowerCase().match(/\b(fix|bug|issue|error)\b/)) {
      commitType = 'fix';
    } else {
      commitType = 'feat';
    }

    // Determine scope from directory analysis
    let scope = '';
    if (hasElectron && !hasRenderer) scope = 'electron';
    else if (hasRenderer && !hasElectron) scope = 'renderer';
    else if (hasComponents && !hasServices) scope = 'ui';
    else if (hasServices) scope = 'services';
    else if (hasTests) scope = 'tests';
    else if (hasConfig) scope = 'config';
    else if (topDir && ['electron', 'renderer', 'shared', 'src'].includes(topDir)) scope = topDir;

    // Build description by analyzing file names and changes
    let description = '';

    // Try to extract meaningful description from file names
    const fileNames = files.map(f => {
      const name = f.path.split('/').pop() || '';
      // Remove extension and convert to readable form
      return name.replace(/\.(tsx?|jsx?|css|scss|md|json)$/, '').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    });

    // Find common patterns in file names
    const uniqueNames = [...new Set(fileNames)].filter(n => n.length > 2);

    if (files.length === 1) {
      // Single file - be specific
      const fileName = files[0].path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'file';
      if (addedFiles.length === 1) {
        description = `add ${fileName}`;
      } else if (deletedFiles.length === 1) {
        description = `remove ${fileName}`;
      } else {
        description = `update ${fileName}`;
      }
    } else if (addedFiles.length > 0 && modifiedFiles.length === 0 && deletedFiles.length === 0) {
      // Only additions
      if (addedFiles.length <= 3) {
        description = `add ${addedFiles.map(f => f.path.split('/').pop()?.replace(/\.[^.]+$/, '')).join(', ')}`;
      } else {
        description = `add ${addedFiles.length} new files`;
      }
    } else if (deletedFiles.length > 0 && addedFiles.length === 0 && modifiedFiles.length === 0) {
      // Only deletions
      description = `remove ${deletedFiles.length} files`;
    } else if (uniqueNames.length <= 3 && uniqueNames.length > 0) {
      // Few distinct files - mention them
      description = `update ${uniqueNames.slice(0, 2).join(' and ')}`;
    } else {
      // Many files - describe the change pattern
      const additions = diffSummary?.totalAdditions || 0;
      const deletions = diffSummary?.totalDeletions || 0;

      if (additions > deletions * 2) {
        description = `implement new functionality across ${files.length} files`;
      } else if (deletions > additions * 2) {
        description = `refactor and clean up ${files.length} files`;
      } else {
        description = `update ${files.length} files`;
      }
    }

    // Ensure description starts with lowercase
    description = description.charAt(0).toLowerCase() + description.slice(1);

    // Truncate if too long
    if (description.length > 50) {
      description = description.substring(0, 47) + '...';
    }

    // Build final message
    const scopePart = scope ? `(${scope})` : '';
    return `${commitType}${scopePart}: ${description}`;
  };

  // Execute manual commit
  const handleCommit = async () => {
    if (!commitMessage) return;
    setCommitting(true);
    setCommitError(null);
    setCommitSuccess(false);
    try {
      const repoPath = session.worktreePath || session.repoPath;
      if (!repoPath) {
        setCommitError('No repository path');
        return;
      }

      // Write commit message to .devops-commit file to trigger auto-commit
      const shortSessionId = session.sessionId.replace('sess_', '').slice(0, 8);
      const commitMsgFile = `.devops-commit-${shortSessionId}.msg`;

      // Use the shell to write the commit message file and trigger the watcher
      // This leverages the existing auto-commit infrastructure
      if (window.api?.shell?.openTerminal) {
        // Alternative: directly invoke git commit via IPC
        const result = await window.api.git.commit(session.sessionId, commitMessage);
        if (result.success) {
          setCommitSuccess(true);
          setCommitMessage(null);
          // Refresh files list
          setTimeout(loadChangedFiles, 1000);
        } else {
          setCommitError(result.error?.message || 'Commit failed');
        }
      }
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Group files by git state
  const uncommittedFiles = gitFiles.filter(f => f.gitState !== 'committed');
  const committedFiles = gitFiles.filter(f => f.gitState === 'committed');
  const hasUncommitted = uncommittedFiles.length > 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-kanvas-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with view toggle, manual commit, and refresh */}
      <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('git')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'git'
                ? 'bg-kanvas-blue text-white'
                : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            Git Diff ({gitFiles.length})
          </button>
          <button
            onClick={() => setViewMode('recent')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'recent'
                ? 'bg-kanvas-blue text-white'
                : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
            }`}
          >
            Recent ({recentChanges.length})
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Manual Commit Button */}
          {hasUncommitted && viewMode === 'git' && (
            <button
              onClick={generateCommitMessage}
              disabled={generatingMessage || committing}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                generatingMessage || committing
                  ? 'bg-kanvas-blue/50 text-white cursor-wait'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title="Generate AI commit message and commit"
            >
              {generatingMessage ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Manual Commit
                </>
              )}
            </button>
          )}
          <button
            onClick={loadChangedFiles}
            disabled={loading}
            className="p-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors"
            title="Refresh"
          >
            <svg className={`w-4 h-4 text-text-secondary ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Commit Message Editor */}
      {commitMessage && (
        <div className="mx-4 mt-4 p-4 bg-surface-secondary rounded-xl border border-kanvas-blue">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                AI Generated Commit Message (edit if needed)
              </label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full h-24 px-3 py-2 text-sm font-mono bg-surface border border-border rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-kanvas-blue resize-none text-text-primary"
                placeholder="Commit message..."
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-text-secondary">
                  {uncommittedFiles.length} file(s) will be committed
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCommitMessage(null)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-surface-tertiary text-text-secondary
                      hover:bg-surface hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommit}
                    disabled={committing || !commitMessage.trim()}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg transition-colors ${
                      committing
                        ? 'bg-green-600/50 text-white cursor-wait'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {committing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Committing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Commit & Push
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {commitError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{commitError}</p>
        </div>
      )}
      {commitSuccess && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">Commit successful!</p>
        </div>
      )}

      {/* Error state */}
      {error && viewMode === 'git' && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'git' ? (
          gitFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                  <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">No Git Changes Yet</h3>
                <p className="text-sm text-text-secondary max-w-xs">
                  Shows files changed since branching. Check "Recent" tab for real-time file activity.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Uncommitted Files Section */}
              {uncommittedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                    Uncommitted ({uncommittedFiles.length})
                  </h4>
                  <div className="space-y-2">
                    {uncommittedFiles.map((file) => (
                      <div key={file.path} className="p-3 bg-surface-secondary rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <GitStateIcon gitState={file.gitState} />
                          <span className="flex-1 font-mono text-sm text-text-primary truncate">{file.path}</span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-500">+{file.additions}</span>
                            <span className="text-red-500">-{file.deletions}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Committed Files Section */}
              {committedFiles.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Committed ({committedFiles.length})
                  </h4>
                  <div className="space-y-2">
                    {committedFiles.map((file) => (
                      <div key={file.path} className="p-3 bg-surface-secondary rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <GitStateIcon gitState={file.gitState} />
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-sm text-text-primary truncate block">{file.path}</span>
                            {file.commitShortHash && (
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-mono">
                                  {file.commitShortHash}
                                </code>
                                {file.commitMessage && (
                                  <span className="text-xs text-text-secondary truncate">
                                    {file.commitMessage.slice(0, 50)}{file.commitMessage.length > 50 ? '...' : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-500">+{file.additions}</span>
                            <span className="text-red-500">-{file.deletions}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          recentChanges.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                  <svg className="w-8 h-8 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">No Recent Activity</h3>
                <p className="text-sm text-text-secondary max-w-xs">
                  Real-time file changes will appear here as the agent works.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {recentChanges.map((change, idx) => (
                <div key={`${change.path}-${idx}`} className="p-3 bg-surface-secondary rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      change.type === 'add' ? 'bg-green-100 text-green-700' :
                      change.type === 'unlink' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {change.type === 'add' ? 'ADD' : change.type === 'unlink' ? 'DEL' : 'MOD'}
                    </span>
                    <span className="flex-1 font-mono text-sm text-text-primary truncate">{change.path}</span>
                    <span className="text-xs text-text-secondary">{formatTime(change.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/**
 * GitStateIcon - Shows the git state of a file (staged, unstaged, committed, untracked)
 */
function GitStateIcon({ gitState }: { gitState: 'staged' | 'unstaged' | 'committed' | 'untracked' }): React.ReactElement {
  const stateStyles: Record<string, { bg: string; text: string; label: string }> = {
    staged: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'S' },
    unstaged: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'M' },
    committed: { bg: 'bg-green-100', text: 'text-green-700', label: 'C' },
    untracked: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'U' },
  };

  const style = stateStyles[gitState] || stateStyles.unstaged;

  return (
    <span
      className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${style.bg} ${style.text}`}
      title={gitState.charAt(0).toUpperCase() + gitState.slice(1)}
    >
      {style.label}
    </span>
  );
}


/**
 * ContractsTab - Shows contracts from House_Rules_Contracts/ directory
 * Matches the existing contract structure in the repo
 */
function ContractsTab({ session }: { session: SessionReport }): React.ReactElement {
  const [activeContractType, setActiveContractType] = useState<ContractType | 'all'>('all');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractChanges, setContractChanges] = useState<Array<{ file: string; type: string; changeType: string; impactLevel: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Contract generation state
  const [scanPathOption, setScanPathOption] = useState<'main' | 'worktree'>('main');
  const [discoveredFeatures, setDiscoveredFeatures] = useState<Array<{
    name: string;
    basePath: string;
    files: { api: string[]; schema: string[]; tests: { e2e: string[]; unit: string[]; integration: string[] }; fixtures: string[]; config: string[]; other: string[] };
    contractPatternMatches: number;
  }>>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{
    total: number;
    completed: number;
    currentFeature: string;
    currentStep: string;
    errors: string[];
  } | null>(null);
  const [generationResult, setGenerationResult] = useState<{
    generated: number;
    failed: number;
    duration: number;
  } | null>(null);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  // Contract categories - both API and Test contracts
  const contractTypes: { type: ContractType | 'all'; label: string; icon: string; file?: string; isTest?: boolean }[] = [
    { type: 'all', label: 'All', icon: '📋' },
    // API/Schema Contracts
    { type: 'api', label: 'API', icon: '🔌', file: 'API_CONTRACT.md' },
    { type: 'schema', label: 'Schema', icon: '📐', file: 'DATABASE_SCHEMA_CONTRACT.md' },
    { type: 'events', label: 'Events', icon: '⚡', file: 'EVENTS_CONTRACT.md' },
    { type: 'features', label: 'Features', icon: '✨', file: 'FEATURES_CONTRACT.md' },
    { type: 'infra', label: 'Infra', icon: '🏗️', file: 'INFRA_CONTRACT.md' },
    { type: 'integrations', label: '3rd Party', icon: '🔗', file: 'THIRD_PARTY_INTEGRATIONS.md' },
    // Test Contracts (Quality Contracts)
    { type: 'e2e', label: 'E2E Tests', icon: '🎭', isTest: true },
    { type: 'unit', label: 'Unit Tests', icon: '🧪', isTest: true },
    { type: 'integration', label: 'Integration', icon: '🔗', isTest: true },
    { type: 'fixtures', label: 'Fixtures', icon: '📦', isTest: true },
  ];

  useEffect(() => {
    async function loadContracts() {
      setLoading(true);
      try {
        const repoPath = session.repoPath || session.worktreePath;

        // Try to get contract changes for this session
        if (window.api?.contract?.analyzeCommit && repoPath) {
          const result = await window.api.contract.analyzeCommit(repoPath);
          if (result.success && result.data?.changes) {
            setContractChanges(result.data.changes);
          }
        }

        // Load contract files from House_Rules_Contracts/
        // For now, create placeholder entries based on known contract files
        const knownContracts: Contract[] = [
          // API & Schema Contracts
          {
            id: 'api-contract',
            type: 'api',
            name: 'API Contract',
            description: 'REST/GraphQL API endpoints and authentication',
            filePath: `${repoPath}/House_Rules_Contracts/API_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'schema-contract',
            type: 'schema',
            name: 'Database Schema Contract',
            description: 'Database tables, migrations, and data models',
            filePath: `${repoPath}/House_Rules_Contracts/DATABASE_SCHEMA_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'events-contract',
            type: 'events',
            name: 'Events Contract (Feature Bus)',
            description: 'Domain events for cross-service communication',
            filePath: `${repoPath}/House_Rules_Contracts/EVENTS_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'features-contract',
            type: 'features',
            name: 'Features Contract',
            description: 'Feature flags and toggles',
            filePath: `${repoPath}/House_Rules_Contracts/FEATURES_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'infra-contract',
            type: 'infra',
            name: 'Infrastructure Contract',
            description: 'Deployment, services, and infrastructure',
            filePath: `${repoPath}/House_Rules_Contracts/INFRA_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'integrations-contract',
            type: 'integrations',
            name: 'Third-Party Integrations',
            description: 'External service integrations and SDKs',
            filePath: `${repoPath}/House_Rules_Contracts/THIRD_PARTY_INTEGRATIONS.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
        ];

        // Try to load test contracts from contract registry
        if (window.api?.contractRegistry?.getRepoSummary && repoPath) {
          try {
            const repoResult = await window.api.contractRegistry.getRepoSummary(repoPath);
            if (repoResult.success && repoResult.data) {
              const features = Object.keys(repoResult.data.features || {});
              for (const featureName of features) {
                const featureResult = await window.api.contractRegistry.getFeatureContracts(repoPath, featureName);
                if (featureResult.success && featureResult.data) {
                  const feature = featureResult.data;
                  // Add E2E tests
                  for (const test of feature.contracts.e2e) {
                    knownContracts.push({
                      id: `e2e-${featureName}-${test.file}`,
                      type: 'e2e',
                      name: `E2E: ${test.file}`,
                      description: `${test.testCount} tests in ${featureName}`,
                      filePath: `${repoPath}/${test.file}`,
                      status: 'active',
                      version: '1.0.0',
                      lastUpdated: test.lastModified,
                    });
                  }
                  // Add unit tests
                  for (const test of feature.contracts.unit) {
                    knownContracts.push({
                      id: `unit-${featureName}-${test.file}`,
                      type: 'unit',
                      name: `Unit: ${test.file}`,
                      description: `${test.testCount} tests in ${featureName}`,
                      filePath: `${repoPath}/${test.file}`,
                      status: 'active',
                      version: '1.0.0',
                      lastUpdated: test.lastModified,
                    });
                  }
                  // Add integration tests
                  for (const test of feature.contracts.integration) {
                    knownContracts.push({
                      id: `int-${featureName}-${test.file}`,
                      type: 'integration',
                      name: `Integration: ${test.file}`,
                      description: `${test.testCount} tests in ${featureName}`,
                      filePath: `${repoPath}/${test.file}`,
                      status: 'active',
                      version: '1.0.0',
                      lastUpdated: test.lastModified,
                    });
                  }
                  // Add fixtures
                  for (const fixture of feature.contracts.fixtures) {
                    knownContracts.push({
                      id: `fixture-${featureName}-${fixture.file}`,
                      type: 'fixtures',
                      name: `Fixture: ${fixture.file}`,
                      description: `Used by ${fixture.usedBy.length} tests`,
                      filePath: `${repoPath}/${fixture.file}`,
                      status: 'active',
                      version: '1.0.0',
                      lastUpdated: fixture.lastModified,
                    });
                  }
                }
              }
            }
          } catch (regErr) {
            console.log('Contract registry not available:', regErr);
          }
        }

        setContracts(knownContracts);
      } catch (error) {
        console.error('Failed to load contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContracts();
  }, [session.sessionId, session.repoPath, session.worktreePath]);

  // Listen for generation progress events
  useEffect(() => {
    const unsubProgress = window.api?.contractGeneration?.onProgress((progress) => {
      setGenerationProgress(progress);
    });
    const unsubComplete = window.api?.contractGeneration?.onComplete((result) => {
      setIsGenerating(false);
      setGenerationProgress(null);
      setGenerationResult({
        generated: result.generated,
        failed: result.failed,
        duration: result.duration,
      });
      // Clear result after 5 seconds
      setTimeout(() => setGenerationResult(null), 5000);
    });
    return () => {
      unsubProgress?.();
      unsubComplete?.();
    };
  }, []);

  // Get the scan path based on selected option
  const getScanPath = () => {
    if (scanPathOption === 'main') {
      return session.repoPath || session.worktreePath;
    }
    return session.worktreePath || session.repoPath;
  };

  // Discover features in the repository
  const handleDiscoverFeatures = async () => {
    const repoPath = getScanPath();
    if (!repoPath) return;

    setIsDiscovering(true);
    setDiscoveredFeatures([]);
    setGenerationResult(null);

    try {
      const result = await window.api?.contractGeneration?.discoverFeatures(repoPath);
      if (result?.success && result.data) {
        setDiscoveredFeatures(result.data);
      }
    } catch (err) {
      console.error('Failed to discover features:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Generate contracts for all discovered features
  const handleGenerateAll = async () => {
    const repoPath = getScanPath();
    if (!repoPath || isGenerating) return;

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      await window.api?.contractGeneration?.generateAll(repoPath, {
        includeCodeSamples: true,
        maxFilesPerFeature: 10,
      });
      // Result comes via onComplete event
    } catch (err) {
      console.error('Failed to generate contracts:', err);
      setIsGenerating(false);
    }
  };

  const filteredContracts = activeContractType === 'all'
    ? contracts
    : contracts.filter(c => c.type === activeContractType);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-kanvas-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Generate Contracts Button */}
      <div className="p-4 border-b border-border bg-surface flex justify-between items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-text-primary">Contracts</h3>
            <div className="flex gap-2 items-center">
              {/* Path selector */}
              {session.repoPath && session.worktreePath && session.repoPath !== session.worktreePath && (
                <select
                  value={scanPathOption}
                  onChange={(e) => {
                    setScanPathOption(e.target.value as 'main' | 'worktree');
                    setDiscoveredFeatures([]); // Clear on path change
                  }}
                  disabled={isDiscovering || isGenerating}
                  className="px-2 py-1.5 rounded-lg text-sm bg-surface-secondary text-text-primary border border-border"
                >
                  <option value="main">Main Repo</option>
                  <option value="worktree">Worktree</option>
                </select>
              )}
              <button
                onClick={handleDiscoverFeatures}
                disabled={isDiscovering || isGenerating}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${isDiscovering
                    ? 'bg-surface-tertiary text-text-secondary cursor-wait'
                    : 'bg-surface-secondary text-text-primary hover:bg-surface-tertiary'
                  }`}
              >
                {isDiscovering ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-3 h-3 border border-text-secondary border-t-transparent rounded-full" />
                    Discovering...
                  </span>
                ) : (
                  '🔍 Discover Features'
                )}
              </button>
              <button
                onClick={handleGenerateAll}
                disabled={isGenerating || discoveredFeatures.length === 0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${isGenerating
                    ? 'bg-kanvas-blue text-white cursor-wait'
                    : discoveredFeatures.length === 0
                      ? 'bg-surface-tertiary text-text-secondary cursor-not-allowed'
                      : 'bg-kanvas-blue text-white hover:bg-blue-600'
                  }`}
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                    Generating...
                  </span>
                ) : (
                  '✨ Generate Contracts'
                )}
              </button>
            </div>
          </div>

          {/* Contract Type Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {contractTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => setActiveContractType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5
                  ${activeContractType === type
                    ? 'bg-kanvas-blue text-white'
                    : 'bg-surface-secondary text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
                  }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
                {type !== 'all' && (
                  <span className="text-xs opacity-70">
                    ({contracts.filter(c => c.type === type).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generation Progress */}
      {isGenerating && generationProgress && (
        <div className="mx-4 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm font-medium text-blue-800">
              Generating: {generationProgress.currentFeature}
            </span>
            <span className="text-xs text-blue-600">
              ({generationProgress.completed}/{generationProgress.total})
            </span>
          </div>
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${generationProgress.total > 0 ? (generationProgress.completed / generationProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Generation Result */}
      {generationResult && (
        <div className={`mx-4 mt-4 p-3 rounded-xl border ${generationResult.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2">
            <span>{generationResult.failed > 0 ? '⚠️' : '✅'}</span>
            <span className="text-sm font-medium">
              Generated {generationResult.generated} contracts in {(generationResult.duration / 1000).toFixed(1)}s
              {generationResult.failed > 0 && ` (${generationResult.failed} failed)`}
            </span>
          </div>
        </div>
      )}

      {/* Discovered Features */}
      {discoveredFeatures.length > 0 && !isGenerating && (
        <div className="mx-4 mt-4 p-3 bg-surface-secondary rounded-xl border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">
              Discovered {discoveredFeatures.length} feature(s)
            </span>
            <button
              onClick={() => setDiscoveredFeatures([])}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {discoveredFeatures.map(f => {
              // Check if this feature has contract changes
              const featureChanges = contractChanges.filter(c =>
                c.file.toLowerCase().includes(f.name.toLowerCase()) ||
                c.file.includes(f.basePath)
              );
              const hasChanges = featureChanges.length > 0;
              const hasBreaking = featureChanges.some(c => c.impactLevel === 'breaking');
              const isExpanded = expandedFeature === f.name;

              return (
                <div key={f.name} className="relative">
                  <button
                    onClick={() => setExpandedFeature(isExpanded ? null : f.name)}
                    className={`px-2 py-1 rounded border text-xs transition-all flex items-center gap-1 ${
                      hasBreaking
                        ? 'bg-red-50 border-red-300 text-red-800'
                        : hasChanges
                          ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                          : 'bg-surface border-border text-text-primary'
                    } ${isExpanded ? 'ring-2 ring-kanvas-blue' : 'hover:border-kanvas-blue'}`}
                    title={`${f.contractPatternMatches} files • Click to ${isExpanded ? 'collapse' : 'expand'}`}
                  >
                    📁 {f.name}
                    <span className="text-text-secondary">({f.contractPatternMatches})</span>
                    {hasChanges && (
                      <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-medium ${
                        hasBreaking ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                      }`}>
                        {featureChanges.length} {hasBreaking ? '⚠️' : '✏️'}
                      </span>
                    )}
                    <span className={`ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {/* Expanded Feature Details */}
                  {isExpanded && (
                    <div className="absolute left-0 top-full mt-1 z-10 w-72 p-3 bg-surface rounded-lg border border-border shadow-lg">
                      <div className="text-xs space-y-2">
                        <div className="font-medium text-text-primary border-b border-border pb-1">
                          {f.name} Details
                        </div>

                        {/* File breakdown */}
                        <div className="grid grid-cols-2 gap-1 text-text-secondary">
                          {f.files.api.length > 0 && (
                            <div>🔌 API: {f.files.api.length}</div>
                          )}
                          {f.files.schema.length > 0 && (
                            <div>📐 Schema: {f.files.schema.length}</div>
                          )}
                          {f.files.tests.unit.length > 0 && (
                            <div>🧪 Unit: {f.files.tests.unit.length}</div>
                          )}
                          {f.files.tests.e2e.length > 0 && (
                            <div>🎭 E2E: {f.files.tests.e2e.length}</div>
                          )}
                          {f.files.config.length > 0 && (
                            <div>⚙️ Config: {f.files.config.length}</div>
                          )}
                          {f.files.other.length > 0 && (
                            <div>📄 Other: {f.files.other.length}</div>
                          )}
                        </div>

                        {/* Contract Changes for this feature */}
                        {featureChanges.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <div className="font-medium text-yellow-700 mb-1">
                              Contract Changes:
                            </div>
                            <div className="space-y-1 max-h-32 overflow-auto">
                              {featureChanges.map((change, idx) => (
                                <div
                                  key={idx}
                                  className={`px-2 py-1 rounded text-[10px] ${
                                    change.impactLevel === 'breaking'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  <span className="font-medium">{change.changeType}</span>
                                  <span className="mx-1">•</span>
                                  <span>{change.type}</span>
                                  <div className="text-text-secondary truncate">{change.file}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {featureChanges.length === 0 && (
                          <div className="text-text-secondary italic">
                            No recent contract changes
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contract Changes Alert */}
      {contractChanges.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {contractChanges.length} contract file(s) changed
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {contractChanges.filter(c => c.impactLevel === 'breaking').length} potentially breaking changes
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contracts List */}
      <div className="flex-1 overflow-auto p-4">
        {filteredContracts.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
                <span className="text-3xl">📋</span>
              </div>
              <h3 className="text-lg font-medium text-text-primary mb-2">No Contracts Found</h3>
              <p className="text-sm text-text-secondary max-w-xs">
                Create a <code className="text-kanvas-blue">House_Rules_Contracts/</code> directory to track contracts.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ContractCard - Individual contract display matching House_Rules_Contracts format
 */
function ContractCard({ contract }: { contract: Contract }): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    modified: 'bg-yellow-100 text-yellow-700',
    deprecated: 'bg-gray-100 text-gray-600',
    breaking: 'bg-red-100 text-red-700',
    beta: 'bg-blue-100 text-blue-700',
  };

  const typeIcons: Record<string, string> = {
    api: '🔌',
    schema: '📐',
    events: '⚡',
    css: '🎨',
    features: '✨',
    infra: '🏗️',
    integrations: '🔗',
  };

  const typeLabels: Record<string, string> = {
    api: 'API Contract',
    schema: 'Schema',
    events: 'Feature Bus',
    css: 'CSS/Design',
    features: 'Feature Flags',
    infra: 'Infrastructure',
    integrations: '3rd Party',
  };

  const handleOpenFile = async () => {
    // Try to open the contract file
    console.log('Open contract file:', contract.filePath);
    // Could add shell.openPath or similar here
  };

  return (
    <div
      className={`
        bg-surface rounded-xl border transition-all cursor-pointer
        ${expanded ? 'border-kanvas-blue shadow-kanvas' : 'border-border hover:border-kanvas-blue/30 hover:shadow-card-hover'}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
            <span className="text-xl">{typeIcons[contract.type]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-text-primary truncate">{contract.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[contract.status]}`}>
                {contract.status}
              </span>
              {contract.breaking && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  ⚠️ Breaking
                </span>
              )}
            </div>
            {contract.description && (
              <p className="text-sm text-text-secondary">{contract.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">v{contract.version}</span>
            <svg
              className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {/* File path */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">File:</span>
            <code className="text-xs text-kanvas-blue bg-surface-secondary px-2 py-0.5 rounded truncate flex-1">
              {contract.filePath.split('/').slice(-2).join('/')}
            </code>
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenFile(); }}
              className="text-xs text-kanvas-blue hover:underline"
            >
              Open
            </button>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text-secondary">Type:</span>
              <span className="ml-2 text-text-primary">{typeLabels[contract.type]}</span>
            </div>
            <div>
              <span className="text-text-secondary">Last Updated:</span>
              <span className="ml-2 text-text-primary">
                {new Date(contract.lastUpdated).toLocaleDateString()}
              </span>
            </div>
            {contract.modifiedBy && (
              <div className="col-span-2">
                <span className="text-text-secondary">Modified By:</span>
                <span className="ml-2 text-text-primary">{contract.modifiedBy}</span>
              </div>
            )}
          </div>

          {/* Changelog preview */}
          {contract.changeLog && contract.changeLog.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-text-secondary mb-1">Recent Changes:</p>
              <div className="bg-surface-secondary rounded-lg p-2 text-xs">
                {contract.changeLog.slice(0, 2).map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-text-secondary">{entry.date}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      entry.impact === 'breaking' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {entry.impact}
                    </span>
                    <span className="text-text-primary truncate">{entry.changes}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * QuickActionsBar - Quick action buttons for terminal, VS Code, finder, copy path
 */
function QuickActionsBar({ worktreePath }: { worktreePath?: string }): React.ReactElement {
  const [copySuccess, setCopySuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const path = worktreePath || '';

  const handleOpenTerminal = async () => {
    if (!path) return;
    setActionError(null);
    const result = await window.api?.shell?.openTerminal?.(path);
    if (!result?.success) {
      setActionError(result?.error?.message || 'Failed to open terminal');
    }
  };

  const handleOpenVSCode = async () => {
    if (!path) return;
    setActionError(null);
    const result = await window.api?.shell?.openVSCode?.(path);
    if (!result?.success) {
      setActionError(result?.error?.message || 'Failed to open VS Code');
    }
  };

  const handleOpenFinder = async () => {
    if (!path) return;
    setActionError(null);
    const result = await window.api?.shell?.openFinder?.(path);
    if (!result?.success) {
      setActionError(result?.error?.message || 'Failed to open Finder');
    }
  };

  const handleCopyPath = async () => {
    if (!path) return;
    setActionError(null);
    const result = await window.api?.shell?.copyPath?.(path);
    if (result?.success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      setActionError(result?.error?.message || 'Failed to copy path');
    }
  };

  if (!path) return <></>;

  return (
    <div className="px-4 py-2 border-b border-border bg-surface-secondary">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-secondary mr-2">Quick Actions:</span>

        <button
          onClick={handleOpenTerminal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
            bg-surface text-text-primary hover:bg-surface-tertiary transition-colors"
          title="Open Terminal"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Terminal
        </button>

        <button
          onClick={handleOpenVSCode}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
            bg-surface text-text-primary hover:bg-surface-tertiary transition-colors"
          title="Open in VS Code"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.583 17.834l-8.042-6.667 8.042-6.667V17.834zm-.001 4.165L1.999 12 17.582 2.001l4.419 2.209v15.58l-4.419 2.209z"/>
          </svg>
          VS Code
        </button>

        <button
          onClick={handleOpenFinder}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
            bg-surface text-text-primary hover:bg-surface-tertiary transition-colors"
          title="Show in Finder"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Finder
        </button>

        <button
          onClick={handleCopyPath}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
            bg-surface text-text-primary hover:bg-surface-tertiary transition-colors"
          title="Copy Path"
        >
          {copySuccess ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Path
            </>
          )}
        </button>

        {actionError && (
          <span className="text-xs text-red-500 ml-2">{actionError}</span>
        )}
      </div>
    </div>
  );
}

/**
 * TerminalTab - Shows system logs, git commands, and debug information
 */
function TerminalTab({ sessionId }: { sessionId: string }): React.ReactElement {
  const [logs, setLogs] = useState<Array<{
    id: string;
    timestamp: string;
    level: string;
    message: string;
    source?: string;
    command?: string;
    output?: string;
    exitCode?: number;
  }>>([]);
  const [filter, setFilter] = useState<'all' | 'debug' | 'info' | 'warn' | 'error' | 'git' | 'system'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  // Track when this session view was mounted (to separate historical from live)
  const [sessionResumeTime] = useState(() => new Date().toISOString());
  const [historicalCount, setHistoricalCount] = useState(0);

  // Load initial logs from database
  useEffect(() => {
    async function loadLogs() {
      if (window.api?.terminal?.getLogs) {
        const result = await window.api.terminal.getLogs(sessionId, 500);
        if (result.success && result.data) {
          setLogs(result.data);
          setHistoricalCount(result.data.length);
        }
      }
    }
    loadLogs();

    // Subscribe to new logs
    const unsubscribe = window.api?.terminal?.onLog?.((entry) => {
      if (!entry.sessionId || entry.sessionId === sessionId) {
        setLogs((prev) => [entry, ...prev].slice(0, 500));
      }
    });

    return () => unsubscribe?.();
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleClearLogs = async () => {
    if (window.api?.terminal?.clearLogs) {
      await window.api.terminal.clearLogs(sessionId);
      setLogs([]);
    }
  };

  const handleCopyAll = async () => {
    const text = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.output ? '\n' + log.output : ''}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((log) => log.level === filter);

  const levelStyles: Record<string, { bg: string; text: string; icon: string }> = {
    debug: { bg: 'bg-gray-100', text: 'text-gray-600', icon: 'D' },
    info: { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'I' },
    warn: { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: 'W' },
    error: { bg: 'bg-red-100', text: 'text-red-600', icon: 'E' },
    git: { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'G' },
    system: { bg: 'bg-green-100', text: 'text-green-600', icon: 'S' },
  };

  const filterCounts = {
    all: logs.length,
    debug: logs.filter((l) => l.level === 'debug').length,
    info: logs.filter((l) => l.level === 'info').length,
    warn: logs.filter((l) => l.level === 'warn').length,
    error: logs.filter((l) => l.level === 'error').length,
    git: logs.filter((l) => l.level === 'git').length,
    system: logs.filter((l) => l.level === 'system').length,
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Terminal</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
            {filteredLogs.length} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter buttons */}
          {(['all', 'git', 'info', 'warn', 'error'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === level
                  ? 'bg-kanvas-blue text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
              {filterCounts[level] > 0 && (
                <span className="ml-1 opacity-60">({filterCounts[level]})</span>
              )}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-700 mx-1" />
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded transition-colors ${
              autoScroll ? 'bg-kanvas-blue text-white' : 'bg-gray-700 text-gray-400'
            }`}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          <button
            onClick={handleCopyAll}
            className="p-1.5 rounded bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
            title="Copy All"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={handleClearLogs}
            className="p-1.5 rounded bg-gray-700 text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
            title="Clear Logs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-auto font-mono text-xs p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>No terminal logs yet</p>
              <p className="text-gray-600 mt-1">Logs will appear as the system operates</p>
            </div>
          </div>
        ) : (
          <>
            {/* Historical data indicator at top */}
            {historicalCount > 0 && (
              <div className="py-2 px-2 mb-2 text-center">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-700" />
                  <span className="text-xs text-gray-500">
                    {historicalCount} entries from previous session
                  </span>
                  <div className="flex-1 h-px bg-gray-700" />
                </div>
              </div>
            )}
            {filteredLogs.slice().reverse().map((log, index, arr) => {
              const style = levelStyles[log.level] || levelStyles.info;
              const isHistorical = log.timestamp < sessionResumeTime;
              const nextLog = arr[index + 1];
              const isLastHistorical = isHistorical && nextLog && nextLog.timestamp >= sessionResumeTime;

              return (
                <React.Fragment key={log.id}>
                  <div className={`flex items-start gap-2 py-1 hover:bg-gray-800 rounded px-1 ${
                    isHistorical ? 'opacity-60' : ''
                  }`}>
                    <span className="text-gray-500 flex-shrink-0 w-20">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${style.bg} ${style.text}`}>
                      {style.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      {log.command ? (
                        <>
                          <span className="text-green-400">$ {log.command}</span>
                          {log.exitCode !== undefined && log.exitCode !== 0 && (
                            <span className="text-red-400 ml-2">[exit: {log.exitCode}]</span>
                          )}
                          {log.output && (
                            <pre className="text-gray-400 mt-1 whitespace-pre-wrap break-all">{log.output}</pre>
                          )}
                        </>
                      ) : (
                        <span className={`${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warn' ? 'text-yellow-400' :
                          log.level === 'git' ? 'text-purple-400' :
                          'text-gray-300'
                        }`}>
                          {log.source && <span className="text-gray-500">[{log.source}] </span>}
                          {log.message}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Session resume separator */}
                  {isLastHistorical && (
                    <div className="py-2 my-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-kanvas-blue/50" />
                        <span className="text-xs text-kanvas-blue font-medium px-2">
                          Session resumed {new Date(sessionResumeTime).toLocaleTimeString()}
                        </span>
                        <div className="flex-1 h-px bg-kanvas-blue/50" />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  );
}

function generateDefaultPrompt(session: SessionReport): string {
  const shortSessionId = session.sessionId.replace('sess_', '').slice(0, 8);
  const task = session.task || session.branchName || 'development';

  // Determine working directory - prefer worktree for isolated development
  // Priority: explicit worktreePath > inferred worktree > repoPath
  let workDir = session.repoPath;

  if (session.worktreePath && session.worktreePath !== session.repoPath) {
    // Explicit worktree path is set and different from repo
    workDir = session.worktreePath;
  } else if (session.branchName && session.repoPath) {
    // Try to infer worktree path: repoPath/local_deploy/branchName
    const inferredWorktree = `${session.repoPath}/local_deploy/${session.branchName}`;
    workDir = inferredWorktree;
  }

  return `# SESSION ${shortSessionId}

# ⚠️ CRITICAL: WRONG DIRECTORY = WASTED WORK ⚠️
WORKDIR: ${workDir}
YOU MUST WORK ONLY IN THIS DIRECTORY - NOT THE MAIN REPO

🛑 FIRST: Run \`pwd\` and show me the output to prove you're in the worktree
🛑 DO NOT proceed until you confirm you're in: ${workDir}

BRANCH: ${session.branchName}
TASK: ${task}

## MANDATORY FIRST RESPONSE
Before doing ANY other work, you MUST respond with:
✓ Current directory: [output of pwd]
✓ Houserules read: [yes/no - if yes, summarize key rules]
✓ File locks checked: [yes/no]

## 1. SETUP (run first)
\`\`\`bash
# Check if worktree exists, create if not
if [ ! -d "${workDir}" ]; then
  cd "${session.repoPath}"
  git worktree add "${workDir}" ${session.branchName}
fi
cd "${workDir}"
pwd  # Verify: should be ${workDir}

# ⚠️ CRITICAL: Read house rules BEFORE making any changes!
cat houserules.md 2>/dev/null || echo "No houserules.md - create one as you learn the codebase"
\`\`\`

📋 **HOUSE RULES** contain project-specific patterns, conventions, testing requirements, and gotchas.
If houserules.md exists, you MUST follow its rules. If it doesn't exist, create one as you work.

## 2. CONTEXT FILE (critical - survives context compaction)
Create immediately so you can recover after compaction:
\`\`\`bash
cat > .claude-session-${shortSessionId}.md << 'EOF'
# Session ${shortSessionId}
Dir: ${workDir}
Branch: ${session.branchName}
Task: ${task}

## Files to Re-read After Compaction
1. This file: .claude-session-${shortSessionId}.md
2. House rules: houserules.md
3. File locks: .file-coordination/active-edits/

## Progress (update as you work)
- [ ] Task started
- [ ] Files identified
- [ ] Implementation in progress
- [ ] Testing complete
- [ ] Ready for commit

## Key Findings (add to houserules.md too)
- e.g. "Uses Zustand for state" or "Tests need build first"

## Notes (context for after compaction)
- e.g. "Working on AuthService.ts" or "Blocked on X"
EOF
\`\`\`

## 3. AFTER CONTEXT COMPACTION
If you see "context compacted", IMMEDIATELY:
1. cd "${workDir}"
2. cat .claude-session-${shortSessionId}.md
3. cat houserules.md
4. ls .file-coordination/active-edits/

## 4. FILE LOCKS (before editing any file)
\`\`\`bash
ls .file-coordination/active-edits/  # Check for conflicts first
# Replace <FILES> with actual files you're editing:
cat > .file-coordination/active-edits/claude-${shortSessionId}.json << 'EOF'
{"agent":"claude","session":"${shortSessionId}","files":["<file1.ts>","<file2.ts>"],"operation":"edit","reason":"${task}"}
EOF
\`\`\`

## 5. HOUSE RULES (read first, update as you learn)
Update houserules.md with patterns you discover (conventions, architecture, testing, gotchas):
\`\`\`bash
# Replace <CATEGORY> and <RULE> with actual findings:
cat >> houserules.md << 'EOF'

## <CATEGORY> - Claude ${shortSessionId}
- <RULE OR PATTERN>
EOF
\`\`\`

## 6. COMMITS
📝 **Write commit messages to: \`.devops-commit-${shortSessionId}.msg\`** (this session's file)
⚠️ DO NOT use .claude-commit-msg - use the session-specific file above!
**One story = one commit.** If given multiple stories, complete and commit each separately.

---
⛔ STOP: Run setup commands, read houserules.md, then await instructions.`;
}
