/**
 * Unit Tests for shared/session-admission.ts (story KIT-MCP-G3)
 *
 * The pure decision "may this session be created?", consulted from inside
 * createInstance's critical section (G1).
 *
 * Four rules, cheapest and most absolute first:
 *   kill switch -> global cap -> per-repo cap -> single-session guard
 *
 * The first three gate MCP-created sessions only. A human creating a session
 * from the UI is not subject to the agent budget — those caps exist to stop an
 * orchestrator melting the machine, not to limit the user. The single-session
 * guard applies to everyone, because it protects the repo checkout regardless
 * of who asked for the session.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateSessionAdmission,
  SESSION_LIMIT_ERROR_CODE,
  AGENT_SESSION_CREATION_DISABLED_CODE,
  DEFAULT_SESSION_LIMITS,
  type SessionAdmissionInput,
} from '../../../shared/session-admission';
import { SINGLE_SESSION_MODE_ERROR_CODE } from '../../../shared/single-session-guard';

const input = (over: Partial<SessionAdmissionInput> = {}): SessionAdmissionInput => ({
  createdBy: 'mcp',
  worktreeMode: 'worktree',
  activeCountForRepo: 0,
  activeMcpCountGlobal: 0,
  activeMcpCountForRepo: 0,
  limits: DEFAULT_SESSION_LIMITS,
  ...over,
});

describe('evaluateSessionAdmission — defaults', () => {
  it('admits a normal MCP session', () => {
    expect(evaluateSessionAdmission(input()).blocked).toBe(false);
  });

  it('ships the documented default limits', () => {
    expect(DEFAULT_SESSION_LIMITS).toEqual({
      enabled: true,
      maxConcurrentGlobal: 8,
      maxConcurrentPerRepo: 4,
    });
  });
});

describe('kill switch', () => {
  const off = { ...DEFAULT_SESSION_LIMITS, enabled: false };

  it('blocks MCP creation when disabled', () => {
    const result = evaluateSessionAdmission(input({ limits: off }));
    expect(result.blocked).toBe(true);
    expect(result.error?.code).toBe(AGENT_SESSION_CREATION_DISABLED_CODE);
  });

  it('tells the agent to ask the user rather than retry', () => {
    // A machine-readable refusal is only useful if it says what to do next.
    const result = evaluateSessionAdmission(input({ limits: off }));
    expect(result.error?.instruction).toMatch(/Settings/i);
    expect(result.error?.instruction).toMatch(/not retry|don't retry|do NOT retry/i);
  });

  it('does NOT block a UI-created session', () => {
    // The switch governs agents, not the human sitting in front of the app.
    expect(
      evaluateSessionAdmission(input({ createdBy: 'ui', limits: off })).blocked
    ).toBe(false);
  });

  it('takes precedence over the caps', () => {
    const result = evaluateSessionAdmission(
      input({ limits: off, activeMcpCountGlobal: 99 })
    );
    expect(result.error?.code).toBe(AGENT_SESSION_CREATION_DISABLED_CODE);
  });
});

describe('concurrency caps', () => {
  it('admits right up to the global cap', () => {
    expect(
      evaluateSessionAdmission(input({ activeMcpCountGlobal: 7 })).blocked
    ).toBe(false);
  });

  it('blocks at the global cap', () => {
    const result = evaluateSessionAdmission(input({ activeMcpCountGlobal: 8 }));
    expect(result.blocked).toBe(true);
    expect(result.error?.code).toBe(SESSION_LIMIT_ERROR_CODE);
    expect(result.error?.details?.scope).toBe('global');
  });

  it('admits right up to the per-repo cap', () => {
    expect(
      evaluateSessionAdmission(input({ activeMcpCountForRepo: 3 })).blocked
    ).toBe(false);
  });

  it('blocks at the per-repo cap even when the global budget is free', () => {
    const result = evaluateSessionAdmission(
      input({ activeMcpCountForRepo: 4, activeMcpCountGlobal: 4 })
    );
    expect(result.blocked).toBe(true);
    expect(result.error?.details?.scope).toBe('repo');
  });

  it('reports the global scope first when both caps are exceeded', () => {
    const result = evaluateSessionAdmission(
      input({ activeMcpCountGlobal: 8, activeMcpCountForRepo: 4 })
    );
    expect(result.error?.details?.scope).toBe('global');
  });

  it('does NOT cap UI-created sessions', () => {
    expect(
      evaluateSessionAdmission(
        input({ createdBy: 'ui', activeMcpCountGlobal: 99, activeMcpCountForRepo: 99 })
      ).blocked
    ).toBe(false);
  });

  it('returns the active sessions so the orchestrator can self-remediate', () => {
    // This payload is the AC, not decoration. Counting `waiting` sessions means
    // a crashed fan-out can hold the whole budget; the way out is for the agent
    // to close its own oldest, which it can only do if it is told what they are.
    const active = [
      { session_id: 'sess_1', branch: 'feat-a', status: 'waiting', idle_minutes: 42 },
      { session_id: 'sess_2', branch: 'feat-b', status: 'idle', idle_minutes: 5 },
    ];
    const result = evaluateSessionAdmission(
      input({ activeMcpCountGlobal: 8, activeSessions: active })
    );

    expect(result.error?.details?.active_sessions).toEqual(active);
    expect(result.error?.details?.limit).toBe(8);
    expect(result.error?.details?.current).toBe(8);
    expect(result.error?.instruction).toMatch(/kit_close_session/);
  });

  it('honours non-default limits', () => {
    const limits = { enabled: true, maxConcurrentGlobal: 2, maxConcurrentPerRepo: 1 };
    expect(
      evaluateSessionAdmission(input({ limits, activeMcpCountGlobal: 1 })).blocked
    ).toBe(false);
    expect(
      evaluateSessionAdmission(input({ limits, activeMcpCountForRepo: 1 })).blocked
    ).toBe(true);
  });
});

describe('single-session mode — applies to everyone', () => {
  it('blocks an MCP session when in-place mode already has one active', () => {
    const result = evaluateSessionAdmission(
      input({ worktreeMode: 'in-place', activeCountForRepo: 1 })
    );
    expect(result.blocked).toBe(true);
    expect(result.error?.code).toBe(SINGLE_SESSION_MODE_ERROR_CODE);
  });

  it('blocks a UI session too — this guard is not about who asked', () => {
    const result = evaluateSessionAdmission(
      input({ createdBy: 'ui', worktreeMode: 'in-place', activeCountForRepo: 1 })
    );
    expect(result.blocked).toBe(true);
    expect(result.error?.code).toBe(SINGLE_SESSION_MODE_ERROR_CODE);
  });

  it('admits when in-place mode has no active session', () => {
    expect(
      evaluateSessionAdmission(input({ worktreeMode: 'in-place', activeCountForRepo: 0 }))
        .blocked
    ).toBe(false);
  });

  it('does not block worktree mode regardless of count', () => {
    expect(
      evaluateSessionAdmission(input({ worktreeMode: 'worktree', activeCountForRepo: 17 }))
        .blocked
    ).toBe(false);
  });

  it('reuses the shared error code rather than redeclaring it', () => {
    const result = evaluateSessionAdmission(
      input({ worktreeMode: 'in-place', activeCountForRepo: 1 })
    );
    // Imported from single-session-guard — the two layers cannot drift.
    expect(result.error?.code).toBe(SINGLE_SESSION_MODE_ERROR_CODE);
  });

  it('points an MCP caller at observer sessions as the way through', () => {
    // An observer never writes, so it is not what in-place mode is protecting
    // against. Worth telling the agent, since it is the only route that works.
    const result = evaluateSessionAdmission(
      input({ worktreeMode: 'in-place', activeCountForRepo: 1 })
    );
    expect(result.error?.instruction).toMatch(/observer/i);
  });

  it('gives a UI caller no observer advice — that is an agent-only concept', () => {
    const result = evaluateSessionAdmission(
      input({ createdBy: 'ui', worktreeMode: 'in-place', activeCountForRepo: 1 })
    );
    expect(result.error?.instruction ?? '').not.toMatch(/observer/i);
  });
});

describe('createdBy defaulting', () => {
  it('treats an absent createdBy as ui — legacy records must not be capped', () => {
    const result = evaluateSessionAdmission(
      input({ createdBy: undefined, activeMcpCountGlobal: 99 })
    );
    expect(result.blocked).toBe(false);
  });

  it('treats adopted sessions as non-agent for the caps', () => {
    expect(
      evaluateSessionAdmission(input({ createdBy: 'adopted', activeMcpCountGlobal: 99 }))
        .blocked
    ).toBe(false);
  });
});

describe('rule ordering', () => {
  it('kill switch beats caps beats single-session', () => {
    const all = input({
      limits: { ...DEFAULT_SESSION_LIMITS, enabled: false },
      activeMcpCountGlobal: 99,
      worktreeMode: 'in-place',
      activeCountForRepo: 5,
    });
    expect(evaluateSessionAdmission(all).error?.code).toBe(
      AGENT_SESSION_CREATION_DISABLED_CODE
    );

    const capsAndSingle = { ...all, limits: DEFAULT_SESSION_LIMITS };
    expect(evaluateSessionAdmission(capsAndSingle).error?.code).toBe(
      SESSION_LIMIT_ERROR_CODE
    );
  });
});
