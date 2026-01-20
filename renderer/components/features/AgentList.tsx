/**
 * AgentList Component
 * Displays all agents reporting into Kanvas
 * Kanvas is a DASHBOARD - agents report INTO it
 *
 * Groups agents by type (Claude, Cursor, etc.) to show a consolidated view
 * Expands to show sessions when an agent type is selected
 */

import React, { useMemo } from 'react';
import { AgentCardSkeleton } from './AgentCard';
import { useAgentStore } from '../../store/agentStore';
import type { AgentInfo, SessionReport } from '../../../shared/agent-protocol';
import type { AgentType } from '../../../shared/types';

interface RegisteredAgent extends AgentInfo {
  isAlive: boolean;
  sessions: string[];
  lastHeartbeat?: string;
  repoPath?: string;
}

interface AgentTypeGroup {
  agentType: AgentType;
  agents: RegisteredAgent[];
  totalSessions: number;
  aliveCount: number;
  latestHeartbeat?: string;
  repos: string[];
}

const AGENT_TYPE_COLORS: Record<string, string> = {
  claude: 'bg-[#CC785C]',
  cursor: 'bg-kanvas-blue',
  copilot: 'bg-gray-600',
  cline: 'bg-purple-500',
  aider: 'bg-green-500',
  warp: 'bg-pink-500',
  custom: 'bg-gray-400',
};

const AGENT_TYPE_ICONS: Record<string, string> = {
  claude: 'C',
  cursor: 'Cu',
  copilot: 'Co',
  cline: 'Cl',
  aider: 'Ai',
  warp: 'W',
  custom: '?',
};

const AGENT_TYPE_NAMES: Record<string, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  copilot: 'GitHub Copilot',
  cline: 'Cline',
  aider: 'Aider',
  warp: 'Warp AI',
  custom: 'Custom Agent',
};

export function AgentList(): React.ReactElement {
  const agentsMap = useAgentStore((state) => state.agents);
  const selectedAgentType = useAgentStore((state) => state.selectedAgentType);
  const setSelectedAgentType = useAgentStore((state) => state.setSelectedAgentType);
  const selectedSessionId = useAgentStore((state) => state.selectedSessionId);
  const setSelectedSession = useAgentStore((state) => state.setSelectedSession);
  const isInitialized = useAgentStore((state) => state.isInitialized);
  const reportedSessions = useAgentStore((state) => state.reportedSessions);

  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap]);

  // Get sessions for selected agent type
  const sessionsForType = useMemo(
    () =>
      selectedAgentType
        ? Array.from(reportedSessions.values()).filter(
            (session) => session.agentType === selectedAgentType
          )
        : [],
    [reportedSessions, selectedAgentType]
  );

  // Group agents by type
  const agentGroups = useMemo(() => {
    const groups = new Map<AgentType, AgentTypeGroup>();

    for (const agent of agents) {
      const existing = groups.get(agent.agentType);
      if (existing) {
        existing.agents.push(agent);
        existing.totalSessions += agent.sessions.length;
        if (agent.isAlive) existing.aliveCount++;
        if (agent.repoPath && !existing.repos.includes(agent.repoPath)) {
          existing.repos.push(agent.repoPath);
        }
        if (agent.lastHeartbeat && (!existing.latestHeartbeat || agent.lastHeartbeat > existing.latestHeartbeat)) {
          existing.latestHeartbeat = agent.lastHeartbeat;
        }
      } else {
        groups.set(agent.agentType, {
          agentType: agent.agentType,
          agents: [agent],
          totalSessions: agent.sessions.length,
          aliveCount: agent.isAlive ? 1 : 0,
          latestHeartbeat: agent.lastHeartbeat,
          repos: agent.repoPath ? [agent.repoPath] : [],
        });
      }
    }

    // Filter out agents with 0 sessions, then sort
    return Array.from(groups.values())
      .filter(group => group.totalSessions > 0)
      .sort((a, b) => {
        if (a.aliveCount !== b.aliveCount) return b.aliveCount - a.aliveCount;
        return (AGENT_TYPE_NAMES[a.agentType] || a.agentType).localeCompare(
          AGENT_TYPE_NAMES[b.agentType] || b.agentType
        );
      });
  }, [agents]);

  if (!isInitialized) {
    return (
      <div className="space-y-3">
        <AgentCardSkeleton />
        <AgentCardSkeleton />
        <AgentCardSkeleton />
      </div>
    );
  }

  const totalSessions = agentGroups.reduce((sum, g) => sum + g.totalSessions, 0);

  // Show empty state if no agents OR all agents have 0 sessions
  if (agents.length === 0 || agentGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-tertiary flex items-center justify-center">
          <svg
            className="w-8 h-8 text-text-secondary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">
          No Agents Connected
        </h3>
        <p className="text-sm text-text-secondary max-w-xs mx-auto">
          Start a DevOps Agent session to see it appear here. Agents report their activity to Kanvas.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">Agents</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-kanvas-blue/10 text-kanvas-blue">
            {totalSessions} sessions
          </span>
        </div>
      </div>

      {/* Agent type groups */}
      <div className="space-y-2">
        {agentGroups.map((group) => (
          <AgentTypeRow
            key={group.agentType}
            group={group}
            isExpanded={selectedAgentType === group.agentType}
            sessions={selectedAgentType === group.agentType ? sessionsForType : []}
            selectedSessionId={selectedSessionId}
            onToggle={() => setSelectedAgentType(
              selectedAgentType === group.agentType ? null : group.agentType
            )}
            onSelectSession={setSelectedSession}
          />
        ))}
      </div>
    </div>
  );
}

