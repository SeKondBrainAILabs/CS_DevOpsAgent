/**
 * useAgentSubscription Hook
 * Subscribes to agent events from the main process
 * Kanvas monitors agents that report into it
 */

import { useEffect } from 'react';
import { useAgentStore } from '../store/agentStore';

export function useAgentSubscription(): void {
  const {
    setAgents,
    addAgent,
    removeAgent,
    updateAgentStatus,
    updateAgentHeartbeat,
    addReportedSession,
    removeReportedSession,
    addActivity,
    setInitialized,
  } = useAgentStore();

  useEffect(() => {
    // Guard: ensure window.api is available (preload script loaded)
    if (!window.api?.agent) {
      console.warn('window.api.agent not available - preload may not be loaded');
      return;
    }

    // Load initial agent list
    window.api.agent.list().then((result) => {
      if (result.success && result.data) {
        setAgents(result.data);
      }
      // Always mark as initialized, even if no agents
      setInitialized(true);
    }).catch((err) => {
      console.error('Failed to load agents:', err);
      // Still mark as initialized to show empty state instead of skeleton
      setInitialized(true);
    });

    // Subscribe to agent registered events
    const unsubRegistered = window.api.agent.onRegistered((agent) => {
      addAgent(agent);
    });

    // Subscribe to agent unregistered events
    const unsubUnregistered = window.api.agent.onUnregistered((agentId) => {
      removeAgent(agentId);
    });

    // Subscribe to agent heartbeat events
    const unsubHeartbeat = window.api.agent.onHeartbeat(({ agentId, timestamp }) => {
      updateAgentHeartbeat(agentId, timestamp);
    });

    // Subscribe to agent status change events
    const unsubStatusChanged = window.api.agent.onStatusChanged(({ agentId, isAlive, lastHeartbeat }) => {
      updateAgentStatus(agentId, isAlive, lastHeartbeat);
    });

    // Subscribe to session reported events
    const unsubSessionReported = window.api.agent.onSessionReported((session) => {
      console.log('[useAgentSubscription] Session reported:', session);
      addReportedSession(session);
    });

    // Subscribe to activity reported events (from external agents)
    const unsubActivityReported = window.api.agent.onActivityReported((activity) => {
      addActivity(activity);
    });

    // Subscribe to internal activity log events (from WatcherService, etc.)
    const unsubLogEntry = window.api.activity?.onLog?.((entry) => {
      // Convert ActivityLogEntry to AgentActivityReport format
      addActivity({
        agentId: `internal-${entry.sessionId?.slice(0, 8) || 'system'}`,
        sessionId: entry.sessionId,
        type: entry.type,
        message: entry.message,
        details: entry.details,
        timestamp: entry.timestamp,
      });
    });

    // Cleanup subscriptions
    return () => {
      unsubRegistered();
      unsubUnregistered();
      unsubHeartbeat();
      unsubStatusChanged();
      unsubSessionReported();
      unsubActivityReported();
      unsubLogEntry?.();
    };
  }, [
    setAgents,
    addAgent,
    removeAgent,
    updateAgentStatus,
    updateAgentHeartbeat,
    addReportedSession,
    removeReportedSession,
    addActivity,
    setInitialized,
  ]);
}
