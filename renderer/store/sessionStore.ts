/**
 * Session Store
 * Zustand store for session management
 */

import { create } from 'zustand';
import type { Session } from '../../shared/types';

interface SessionState {
  sessions: Map<string, Session>;
  activeSessionId: string | null;

  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;

  // Computed
  getActiveSession: () => Session | undefined;
  getSessionById: (id: string) => Session | undefined;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,

  setSessions: (sessions) => {
    const sessionMap = new Map<string, Session>();
    sessions.forEach((session) => sessionMap.set(session.id, session));
    set({ sessions: sessionMap });

    // Auto-select first session if none selected
    if (sessions.length > 0 && !get().activeSessionId) {
      set({ activeSessionId: sessions[0].id });
    }
  },

  addSession: (session) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(session.id, session);
      return {
        sessions: newSessions,
        // Auto-select new session
        activeSessionId: session.id,
      };
    }),

  updateSession: (id, updates) =>
    set((state) => {
      const session = state.sessions.get(id);
      if (!session) return state;

      const newSessions = new Map(state.sessions);
      newSessions.set(id, { ...session, ...updates });
      return { sessions: newSessions };
    }),

  removeSession: (id) =>
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(id);

      // If removed session was active, select another
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === id) {
        const remaining = Array.from(newSessions.keys());
        newActiveId = remaining.length > 0 ? remaining[0] : null;
      }

      return {
        sessions: newSessions,
        activeSessionId: newActiveId,
      };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? sessions.get(activeSessionId) : undefined;
  },

  getSessionById: (id) => {
    return get().sessions.get(id);
  },
}));
