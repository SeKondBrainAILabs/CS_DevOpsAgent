/**
 * Shared MCP Type Definitions
 * Types used by both the MCP server and client code.
 */

// =============================================================================
// MCP SERVER STATUS
// =============================================================================

export interface McpServerStatus {
  port: number | null;
  url: string | null;
  isRunning: boolean;
  connectionCount: number;
  startedAt: string | null;
}

// =============================================================================
// MCP TOOL RESULTS
// =============================================================================

export interface McpCommitResult {
  commitHash: string;
  shortHash: string;
  message: string;
  filesChanged: number;
  pushed: boolean;
}

export interface McpSessionInfo {
  sessionId: string;
  agentType: string;
  branchName: string;
  baseBranch: string;
  worktreePath: string;
  repoPath: string;
  task: string;
  createdAt: string;
}

export interface McpLockResult {
  locked: boolean;
  files: string[];
  conflicts?: Array<{
    file: string;
    heldBy: string;
    sessionId: string;
  }>;
}

export interface McpCommitHistoryEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: number;
}

export interface McpReviewResult {
  logged: boolean;
  summary: string;
  sessionId: string;
}

// =============================================================================
// MCP TOOL NAMES
// =============================================================================

/**
 * Every tool the MCP server registers. Authoritative — a jest test asserts the
 * registered set matches this constant, so a tool added to tools.ts without a
 * line here fails the suite.
 *
 * It listed 8 of the 22 live tools before the session-lifecycle epic, which is
 * exactly the drift the test now prevents.
 */
export const MCP_TOOLS = {
  // Commit / review
  COMMIT: 'kit_commit',
  COMMIT_ALL: 'kit_commit_all',
  REQUEST_REVIEW: 'kit_request_review',
  GET_COMMIT_HISTORY: 'kit_get_commit_history',
  // Session info + activity
  GET_SESSION_INFO: 'kit_get_session_info',
  LOG_ACTIVITY: 'kit_log_activity',
  GET_ACTIVE_SESSION_COUNT: 'kit_get_active_session_count',
  // File coordination
  LOCK_FILE: 'kit_lock_file',
  UNLOCK_FILE: 'kit_unlock_file',
  // Git integration
  MERGE: 'kit_merge',
  REBASE: 'kit_rebase',
  GET_REPO_STATUS: 'kit_get_repo_status',
  LIST_BRANCHES: 'kit_list_branches',
  LIST_WORKTREES: 'kit_list_worktrees',
  CHECK_AUTOCOMMIT_GUARD: 'kit_check_autocommit_guard',
  // Workspace / project groups
  WORKSPACE_LIST: 'kit_workspace_list',
  WORKSPACE_ADD: 'kit_workspace_add',
  WORKSPACE_SCAN: 'kit_workspace_scan',
  PROJECT_GROUP_LIST: 'kit_project_group_list',
  PROJECT_GROUP_ADD: 'kit_project_group_add',
  // Per-repo worktree mode
  GET_REPO_WORKTREE_MODE: 'kit_get_repo_worktree_mode',
  SET_REPO_WORKTREE_MODE: 'kit_set_repo_worktree_mode',
} as const;

/**
 * Session-lifecycle tools (the MCP session-lifecycle epic).
 *
 * Declared ahead of their implementations on purpose. The registry test
 * asserts `registered ⊆ MCP_TOOLS` while this list is still filling up, and
 * flips to equality once the last one lands — so CI stays green through the
 * phase instead of going red on every intermediate commit.
 */
export const MCP_SESSION_TOOLS = {
  START_SESSION: 'kit_start_session',
  CLOSE_SESSION: 'kit_close_session',
  CLOSE_SESSIONS: 'kit_close_sessions',
  LIST_SESSIONS: 'kit_list_sessions',
  GET_SESSION_STATUS: 'kit_get_session_status',
} as const;