interface AgentTypeRowProps {
  group: AgentTypeGroup;
  isExpanded: boolean;
  sessions: SessionReport[];
  selectedSessionId: string | null;
  onToggle: () => void;
  onSelectSession: (sessionId: string | null) => void;
}

function AgentTypeRow({
  group,
  isExpanded,
  sessions,
  selectedSessionId,
  onToggle,
  onSelectSession
}: AgentTypeRowProps): React.ReactElement {
  const typeColor = AGENT_TYPE_COLORS[group.agentType] || AGENT_TYPE_COLORS.custom;
  const typeIcon = AGENT_TYPE_ICONS[group.agentType] || AGENT_TYPE_ICONS.custom;
  const typeName = AGENT_TYPE_NAMES[group.agentType] || group.agentType;

  const timeAgo = group.latestHeartbeat
    ? getTimeAgo(new Date(group.latestHeartbeat))
    : null;

  return (
    <div className="space-y-1">
      {/* Agent Type Header */}
      <div
        onClick={onToggle}
        className={`
          relative p-3 rounded-xl border transition-all cursor-pointer
          ${isExpanded
            ? 'border-kanvas-blue bg-surface-secondary shadow-kanvas'
            : 'border-border bg-surface hover:border-kanvas-blue/50 hover:shadow-card-hover'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Expand/Collapse chevron */}
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Agent type badge */}
          <div className={`
            w-10 h-10 rounded-lg ${typeColor}
            flex items-center justify-center flex-shrink-0
            text-white font-bold text-sm
          `}>
            {typeIcon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-text-primary truncate">
                {typeName}
              </h3>
              <span className={`
                w-2 h-2 rounded-full flex-shrink-0
                ${group.aliveCount > 0 ? 'bg-green-500 animate-pulse-slow' : 'bg-gray-400'}
              `} />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-sm text-text-secondary">
                {group.totalSessions} {group.totalSessions === 1 ? 'session' : 'sessions'}
              </span>
              {group.repos.length > 0 && (
                <span className="text-xs text-text-secondary truncate">
                  {group.repos.length === 1
                    ? group.repos[0].split('/').pop()
                    : `${group.repos.length} repos`}
                </span>
              )}
            </div>
          </div>

          {/* Activity indicator */}
          <div className="flex flex-col items-end text-xs text-text-secondary">
            {group.aliveCount > 0 && (
              <span className="text-green-600">
                {group.aliveCount} active
              </span>
            )}
            {timeAgo && (
              <span>{timeAgo}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Sessions List */}
      {isExpanded && sessions.length > 0 && (
        <div className="ml-6 space-y-1">
          {sessions.map((session) => (
            <SessionRow
              key={session.sessionId}
              session={session}
              isSelected={selectedSessionId === session.sessionId}
              onClick={() => onSelectSession(
                selectedSessionId === session.sessionId ? null : session.sessionId
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SessionRowProps {
  session: SessionReport;
  isSelected: boolean;
  onClick: () => void;
}

function SessionRow({ session, isSelected, onClick }: SessionRowProps): React.ReactElement {
  const statusColors = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    error: 'bg-red-500',
    completed: 'bg-gray-400',
  };

  const repoName = session.repoPath?.split('/').pop() || 'Unknown';

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg border transition-all cursor-pointer
        ${isSelected
          ? 'border-kanvas-blue bg-kanvas-blue/10'
          : 'border-border/50 bg-surface-secondary hover:border-kanvas-blue/30'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <span className={`
          w-2 h-2 rounded-full flex-shrink-0
          ${statusColors[session.status] || 'bg-gray-400'}
        `} />

        {/* Session info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {session.task || session.branchName || 'Untitled Session'}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-secondary truncate">
              {repoName}
            </span>
            <span className="text-xs text-text-secondary">
              {session.branchName}
            </span>
          </div>
        </div>

        {/* Commit count badge */}
        {session.commitCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-tertiary text-text-secondary">
            {session.commitCount} commits
          </span>
        )}

        {/* Arrow indicator for selected */}
        {isSelected && (
          <svg className="w-4 h-4 text-kanvas-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * AgentListCompact - Smaller version for tight spaces
 */
export function AgentListCompact(): React.ReactElement {
  const agentsMap = useAgentStore((state) => state.agents);
  const selectedAgentType = useAgentStore((state) => state.selectedAgentType);
  const setSelectedAgentType = useAgentStore((state) => state.setSelectedAgentType);

  const agents = useMemo(() => Array.from(agentsMap.values()), [agentsMap]);
  const aliveAgents = agents.filter((a) => a.isAlive);

  // Group by type for compact view
  const typeGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const agent of aliveAgents) {
      groups.set(agent.agentType, (groups.get(agent.agentType) || 0) + 1);
    }
    return Array.from(groups.entries());
  }, [aliveAgents]);

  return (
    <div className="flex flex-wrap gap-2">
      {typeGroups.map(([agentType, count]) => (
        <button
          key={agentType}
          onClick={() => setSelectedAgentType(
            selectedAgentType === agentType ? null : agentType
          )}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg
            text-sm transition-colors
            ${selectedAgentType === agentType
              ? 'bg-kanvas-blue text-white'
              : 'bg-surface-tertiary text-text-primary hover:bg-surface-secondary'
            }
          `}
        >
          <span className="w-2 h-2 rounded-full bg-green-500" />
          {AGENT_TYPE_NAMES[agentType] || agentType}
          <span className="text-xs opacity-70">
            ({count})
          </span>
        </button>
      ))}
      {typeGroups.length === 0 && (
        <span className="text-sm text-text-secondary">No active agents</span>
      )}
    </div>
  );
}
