/**
 * SessionDetailView Component
 * Shows detailed view of a selected session including prompt, activity, files, and contracts
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionReport } from '../../../shared/agent-protocol';
import type { AgentInstance, ContractType, Contract, ActivityLogEntry, DiscoveredFeature } from '../../../shared/types';
import { useAgentStore } from '../../store/agentStore';
import { CommitsTab } from './CommitsTab';

type DetailTab = 'prompt' | 'activity' | 'commits' | 'files' | 'contracts' | 'terminal';

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
  const [showErrorPopup, setShowErrorPopup] = useState(false);

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
    setShowErrorPopup(false);
    try {
      const repoPath = session.worktreePath || session.repoPath;
      const baseBranch = session.baseBranch || 'main';

      if (!repoPath) {
        setSyncResult({ success: false, message: 'No repository path configured' });
        setShowErrorPopup(true);
        return;
      }

      console.log(`[SessionDetail] Syncing ${repoPath} with ${baseBranch}...`);

      // First fetch
      const fetchResult = await window.api?.git?.fetch?.(repoPath, 'origin');
      if (!fetchResult?.success) {
        const errorMessage = fetchResult?.error?.message || 'Failed to fetch from remote';
        setSyncResult({ success: false, message: errorMessage });
        setShowErrorPopup(true);
        return;
      }

      // Then rebase
      const rebaseResult = await window.api?.git?.performRebase?.(repoPath, baseBranch);

      if (rebaseResult?.success && rebaseResult.data) {
        const resultMessage = rebaseResult.data.message || (rebaseResult.data.success ? 'Synced successfully' : 'Rebase failed');
        setSyncResult({
          success: rebaseResult.data.success,
          message: resultMessage,
        });

        // Show popup for failures or warnings
        if (!rebaseResult.data.success) {
          setShowErrorPopup(true);
        } else if (resultMessage.toLowerCase().includes('warning') || resultMessage.toLowerCase().includes('conflict')) {
          setShowErrorPopup(true);
        } else {
          // Clear success message after 5 seconds
          setTimeout(() => setSyncResult(null), 5000);
        }
      } else {
        const errorMessage = rebaseResult?.error?.message || 'Rebase failed - check console for details';
        setSyncResult({
          success: false,
          message: errorMessage,
        });
        setShowErrorPopup(true);
      }
    } catch (error) {
      console.error('[SessionDetail] Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Sync failed unexpectedly';
      setSyncResult({
        success: false,
        message: errorMessage,
      });
      setShowErrorPopup(true);
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
      {/* Error/Warning Popup */}
      {showErrorPopup && syncResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-surface border rounded-lg shadow-xl max-w-md w-full mx-4 p-6 ${
            syncResult.success ? 'border-yellow-500' : 'border-red-500'
          }`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {syncResult.success ? (
                  <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <h3 className={`text-lg font-semibold mb-2 ${
                  syncResult.success ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {syncResult.success ? 'Sync Warning' : 'Sync Failed'}
                </h3>
                <p className="text-text-secondary text-sm whitespace-pre-wrap">{syncResult.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowErrorPopup(false);
                  setSyncResult(null);
                }}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Dismiss
              </button>
              {!syncResult.success && (
                <button
                  onClick={() => {
                    setShowErrorPopup(false);
                    handleSync();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
          {(['prompt', 'activity', 'commits', 'terminal', 'files', 'contracts'] as DetailTab[]).map((tab) => (
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
        {activeTab === 'commits' && (
          <CommitsTab session={session} />
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
  const [scanPathOption, setScanPathOption] = useState<'main' | 'worktree'>('worktree');
  const [discoveredFeatures, setDiscoveredFeatures] = useState<Array<{
    name: string;
    description?: string;
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
  const [activityLogs, setActivityLogs] = useState<Array<{
    time: string;
    message: string;
    type: 'info' | 'success' | 'error';
  }>>([]);
  const [showActivityLog, setShowActivityLog] = useState(true);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);
  const [featuresCollapsed, setFeaturesCollapsed] = useState(false);

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
    // Additional Contracts
    { type: 'admin', label: 'Admin', icon: '👤', file: 'ADMIN_CONTRACT.md' },
    { type: 'sql', label: 'SQL', icon: '🗃️', file: 'SQL_CONTRACT.md' },
    { type: 'css', label: 'CSS', icon: '🎨', file: 'CSS_CONTRACT.md' },
    { type: 'prompts', label: 'Prompts', icon: '💬', file: 'PROMPTS_CONTRACT.md' },
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

        // Load contract changes in background (non-blocking)
        if (window.api?.contract?.analyzeCommit && repoPath) {
          window.api.contract.analyzeCommit(repoPath).then(result => {
            if (result.success && result.data?.changes) {
              setContractChanges(result.data.changes);
            }
          }).catch(() => {});
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
          // Additional Contracts
          {
            id: 'admin-contract',
            type: 'admin',
            name: 'Admin Contract',
            description: 'Admin panel capabilities, CRUD operations, and permissions',
            filePath: `${repoPath}/House_Rules_Contracts/ADMIN_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'sql-contract',
            type: 'sql',
            name: 'SQL Contract',
            description: 'Reusable SQL queries, stored procedures, and performance hints',
            filePath: `${repoPath}/House_Rules_Contracts/SQL_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'css-contract',
            type: 'css',
            name: 'CSS Contract',
            description: 'Design tokens, themes, and style guidelines',
            filePath: `${repoPath}/House_Rules_Contracts/CSS_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
          {
            id: 'prompts-contract',
            type: 'prompts',
            name: 'Prompts & Skills Contract',
            description: 'AI prompts, skills, modes, and agent configurations',
            filePath: `${repoPath}/House_Rules_Contracts/PROMPTS_CONTRACT.md`,
            status: 'active',
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
          },
        ];

        // Show base contracts immediately
        setContracts(knownContracts);
        setLoading(false);

        // Load test contracts in background (from saved features cache)
        if (window.api?.contractGeneration?.loadDiscoveredFeatures && repoPath) {
          window.api.contractGeneration.loadDiscoveredFeatures(repoPath).then(savedResult => {
            if (savedResult?.success && savedResult.data && savedResult.data.length > 0) {
              // Also update discoveredFeatures state
              setDiscoveredFeatures(savedResult.data);

              // Collect all test files by type (GROUPED)
              const e2eFiles: string[] = [];
              const unitFiles: string[] = [];
              const integrationFiles: string[] = [];
              const fixtureFiles: string[] = [];

              for (const feature of savedResult.data) {
                e2eFiles.push(...(feature.files?.tests?.e2e || []));
                unitFiles.push(...(feature.files?.tests?.unit || []));
                integrationFiles.push(...(feature.files?.tests?.integration || []));
                fixtureFiles.push(...(feature.files?.fixtures || []));
              }

              // Add test contract cards
              const testContracts: Contract[] = [];

              if (e2eFiles.length > 0) {
                testContracts.push({
                  id: 'e2e-all',
                  type: 'e2e',
                  name: 'E2E Tests',
                  description: `${e2eFiles.length} E2E test file(s)`,
                  filePath: `${repoPath}/.devops-kit/contracts/E2E_TESTS.md`,
                  status: 'active',
                  version: '1.0.0',
                  lastUpdated: new Date().toISOString(),
                });
              }

              if (unitFiles.length > 0) {
                testContracts.push({
                  id: 'unit-all',
                  type: 'unit',
                  name: 'Unit Tests',
                  description: `${unitFiles.length} unit test file(s)`,
                  filePath: `${repoPath}/.devops-kit/contracts/UNIT_TESTS.md`,
                  status: 'active',
                  version: '1.0.0',
                  lastUpdated: new Date().toISOString(),
                });
              }

              if (integrationFiles.length > 0) {
                testContracts.push({
                  id: 'integration-all',
                  type: 'integration',
                  name: 'Integration Tests',
                  description: `${integrationFiles.length} integration test file(s)`,
                  filePath: `${repoPath}/.devops-kit/contracts/INTEGRATION_TESTS.md`,
                  status: 'active',
                  version: '1.0.0',
                  lastUpdated: new Date().toISOString(),
                });
              }

              if (fixtureFiles.length > 0) {
                testContracts.push({
                  id: 'fixtures-all',
                  type: 'fixtures',
                  name: 'Test Fixtures',
                  description: `${fixtureFiles.length} fixture file(s)`,
                  filePath: `${repoPath}/.devops-kit/contracts/FIXTURES.md`,
                  status: 'active',
                  version: '1.0.0',
                  lastUpdated: new Date().toISOString(),
                });
              }

              // Append test contracts to existing
              if (testContracts.length > 0) {
                setContracts(prev => {
                  const nonTest = prev.filter(c => !['e2e', 'unit', 'integration', 'fixtures'].includes(c.type));
                  return [...nonTest, ...testContracts];
                });
              }
            }
          }).catch(() => {});
        }

        // Early return - loading already set to false above
        return;
      } catch (error) {
        console.error('Failed to load contracts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadContracts();
  }, [session.sessionId, session.repoPath, session.worktreePath]);

  // Update contracts list when discoveredFeatures change (add grouped test contracts)
  useEffect(() => {
    if (discoveredFeatures.length === 0) return;

    const repoPath = session.worktreePath || session.repoPath;
    if (!repoPath) return;

    // Add GROUPED test contracts from discovered features
    setContracts(prev => {
      // Filter out existing test contracts to avoid duplicates
      const nonTestContracts = prev.filter(c => !['e2e', 'unit', 'integration', 'fixtures'].includes(c.type));

      // Collect all test files by type
      const e2eFiles: string[] = [];
      const unitFiles: string[] = [];
      const integrationFiles: string[] = [];
      const fixtureFiles: string[] = [];

      for (const feature of discoveredFeatures) {
        e2eFiles.push(...(feature.files?.tests?.e2e || []));
        unitFiles.push(...(feature.files?.tests?.unit || []));
        integrationFiles.push(...(feature.files?.tests?.integration || []));
        fixtureFiles.push(...(feature.files?.fixtures || []));
      }

      const newTestContracts: Contract[] = [];

      // Create ONE card per test type (grouped)
      if (e2eFiles.length > 0) {
        newTestContracts.push({
          id: 'e2e-all',
          type: 'e2e',
          name: 'E2E Tests',
          description: `${e2eFiles.length} E2E test file(s) across ${discoveredFeatures.length} features`,
          filePath: `${repoPath}/.devops-kit/contracts/E2E_TESTS.md`,
          status: 'active',
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          testFiles: e2eFiles, // Store for later
        } as Contract & { testFiles: string[] });
      }

      if (unitFiles.length > 0) {
        newTestContracts.push({
          id: 'unit-all',
          type: 'unit',
          name: 'Unit Tests',
          description: `${unitFiles.length} unit test file(s) across ${discoveredFeatures.length} features`,
          filePath: `${repoPath}/.devops-kit/contracts/UNIT_TESTS.md`,
          status: 'active',
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          testFiles: unitFiles,
        } as Contract & { testFiles: string[] });
      }

      if (integrationFiles.length > 0) {
        newTestContracts.push({
          id: 'integration-all',
          type: 'integration',
          name: 'Integration Tests',
          description: `${integrationFiles.length} integration test file(s) across ${discoveredFeatures.length} features`,
          filePath: `${repoPath}/.devops-kit/contracts/INTEGRATION_TESTS.md`,
          status: 'active',
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          testFiles: integrationFiles,
        } as Contract & { testFiles: string[] });
      }

      if (fixtureFiles.length > 0) {
        newTestContracts.push({
          id: 'fixtures-all',
          type: 'fixtures',
          name: 'Test Fixtures',
          description: `${fixtureFiles.length} fixture file(s) across ${discoveredFeatures.length} features`,
          filePath: `${repoPath}/.devops-kit/contracts/FIXTURES.md`,
          status: 'active',
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          testFiles: fixtureFiles,
        } as Contract & { testFiles: string[] });
      }

      return [...nonTestContracts, ...newTestContracts];
    });
  }, [discoveredFeatures, session.worktreePath, session.repoPath]);

  // Listen for generation progress events
  useEffect(() => {
    const unsubProgress = window.api?.contractGeneration?.onProgress((progress) => {
      setGenerationProgress(progress);
      // Add activity log entry
      const time = new Date().toLocaleTimeString();
      const stepLabels: Record<string, string> = {
        discovering: 'Discovering features',
        analyzing: 'Analyzing code',
        generating: 'Generating contract',
        saving: 'Saving contract',
      };
      const contractTypeLabels: Record<string, string> = {
        markdown: '📄 Markdown',
        json: '📋 JSON',
        admin: '👤 Admin',
      };
      const stepLabel = stepLabels[progress.currentStep] || progress.currentStep;
      const contractTypeLabel = progress.contractType ? ` [${contractTypeLabels[progress.contractType] || progress.contractType}]` : '';
      setActivityLogs(prev => {
        const newLog = { time, message: `${stepLabel}${contractTypeLabel}: ${progress.currentFeature}`, type: 'info' as const };
        // Keep only last 50 logs
        return [...prev.slice(-49), newLog];
      });
    });
    const unsubComplete = window.api?.contractGeneration?.onComplete((result) => {
      setIsGenerating(false);
      setGenerationProgress(null);
      // Add completion log
      const time = new Date().toLocaleTimeString();
      setActivityLogs(prev => [...prev.slice(-49), {
        time,
        message: `Completed: ${result.generated} contracts generated, ${result.failed} failed (${(result.duration / 1000).toFixed(1)}s)`,
        type: result.failed > 0 ? 'error' as const : 'success' as const,
      }]);
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

  // Load saved discovered features on mount
  useEffect(() => {
    const loadSavedFeatures = async () => {
      const repoPath = getScanPath();
      console.log('[SessionDetailView] loadSavedFeatures called with path:', repoPath);
      console.log('[SessionDetailView] session.repoPath:', session.repoPath);
      console.log('[SessionDetailView] session.worktreePath:', session.worktreePath);
      console.log('[SessionDetailView] scanPathOption:', scanPathOption);
      if (!repoPath) {
        console.log('[SessionDetailView] No repoPath, skipping feature load');
        return;
      }

      try {
        const result = await window.api?.contractGeneration?.loadDiscoveredFeatures(repoPath);
        console.log('[SessionDetailView] loadDiscoveredFeatures result:', result);
        if (result?.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          console.log('[SessionDetailView] Setting', result.data.length, 'discovered features');
          setDiscoveredFeatures(result.data as typeof discoveredFeatures);
        } else {
          console.log('[SessionDetailView] No features found in database for path:', repoPath);
        }
      } catch (err) {
        console.error('Failed to load saved features:', err);
      }
    };

    loadSavedFeatures();
  }, [session.worktreePath, session.repoPath, scanPathOption]);

  // Discover features in the repository
  const handleDiscoverFeatures = async () => {
    const repoPath = getScanPath();
    if (!repoPath) return;

    setIsDiscovering(true);
    setDiscoveredFeatures([]);
    setGenerationResult(null);

    try {
      // Use AI to intelligently filter features (true = use LLM to identify actual features)
      const result = await window.api?.contractGeneration?.discoverFeatures(repoPath, true);
      if (result?.success && result.data) {
        setDiscoveredFeatures(result.data);
        // Save discovered features for later
        await window.api?.contractGeneration?.saveDiscoveredFeatures(repoPath, result.data);
      }
    } catch (err) {
      console.error('Failed to discover features:', err);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Generate contracts for all discovered features
  // forceRefresh=false (default): Incremental mode - only process features with changes
  // forceRefresh=true: Process all features regardless of changes
  const handleGenerateAll = async (forceRefresh = false) => {
    const repoPath = getScanPath();
    if (!repoPath || isGenerating) return;

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      await window.api?.contractGeneration?.generateAll(repoPath, {
        includeCodeSamples: true,
        maxFilesPerFeature: 10,
        preDiscoveredFeatures: discoveredFeatures.length > 0 ? discoveredFeatures : undefined,
        forceRefresh,
      });
      // Result comes via onComplete event
    } catch (err) {
      console.error('Failed to generate contracts:', err);
      setIsGenerating(false);
    }
  };

  // State for generate button dropdown
  const [showGenerateDropdown, setShowGenerateDropdown] = useState(false);

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
            {/* Show warning if no repo path */}
            {!getScanPath() && (
              <span className="text-xs text-orange-600 px-2 py-1 bg-orange-50 rounded">
                Missing path - repoPath: "{session.repoPath || ''}" | worktreePath: "{session.worktreePath || ''}"
              </span>
            )}
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
              {/* Split button: Update Contracts (incremental) with Force Refresh dropdown */}
              <div className="relative">
                <div className="flex">
                  <button
                    onClick={() => handleGenerateAll(false)}
                    disabled={isGenerating || !getScanPath()}
                    className={`px-3 py-1.5 rounded-l-lg text-sm font-medium transition-colors
                      ${isGenerating
                        ? 'bg-kanvas-blue text-white cursor-wait'
                        : !getScanPath()
                          ? 'bg-surface-tertiary text-text-secondary cursor-not-allowed'
                          : 'bg-kanvas-blue text-white hover:bg-blue-600'
                      }`}
                    title={discoveredFeatures.length === 0 ? "Will auto-discover features and generate contracts" : "Smart update - only processes features with changes since last run"}
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-2">
                        <span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full" />
                        Generating...
                      </span>
                    ) : (
                      '✨ Update Contracts'
                    )}
                  </button>
                  <button
                    onClick={() => setShowGenerateDropdown(!showGenerateDropdown)}
                    disabled={isGenerating || !getScanPath()}
                    className={`px-2 py-1.5 rounded-r-lg text-sm font-medium transition-colors border-l border-white/20
                      ${isGenerating
                        ? 'bg-kanvas-blue text-white cursor-wait'
                        : !getScanPath()
                          ? 'bg-surface-tertiary text-text-secondary cursor-not-allowed'
                          : 'bg-kanvas-blue text-white hover:bg-blue-600'
                      }`}
                  >
                    <svg className={`w-4 h-4 transition-transform ${showGenerateDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {showGenerateDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 min-w-[180px]">
                    <button
                      onClick={() => { handleGenerateAll(false); setShowGenerateDropdown(false); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-secondary flex items-center gap-2 rounded-t-lg"
                    >
                      <span className="text-green-500">⚡</span>
                      <div>
                        <div className="font-medium text-text-primary">Smart Update</div>
                        <div className="text-xs text-text-secondary">Only changed features</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { handleGenerateAll(true); setShowGenerateDropdown(false); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-surface-secondary flex items-center gap-2 rounded-b-lg border-t border-border"
                    >
                      <span className="text-orange-500">🔄</span>
                      <div>
                        <div className="font-medium text-text-primary">Force Refresh</div>
                        <div className="text-xs text-text-secondary">Regenerate all contracts</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
            {generationProgress.contractType && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                generationProgress.contractType === 'markdown' ? 'bg-purple-100 text-purple-700' :
                generationProgress.contractType === 'json' ? 'bg-green-100 text-green-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {generationProgress.contractType === 'markdown' ? '📄 Markdown' :
                 generationProgress.contractType === 'json' ? '📋 JSON' : '👤 Admin'}
              </span>
            )}
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
          {/* Activity Log */}
          <div className="mt-3">
            <button
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>{showActivityLog ? '▼' : '▶'}</span>
              Activity Log ({activityLogs.length})
            </button>
            {showActivityLog && activityLogs.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto bg-white/50 rounded p-2 text-xs font-mono">
                {activityLogs.slice(-10).map((log, i) => (
                  <div key={i} className={`py-0.5 ${log.type === 'error' ? 'text-red-600' : log.type === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
                    <span className="text-gray-400">[{log.time}]</span> {log.message}
                  </div>
                ))}
              </div>
            )}
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

      {/* Discovered Features - Table View */}
      {discoveredFeatures.length > 0 && !isGenerating && (
        <div className="mx-4 mt-4 p-3 bg-surface-secondary rounded-xl border border-border flex flex-col">
          <div className="flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setFeaturesCollapsed(!featuresCollapsed)}
              className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-kanvas-blue transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${featuresCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Discovered {discoveredFeatures.length} feature(s)
            </button>
            <button
              onClick={() => setDiscoveredFeatures([])}
              className="text-xs text-text-secondary hover:text-text-primary"
            >
              Clear
            </button>
          </div>

          {/* Features Table - Collapsible */}
          {!featuresCollapsed && (
          <>
          <div className="overflow-auto flex-1 min-h-0 max-h-[350px] mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-2 pr-4 font-medium">Feature</th>
                  <th className="pb-2 pr-4 font-medium">Location</th>
                  <th className="pb-2 pr-2 font-medium text-center" title="API files">🔌</th>
                  <th className="pb-2 pr-2 font-medium text-center" title="Schema files">📐</th>
                  <th className="pb-2 pr-2 font-medium text-center" title="Events/Config">⚡</th>
                  <th className="pb-2 pr-2 font-medium text-center" title="Unit tests">🧪</th>
                  <th className="pb-2 pr-2 font-medium text-center" title="E2E tests">🎭</th>
                  <th className="pb-2 font-medium text-center">Files</th>
                </tr>
              </thead>
              <tbody>
                {discoveredFeatures.map(f => {
                  // Check if this feature has contract changes
                  const featureChanges = contractChanges.filter(c =>
                    c.file.toLowerCase().includes(f.name.toLowerCase()) ||
                    c.file.includes(f.basePath)
                  );
                  const hasChanges = featureChanges.length > 0;
                  const hasBreaking = featureChanges.some(c => c.impactLevel === 'breaking');

                  // Get relative path from repo root
                  const relativePath = f.basePath.split('/').slice(-2).join('/');

                  return (
                    <tr
                      key={f.name}
                      className={`border-b border-border/50 hover:bg-surface transition-colors ${
                        hasBreaking ? 'bg-red-50/50' : hasChanges ? 'bg-yellow-50/50' : ''
                      }`}
                    >
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{f.name}</span>
                          {hasChanges && (
                            <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${
                              hasBreaking ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                            }`}>
                              {hasBreaking ? '⚠️' : '✏️'}
                            </span>
                          )}
                        </div>
                        {f.description && (
                          <div className="text-text-secondary text-[10px] mt-0.5 max-w-[300px] leading-tight">
                            {f.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <code className="text-[10px] text-text-secondary bg-surface px-1 py-0.5 rounded">
                          {relativePath}
                        </code>
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {f.files.api.length > 0 ? (
                          <span className="text-green-600" title={`${f.files.api.length} API files`}>✓</span>
                        ) : (
                          <span className="text-text-secondary/30">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {f.files.schema.length > 0 ? (
                          <span className="text-blue-600" title={`${f.files.schema.length} Schema files`}>✓</span>
                        ) : (
                          <span className="text-text-secondary/30">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {f.files.config.length > 0 ? (
                          <span className="text-purple-600" title={`${f.files.config.length} Config/Event files`}>✓</span>
                        ) : (
                          <span className="text-text-secondary/30">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {f.files.tests.unit.length > 0 ? (
                          <span className="text-amber-600" title={`${f.files.tests.unit.length} Unit tests`}>✓</span>
                        ) : (
                          <span className="text-text-secondary/30">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {f.files.tests.e2e.length > 0 ? (
                          <span className="text-cyan-600" title={`${f.files.tests.e2e.length} E2E tests`}>✓</span>
                        ) : (
                          <span className="text-text-secondary/30">-</span>
                        )}
                      </td>
                      <td className="py-2 text-center text-text-secondary">
                        {f.contractPatternMatches}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-3 pt-2 border-t border-border flex flex-wrap gap-3 text-[10px] text-text-secondary">
            <span>🔌 API</span>
            <span>📐 Schema</span>
            <span>⚡ Events/Config</span>
            <span>🧪 Unit Tests</span>
            <span>🎭 E2E Tests</span>
          </div>
          </>
          )}
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
              <ContractCard
                key={contract.id}
                contract={contract}
                repoPath={session.worktreePath || session.repoPath}
                hasChanges={contractChanges.some(c => c.file.includes(contract.name) || contract.filePath.includes(c.file))}
                discoveredFeatures={discoveredFeatures as DiscoveredFeature[]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Cleanup AI preamble and code blocks from contract content
 * This fixes contracts that were generated before cleanup was added to the backend
 */
function cleanupContractContent(content: string): string {
  let cleaned = content.trim();

  // Remove AI preamble patterns at the start
  const preamblePatterns = [
    /^I'll analyze.*?\n+/i,
    /^I will analyze.*?\n+/i,
    /^Let me (analyze|examine|generate|create).*?\n+/i,
    /^I will (analyze|examine|generate|create).*?\n+/i,
    /^Here('s| is) (the|a) (contract|document|markdown|analysis).*?\n+/i,
    /^Based on (the|my) analysis.*?\n+/i,
    /^Looking at (the|this).*?\n+/i,
    /^After (analyzing|examining|reviewing).*?\n+/i,
  ];

  for (const pattern of preamblePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  // If content starts with a code fence, check if it's code instead of markdown
  const codeBlockMatch = cleaned.match(/^```(\w+)\n/);
  if (codeBlockMatch) {
    const lang = codeBlockMatch[1].toLowerCase();
    // If it's markdown, extract it
    if (lang === 'markdown' || lang === 'md') {
      cleaned = cleaned.replace(/^```(?:markdown|md)\n?/, '').replace(/\n?```\s*$/, '');
    }
    // If it's code (Python, JS, etc), this is a bad response - return warning
    else if (['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'java', 'go', 'rust'].includes(lang)) {
      return `# Contract Needs Regeneration

> **Note:** This contract contains code instead of proper documentation.
> Click "Force Refresh" to regenerate it properly.

---

*Original content was ${lang} code that should have been markdown documentation.*`;
    }
  }

  // Check if the content looks like Python code without code fences
  if (cleaned.startsWith('import ') || cleaned.startsWith('from ') || cleaned.startsWith('def ') || cleaned.startsWith('class ')) {
    return `# Contract Needs Regeneration

> **Note:** This contract contains Python code instead of proper documentation.
> Click "Force Refresh" to regenerate it properly.`;
  }

  // Check for multiple lines of Python code (common patterns)
  const pythonPatterns = /^(import \w+|from \w+ import|def \w+\(|class \w+:|if __name__|print\()/m;
  const pythonMatches = cleaned.match(pythonPatterns);
  if (pythonMatches && pythonMatches.length > 2) {
    return `# Contract Needs Regeneration

> **Note:** This contract appears to contain code instead of documentation.
> Click "Force Refresh" to regenerate it properly.`;
  }

  return cleaned;
}

/**
 * Extract version from contract content
 * Looks for <!-- Version: X.X.X | Generated: ... --> comment or version: "X.X.X" in JSON
 */
function extractVersionFromContent(content: string): string | null {
  // Try HTML comment format first: <!-- Version: 1.0.1 | Generated: ... -->
  const versionMatch = content.match(/<!--\s*Version:\s*([\d.]+)/i);
  if (versionMatch) {
    return versionMatch[1];
  }

  // Try JSON format: "version": "1.0.0"
  const jsonMatch = content.match(/"version"\s*:\s*"([\d.]+)"/);
  if (jsonMatch) {
    return jsonMatch[1];
  }

  // Try YAML frontmatter: version: 1.0.0
  const yamlMatch = content.match(/^version:\s*([\d.]+)/m);
  if (yamlMatch) {
    return yamlMatch[1];
  }

  return null;
}

/**
 * Extract metrics from contract markdown content
 */
function extractContractMetrics(content: string, type: string): { label: string; count: number }[] {
  const metrics: { label: string; count: number }[] = [];

  switch (type) {
    case 'api': {
      // Count endpoints (lines starting with ### GET, ### POST, etc.)
      const endpointMatches = content.match(/^###?\s+(GET|POST|PUT|DELETE|PATCH)\s+/gm);
      if (endpointMatches) metrics.push({ label: 'Endpoints', count: endpointMatches.length });
      // Count route patterns
      const routeMatches = content.match(/`\/([\w/:]+)`/g);
      if (routeMatches) metrics.push({ label: 'Routes', count: new Set(routeMatches).size });
      break;
    }
    case 'schema': {
      // Count tables/models
      const tableMatches = content.match(/^##\s+\w+/gm);
      if (tableMatches) metrics.push({ label: 'Tables', count: tableMatches.length });
      // Count fields (lines with | field |)
      const fieldMatches = content.match(/^\|\s*\w+\s*\|/gm);
      if (fieldMatches) metrics.push({ label: 'Fields', count: fieldMatches.length });
      break;
    }
    case 'events': {
      // Count events
      const eventMatches = content.match(/^###?\s+\w+/gm);
      if (eventMatches) metrics.push({ label: 'Events', count: eventMatches.length });
      break;
    }
    case 'e2e':
    case 'unit':
    case 'integration': {
      // Count tests (lines with test/it/describe)
      const testMatches = content.match(/^\s*-\s+.*test|^\s*-\s+.*spec|^###?\s+Test/gim);
      if (testMatches) metrics.push({ label: 'Tests', count: testMatches.length });
      break;
    }
    case 'infra': {
      // Count env vars
      const envMatches = content.match(/`[A-Z_]+`/g);
      if (envMatches) metrics.push({ label: 'Env Vars', count: new Set(envMatches).size });
      break;
    }
    case 'features': {
      // Count feature flags
      const flagMatches = content.match(/^\s*-\s+`?\w+`?:/gm);
      if (flagMatches) metrics.push({ label: 'Flags', count: flagMatches.length });
      break;
    }
    case 'integrations': {
      // Count integrations
      const integrationMatches = content.match(/^##\s+\w+/gm);
      if (integrationMatches) metrics.push({ label: 'Services', count: integrationMatches.length });
      break;
    }
    default: {
      // Count sections as generic metric
      const sectionMatches = content.match(/^##\s+/gm);
      if (sectionMatches) metrics.push({ label: 'Sections', count: sectionMatches.length });
    }
  }

  return metrics;
}

/**
 * ContractCard - Individual contract display matching House_Rules_Contracts format
 */
interface FeatureContract {
  name: string;
  path: string;
}

function ContractCard({ contract, repoPath, hasChanges, discoveredFeatures }: {
  contract: Contract;
  repoPath?: string;
  hasChanges?: boolean;
  discoveredFeatures?: DiscoveredFeature[];
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [diffStats, setDiffStats] = useState<{ additions: number; deletions: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ label: string; count: number }[]>([]);
  const [extractedVersion, setExtractedVersion] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string>('repo');
  const [featureContracts, setFeatureContracts] = useState<FeatureContract[]>([]);
  const [fileExists, setFileExists] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'markdown' | 'json'>('markdown');
  const [rawContent, setRawContent] = useState<string | null>(null);

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
    admin: '👤',
    sql: '🗃️',
    prompts: '💬',
    e2e: '🎭',
    unit: '🧪',
    integration: '🔗',
    fixtures: '📦',
  };

  const typeLabels: Record<string, string> = {
    api: 'API Contract',
    schema: 'Schema',
    events: 'Feature Bus',
    css: 'CSS/Design',
    features: 'Feature Flags',
    infra: 'Infrastructure',
    integrations: '3rd Party',
    admin: 'Admin Panel',
    sql: 'SQL Queries',
    prompts: 'Prompts & Skills',
    e2e: 'E2E Tests',
    unit: 'Unit Tests',
    integration: 'Integration Tests',
    fixtures: 'Test Fixtures',
  };

  const loadContent = async (filePath?: string) => {
    const pathToLoad = filePath || contract.filePath;
    // Only skip if we're loading the same path and already have content
    if (content && !filePath && !loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.api?.file?.readContent?.(pathToLoad);
      if (result?.success && result.data) {
        setFileExists(true);
        setRawContent(result.data); // Store raw for JSON view
        // Clean up AI preamble/code from old contracts
        const cleanedContent = cleanupContractContent(result.data);
        setContent(cleanedContent);
        setMetrics(extractContractMetrics(cleanedContent, contract.type));
        // Extract version from content (before cleanup to get metadata)
        const version = extractVersionFromContent(result.data);
        if (version) {
          setExtractedVersion(version);
        }
      } else {
        // Check if file doesn't exist vs other error
        const errorMsg = result?.error?.message || 'Failed to load content';
        if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file') || errorMsg.includes('does not exist')) {
          setFileExists(false);
          setError(null); // Don't show error, show generate button instead
        } else {
          setError(errorMsg);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load content';
      if (errorMsg.includes('ENOENT') || errorMsg.includes('no such file')) {
        setFileExists(false);
        setError(null);
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle generating a single contract
  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[ContractCard] handleGenerate called, selectedFeature:', selectedFeature, 'repoPath:', repoPath);

    if (!repoPath || generating) {
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Always regenerate repo-level contract first
      console.log('[ContractCard] Regenerating REPO-level contract:', contract.type);
      const repoResult = await window.api?.contractGeneration?.generateSingle?.(repoPath, contract.type);

      if (!repoResult?.success || !repoResult.data?.success) {
        console.warn('[ContractCard] Repo contract failed:', repoResult?.data?.error);
      }

      // Then regenerate all feature-level contracts
      if (discoveredFeatures && discoveredFeatures.length > 0) {
        console.log('[ContractCard] Regenerating', discoveredFeatures.length, 'feature contracts...');

        for (const feature of discoveredFeatures) {
          console.log('[ContractCard] Regenerating feature:', feature.name);
          try {
            await window.api?.contractGeneration?.generateFeature?.(repoPath, feature, {
              includeCodeSamples: true,
              maxFilesPerFeature: 10,
            });
          } catch (err) {
            console.warn('[ContractCard] Failed to regenerate feature:', feature.name, err);
          }
        }
      }

      // Reload the currently selected content
      setFileExists(true);
      if (selectedFeature === 'repo') {
        await loadContent(contract.filePath);
      } else {
        const featureContract = featureContracts.find(f => f.name === selectedFeature);
        if (featureContract) {
          await loadContent(featureContract.path);
        }
      }

      console.log('[ContractCard] All contracts regenerated');
    } catch (err) {
      console.error('[ContractCard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate contracts');
    } finally {
      setGenerating(false);
    }
  };

  // Load feature contracts related to this contract type
  useEffect(() => {
    if (discoveredFeatures && discoveredFeatures.length > 0 && repoPath) {
      const features: FeatureContract[] = discoveredFeatures.map(f => ({
        name: f.name,
        path: `${f.basePath}/CONTRACTS.md`,
      }));
      setFeatureContracts(features);
    }
  }, [discoveredFeatures, repoPath]);

  // Handle feature selection change
  const handleFeatureChange = async (featureName: string) => {
    setSelectedFeature(featureName);
    setContent(null); // Clear current content
    setMetrics([]);
    setExtractedVersion(null);

    if (featureName === 'repo') {
      // Load repo-level contract
      await loadContent(contract.filePath);
    } else {
      // Load feature-level contract
      const feature = featureContracts.find(f => f.name === featureName);
      if (feature) {
        await loadContent(feature.path);
      }
    }
  };

  const loadDiff = async () => {
    if (diff || loadingDiff || !repoPath) return;
    setLoadingDiff(true);
    try {
      const result = await window.api?.git?.getDiffSummary?.(repoPath);
      if (result?.success && result.data?.files) {
        // Find diff for this contract file
        const relativePath = contract.filePath.replace(repoPath + '/', '');
        const fileDiff = result.data.files.find((f: { path: string }) =>
          f.path === relativePath ||
          contract.filePath.includes(f.path) ||
          f.path.includes(contract.name)
        );
        if (fileDiff) {
          setDiff(fileDiff.diff);
          setDiffStats({ additions: fileDiff.additions, deletions: fileDiff.deletions });
        }
      }
    } catch (err) {
      console.error('Failed to load diff:', err);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleOpenFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!content) {
      await loadContent();
    }
    setShowContent(true);
  };

  const handleOpenInEditor = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open in VS Code
    const dir = contract.filePath.split('/').slice(0, -1).join('/');
    await window.api?.shell?.openVSCode?.(dir);
  };

  // Load metrics on mount (for collapsed state display)
  useEffect(() => {
    if (!content && !loading) {
      loadContent();
    }
  }, []); // Run once on mount

  // Load diff when expanded and has changes
  useEffect(() => {
    if (expanded && hasChanges && !diff && !loadingDiff) {
      loadDiff();
    }
  }, [expanded, hasChanges]);

  return (
    <>
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
                    Breaking
                  </span>
                )}
                {hasChanges && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 flex items-center gap-1">
                    {diffStats ? (
                      <>
                        <span className="text-green-600">+{diffStats.additions}</span>
                        <span className="text-red-600">-{diffStats.deletions}</span>
                      </>
                    ) : (
                      'Modified'
                    )}
                  </span>
                )}
              </div>
              {/* Not generated indicator */}
              {!fileExists && !loading && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    Not Generated
                  </span>
                  {generating && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </span>
                  )}
                </div>
              )}
              {/* Metrics pills - show when available */}
              {fileExists && metrics.length > 0 && (
                <div className="flex items-center gap-1.5 mb-1">
                  {metrics.map((m, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-tertiary text-text-secondary">
                      {m.count} {m.label}
                    </span>
                  ))}
                </div>
              )}
              {contract.description && (
                <p className="text-sm text-text-secondary line-clamp-1">{contract.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">v{extractedVersion || contract.version}</span>
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
            {/* Actions row */}
            <div className="flex items-center gap-2">
              {!fileExists ? (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !repoPath}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-kanvas-blue text-white hover:bg-kanvas-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Generate Contract
                      </>
                    )}
                  </button>
                  <span className="text-xs text-text-secondary">
                    This contract has not been generated yet
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={handleOpenFile}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-kanvas-blue text-white hover:bg-kanvas-blue/90 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Contract
                  </button>
                  <button
                    onClick={handleOpenInEditor}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-surface-secondary text-text-primary hover:bg-surface-tertiary transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.583 17.834l-8.042-6.667 8.042-6.667V17.834zm-.001 4.165L1.999 12 17.582 2.001l4.419 2.209v15.58l-4.419 2.209z"/>
                    </svg>
                    Open in Editor
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !repoPath}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-surface-secondary text-text-primary hover:bg-surface-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!repoPath ? "Repository path not available" : "Regenerate this contract"}
                  >
                    {generating ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                      </>
                    )}
                  </button>
                </>
              )}
              <div className="flex-1" />
              <code className="text-xs text-text-secondary bg-surface-secondary px-2 py-1 rounded truncate max-w-[200px]">
                {contract.filePath.split('/').slice(-2).join('/')}
              </code>
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

            {/* Uncommitted Changes Diff */}
            {(hasChanges || diff) && (
              <div className="mt-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDiff(!showDiff); }}
                  className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${showDiff ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Uncommitted Changes
                  {diffStats && (
                    <span className="text-text-secondary">
                      (<span className="text-green-600">+{diffStats.additions}</span>{' '}
                      <span className="text-red-600">-{diffStats.deletions}</span>)
                    </span>
                  )}
                </button>
                {showDiff && (
                  <div className="mt-2 bg-surface-secondary rounded-lg p-3 overflow-auto max-h-[300px]">
                    {loadingDiff ? (
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading diff...
                      </div>
                    ) : diff ? (
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {diff.split('\n').map((line, i) => {
                          let className = 'text-text-primary';
                          if (line.startsWith('+') && !line.startsWith('+++')) {
                            className = 'text-green-600 bg-green-50';
                          } else if (line.startsWith('-') && !line.startsWith('---')) {
                            className = 'text-red-600 bg-red-50';
                          } else if (line.startsWith('@@')) {
                            className = 'text-blue-600';
                          }
                          return (
                            <div key={i} className={className}>{line}</div>
                          );
                        })}
                      </pre>
                    ) : (
                      <div className="text-xs text-text-secondary">
                        No diff available. Changes may be committed already.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contract Content Modal */}
      {showContent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowContent(false)}
        >
          <div
            className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] mx-4 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center">
                  <span className="text-lg">{typeIcons[contract.type]}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">{contract.name}</h3>
                  <p className="text-xs text-text-secondary">{typeLabels[contract.type]}</p>
                </div>
                {/* Feature Dropdown */}
                {featureContracts.length > 0 && (
                  <div className="ml-4">
                    <select
                      value={selectedFeature}
                      onChange={(e) => handleFeatureChange(e.target.value)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-secondary text-text-primary
                        focus:outline-none focus:ring-2 focus:ring-kanvas-blue/50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="repo">Repo-Level (Consolidated)</option>
                      <optgroup label="Feature-Level Contracts">
                        {featureContracts.map(f => (
                          <option key={f.name} value={f.name}>{f.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {metrics.length > 0 && (
                  <div className="flex items-center gap-1.5 mr-4">
                    {metrics.map((m, idx) => (
                      <span key={idx} className="px-2 py-1 rounded-full text-xs font-medium bg-kanvas-blue/10 text-kanvas-blue">
                        {m.count} {m.label}
                      </span>
                    ))}
                  </div>
                )}
                {/* Regenerate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !repoPath}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors mr-2 ${
                    generating || !repoPath
                      ? 'bg-surface-secondary text-text-secondary opacity-50 cursor-not-allowed'
                      : 'bg-kanvas-blue text-white hover:bg-kanvas-blue/90'
                  }`}
                  title={selectedFeature === 'repo' ? 'Regenerate repo-level contract' : `Regenerate ${selectedFeature} contract`}
                >
                  {generating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </>
                  )}
                </button>
                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border border-border overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode('markdown')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'markdown'
                        ? 'bg-kanvas-blue text-white'
                        : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
                    }`}
                    title="Markdown View"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={() => setViewMode('json')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'json'
                        ? 'bg-kanvas-blue text-white'
                        : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
                    }`}
                    title="JSON View"
                  >
                    Raw
                  </button>
                </div>
                <button
                  onClick={handleOpenInEditor}
                  className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                  title="Open in Editor"
                >
                  <svg className="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.583 17.834l-8.042-6.667 8.042-6.667V17.834zm-.001 4.165L1.999 12 17.582 2.001l4.419 2.209v15.58l-4.419 2.209z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setShowContent(false)}
                  className="p-2 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              {loading || generating ? (
                <div className="flex flex-col items-center justify-center h-32 gap-4">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {generating ? 'Generating contract...' : 'Loading contract...'}
                  </div>
                  {generating && (
                    <div className="w-64 h-2 bg-surface-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-kanvas-blue rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  )}
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <p className="text-red-500 mb-2">{error}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); loadContent(); }}
                      className="text-kanvas-blue text-sm hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : content ? (
                viewMode === 'markdown' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none select-text
                    prose-headings:text-text-primary prose-p:text-text-secondary
                    prose-table:border-collapse prose-table:w-full prose-table:my-4
                    prose-th:border prose-th:border-border prose-th:bg-surface-secondary prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-text-primary prose-th:font-semibold
                    prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-text-secondary
                    prose-code:bg-surface-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-kanvas-blue prose-code:font-mono prose-code:text-sm
                    prose-pre:bg-surface-secondary prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-auto
                    prose-blockquote:border-l-4 prose-blockquote:border-kanvas-blue prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-text-secondary
                    prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6
                    prose-li:text-text-secondary prose-li:my-1
                    prose-a:text-kanvas-blue prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-text-primary prose-em:text-text-secondary
                    prose-hr:border-border"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <table className="w-full border-collapse my-4 text-sm">{children}</table>
                        ),
                        thead: ({ children }) => (
                          <thead className="bg-surface-secondary">{children}</thead>
                        ),
                        tbody: ({ children }) => (
                          <tbody>{children}</tbody>
                        ),
                        tr: ({ children }) => (
                          <tr className="border-b border-border">{children}</tr>
                        ),
                        th: ({ children }) => (
                          <th className="border border-border bg-surface-secondary px-3 py-2 text-left text-text-primary font-semibold">{children}</th>
                        ),
                        td: ({ children }) => (
                          <td className="border border-border px-3 py-2 text-text-secondary">{children}</td>
                        ),
                        h1: ({ children }) => (
                          <h1 className="text-2xl font-bold text-text-primary mt-6 mb-4">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-xl font-semibold text-text-primary mt-5 mb-3 border-b border-border pb-2">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-lg font-medium text-text-primary mt-4 mb-2">{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p className="text-text-secondary my-2">{children}</p>
                        ),
                        code: ({ children, className }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-surface-secondary px-1.5 py-0.5 rounded text-kanvas-blue font-mono text-sm">{children}</code>
                          ) : (
                            <code className={className}>{children}</code>
                          );
                        },
                        pre: ({ children }) => (
                          <pre className="bg-surface-secondary p-4 rounded-lg overflow-auto my-4">{children}</pre>
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="bg-surface-secondary rounded-lg p-4 text-sm font-mono text-text-secondary overflow-auto select-text whitespace-pre-wrap"
                    style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>
                    {rawContent || content}
                  </pre>
                )
              ) : (
                <div className="flex items-center justify-center h-32 text-text-secondary">
                  No content available
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-border text-xs text-text-secondary">
              <span>{selectedFeature === 'repo' ? contract.filePath : featureContracts.find(f => f.name === selectedFeature)?.path || contract.filePath}</span>
              <span>v{extractedVersion || contract.version} - Last updated {new Date(contract.lastUpdated).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}
    </>
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
