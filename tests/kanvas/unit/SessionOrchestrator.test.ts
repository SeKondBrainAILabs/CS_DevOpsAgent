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
  stopAll?: (...a: unknown[]) => Promise<IpcResult<void>>;
  stopWatching?: (...a: unknown[]) => Promise<IpcResult<void>>;
  unregisterSession?: (id: string) => void;
} = {}) {
  const createInstance = jest.fn(
    over.createInstance ?? (async () => ok(instance()))
  ) as any;
  const startWithPath = jest.fn(
    over.startWithPath ?? (async () => ({ success: true }))
  ) as any;
  const stopAll = jest.fn(over.stopAll ?? (async () => ({ success: true }))) as any;
  const stopWatching = jest.fn(
    over.stopWatching ?? (async () => ({ success: true }))
  ) as any;
  const unregisterSession = jest.fn(
    over.unregisterSession ?? (() => undefined)
  ) as any;
  const listInstances = jest.fn(() => ({
    success: true,
    data: over.instances ?? [],
  })) as any;

  return {
    deps: {
      agentInstance: { createInstance, listInstances },
      watcher: { startWithPath, stopAll },
      rebaseWatcher: { stopWatching },
      binder: { unregisterSession },
    },
    createInstance,
    startWithPath,
    stopAll,
    stopWatching,
    unregisterSession,
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

// ─── teardownSession ─────────────────────────────────────────────────────────
describe('SessionOrchestrator.teardownSession', () => {
  it('uses stopAll, not stop — only stopAll matches multi-repo compound keys', async () => {
    // Multi-repo watchers are keyed `<sessionId>:<repoName>` (WatcherService:449).
    // The delete paths called the exact-key stop(), so a 3-repo session leaked
    // 2 chokidar watchers on every close. stopAll (:462) already handles the
    // single-key case too, so there is no conditional to get wrong.
    const { deps, stopAll } = makeDeps();

    await new SessionOrchestrator(deps).teardownSession('sess_1');

    expect(stopAll).toHaveBeenCalledTimes(1);
    expect(stopAll).toHaveBeenCalledWith('sess_1');
  });

  it('stops the rebase watcher — no delete path did this before', async () => {
    // Leak 2: stopWatching was only ever called from the IPC stop handler, so
    // every deleted session left a 60s setInterval polling git forever.
    const { deps, stopWatching } = makeDeps();

    await new SessionOrchestrator(deps).teardownSession('sess_1');

    expect(stopWatching).toHaveBeenCalledTimes(1);
    expect(stopWatching).toHaveBeenCalledWith('sess_1');
  });

  it('reports what it actually did', async () => {
    const { deps } = makeDeps();
    const actions = await new SessionOrchestrator(deps).teardownSession('sess_1');

    expect(actions.watchersStopped).toBe(true);
    expect(actions.rebaseWatcherStopped).toBe(true);
    expect(actions.errors).toEqual([]);
  });

  describe('best-effort: one failing step must not abort the others', () => {
    it('still stops the rebase watcher when stopAll throws', async () => {
      const { deps, stopWatching } = makeDeps({
        stopAll: async () => {
          throw new Error('chokidar close failed');
        },
      });

      const actions = await new SessionOrchestrator(deps).teardownSession('sess_1');

      expect(stopWatching).toHaveBeenCalledWith('sess_1');
      expect(actions.watchersStopped).toBe(false);
      expect(actions.rebaseWatcherStopped).toBe(true);
    });

    it('still stops watchers when the rebase watcher throws', async () => {
      const { deps, stopAll } = makeDeps({
        stopWatching: async () => {
          throw new Error('interval clear failed');
        },
      });

      const actions = await new SessionOrchestrator(deps).teardownSession('sess_1');

      expect(stopAll).toHaveBeenCalledWith('sess_1');
      expect(actions.watchersStopped).toBe(true);
      expect(actions.rebaseWatcherStopped).toBe(false);
    });

    it('never rejects, even when every step fails', async () => {
      const boom = async () => {
        throw new Error('boom');
      };
      const { deps } = makeDeps({ stopAll: boom, stopWatching: boom });

      await expect(
        new SessionOrchestrator(deps).teardownSession('sess_1')
      ).resolves.toBeDefined();
    });

    it('records each failure rather than swallowing it silently', async () => {
      // M2's kit_close_session reports an `actions` block to the calling agent.
      // Silent swallowing would let it claim a clean teardown that never happened.
      const { deps } = makeDeps({
        stopAll: async () => {
          throw new Error('chokidar close failed');
        },
      });

      const actions = await new SessionOrchestrator(deps).teardownSession('sess_1');

      expect(actions.errors).toHaveLength(1);
      expect(actions.errors[0].step).toBe('watchers');
      expect(actions.errors[0].message).toMatch(/chokidar close failed/);
    });

    it('treats a failure result (not a throw) as a failed step', async () => {
      // The underlying services wrap everything and return IpcResult rather
      // than throwing, so a rejected promise is the rarer path.
      const { deps } = makeDeps({
        stopWatching: async () => ({
          success: false,
          error: { code: 'REBASE_WATCH_STOP_FAILED', message: 'nope' },
        }),
      });

      const actions = await new SessionOrchestrator(deps).teardownSession('sess_1');

      expect(actions.rebaseWatcherStopped).toBe(false);
      expect(actions.errors.some((e) => e.step === 'rebaseWatcher')).toBe(true);
    });
  });

  it('is a no-op success for a session that was never started', async () => {
    const { deps } = makeDeps();
    const actions = await new SessionOrchestrator(deps).teardownSession('sess_never');
    expect(actions.errors).toEqual([]);
  });

  it('is idempotent — a second teardown is safe', async () => {
    const { deps, stopAll, stopWatching } = makeDeps();
    const orch = new SessionOrchestrator(deps);

    await orch.teardownSession('sess_1');
    const second = await orch.teardownSession('sess_1');

    expect(stopAll).toHaveBeenCalledTimes(2);
    expect(stopWatching).toHaveBeenCalledTimes(2);
    expect(second.errors).toEqual([]);
  });
});

// ─── resolveSessionId ────────────────────────────────────────────────────────
describe('SessionOrchestrator.resolveSessionId', () => {
  // Regression guard for a latent bug: IPC.INSTANCE_DELETE passed an
  // instanceId to watcher.stop, but watchers key on sessionId. The id spaces
  // can never collide (`inst_…` vs `sess_…`, AgentInstanceService:590-591), so
  // that call has always matched nothing and every deleted-by-instance session
  // leaked its watcher.
  const inst = instance({ id: 'inst_abc', sessionId: 'sess_abc' });

  it('maps an instanceId to its sessionId', () => {
    const { deps } = makeDeps({ instances: [inst] });
    expect(new SessionOrchestrator(deps).resolveSessionId('inst_abc')).toBe('sess_abc');
  });

  it('passes a sessionId through unchanged', () => {
    const { deps } = makeDeps({ instances: [inst] });
    expect(new SessionOrchestrator(deps).resolveSessionId('sess_abc')).toBe('sess_abc');
  });

  it('returns undefined for an id it cannot place', () => {
    const { deps } = makeDeps({ instances: [inst] });
    expect(new SessionOrchestrator(deps).resolveSessionId('inst_gone')).toBeUndefined();
  });
});

// ─── teardownSession: MCP binder unregistration (H2) ─────────────────────────
describe('SessionOrchestrator.teardownSession — MCP binder', () => {
  // sess_old -> sess_mid -> sess_live, chain stored oldest-first on the live one.
  const chained = instance({
    id: 'inst_live',
    sessionId: 'sess_live',
    predecessorSessionIds: ['sess_old', 'sess_mid'],
  });

  it('unregisters the session from the binder by default', async () => {
    // McpSessionBinder.unregisterSession had ZERO production callers, so a
    // deleted session stayed MCP-resolvable until the app restarted and
    // kit_commit kept working against it.
    const { deps, unregisterSession } = makeDeps({
      instances: [instance({ sessionId: 'sess_solo' })],
    });

    await new SessionOrchestrator(deps).teardownSession('sess_solo');

    expect(unregisterSession).toHaveBeenCalledWith('sess_solo');
  });

  it('unregisters every predecessor alias, not just the current id', async () => {
    // registerExistingSessionsWithBinder registers each predecessor as its OWN
    // binder entry (AgentInstanceService:2317). Unregistering only the current
    // id would leave live aliases behind, and kit_commit under an old id would
    // still resolve to a closed session.
    const { deps, unregisterSession } = makeDeps({ instances: [chained] });

    await new SessionOrchestrator(deps).teardownSession('sess_live');

    const unregistered = unregisterSession.mock.calls.map((c: string[]) => c[0]);
    expect(new Set(unregistered)).toEqual(
      new Set(['sess_live', 'sess_mid', 'sess_old'])
    );
  });

  it('reports how many aliases it cleared', async () => {
    const { deps } = makeDeps({ instances: [chained] });
    const actions = await new SessionOrchestrator(deps).teardownSession('sess_live');

    expect(actions.mcpUnregistered).toBe(true);
    expect(actions.aliasesUnregistered).toBe(3);
  });

  describe('unbindMcp: false — the restart path', () => {
    // IPC.INSTANCE_RESTART tears down BEFORE restartInstance runs. Restart then
    // re-aliases the old session id onto the new worktree
    // (aliasOldSessionInBinder, :2274). Unbinding in between opens a window
    // where the old id resolves to nothing — any in-flight kit_commit from a
    // subagent launched with that id gets "Unknown session", and if the
    // createInstance half then fails the break is permanent.
    it('does not touch the binder', async () => {
      const { deps, unregisterSession } = makeDeps({ instances: [chained] });

      await new SessionOrchestrator(deps).teardownSession('sess_live', {
        unbindMcp: false,
      });

      expect(unregisterSession).not.toHaveBeenCalled();
    });

    it('still stops watchers and the rebase watcher — the flag gates only the binder', async () => {
      const { deps, stopAll, stopWatching } = makeDeps({ instances: [chained] });

      const actions = await new SessionOrchestrator(deps).teardownSession('sess_live', {
        unbindMcp: false,
      });

      expect(stopAll).toHaveBeenCalledWith('sess_live');
      expect(stopWatching).toHaveBeenCalledWith('sess_live');
      expect(actions.watchersStopped).toBe(true);
      expect(actions.mcpUnregistered).toBe(false);
      expect(actions.aliasesUnregistered).toBe(0);
    });
  });

  it('a throwing binder does not prevent watcher teardown, and is reported', async () => {
    const { deps, stopAll, stopWatching } = makeDeps({
      instances: [chained],
      unregisterSession: () => {
        throw new Error('binder exploded');
      },
    });

    const actions = await new SessionOrchestrator(deps).teardownSession('sess_live');

    expect(stopAll).toHaveBeenCalled();
    expect(stopWatching).toHaveBeenCalled();
    expect(actions.mcpUnregistered).toBe(false);
    expect(actions.errors.some((e) => e.step === 'mcpBinder')).toBe(true);
  });

  it('unregisters the given id even when it matches no live instance', async () => {
    // Ghost-mode deletes operate on sessions with no in-memory record; the
    // binder may still hold an entry from before a reap.
    const { deps, unregisterSession } = makeDeps({ instances: [] });

    await new SessionOrchestrator(deps).teardownSession('sess_ghost');

    expect(unregisterSession).toHaveBeenCalledWith('sess_ghost');
  });
});