/** Tools that mutate state and are therefore logged to the activity feed. */
export const MCP_STATE_CHANGING_TOOLS: ReadonlySet<string> = new Set<string>([
  MCP_TOOLS.COMMIT,
  MCP_TOOLS.COMMIT_ALL,
  MCP_TOOLS.LOCK_FILE,
  MCP_TOOLS.UNLOCK_FILE,
  MCP_TOOLS.REQUEST_REVIEW,
  MCP_TOOLS.WORKSPACE_ADD,
  MCP_TOOLS.WORKSPACE_SCAN,
  MCP_TOOLS.PROJECT_GROUP_ADD,
  MCP_TOOLS.SET_REPO_WORKTREE_MODE,
  MCP_SESSION_TOOLS.START_SESSION,
  MCP_SESSION_TOOLS.CLOSE_SESSION,
  MCP_SESSION_TOOLS.CLOSE_SESSIONS,
]);

/**
 * Which activity-log type a tool's calls are recorded under.
 *
 * Everything was hardcoded to 'git', which was fine while every state-changing
 * tool really was a git operation. Session lifecycle is not — starting or
 * closing a session is not a commit, and filing it under 'git' makes the
 * activity feed read as though the agent had touched the repository.
 */
export const MCP_TOOL_LOG_TYPE: Readonly<Record<string, 'git' | 'info'>> = {
  [MCP_SESSION_TOOLS.START_SESSION]: 'info',
  [MCP_SESSION_TOOLS.CLOSE_SESSION]: 'info',
  [MCP_SESSION_TOOLS.CLOSE_SESSIONS]: 'info',
  [MCP_TOOLS.WORKSPACE_ADD]: 'info',
  [MCP_TOOLS.WORKSPACE_SCAN]: 'info',
  [MCP_TOOLS.PROJECT_GROUP_ADD]: 'info',
  [MCP_TOOLS.SET_REPO_WORKTREE_MODE]: 'info',
};

/**
 * The parameter naming the CALLER, per tool.
 *
 * `withCallLog` assumed `session_id` was always the caller. That holds for the
 * original 22, but not for the close tools: there `session_id` is the TARGET
 * and `caller_session_id` is the actor. Left unfixed, closing a session would
 * flip that session's status to 'idle', write the activity entry into the feed
 * of the session being closed, and run a drift check against a worktree that
 * may have just been removed.
 */
export const MCP_ACTOR_PARAM: Readonly<Record<string, string>> = {
  [MCP_SESSION_TOOLS.CLOSE_SESSION]: 'caller_session_id',
  [MCP_SESSION_TOOLS.CLOSE_SESSIONS]: 'caller_session_id',
};

/** Resolve the calling session id from a tool's arguments. */
export function actorSessionIdFor(
  toolName: string,
  args: Record<string, unknown> | undefined
): string {
  const param = MCP_ACTOR_PARAM[toolName] ?? 'session_id';
  const value = args?.[param];
  return typeof value === 'string' && value ? value : 'unknown';
}

// =============================================================================
// MCP RESOURCE URIS
// =============================================================================

export const MCP_RESOURCES = {
  SESSION_INFO: 'kit://session/{session_id}/info',
  HOUSERULES: 'kit://session/{session_id}/houserules',
  CONTRACTS: 'kit://session/{session_id}/contracts',
  COMMITS: 'kit://session/{session_id}/commits',
} as const;

// =============================================================================
// CLAUDE CODE CONFIG STATUS
// =============================================================================

export type McpInstallTarget = 'claude-code' | 'claude-desktop';

export interface McpInstallConfigStatus {
  installed: boolean;
  path: string;
  currentUrl: string | null;
  portMismatch: boolean;
}

/** @deprecated Use McpInstallConfigStatus instead */
export type ClaudeCodeConfigStatus = McpInstallConfigStatus;

// =============================================================================
// MCP CONFIG
// =============================================================================

export const MCP_DEFAULT_PORT_START = 39100;
export const MCP_SERVER_HOST = '127.0.0.1';
