/**
 * Unit Tests for SessionOrchestrator (story KIT-MCP-S1)
 *
 * The orchestrator is the single funnel for session lifecycle. Both the IPC
 * layer and (later) the MCP tool layer call it, so neither reimplements the
 * compose step.
 *
 * Why it exists: `AgentInstanceService.createInstance()` performs twelve side
 * effects but does NOT start the file watcher. Three separate IPC sites do
 * that — create (:407), restart (:495), and startup rehydration (:1639/:1685).
 * Any caller that is not one of those three silently gets a session where
 * auto-commit never runs, which is precisely the trap an MCP `kit_start_session`
 * would fall into.
 *
 * Why injected deps rather than concrete services: jest cannot import
 * AgentInstanceService at all — `electron-store` is ESM and untransformed, so
 * the import throws "Cannot use import statement outside a module". That is why
 * the existing AgentInstanceService.test.ts exercises the `window.api` mock
 * surface instead of the class. A statically-importing orchestrator would
 * inherit the same untestability, so the constructor takes narrow structural
 * interfaces and the module uses `import type` only.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionOrchestrator } from '../../../electron/services/SessionOrchestrator';
import type { AgentInstance, AgentInstanceConfig, IpcResult } from '../../../shared/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseConfig = (over: Partial<AgentInstanceConfig> = {}): AgentInstanceConfig =>
  ({
    repoPath: '/repo',
    agentType: 'claude',
    taskDescription: 'do a thing',
    branchName: 'claude-session-20260829-a1b2',
    baseBranch: 'development',
    useWorktree: true,
    autoCommit: true,
    commitInterval: 30,
    rebaseFrequency: 'never',
    systemPrompt: '',
    contextPreservation: '',
    ...over,
  }) as AgentInstanceConfig;

const instance = (over: Partial<AgentInstance> = {}): AgentInstance =>
  ({
    id: 'inst_1',
    config: baseConfig(),
    status: 'waiting',
    createdAt: '2026-08-29T00:00:00.000Z',
    sessionId: 'sess_1',
    worktreePath: '/repo-parent/KIT-DevOps-repo/claude-session-20260829-a1b2',
    ...over,
  }) as AgentInstance;

const ok = (data: AgentInstance): IpcResult<AgentInstance> => ({ success: true, data });

function makeDeps(over: {
  createInstance?: (c: AgentInstanceConfig) => Promise<IpcResult<AgentInstance>>;
  instances?: AgentInstance[];
  startWithPath?: (...a: unknown[]) => Promise<IpcResult<void>>;
} = {}) {
  const createInstance = jest.fn(
    over.createInstance ?? (async () => ok(instance()))
  ) as any;
  const startWithPath = jest.fn(
    over.startWithPath ?? (async () => ({ success: true }))
  ) as any;
  const listInstances = jest.fn(() => ({
    success: true,
    data: over.instances ?? [],
  })) as any;

  return {
    deps: {
      agentInstance: { createInstance, listInstances },
      watcher: { startWithPath },
    },
    createInstance,
    startWithPath,
    listInstances,
  };
}

/** Lets fire-and-forget work settle without asserting on internal timing. */
const flush = () => new Promise((r) => setTimeout(r, 0));

