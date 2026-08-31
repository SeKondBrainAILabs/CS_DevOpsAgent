/**
 * SessionOrchestrator — the single funnel for session lifecycle.
 *
 * ## Why this exists
 *
 * "Create a session" is currently split across two layers, and "close a
 * session" does not exist at all:
 *
 *   - `AgentInstanceService.createInstance()` performs twelve side effects
 *     (validation, guards, worktree creation, session file, agent environment,
 *     MCP binder registration, ...) but does NOT start the file watcher.
 *   - Three separate IPC sites start the watcher instead: create
 *     (`ipc/index.ts:407`), restart (`:495`), and startup rehydration
 *     (`:1639` / `:1685`).
 *
 * Any caller that is not one of those three gets a session where auto-commit
 * silently never runs. That is exactly the trap an MCP `kit_start_session`
 * would fall into, and it is invisible until someone notices a session that
 * never commits.
 *
 * The orchestrator owns the compose step so neither the IPC layer nor the MCP
 * tool layer reimplements it. Later stories add their own methods here:
 * `teardownSession` (H1), `closeSession` (M2), `closeSessions` (M3),
 * `getSessionStatus` (M4), `restartSession` / `adoptSession` /
 * `updateSession` (M5), `reapExpiredAgentSessions` (R1).
 *
 * ## Why the deps are injected
 *
 * jest cannot import `AgentInstanceService`: it pulls in `electron-store`,
 * which is ESM and untransformed, so the import throws "Cannot use import
 * statement outside a module". That is why the existing
 * `AgentInstanceService.test.ts` exercises the `window.api` mock surface
 * rather than the class itself.
 *
 * If this module statically imported the concrete services it would inherit
 * the same untestability — and it is on the critical path for every session
 * the app creates. So it takes narrow structural interfaces and uses
 * `import type` only, which is erased at compile time. This mirrors the
 * `McpServiceDeps` shim already established at `McpServerService.ts:58`.
 */

import type {
  AgentInstance,
  AgentInstanceConfig,
  AgentType,
  IpcResult,
} from '../../shared/types';

/** The slice of AgentInstanceService the orchestrator needs. */
export interface OrchestratorAgentInstanceService {
  createInstance(config: AgentInstanceConfig): Promise<IpcResult<AgentInstance>>;
  listInstances(): IpcResult<AgentInstance[]>;
}

/** The slice of WatcherService the orchestrator needs. */
export interface OrchestratorWatcherService {
  startWithPath(
    sessionId: string,
    worktreePath: string,
    agentType?: AgentType,
    branchName?: string
  ): Promise<IpcResult<void>>;
  /**
   * Stops every watcher for a session, including the multi-repo compound keys
   * `<sessionId>:<repoName>`. Always prefer this over `stop()` — it already
   * handles the single-key case, so there is no conditional to get wrong.
   */
  stopAll(sessionId: string, releaseLocks?: boolean): Promise<IpcResult<void>>;
}

/** The slice of RebaseWatcherService the orchestrator needs. */
export interface OrchestratorRebaseWatcherService {
  stopWatching(sessionId: string): Promise<IpcResult<void>>;
}

export interface SessionOrchestratorDeps {
  agentInstance: OrchestratorAgentInstanceService;
  watcher: OrchestratorWatcherService;
  rebaseWatcher: OrchestratorRebaseWatcherService;
}

/** What a teardown actually managed to do. */
export interface TeardownActions {
  watchersStopped: boolean;
  rebaseWatcherStopped: boolean;
  errors: Array<{ step: string; message: string }>;
}

export class SessionOrchestrator {
  constructor(private readonly deps: SessionOrchestratorDeps) {}

  /**
   * Create a session and bring up everything that has to run alongside it.
   *
   * Behaviourally identical to what `IPC.INSTANCE_CREATE` did inline before
   * this story, including three details that are easy to "improve" by
   * accident:
   *
   *   1. The watcher is fire-and-forget. Awaiting it would make session
   *      creation wait on a filesystem scan, and would turn a watcher failure
   *      into a creation failure.
   *   2. The rejection is swallowed with a warn, for the same reason.
   *   3. `worktreePath` falls back to `config.repoPath`, because
   *      `createWorktreeIfNeeded` silently returns the repo path when worktree
   *      creation fails.
   *
   * KNOWN, DELIBERATELY PRESERVED: `startWithPath` accepts
   * `(sessionId, worktreePath, agentType = 'custom', branchName?)`, and only
   * the first two are passed. Every session therefore auto-locks as agent type
   * 'custom' regardless of the real agent, and `branchName` is always
   * undefined. The config carries both values and passing them would be a
   * genuine improvement — but it would change what `LockService.autoLockFile`
   * records, and this story's acceptance criterion is byte-identical
   * behaviour. Tracked separately.
   */
  async startSession(config: AgentInstanceConfig): Promise<IpcResult<AgentInstance>> {
    const result = await this.deps.agentInstance.createInstance(config);

    if (result.success && result.data?.sessionId) {
      const watchPath = result.data.worktreePath || config.repoPath;
      this.deps.watcher
        .startWithPath(result.data.sessionId, watchPath)
        .catch((err: unknown) => {
          console.warn(
            '[SessionOrchestrator] Failed to start watcher for new session:',
            err
          );
        });
    }

    return result;
  }

