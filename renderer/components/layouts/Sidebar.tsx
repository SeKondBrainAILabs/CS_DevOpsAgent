/**
 * Sidebar Component
 * Displays connected agents and their sessions
 * Kanvas is a DASHBOARD - agents report INTO it
 * Follows SeKondBrain design aesthetics
 */

import React, { useState, useEffect } from 'react';
import { AgentList } from '../features/AgentList';
import { KanvasLogo } from '../ui/KanvasLogo';
import { useAgentStore, selectSessionsByAgent } from '../../store/agentStore';
import { useUIStore } from '../../store/uiStore';
import type { SessionReport } from '../../../shared/agent-protocol';

type SidebarTab = 'agents' | 'sessions';

export function Sidebar(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SidebarTab>('agents');
  const { setShowNewSessionWizard, setShowSettingsModal, setShowCreateAgentWizard } = useUIStore();
  const selectedAgentId = useAgentStore((state) => state.selectedAgentId);
  const reportedSessions = useAgentStore((state) => state.reportedSessions);
  const selectedSessionId = useAgentStore((state) => state.selectedSessionId);
  const setSelectedSession = useAgentStore((state) => state.setSelectedSession);

  // Get sessions for selected agent or all sessions
  const sessions = selectedAgentId
    ? useAgentStore((state) => selectSessionsByAgent(state, selectedAgentId))
    : Array.from(reportedSessions.values());

  const removeReportedSession = useAgentStore((state) => state.removeReportedSession);

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string): Promise<void> => {
    try {
      const result = await window.api.instance?.delete?.(sessionId);
      if (result?.success) {
        // Remove from store
        removeReportedSession(sessionId);
        // Clear selection if deleted session was selected
        if (selectedSessionId === sessionId) {
          setSelectedSession(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <KanvasLogo size="md" />
          <div>
            <h1 className="font-semibold text-text-primary text-sm">Kanvas</h1>
            <p className="text-xs text-text-secondary">Agent Dashboard</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('agents')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${activeTab === 'agents'
              ? 'text-kanvas-blue border-b-2 border-kanvas-blue bg-surface-secondary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
            }
          `}
        >
          Agents
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`
            flex-1 px-4 py-3 text-sm font-medium transition-colors
            ${activeTab === 'sessions'
              ? 'text-kanvas-blue border-b-2 border-kanvas-blue bg-surface-secondary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
            }
          `}
        >
          Sessions
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'agents' ? (
          <AgentList />
        ) : (
          <SessionList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={setSelectedSession}
            onDeleteSession={handleDeleteSession}
          />
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={() => setShowCreateAgentWizard(true)}
          className="w-full py-2.5 px-4 rounded-xl bg-kanvas-blue text-white font-medium text-sm
                     hover:bg-kanvas-blue-dark transition-colors shadow-kanvas flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Agent Instance
        </button>
        <button
          onClick={() => setShowNewSessionWizard(true)}
          className="w-full py-2 px-4 rounded-xl border border-border text-text-primary text-sm
                     hover:bg-surface-secondary transition-colors"
        >
          Initialize Directory
        </button>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-full py-2 px-4 rounded-xl border border-border text-text-primary text-sm
                     hover:bg-surface-secondary transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  );
}

/**
 * SessionList - Displays sessions grouped by repository
 */
interface SessionListProps {
  sessions: SessionReport[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
}

function SessionList({ sessions, selectedSessionId, onSelectSession, onDeleteSession }: SessionListProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-tertiary flex items-center justify-center">
          <svg
            className="w-6 h-6 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <p className="text-sm text-text-secondary">No sessions yet</p>
        <p className="text-xs text-text-secondary mt-1">Create an agent instance to get started</p>
      </div>
    );
  }

  // Group sessions by repository
  const sessionsByRepo = sessions.reduce((acc, session) => {
    const repoPath = session.repoPath || session.worktreePath || 'Unknown';
    const repoName = repoPath.split('/').pop() || repoPath;
    if (!acc[repoName]) {
      acc[repoName] = { repoPath, sessions: [] };
    }
    acc[repoName].sessions.push(session);
    return acc;
  }, {} as Record<string, { repoPath: string; sessions: SessionReport[] }>);

  const repoNames = Object.keys(sessionsByRepo).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          Sessions by Repository
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-tertiary text-text-secondary">
          {sessions.length} total
        </span>
      </div>

      {repoNames.map((repoName) => {
        const { repoPath, sessions: repoSessions } = sessionsByRepo[repoName];
        return (
          <RepoSessionGroup
            key={repoPath}
            repoName={repoName}
            repoPath={repoPath}
            sessions={repoSessions}
            selectedSessionId={selectedSessionId}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
          />
        );
      })}
    </div>
  );
}

/**
 * RepoSessionGroup - Collapsible group of sessions for a repository
 */
function RepoSessionGroup({
  repoName,
  repoPath,
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
}: {
  repoName: string;
  repoPath: string;
  sessions: SessionReport[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string | null) => void;
  onDeleteSession: (sessionId: string) => void;
}): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Repo Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-surface-secondary transition-colors"
      >
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4 text-kanvas-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span className="flex-1 text-left text-sm font-medium text-text-primary truncate">
          {repoName}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-tertiary text-text-secondary">
          {sessions.length}
        </span>
      </button>

      {/* Sessions */}
      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {sessions.map((session) => (
            <SessionCard
              key={session.sessionId}
              session={session}
              isSelected={selectedSessionId === session.sessionId}
              onClick={() => onSelectSession(
                selectedSessionId === session.sessionId ? null : session.sessionId
              )}
              onDelete={() => onDeleteSession(session.sessionId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SessionCard - Individual session display within repo group
 * Status indicator colors:
 * - Green (pulsing): Active - changes in last 30 seconds
 * - Orange: Dormant - no recent activity
 * - Red: Error/damaged config
 */
function SessionCard({
  session,
  isSelected,
  onClick,
  onDelete,
}: {
  session: SessionReport;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const [showConfirm, setShowConfirm] = useState(false);
  const [, forceUpdate] = useState(0);
  const recentActivity = useAgentStore((state) => state.recentActivity);

  // Force re-render every 10 seconds to update activity status
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Calculate activity-based status
  const getActivityStatus = (): { color: string; label: string; title: string } => {
    // Check for error/damaged config
    if (session.status === 'error') {
      return { color: 'bg-red-500', label: 'Error', title: 'Session has errors' };
    }

    // Get last activity for this session
    const sessionActivity = recentActivity.filter(a => a.sessionId === session.sessionId);
    const lastActivity = sessionActivity[0]; // Most recent first

    if (lastActivity) {
      const lastActivityTime = new Date(lastActivity.timestamp).getTime();
      const now = Date.now();
      const secondsSinceActivity = (now - lastActivityTime) / 1000;

      if (secondsSinceActivity < 30) {
        return {
          color: 'bg-green-500 animate-pulse',
          label: 'Active',
          title: `Active - last activity ${Math.round(secondsSinceActivity)}s ago`
        };
      }
    }

    // Check session updated timestamp as fallback
    if (session.updated) {
      const updatedTime = new Date(session.updated).getTime();
      const secondsSinceUpdate = (Date.now() - updatedTime) / 1000;
      if (secondsSinceUpdate < 30) {
        return {
          color: 'bg-green-500 animate-pulse',
          label: 'Active',
          title: 'Active - recently updated'
        };
      }
    }

    // Dormant - no recent activity
    return { color: 'bg-orange-400', label: 'Dormant', title: 'Dormant - no recent activity' };
  };

  const status = getActivityStatus();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showConfirm) {
      onDelete();
      setShowConfirm(false);
    } else {
      setShowConfirm(true);
      // Auto-hide confirm after 3 seconds
      setTimeout(() => setShowConfirm(false), 3000);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        px-3 py-2.5 transition-colors cursor-pointer group
        ${isSelected
          ? 'bg-kanvas-blue/10 border-l-2 border-kanvas-blue'
          : 'hover:bg-surface-secondary border-l-2 border-transparent'
        }
      `}
    >
      <div className="flex items-start gap-2">
        <span
          className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${status.color}`}
          title={status.title}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm truncate flex-1 ${isSelected ? 'text-kanvas-blue font-medium' : 'text-text-primary'}`}>
              {session.task || 'Untitled session'}
            </p>
            <span className="text-xs text-text-secondary flex-shrink-0">
              {session.agentType}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-kanvas-blue font-mono truncate">
              {session.branchName}
            </span>
            {session.commitCount > 0 && (
              <span className="text-xs text-text-secondary">
                {session.commitCount} commits
              </span>
            )}
          </div>
        </div>
        {/* Delete button - shows on hover or when selected */}
        <button
          onClick={handleDelete}
          className={`
            flex-shrink-0 p-1 rounded transition-all
            ${showConfirm
              ? 'bg-red-500 text-white'
              : 'text-text-secondary hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100'
            }
            ${isSelected ? 'opacity-100' : ''}
          `}
          title={showConfirm ? 'Click again to confirm' : 'Delete session'}
        >
          {showConfirm ? (
            <span className="text-xs px-1">Delete?</span>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