let warnSpy: ReturnType<typeof jest.spyOn>;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ─── startSession ────────────────────────────────────────────────────────────
describe('SessionOrchestrator.startSession', () => {
  it('creates the instance with the config passed through verbatim', async () => {
    const { deps, createInstance } = makeDeps();
    const cfg = baseConfig({ taskDescription: 'specific task' });

    await new SessionOrchestrator(deps).startSession(cfg);

    expect(createInstance).toHaveBeenCalledTimes(1);
    expect(createInstance).toHaveBeenCalledWith(cfg);
  });

  it('starts the watcher on the created session, using the worktree path', async () => {
    const { deps, startWithPath } = makeDeps();

    await new SessionOrchestrator(deps).startSession(baseConfig());
    await flush();

    expect(startWithPath).toHaveBeenCalledTimes(1);
    expect(startWithPath).toHaveBeenCalledWith(
      'sess_1',
      '/repo-parent/KIT-DevOps-repo/claude-session-20260829-a1b2'
    );
  });

  it('falls back to the repo path when the instance has no worktree', async () => {
    // createWorktreeIfNeeded silently returns config.repoPath on failure, so
    // worktreePath can legitimately be absent. Matches the pre-existing
    // `result.data.worktreePath || config.repoPath` at ipc/index.ts:406.
    const { deps, startWithPath } = makeDeps({
      createInstance: async () => ok(instance({ worktreePath: undefined })),
    });

    await new SessionOrchestrator(deps).startSession(baseConfig({ repoPath: '/fallback-repo' }));
    await flush();

    expect(startWithPath).toHaveBeenCalledWith('sess_1', '/fallback-repo');
  });

  it('returns the createInstance result unchanged', async () => {
    const created = ok(instance({ id: 'inst_xyz' }));
    const { deps } = makeDeps({ createInstance: async () => created });

    const result = await new SessionOrchestrator(deps).startSession(baseConfig());

    expect(result).toBe(created);
  });

  it('does NOT start a watcher when instance creation fails', async () => {
    const failure: IpcResult<AgentInstance> = {
      success: false,
      error: { code: 'BRANCH_IN_USE', message: 'nope' },
    };
    const { deps, startWithPath } = makeDeps({ createInstance: async () => failure });

    const result = await new SessionOrchestrator(deps).startSession(baseConfig());
    await flush();

    expect(startWithPath).not.toHaveBeenCalled();
    expect(result).toBe(failure);
  });

  it('does NOT start a watcher when creation succeeded but no sessionId came back', async () => {
    const { deps, startWithPath } = makeDeps({
      createInstance: async () => ok(instance({ sessionId: undefined })),
    });

    await new SessionOrchestrator(deps).startSession(baseConfig());
    await flush();

    expect(startWithPath).not.toHaveBeenCalled();
  });

  // The behavioural contract that a naive `await` would silently break.
  it('does not await the watcher — a slow watcher must not delay session creation', async () => {
    let releaseWatcher!: () => void;
    const { deps } = makeDeps({
      startWithPath: () =>
        new Promise((resolve) => {
          releaseWatcher = () => resolve({ success: true });
        }),
    });

    const result = await new SessionOrchestrator(deps).startSession(baseConfig());

    // Resolved while the watcher is still pending.
    expect(result.success).toBe(true);
    releaseWatcher();
  });

  it('does not reject when the watcher fails — creation still succeeds', async () => {
    const { deps } = makeDeps({
      startWithPath: async () => {
        throw new Error('chokidar exploded');
      },
    });

    const result = await new SessionOrchestrator(deps).startSession(baseConfig());
    await flush();

    expect(result.success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ─── expandSessionAliases ────────────────────────────────────────────────────
describe('SessionOrchestrator.expandSessionAliases', () => {
  // A session restarted twice: sess_old -> sess_mid -> sess_live.
  // recordPredecessor stores the chain oldest-first on the LIVE instance.
  const chained = instance({
    id: 'inst_live',
    sessionId: 'sess_live',
    predecessorSessionIds: ['sess_old', 'sess_mid'],
  });

  it('returns the live id plus its whole predecessor chain', () => {
    const { deps } = makeDeps({ instances: [chained] });
    const aliases = new SessionOrchestrator(deps).expandSessionAliases('sess_live');
    expect(new Set(aliases)).toEqual(new Set(['sess_live', 'sess_mid', 'sess_old']));
  });

  it('returns the SAME set when asked by any predecessor id', () => {
    // This is what makes kit_close_sessions(parent_session_id=<old id>) still
    // match after a KIT restart re-ids the parent. Without it that call — the
    // sentence the whole epic is built on — returns matched: 0.
    const { deps } = makeDeps({ instances: [chained] });
    const orch = new SessionOrchestrator(deps);

    const fromLive = new Set(orch.expandSessionAliases('sess_live'));
    expect(new Set(orch.expandSessionAliases('sess_mid'))).toEqual(fromLive);
    expect(new Set(orch.expandSessionAliases('sess_old'))).toEqual(fromLive);
  });

  it('always includes the queried id', () => {
    const { deps } = makeDeps({ instances: [chained] });
    for (const id of ['sess_live', 'sess_mid', 'sess_old']) {
      expect(new SessionOrchestrator(deps).expandSessionAliases(id)).toContain(id);
    }
  });

  it('returns just the id for a session with no restart history', () => {
    const { deps } = makeDeps({ instances: [instance({ sessionId: 'sess_solo' })] });
    expect(new SessionOrchestrator(deps).expandSessionAliases('sess_solo')).toEqual([
      'sess_solo',
    ]);
  });

  it('returns just the id for an unknown session rather than an empty list', () => {
    // Callers filter on the result; an empty array would silently match nothing.
    const { deps } = makeDeps({ instances: [chained] });
    expect(new SessionOrchestrator(deps).expandSessionAliases('sess_nope')).toEqual([
      'sess_nope',
    ]);
  });

  it('does not bleed aliases between unrelated sessions', () => {
    const other = instance({
      id: 'inst_other',
      sessionId: 'sess_other',
      predecessorSessionIds: ['sess_other_old'],
    });
    const { deps } = makeDeps({ instances: [chained, other] });
    const orch = new SessionOrchestrator(deps);

    expect(orch.expandSessionAliases('sess_live')).not.toContain('sess_other');
    expect(orch.expandSessionAliases('sess_other')).not.toContain('sess_live');
  });

  it('survives listInstances returning a failure', () => {
    const deps = {
      agentInstance: {
        createInstance: jest.fn() as any,
        listInstances: jest.fn(() => ({ success: false })) as any,
      },
      watcher: { startWithPath: jest.fn() as any },
    };
    expect(new SessionOrchestrator(deps).expandSessionAliases('sess_1')).toEqual(['sess_1']);
  });
});

// ─── listSessions ────────────────────────────────────────────────────────────
describe('SessionOrchestrator.listSessions', () => {
  it('returns the instances the service reports', () => {
    const a = instance({ id: 'inst_a', sessionId: 'sess_a' });
    const b = instance({ id: 'inst_b', sessionId: 'sess_b' });
    const { deps } = makeDeps({ instances: [a, b] });

    expect(new SessionOrchestrator(deps).listSessions()).toEqual([a, b]);
  });

  it('returns an empty list rather than throwing when the service fails', () => {
    const deps = {
      agentInstance: {
        createInstance: jest.fn() as any,
        listInstances: jest.fn(() => ({ success: false })) as any,
      },
      watcher: { startWithPath: jest.fn() as any },
    };
    expect(new SessionOrchestrator(deps).listSessions()).toEqual([]);
  });
});