  /**
   * Stop every per-session background resource. Best-effort and idempotent.
   *
   * Three leaks are closed by having exactly one implementation of this:
   *
   *   - The delete paths called the exact-key `watcher.stop()`, which does not
   *     match the multi-repo compound keys `<sessionId>:<repoName>`, so an
   *     N-repo session leaked N-1 chokidar watchers on every close.
   *     `stopAll` matches both shapes.
   *   - No delete path stopped `RebaseWatcherService`, so every deleted
   *     session left a 60-second `setInterval` polling git for the life of the
   *     process. At fan-out that is the CPU leak that gets noticed first.
   *   - Doing it in four places meant a fifth caller (the MCP close path) would
   *     have had to remember all of it.
   *
   * Each step is caught individually: a session whose rebase watcher throws
   * must still get its file watchers stopped. Failures are reported rather
   * than swallowed, so `kit_close_session` (M2) can tell the calling agent what
   * actually happened instead of claiming a clean teardown that never was.
   *
   * NOTE: file locks are released as a side effect of `watcher.stop()`, but
   * only when a watcher is actually running — `stop()` returns early at
   * `WatcherService:383` when the session has none. Releasing locks for a
   * watcher-less session is leak 8c and belongs to H6, not here.
   */
  async teardownSession(sessionId: string): Promise<TeardownActions> {
    const actions: TeardownActions = {
      watchersStopped: false,
      rebaseWatcherStopped: false,
      errors: [],
    };

    const step = async (
      name: string,
      run: () => Promise<IpcResult<void>>
    ): Promise<boolean> => {
      try {
        const result = await run();
        // The services wrap everything and return IpcResult rather than
        // throwing, so a falsy `success` is the common failure shape.
        if (result && result.success === false) {
          actions.errors.push({
            step: name,
            message: result.error?.message ?? 'unknown error',
          });
          return false;
        }
        return true;
      } catch (err) {
        actions.errors.push({
          step: name,
          message: err instanceof Error ? err.message : String(err),
        });
        return false;
      }
    };

    actions.watchersStopped = await step('watchers', () =>
      this.deps.watcher.stopAll(sessionId)
    );
    actions.rebaseWatcherStopped = await step('rebaseWatcher', () =>
      this.deps.rebaseWatcher.stopWatching(sessionId)
    );

    return actions;
  }

  /**
   * Map an instance id OR a session id to the session id.
   *
   * `IPC.INSTANCE_DELETE` receives an `instanceId` and passed it straight to
   * `watcher.stop()`, but watchers are keyed by `sessionId` and the two id
   * spaces can never collide (`inst_…` vs `sess_…`,
   * `AgentInstanceService:590-591`). That call has therefore always matched
   * nothing, and every session deleted by instance id leaked its watcher.
   *
   * Returns `undefined` when the id matches no live instance, so callers can
   * distinguish "nothing to tear down" from "tear down the wrong thing".
   */
  resolveSessionId(instanceOrSessionId: string): string | undefined {
    const match = this.listSessions().find(
      (inst) =>
        inst.id === instanceOrSessionId || inst.sessionId === instanceOrSessionId
    );
    return match?.sessionId;
  }

  /** Every live instance. Empty when the underlying service reports failure. */
  listSessions(): AgentInstance[] {
    const listed = this.deps.agentInstance.listInstances();
    return listed?.success && listed.data ? listed.data : [];
  }

  /**
   * Every session id that refers to the same underlying session.
   *
   * A restart mints a NEW `sessionId` and records the old one on the new
   * instance's `predecessorSessionIds` (written by `recordPredecessor`,
   * `AgentInstanceService:1803`, oldest first). So a single session can be
   * referred to by any id in that chain, and callers receive whichever one the
   * agent happened to be launched with.
   *
   * Resolving from ANY member of the chain — not just the live id — is what
   * keeps `kit_close_sessions(parent_session_id=...)` working after a KIT
   * restart re-ids the parent: children created beforehand still carry the
   * parent's old id. Without this, that call, which the whole epic is built
   * around, matches nothing.
   *
   * An unknown id resolves to `[id]` rather than `[]`, so callers that filter
   * on the result degrade to "just this one" instead of silently matching
   * nothing.
   */
  expandSessionAliases(sessionId: string): string[] {
    const match = this.listSessions().find(
      (inst) =>
        inst.sessionId === sessionId ||
        (Array.isArray(inst.predecessorSessionIds) &&
          inst.predecessorSessionIds.includes(sessionId))
    );

    if (!match?.sessionId) return [sessionId];

    const aliases = new Set<string>([match.sessionId, sessionId]);
    for (const predecessor of match.predecessorSessionIds ?? []) {
      if (predecessor) aliases.add(predecessor);
    }
    return Array.from(aliases);
  }
}
