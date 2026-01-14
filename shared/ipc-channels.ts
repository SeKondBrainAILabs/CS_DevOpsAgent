/**
 * IPC Channel Constants
 * Naming convention: {domain}:{action}
 */

export const IPC = {
  // ==========================================================================
  // SESSION CHANNELS
  // ==========================================================================
  SESSION_CREATE: 'session:create',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_CLOSE: 'session:close',
  SESSION_CLAIM: 'session:claim',
  SESSION_UPDATE: 'session:update',
  // Events (main → renderer)
  SESSION_CREATED: 'session:created',
  SESSION_UPDATED: 'session:updated',
  SESSION_CLOSED: 'session:closed',

  // ==========================================================================
  // GIT CHANNELS
  // ==========================================================================
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_MERGE: 'git:merge',
  GIT_BRANCHES: 'git:branches',
  GIT_CREATE_WORKTREE: 'git:createWorktree',
  GIT_REMOVE_WORKTREE: 'git:removeWorktree',
  // Events (main → renderer)
  GIT_STATUS_CHANGED: 'git:statusChanged',

  // ==========================================================================
  // WATCHER CHANNELS
  // ==========================================================================
  WATCHER_START: 'watcher:start',
  WATCHER_STOP: 'watcher:stop',
  WATCHER_STATUS: 'watcher:status',
  // Events (main → renderer)
  FILE_CHANGED: 'file:changed',
  COMMIT_TRIGGERED: 'commit:triggered',
  COMMIT_COMPLETED: 'commit:completed',

  // ==========================================================================
  // LOCK/COORDINATION CHANNELS
  // ==========================================================================
  LOCK_DECLARE: 'lock:declare',
  LOCK_RELEASE: 'lock:release',
  LOCK_CHECK: 'lock:check',
  LOCK_LIST: 'lock:list',
  // Events (main → renderer)
  CONFLICT_DETECTED: 'conflict:detected',

  // ==========================================================================
  // CONFIG CHANNELS
  // ==========================================================================
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_GET_ALL: 'config:getAll',
  CREDENTIAL_GET: 'credential:get',
  CREDENTIAL_SET: 'credential:set',
  CREDENTIAL_HAS: 'credential:has',

  // ==========================================================================
  // AI/CHAT CHANNELS
  // ==========================================================================
  AI_CHAT: 'ai:chat',
  AI_STREAM_START: 'ai:stream:start',
  AI_STREAM_STOP: 'ai:stream:stop',
  AI_GET_MODEL: 'ai:get-model',
  AI_SET_MODEL: 'ai:set-model',
  AI_LIST_MODELS: 'ai:list-models',
  // Mode-based prompts
  AI_CHAT_WITH_MODE: 'ai:chat-with-mode',
  AI_STREAM_WITH_MODE: 'ai:stream-with-mode',
  AI_LIST_MODES: 'ai:list-modes',
  AI_GET_MODE: 'ai:get-mode',
  AI_RELOAD_CONFIG: 'ai:reload-config',
  AI_GET_CONFIG_SOURCES: 'ai:get-config-sources',
  // Events (main → renderer)
  AI_STREAM_CHUNK: 'ai:stream:chunk',
  AI_STREAM_END: 'ai:stream:end',
  AI_STREAM_ERROR: 'ai:stream:error',

  // ==========================================================================
  // ACTIVITY LOG CHANNELS
  // ==========================================================================
  LOG_GET: 'log:get',
  LOG_CLEAR: 'log:clear',
  // Events (main → renderer)
  LOG_ENTRY: 'log:entry',

  // ==========================================================================
  // DIALOG CHANNELS
  // ==========================================================================
  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
  DIALOG_SHOW_MESSAGE: 'dialog:showMessage',

  // ==========================================================================
  // AGENT LISTENER CHANNELS
  // Kanvas monitors agents that report into it
  // ==========================================================================
  AGENT_LIST: 'agent:list',
  AGENT_GET: 'agent:get',
  AGENT_SESSIONS: 'agent:sessions',
  AGENT_INITIALIZE: 'agent:initialize',
  // Events (main → renderer) - Agent reports to Kanvas
  AGENT_REGISTERED: 'agent:registered',
  AGENT_UNREGISTERED: 'agent:unregistered',
  AGENT_HEARTBEAT: 'agent:heartbeat',
  AGENT_STATUS_CHANGED: 'agent:status-changed',
  SESSION_REPORTED: 'session:reported',
  ACTIVITY_REPORTED: 'activity:reported',

  // ==========================================================================
  // AGENT INSTANCE CHANNELS
  // Create and manage agent instances from Kanvas dashboard
  // ==========================================================================
  INSTANCE_CREATE: 'instance:create',
  INSTANCE_VALIDATE_REPO: 'instance:validate-repo',
  INSTANCE_INITIALIZE_KANVAS: 'instance:initialize-kanvas',
  INSTANCE_GET_INSTRUCTIONS: 'instance:get-instructions',
  INSTANCE_LAUNCH: 'instance:launch',
  INSTANCE_LIST: 'instance:list',
  INSTANCE_GET: 'instance:get',
  INSTANCE_DELETE: 'instance:delete',
  INSTANCE_CLEAR_ALL: 'instance:clear-all',
  RECENT_REPOS_LIST: 'recent-repos:list',
  RECENT_REPOS_ADD: 'recent-repos:add',
  RECENT_REPOS_REMOVE: 'recent-repos:remove',
  // Events (main → renderer)
  INSTANCE_STATUS_CHANGED: 'instance:status-changed',
  INSTANCE_DELETED: 'instance:deleted',
  INSTANCES_CLEARED: 'instances:cleared',

  // ==========================================================================
  // SESSION RECOVERY CHANNELS
  // ==========================================================================
  RECOVERY_SCAN_REPO: 'recovery:scan-repo',
  RECOVERY_SCAN_ALL: 'recovery:scan-all',
  RECOVERY_RECOVER_SESSION: 'recovery:recover-session',
  RECOVERY_RECOVER_MULTIPLE: 'recovery:recover-multiple',
  RECOVERY_DELETE_ORPHANED: 'recovery:delete-orphaned',
  // Events
  INSTANCE_RECOVERED: 'instance:recovered',

  // ==========================================================================
  // REPO CLEANUP CHANNELS
  // ==========================================================================
  CLEANUP_ANALYZE: 'cleanup:analyze',
  CLEANUP_EXECUTE: 'cleanup:execute',
  CLEANUP_QUICK: 'cleanup:quick',
  CLEANUP_KANVAS: 'cleanup:kanvas',
  // Events
  CLEANUP_PROGRESS: 'cleanup:progress',

  // ==========================================================================
  // GIT REBASE CHANNELS
  // ==========================================================================
  GIT_FETCH: 'git:fetch',
  GIT_CHECK_REMOTE: 'git:check-remote',
  GIT_REBASE: 'git:rebase',
  GIT_PERFORM_REBASE: 'git:perform-rebase',
  GIT_LIST_WORKTREES: 'git:list-worktrees',
  GIT_PRUNE_WORKTREES: 'git:prune-worktrees',
  GIT_DELETE_BRANCH: 'git:delete-branch',
  GIT_MERGED_BRANCHES: 'git:merged-branches',

  // ==========================================================================
  // REBASE WATCHER CHANNELS
  // Auto-rebase on remote changes (on-demand mode)
  // ==========================================================================
  REBASE_WATCHER_START: 'rebase-watcher:start',
  REBASE_WATCHER_STOP: 'rebase-watcher:stop',
  REBASE_WATCHER_PAUSE: 'rebase-watcher:pause',
  REBASE_WATCHER_RESUME: 'rebase-watcher:resume',
  REBASE_WATCHER_GET_STATUS: 'rebase-watcher:get-status',
  REBASE_WATCHER_FORCE_CHECK: 'rebase-watcher:force-check',
  REBASE_WATCHER_TRIGGER: 'rebase-watcher:trigger',
  REBASE_WATCHER_LIST: 'rebase-watcher:list',
  // Events (main → renderer)
  REBASE_WATCHER_STATUS: 'rebase-watcher:status',
  REBASE_WATCHER_STOPPED: 'rebase-watcher:stopped',
  REBASE_REMOTE_CHANGES_DETECTED: 'rebase:remote-changes-detected',
  REBASE_AUTO_COMPLETED: 'rebase:auto-completed',

  // ==========================================================================
  // CONTRACT DETECTION CHANNELS
  // ==========================================================================
  CONTRACT_ANALYZE_COMMIT: 'contract:analyze-commit',
  CONTRACT_ANALYZE_RANGE: 'contract:analyze-range',
  CONTRACT_ANALYZE_STAGED: 'contract:analyze-staged',
  CONTRACT_GET_PATTERNS: 'contract:get-patterns',
  // Events
  CONTRACT_CHANGES_DETECTED: 'contract:changes-detected',

  // ==========================================================================
  // APP CHANNELS
  // ==========================================================================
  APP_GET_VERSION: 'app:getVersion',
  APP_QUIT: 'app:quit',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// Channel groups for type-safe handler registration
export const REQUEST_CHANNELS = [
  IPC.SESSION_CREATE,
  IPC.SESSION_LIST,
  IPC.SESSION_GET,
  IPC.SESSION_CLOSE,
  IPC.SESSION_CLAIM,
  IPC.GIT_STATUS,
  IPC.GIT_COMMIT,
  IPC.GIT_PUSH,
  IPC.GIT_MERGE,
  IPC.GIT_BRANCHES,
  IPC.GIT_CREATE_WORKTREE,
  IPC.GIT_REMOVE_WORKTREE,
  IPC.WATCHER_START,
  IPC.WATCHER_STOP,
  IPC.WATCHER_STATUS,
  IPC.LOCK_DECLARE,
  IPC.LOCK_RELEASE,
  IPC.LOCK_CHECK,
  IPC.LOCK_LIST,
  IPC.CONFIG_GET,
  IPC.CONFIG_SET,
  IPC.CONFIG_GET_ALL,
  IPC.CREDENTIAL_GET,
  IPC.CREDENTIAL_SET,
  IPC.CREDENTIAL_HAS,
  IPC.AI_CHAT,
  IPC.AI_CHAT_WITH_MODE,
  IPC.AI_LIST_MODES,
  IPC.AI_GET_MODE,
  IPC.AI_RELOAD_CONFIG,
  IPC.AI_GET_CONFIG_SOURCES,
  IPC.LOG_GET,
  IPC.LOG_CLEAR,
  IPC.DIALOG_OPEN_DIRECTORY,
  IPC.DIALOG_SHOW_MESSAGE,
  IPC.AGENT_LIST,
  IPC.AGENT_GET,
  IPC.AGENT_SESSIONS,
  IPC.AGENT_INITIALIZE,
  IPC.INSTANCE_CREATE,
  IPC.INSTANCE_VALIDATE_REPO,
  IPC.INSTANCE_INITIALIZE_KANVAS,
  IPC.INSTANCE_GET_INSTRUCTIONS,
  IPC.INSTANCE_LAUNCH,
  IPC.INSTANCE_LIST,
  IPC.INSTANCE_GET,
  IPC.INSTANCE_DELETE,
  IPC.RECENT_REPOS_LIST,
  IPC.RECENT_REPOS_ADD,
  IPC.RECENT_REPOS_REMOVE,
  IPC.APP_GET_VERSION,
] as const;

export const EVENT_CHANNELS = [
  IPC.SESSION_CREATED,
  IPC.SESSION_UPDATED,
  IPC.SESSION_CLOSED,
  IPC.GIT_STATUS_CHANGED,
  IPC.FILE_CHANGED,
  IPC.COMMIT_TRIGGERED,
  IPC.COMMIT_COMPLETED,
  IPC.CONFLICT_DETECTED,
  IPC.AI_STREAM_CHUNK,
  IPC.AI_STREAM_END,
  IPC.AI_STREAM_ERROR,
  IPC.LOG_ENTRY,
  IPC.AGENT_REGISTERED,
  IPC.AGENT_UNREGISTERED,
  IPC.AGENT_HEARTBEAT,
  IPC.AGENT_STATUS_CHANGED,
  IPC.SESSION_REPORTED,
  IPC.ACTIVITY_REPORTED,
  IPC.INSTANCE_STATUS_CHANGED,
] as const;
