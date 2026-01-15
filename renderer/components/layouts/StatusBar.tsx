/**
 * StatusBar Component
 * Shows agent status and key metrics at the bottom of the window
 * Follows SeKondBrain design aesthetics
 */

import React from 'react';
import { useAgentStore, selectAgentList } from '../../store/agentStore';
import type { AgentInfo } from '../../../shared/agent-protocol';

interface RegisteredAgent extends AgentInfo {
  isAlive: boolean;
  sessions: string[];
  lastHeartbeat?: string;
}

interface StatusBarProps {
  agent: RegisteredAgent | null | undefined;
}

export function StatusBar({ agent }: StatusBarProps): React.ReactElement {
  const agents = useAgentStore(selectAgentList);
  const reportedSessions = useAgentStore((state) => state.reportedSessions);

  const aliveAgents = agents.filter((a) => a.isAlive).length;
  const totalSessions = reportedSessions.size;

  return (
    <div className="h-7 px-4 bg-surface border-t border-border flex items-center gap-4 text-xs">
      {/* Kanvas branding */}
      <span className="flex items-center gap-1.5 text-kanvas-blue font-medium">
        <div className="w-3 h-3 rounded bg-kanvas-blue flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-2 h-2 text-white" fill="currentColor">
            <circle cx="12" cy="12" r="5" />
          </svg>
        </div>
        Kanvas
      </span>

      <span className="text-border">|</span>

      {/* Agent count */}
      <span className="flex items-center gap-1.5 text-text-secondary">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-text-primary">{aliveAgents}</span>
        <span>/{agents.length} agents</span>
      </span>

      {/* Session count */}
      <span className="flex items-center gap-1.5 text-text-secondary">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="text-text-primary">{totalSessions}</span>
        <span>sessions</span>
      </span>

      {/* Selected agent info */}
      {agent && (
        <>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${agent.isAlive ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-text-primary font-medium">{agent.agentName}</span>
            <span className="text-text-secondary">
              ({agent.sessions.length} sessions)
            </span>
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard shortcuts hint */}
      <span className="text-text-secondary hidden md:inline">
        <kbd className="px-1 py-0.5 rounded bg-surface-tertiary text-text-secondary font-mono text-[10px]">Ctrl</kbd>
        <span className="mx-0.5">+</span>
        <kbd className="px-1 py-0.5 rounded bg-surface-tertiary text-text-secondary font-mono text-[10px]">N</kbd>
        <span className="ml-1">New</span>
      </span>

      {/* Version */}
      <span className="text-text-secondary/60">v1.0.0</span>
    </div>
  );
}
