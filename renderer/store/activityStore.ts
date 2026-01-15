/**
 * Activity Store
 * Zustand store for activity logs
 */

import { create } from 'zustand';
import type { ActivityLogEntry } from '../../shared/types';

interface ActivityState {
  logs: Map<string, ActivityLogEntry[]>;

  // Actions
  addLog: (entry: ActivityLogEntry) => void;
  setLogs: (sessionId: string, logs: ActivityLogEntry[]) => void;
  clearLogs: (sessionId: string) => void;

  // Computed
  getLogsForSession: (sessionId: string) => ActivityLogEntry[];
}

const MAX_LOGS_PER_SESSION = 500;

export const useActivityStore = create<ActivityState>((set, get) => ({
  logs: new Map(),

  addLog: (entry) =>
    set((state) => {
      const newLogs = new Map(state.logs);
      const sessionLogs = [...(newLogs.get(entry.sessionId) || []), entry];

      // Trim if too many logs
      if (sessionLogs.length > MAX_LOGS_PER_SESSION) {
        sessionLogs.shift();
      }

      newLogs.set(entry.sessionId, sessionLogs);
      return { logs: newLogs };
    }),

  setLogs: (sessionId, logs) =>
    set((state) => {
      const newLogs = new Map(state.logs);
      newLogs.set(sessionId, logs);
      return { logs: newLogs };
    }),

  clearLogs: (sessionId) =>
    set((state) => {
      const newLogs = new Map(state.logs);
      newLogs.delete(sessionId);
      return { logs: newLogs };
    }),

  getLogsForSession: (sessionId) => {
    return get().logs.get(sessionId) || [];
  },
}));
