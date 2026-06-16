/**
 * MCP Tool Handlers
 *
 * Registers 8 tools via mcpServer.tool() with Zod input schemas:
 * - kit_commit
 * - kit_commit_all (multi-repo: commit across all repos)
 * - kit_get_session_info
 * - kit_log_activity
 * - kit_lock_file
 * - kit_unlock_file
 * - kit_get_commit_history
 * - kit_request_review
 */

import { z } from 'zod';
import { existsSync, realpathSync } from 'fs';
import { join, basename, relative } from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpSessionBinder } from './session-binder';
import type { McpServiceDeps, McpCallLogEntry } from '../McpServerService';

// Dynamic execa (ESM-only) for the worktree-divergence guards. Mirrors the
// resolution fallbacks used in AgentInstanceService for bundler compatibility.
let _execa: ((cmd: string, args: string[], options?: object) => Promise<{ stdout: string; stderr: string }>) | null = null;
async function gitInWorktree(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  if (!_execa) {
    const mod: any = await import('execa');
    _execa = typeof mod.execa === 'function' ? mod.execa
      : typeof mod.default === 'function' ? mod.default
      : mod.default?.execa;
    if (typeof _execa !== 'function') throw new Error('execa unavailable');
  }
  return _execa('git', args, { cwd, timeout: 10_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
}

/** Shape of a worktree-divergence correction returned to the agent. */
type Divergence = {
  error: 'WRONG_WORKTREE' | 'DETACHED_HEAD' | 'WRONG_BRANCH';
  instruction: string;
  [k: string]: unknown;
};

/** Interface for the McpServerService to log calls */
interface McpCallLogger {
  addCallLogEntry(entry: McpCallLogEntry): void;
}

/**
 * Register all MCP tools on the server instance.
 *
 * NOTE: We cast `server` to `any` below to avoid extremely expensive
 * generic type inference when combining McpServer.tool() + Zod schemas.
 * TypeScript's type checker hangs (OOM) without this escape hatch.
 */
export function registerTools(
  server: McpServer,
  binder: McpSessionBinder,
  deps: McpServiceDeps,
  callLogger?: McpCallLogger
): void {
  // Cast to any to avoid TS compiler OOM from complex zod+MCP generic inference
  const srv: any = server;

  // Tools that change state — their calls are logged to the session activity feed
  const STATE_CHANGING_TOOLS = new Set([
    'kit_commit', 'kit_commit_all', 'kit_lock_file', 'kit_unlock_file', 'kit_request_review',
  ]);

  // ===========================================================================
  // Worktree-divergence guards
  //
  // Coding agents are chaotic: they cd into sibling clones, switch branches, or
  // detach HEAD. Because the commit tools always operate in the session's
  // REGISTERED worktree (not wherever the agent happens to be), divergence
  // silently produces empty/wrong-branch/orphaned commits. These guards make
  // that impossible: mutating tools require the agent's cwd and we verify both
  // the directory and the branch, returning a correction the agent reads.
  // ===========================================================================

  /** The branch the session's worktree SHOULD be on, from the instance record. */
  function expectedBranchFor(sessionId: string): string | undefined {
    try {
      const listed = deps.agentInstanceService?.listInstances?.();
      if (!listed?.success || !listed.data) return undefined;
      const inst = listed.data.find((i: any) => i.sessionId === sessionId || i.id === sessionId);
      return inst?.config?.branchName;
    } catch { return undefined; }
  }

  /**
   * Current branch of a worktree, TRI-STATE (see GitService.getCurrentBranch):
   *   branch name → on that branch; 'HEAD' → detached; null → could not determine.
   * We must distinguish "detached" from "unknown" so a failed check never produces
   * a false detached warning/block.
   */
  async function currentBranchOf(worktreePath: string): Promise<string | null> {
    // Prefer the injected git service (mockable in tests); fall back to direct git.
    const dep = deps.gitService?.getCurrentBranchName;
    if (typeof dep === 'function') {
      try { return await dep(worktreePath); } catch { return null; }
    }
    try {
      const { stdout } = await gitInWorktree(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath);
      return stdout.trim() || null;
    } catch { return null; }
  }

  function realpathSafe(p: string): string {
    try { return realpathSync(p); } catch { return p.replace(/\/+$/, ''); }
  }

  /**
   * Layers 1+2: verify the agent is physically in the session worktree (cwd) and
   * that the worktree is on the expected branch. Returns a correction or null.
   */
  async function checkDivergence(
    sessionId: string,
    repo: string | undefined,
    cwd: string,
    opts: { requireBranch?: boolean } = {},
  ): Promise<Divergence | null> {
    const { requireBranch = true } = opts;
    const expectedWorktree = binder.getWorktreePathForRepo(sessionId, repo);
    if (!expectedWorktree) return null; // unknown session/repo handled by the caller

    // Layer 1 — the agent's working directory must BE the worktree.
    if (realpathSafe(cwd) !== realpathSafe(expectedWorktree)) {
      return {
        error: 'WRONG_WORKTREE',
        expected_worktree: expectedWorktree,
        your_cwd: cwd,
        instruction: `You are not in this session's worktree. Any changes under "${cwd}" are NOT part of this session and will NOT be committed. Run:  cd "${expectedWorktree}"  then retry. Work ONLY inside that directory.`,
      };
    }

    if (!requireBranch) return null;

    // Layer 2 — the worktree must be on the session branch, not detached/switched.
    // Tri-state: null = couldn't determine → FAIL OPEN (never block/scare on an
    // inconclusive check); 'HEAD' = genuinely detached; else = the branch name.
    const actualBranch = await currentBranchOf(expectedWorktree);
    const expectedBranch = expectedBranchFor(sessionId);
    if (actualBranch === null) {
      return null; // can't tell — allow; the cwd check already confirmed the directory
    }
    if (actualBranch === 'HEAD') {
      return {
        error: 'DETACHED_HEAD',
        expected_branch: expectedBranch ?? null,
        instruction: `The worktree is in a DETACHED HEAD state — commits made now attach to no branch and can be lost. Run:  git checkout ${expectedBranch ?? '<session-branch>'}  before continuing.`,
      };
    }
    // Only enforce the branch name for the primary repo; secondary repos in a
    // multi-repo session may legitimately be on a differently-named branch.
    if (!repo && expectedBranch && actualBranch !== expectedBranch) {
      return {
        error: 'WRONG_BRANCH',
        expected_branch: expectedBranch,
        your_branch: actualBranch,
        instruction: `The worktree is on "${actualBranch}" but this session is "${expectedBranch}". Run:  git checkout ${expectedBranch}  before continuing so your work lands on the right branch.`,
      };
    }
    return null;
  }

  /** Build the rejection tool-response for a divergence and log it. */
  function divergenceResponse(sessionId: string, toolName: string, divergence: Divergence) {
    deps.activityService?.log(sessionId, 'warning', `MCP rejected ${toolName} — ${divergence.error}`, { source: 'mcp', toolName, ...divergence });
    deps.debugLog?.warn('McpTool', `Rejected ${toolName} — ${divergence.error}`, { sessionId, ...divergence });
    return { content: [{ type: 'text', text: JSON.stringify(divergence, null, 2) }], isError: true };
  }

  // Layer 3: proactive drift directive, throttled, appended to EVERY response so
  // the agent is nudged to correct even on read-only calls (before it tries to commit).
  const driftCache = new Map<string, { at: number; directive: string | null }>();
  const DRIFT_TTL_MS = 8000;
  async function driftDirectiveFor(sessionId: string): Promise<string | null> {
    if (!sessionId || sessionId === 'unknown') return null;
    const cached = driftCache.get(sessionId);
    if (cached && Date.now() - cached.at < DRIFT_TTL_MS) return cached.directive;
    let directive: string | null = null;
    try {
      const worktree = binder.getWorktreePathForRepo(sessionId);
      if (worktree && existsSync(worktree)) {
        const actual = await currentBranchOf(worktree);
        const expected = expectedBranchFor(sessionId);
        // Tri-state: null = couldn't determine → stay SILENT (no false alarms).
        // Only warn on a definitive detached HEAD or a definite branch mismatch.
        if (actual === 'HEAD') {
          directive = `⚠️ KIT: this session's worktree is in a DETACHED HEAD state. Run: git checkout ${expected ?? '<session-branch>'} before committing, or your work may be lost.`;
        } else if (actual !== null && expected && actual !== expected) {
          directive = `⚠️ KIT: this session's worktree is on "${actual}" but should be on "${expected}". Run: git checkout ${expected} before committing.`;
        }
      }
    } catch { /* best-effort */ }
    driftCache.set(sessionId, { at: Date.now(), directive });
    return directive;
  }

  /** Wrap a tool handler to log timing, success/failure, and surface errors to the activity feed */
  function withCallLog<T extends Record<string, any>>(
    toolName: string,
    handler: (args: T) => Promise<any>
  ): (args: T) => Promise<any> {
    return async (args: T) => {
      const start = Date.now();
      const sessionId = (args as any).session_id || 'unknown';

      // First MCP call from an agent flips the instance status from 'waiting'
      // (the post-create / post-restart default) to 'idle' so the
      // "Waiting for agent to connect…" banner clears. Idempotent — only
      // bumps when current status is exactly 'waiting'.
      if (sessionId !== 'unknown' && deps.agentInstanceService?.listInstances) {
        try {
          const listed = deps.agentInstanceService.listInstances();
          if (listed?.success && Array.isArray(listed.data)) {
            for (const inst of listed.data) {
              if (inst?.sessionId === sessionId && inst.status === 'waiting' && inst.id) {
                deps.agentInstanceService.updateInstanceStatus?.(inst.id, 'idle');
                break;
              }
            }
          }
        } catch {
          // Diagnostics-only flip — never block a tool call on it.
        }
      }

      // Log state-changing tool calls to the activity feed so they're visible in KIT
      if (STATE_CHANGING_TOOLS.has(toolName) && sessionId !== 'unknown') {
        deps.activityService?.log(sessionId, 'git', `MCP › ${toolName}`, { source: 'mcp', toolName });
      }

      try {
        const result = await handler(args);
        callLogger?.addCallLogEntry({
          timestamp: new Date().toISOString(),
          toolName,
          sessionId,
          success: true,
          durationMs: Date.now() - start,
        });
        // Layer 3: append a proactive drift warning so the agent is nudged to
        // correct even on read-only calls. Skip when the call was itself a
        // divergence rejection (it already carries the correction).
        try {
          if (result && !result.isError && Array.isArray(result.content)) {
            const directive = await driftDirectiveFor(sessionId);
            if (directive) result.content.push({ type: 'text', text: directive });
          }
        } catch { /* non-fatal */ }
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        callLogger?.addCallLogEntry({
          timestamp: new Date().toISOString(),
          toolName,
          sessionId,
          success: false,
          durationMs: Date.now() - start,
          error: errorMsg,
        });
        deps.debugLog?.error('McpTool', `Tool call failed: ${toolName}`, { sessionId, error: errorMsg });
        // Always surface exceptions to the activity feed regardless of tool type
        if (sessionId !== 'unknown') {
          deps.activityService?.log(sessionId, 'error', `MCP error › ${toolName}: ${errorMsg}`, {
            source: 'mcp',
            toolName,
          });
        }
        throw err;
      }
    };
  }

  /** Post-commit: detect contract changes and regenerate affected contracts */
  async function triggerContractCheck(sessionId: string, worktreePath: string, commitHash: string, repoPath?: string): Promise<void> {
    if (!deps.contractDetectionService || !deps.contractGenerationService || !deps.databaseService) return;

    const metaFile = join(worktreePath, '.devops-kit', '.contract-generation-meta.json');
    if (!existsSync(metaFile)) return;

    try {
      const analysisResult = await deps.contractDetectionService.analyzeCommit(worktreePath, commitHash);
      if (!analysisResult.success || !analysisResult.data?.hasContractChanges) return;

      const { changes, breakingChanges } = analysisResult.data;
      const changedFiles: string[] = changes.map((c: { file: string }) => c.file);

      const effectiveRepoPath = repoPath || worktreePath;
      const cachedFeatures: any[] = deps.databaseService.getSetting(`discovered_features:${effectiveRepoPath}`, []) || [];
      if (!cachedFeatures.length) return;

      const affectedFeatures = cachedFeatures.filter((feature: any) => {
        const relativeFeatPath = relative(effectiveRepoPath, feature.basePath);
        return changedFiles.some((f: string) => f.startsWith(relativeFeatPath + '/'));
      });

      if (affectedFeatures.length === 0) return;

      const updatedFeatures: string[] = [];
      for (const feature of affectedFeatures) {
        try {
          const result = await deps.contractGenerationService!.generateFeatureContract(worktreePath, feature);
          if (result.success) updatedFeatures.push(feature.name);
        } catch { /* non-fatal */ }
      }

      if (updatedFeatures.length > 0 && deps.activityService) {
        const displayFiles = changedFiles.map((f: string) => basename(f));
        const filesSummary = displayFiles.length > 5
          ? `${displayFiles.slice(0, 5).join(', ')} +${displayFiles.length - 5} more`
          : displayFiles.join(', ');
        deps.activityService.log(sessionId, 'info',
          `Contracts updated for ${updatedFeatures.length} feature(s): ${updatedFeatures.join(', ')} (${changedFiles.length} files: ${filesSummary})`,
          { type: 'contract-auto-update', commitHash, updatedFeatures, filesChanged: changedFiles, breakingChanges: breakingChanges.length }
        );
      }
    } catch (err) {
      console.error('[MCP] Post-commit contract check error:', err);
    }
  }

  // --------------------------------------------------------------------------
  // kit_commit — Stage + commit + record + push (optional repo for multi-repo)
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_commit',
    'Stage all changes, commit with a message, record in KIT, and optionally push. This replaces writing .devops-commit files. In multi-repo mode, specify repo to target a specific repository.',
    {
      session_id: z.string().describe('The KIT session ID'),
      message: z.string().describe('Commit message (conventional commits format preferred)'),
      cwd: z.string().describe('Your current shell working directory (run `pwd`). REQUIRED. The commit is rejected if this is not the session worktree, so your work is never silently committed to the wrong place.'),
      push: z.boolean().optional().default(false).describe('Push to remote after commit'),
      repo: z.string().optional().describe('Target repo name (multi-repo mode). Omit for primary repo.'),
    },
    withCallLog('kit_commit', async ({ session_id, message, cwd, push, repo }) => {
      const worktree = binder.getWorktreePathForRepo(session_id, repo);
      if (!worktree) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session or repo', session_id, repo }) }] };
      }

      // Guard: refuse if the agent is in the wrong directory or on the wrong branch.
      const divergence = await checkDivergence(session_id, repo, cwd);
      if (divergence) return divergenceResponse(session_id, 'kit_commit', divergence);

      if (!deps.gitService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Git service not available' }) }] };
      }

      try {
        // For secondary repos, prefix message with "Upgrade From {RootRepo}"
        // so child repo history clearly traces back to the root repo session
        const primaryRepo = binder.getPrimaryRepoNameIfSecondary(session_id, repo);
        const commitMessage = primaryRepo
          ? `[Upgrade From ${primaryRepo}] ${message}`
          : message;

        // 1. Stage + commit via gitService (pass repoName for multi-repo)
        const commitResult = await deps.gitService.commit(session_id, commitMessage, repo);
        if (!commitResult.success) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: commitResult.error?.message || 'Commit failed' }) }] };
        }

        const commitData = commitResult.data;
        const hash = commitData?.hash || commitData?.commitHash || '';
        const shortHash = commitData?.shortHash || hash.substring(0, 7);
        const filesChanged = commitData?.filesChanged || 0;

        // 2. Record in database
        if (deps.databaseService) {
          try {
            deps.databaseService.recordCommit(hash, session_id, commitMessage, new Date().toISOString(), { filesChanged, repoName: repo });
            deps.databaseService.recordSessionEvent(session_id, 'commit', { hash, message: commitMessage, filesChanged, repo });
          } catch {
            // Non-fatal: database recording
          }
        }

        // 3. Link activity — update the "MCP › kit_commit" entry with commit details
        if (deps.activityService) {
          deps.activityService.log(session_id, 'git', `Committed [${shortHash}]: ${message}`, {
            commitHash: hash,
            shortHash,
            filesChanged,
            repo,
            source: 'mcp',
          });
        }

        // 4. Optional push — capture failure reason so agent knows exactly what went wrong
        let pushed = false;
        let pushError: string | undefined;
        if (push) {
          try {
            const pushResult = await deps.gitService.push(session_id, repo);
            pushed = pushResult.success === true;
            if (!pushed) {
              pushError = pushResult.error?.message || 'Push returned failure';
            }
          } catch (err) {
            pushError = err instanceof Error ? err.message : 'Push threw an error';
          }
          if (!pushed && pushError) {
            deps.activityService?.log(session_id, 'warning',
              `Push failed after commit [${shortHash}]: ${pushError}`,
              { commitHash: hash, pushError, repo, source: 'mcp' }
            );
          }
        }

        // 5. Emit commit event so renderer CommitsTab updates in real-time
        deps.emitCommitCompleted?.(session_id, hash, commitMessage, filesChanged);

        // 6. Post-commit contract check (fire-and-forget)
        triggerContractCheck(session_id, worktree, hash).catch(() => {});

        const result: Record<string, unknown> = {
          commitHash: hash,
          shortHash,
          message,
          filesChanged,
          pushed,
          repo: repo || undefined,
        };
        // Always tell the agent why push failed — it needs this to decide next steps
        if (pushError) result.pushError = pushError;

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Commit failed';
        deps.activityService?.log(session_id, 'error', `Commit failed: ${errorMsg}`, { source: 'mcp' });
        return { content: [{ type: 'text', text: JSON.stringify({ error: errorMsg }) }] };
      }
    })
  );

  // --------------------------------------------------------------------------
  // kit_commit_all — Commit across all repos in multi-repo session
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_commit_all',
    'Commit changes across all repositories in a multi-repo session. Each repo with changes gets a commit with the same message.',
    {
      session_id: z.string().describe('The KIT session ID'),
      message: z.string().describe('Commit message (conventional commits format preferred)'),
      cwd: z.string().describe('Your current shell working directory (run `pwd`). REQUIRED — must be the session\'s primary worktree, or the call is rejected.'),
      push: z.boolean().optional().default(false).describe('Push to remote after each commit'),
    },
    withCallLog('kit_commit_all', async ({ session_id, message, cwd, push }) => {
      const repos = binder.getReposForSession(session_id);
      if (repos.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session', session_id }) }] };
      }

      // Guard: agent must be in the session's primary worktree, on the right branch.
      const divergence = await checkDivergence(session_id, undefined, cwd);
      if (divergence) return divergenceResponse(session_id, 'kit_commit_all', divergence);

      if (!deps.gitService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Git service not available' }) }] };
      }

      const results: Array<{ repoName: string; commitHash?: string; filesChanged?: number; pushed?: boolean; error?: string }> = [];

      for (const repo of repos) {
        try {
          const repoName = repo.repoName === 'primary' ? undefined : repo.repoName;

          // For secondary repos, prefix message with "Upgrade From {RootRepo}"
          const primaryRepo = binder.getPrimaryRepoNameIfSecondary(session_id, repoName);
          const commitMessage = primaryRepo
            ? `[Upgrade From ${primaryRepo}] ${message}`
            : message;

          const commitResult = await deps.gitService.commit(session_id, commitMessage, repoName);

          if (!commitResult.success) {
            results.push({ repoName: repo.repoName, error: commitResult.error?.message || 'Commit failed' });
            continue;
          }

          const hash = commitResult.data?.hash || '';
          const filesChanged = commitResult.data?.filesChanged || 0;

          // Record in database
          if (deps.databaseService) {
            try {
              deps.databaseService.recordCommit(hash, session_id, commitMessage, new Date().toISOString(), { filesChanged, repoName: repo.repoName });
            } catch { /* non-fatal */ }
          }

          // Activity log
          if (deps.activityService) {
            deps.activityService.log(session_id, 'git', `Committed (${repo.repoName}): ${message}`, {
              commitHash: hash,
              repo: repo.repoName,
              source: 'mcp',
            });
          }

          // Optional push — capture failure reason
          let pushed = false;
          let pushError: string | undefined;
          if (push) {
            try {
              const pushResult = await deps.gitService.push(session_id, repoName);
              pushed = pushResult.success === true;
              if (!pushed) pushError = pushResult.error?.message || 'Push returned failure';
            } catch (err) {
              pushError = err instanceof Error ? err.message : 'Push threw an error';
            }
            if (!pushed && pushError) {
              deps.activityService?.log(session_id, 'warning',
                `Push failed (${repo.repoName}): ${pushError}`,
                { commitHash: hash, pushError, repo: repo.repoName, source: 'mcp' }
              );
            }
          }

          // Post-commit contract check
          triggerContractCheck(session_id, repo.worktreePath, hash).catch(() => {});

          const repoResult: Record<string, unknown> = { repoName: repo.repoName, commitHash: hash, filesChanged, pushed };
          if (pushError) repoResult.pushError = pushError;
          results.push(repoResult as any);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Failed';
          deps.activityService?.log(session_id, 'error', `Commit failed (${repo.repoName}): ${errMsg}`, { source: 'mcp' });
          results.push({ repoName: repo.repoName, error: errMsg });
        }
      }

      return { content: [{ type: 'text', text: JSON.stringify({ commits: results }) }] };
    })
  );

  // --------------------------------------------------------------------------
  // kit_get_session_info — Session config and metadata
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_get_session_info',
    'Get session configuration, metadata, and working directory for a KIT session. In multi-repo mode, returns all repos.',
    {
      session_id: z.string().describe('The KIT session ID'),
    },
    withCallLog('kit_get_session_info', async ({ session_id }) => {
      const session = binder.getSession(session_id);
      if (!session) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session', session_id }) }] };
      }

      // Try to get richer info from agentInstanceService
      let extraInfo: Record<string, unknown> = {};
      if (deps.agentInstanceService) {
        const instances = deps.agentInstanceService.listInstances();
        if (instances.success && instances.data) {
          const match = instances.data.find((i: any) => i.sessionId === session_id);
          if (match) {
            extraInfo = {
              agentType: match.config?.agentType,
              branchName: match.config?.branchName,
              baseBranch: match.config?.baseBranch,
              task: match.config?.taskDescription,
              repoPath: match.config?.repoPath,
              createdAt: match.createdAt,
            };
          }
        }
      }

      // Include repos list for multi-repo sessions
      const repos = binder.getReposForSession(session_id);
      const reposInfo = repos.length > 1 ? repos : undefined;

      const result = {
        sessionId: session_id,
        worktreePath: session.worktreePath,
        registeredAt: session.registeredAt,
        repos: reposInfo,
        ...extraInfo,
      };

      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    })
  );

  // --------------------------------------------------------------------------
  // kit_log_activity — Log to KIT dashboard timeline
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_log_activity',
    'Log an activity entry to the KIT dashboard timeline. Use for progress updates, warnings, or error reports.',
    {
      session_id: z.string().describe('The KIT session ID'),
      type: z.enum(['info', 'warning', 'error', 'git']).describe('Log level/type'),
      message: z.string().describe('Activity message'),
      details: z.record(z.unknown()).optional().describe('Optional structured details'),
    },
    withCallLog('kit_log_activity', async ({ session_id, type, message, details }) => {
      if (!binder.getSession(session_id)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session', session_id }) }] };
      }

      if (!deps.activityService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Activity service not available' }) }] };
      }

      deps.activityService.log(session_id, type, message, { ...details, source: 'mcp' });
      return { content: [{ type: 'text', text: JSON.stringify({ logged: true, type, message }) }] };
    })
  );

  // --------------------------------------------------------------------------
  // kit_lock_file — Declare file edit intent (optional repo for multi-repo)
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_lock_file',
    'Declare intent to edit files. Returns conflicts if another session holds locks on the same files.',
    {
      session_id: z.string().describe('The KIT session ID'),
      files: z.array(z.string()).describe('File paths to lock (relative to worktree)'),
      cwd: z.string().describe('Your current shell working directory (run `pwd`). REQUIRED — must be the session worktree.'),
      reason: z.string().optional().describe('Reason for the lock'),
      repo: z.string().optional().describe('Target repo name (multi-repo mode). Omit for primary repo.'),
    },
    withCallLog('kit_lock_file', async ({ session_id, files, cwd, reason, repo }) => {
      const worktree = binder.getWorktreePathForRepo(session_id, repo);
      if (!worktree) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session or repo', session_id, repo }) }] };
      }

      // Guard (directory only — locking files from the wrong dir is the failure to catch).
      const divergence = await checkDivergence(session_id, repo, cwd, { requireBranch: false });
      if (divergence) return divergenceResponse(session_id, 'kit_lock_file', divergence);

      if (!deps.lockService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Lock service not available' }) }] };
      }

      try {
        // Check for conflicts first
        const conflictResult = await deps.lockService.checkConflicts(worktree, files, session_id);
        const conflicts = conflictResult.success && conflictResult.data?.length > 0
          ? conflictResult.data
          : [];

        if (conflicts.length > 0) {
          const conflictSummary = conflicts.map((c: any) =>
            `${c.file || c.filePath} (held by ${c.heldBy || c.agentType || 'unknown session'})`
          ).join(', ');
          deps.activityService?.log(session_id, 'warning',
            `File lock conflict: ${conflictSummary}`,
            { files, conflicts, source: 'mcp' }
          );
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                locked: false,
                files,
                conflicts: conflicts.map((c: any) => ({
                  file: c.file || c.filePath,
                  heldBy: c.heldBy || c.agentType || 'unknown',
                  sessionId: c.sessionId || 'unknown',
                })),
              }),
            }],
          };
        }

        // Declare locks
        await deps.lockService.declareFiles(session_id, files, 'edit');

        if (deps.activityService) {
          deps.activityService.log(session_id, 'info', `Locked files: ${files.join(', ')}`, {
            files,
            reason,
            repo,
            source: 'mcp',
          });
        }

        return { content: [{ type: 'text', text: JSON.stringify({ locked: true, files, conflicts: [] }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : 'Lock failed' }) }] };
      }
    })
  );

  // --------------------------------------------------------------------------
  // kit_unlock_file — Release file locks
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_unlock_file',
    'Release file locks for this session. If no files specified, releases all locks.',
    {
      session_id: z.string().describe('The KIT session ID'),
      files: z.array(z.string()).optional().describe('Specific files to unlock. Omit to release all.'),
      repo: z.string().optional().describe('Target repo name (multi-repo mode). Omit for primary repo.'),
    },
    withCallLog('kit_unlock_file', async ({ session_id, files, repo }) => {
      if (!binder.getSession(session_id)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session', session_id }) }] };
      }

      if (!deps.lockService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Lock service not available' }) }] };
      }

      try {
        if (files && files.length > 0) {
          // Release specific files by force-releasing each
          const worktree = binder.getWorktreePathForRepo(session_id, repo)!;
          for (const file of files) {
            await deps.lockService.forceReleaseLock(worktree, file);
          }
        } else {
          // Release all locks for this session
          await deps.lockService.releaseFiles(session_id);
        }

        const unlockedLabel = files ? files.join(', ') : 'all files';
        deps.activityService?.log(session_id, 'git', `Unlocked: ${unlockedLabel}`, { files, source: 'mcp' });
        return { content: [{ type: 'text', text: JSON.stringify({ unlocked: true, files: files || 'all' }) }] };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unlock failed';
        deps.activityService?.log(session_id, 'error', `Unlock failed: ${errMsg}`, { source: 'mcp' });
        return { content: [{ type: 'text', text: JSON.stringify({ error: errMsg }) }] };
      }
    })
  );

  // --------------------------------------------------------------------------
  // kit_get_commit_history — Recent commits for session branch
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_get_commit_history',
    'Get recent commit history for the session branch. In multi-repo mode, specify repo to get history for a specific repository.',
    {
      session_id: z.string().describe('The KIT session ID'),
      limit: z.number().optional().default(10).describe('Max number of commits to return'),
      repo: z.string().optional().describe('Target repo name (multi-repo mode). Omit for primary repo.'),
    },
    withCallLog('kit_get_commit_history', async ({ session_id, limit, repo }) => {
      const worktree = binder.getWorktreePathForRepo(session_id, repo);
      if (!worktree) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session or repo', session_id, repo }) }] };
      }

      if (!deps.gitService) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Git service not available' }) }] };
      }

      try {
        const result = await deps.gitService.getCommitHistory(worktree, undefined, limit);
        if (!result.success) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: result.error?.message || 'Failed to get history' }) }] };
        }

        return { content: [{ type: 'text', text: JSON.stringify({ commits: result.data || [], repo: repo || undefined }) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : 'History fetch failed' }) }] };
      }
    })
  );

  // --------------------------------------------------------------------------
  // kit_request_review — Signal work ready for review
  // --------------------------------------------------------------------------
  srv.tool(
    'kit_request_review',
    'Signal that work is ready for review. Logs activity and emits event to KIT dashboard.',
    {
      session_id: z.string().describe('The KIT session ID'),
      summary: z.string().describe('Summary of work completed and what to review'),
      cwd: z.string().describe('Your current shell working directory (run `pwd`). REQUIRED — must be the session worktree, on the session branch.'),
    },
    withCallLog('kit_request_review', async ({ session_id, summary, cwd }) => {
      if (!binder.getSession(session_id)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Unknown session', session_id }) }] };
      }

      // Guard: reviewing implies the work is on the session branch in the worktree.
      const divergence = await checkDivergence(session_id, undefined, cwd);
      if (divergence) return divergenceResponse(session_id, 'kit_request_review', divergence);

      if (deps.activityService) {
        deps.activityService.log(session_id, 'info', `Review requested: ${summary}`, {
          reviewRequested: true,
          summary,
          source: 'mcp',
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ logged: true, summary, sessionId: session_id }),
        }],
      };
    })
  );
}
