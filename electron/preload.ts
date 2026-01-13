/**
 * Electron Preload Script
 * Exposes type-safe API to renderer via contextBridge
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import type {
  Session,
  CreateSessionRequest,
  CloseSessionRequest,
  GitStatus,
  GitCommit,
  BranchInfo,
  FileLock,
  FileConflict,
  FileChangeEvent,
  CommitTriggerEvent,
  CommitCompleteEvent,
  ChatMessage,
  ActivityLogEntry,
  AppConfig,
  Credentials,
  IpcResult,
} from '../shared/types';
import type {
  AgentInfo,
  AgentStatusUpdate,
  AgentActivityReport,
  SessionReport,
} from '../shared/agent-protocol';
import type {
  AgentInstance,
  AgentInstanceConfig,
  RepoValidation,
  RecentRepo,
  AgentType,
} from '../shared/types';

/**
 * Type-safe API exposed to renderer process
 */
const api = {
  // ==========================================================================
  // SESSION API
  // ==========================================================================
  session: {
    create: (request: CreateSessionRequest): Promise<IpcResult<Session>> =>
      ipcRenderer.invoke(IPC.SESSION_CREATE, request),

    list: (): Promise<IpcResult<Session[]>> =>
      ipcRenderer.invoke(IPC.SESSION_LIST),

    get: (id: string): Promise<IpcResult<Session | null>> =>
      ipcRenderer.invoke(IPC.SESSION_GET, id),

    close: (request: CloseSessionRequest): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.SESSION_CLOSE, request),

    claim: (sessionId: string): Promise<IpcResult<Session>> =>
      ipcRenderer.invoke(IPC.SESSION_CLAIM, sessionId),

    onCreated: (callback: (session: Session) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, session: Session) => callback(session);
      ipcRenderer.on(IPC.SESSION_CREATED, handler);
      return () => ipcRenderer.removeListener(IPC.SESSION_CREATED, handler);
    },

    onUpdated: (callback: (session: Session) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, session: Session) => callback(session);
      ipcRenderer.on(IPC.SESSION_UPDATED, handler);
      return () => ipcRenderer.removeListener(IPC.SESSION_UPDATED, handler);
    },

    onClosed: (callback: (sessionId: string) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, sessionId: string) => callback(sessionId);
      ipcRenderer.on(IPC.SESSION_CLOSED, handler);
      return () => ipcRenderer.removeListener(IPC.SESSION_CLOSED, handler);
    },
  },

  // ==========================================================================
  // GIT API
  // ==========================================================================
  git: {
    status: (sessionId: string): Promise<IpcResult<GitStatus>> =>
      ipcRenderer.invoke(IPC.GIT_STATUS, sessionId),

    commit: (sessionId: string, message: string): Promise<IpcResult<GitCommit>> =>
      ipcRenderer.invoke(IPC.GIT_COMMIT, sessionId, message),

    push: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.GIT_PUSH, sessionId),

    merge: (sessionId: string, targetBranch: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.GIT_MERGE, sessionId, targetBranch),

    branches: (sessionId: string): Promise<IpcResult<BranchInfo[]>> =>
      ipcRenderer.invoke(IPC.GIT_BRANCHES, sessionId),

    onStatusChanged: (callback: (data: { sessionId: string; status: GitStatus }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { sessionId: string; status: GitStatus }) => callback(data);
      ipcRenderer.on(IPC.GIT_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.GIT_STATUS_CHANGED, handler);
    },
  },

  // ==========================================================================
  // WATCHER API
  // ==========================================================================
  watcher: {
    start: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.WATCHER_START, sessionId),

    stop: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.WATCHER_STOP, sessionId),

    status: (sessionId: string): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.WATCHER_STATUS, sessionId),

    onFileChanged: (callback: (event: FileChangeEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: FileChangeEvent) => callback(data);
      ipcRenderer.on(IPC.FILE_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.FILE_CHANGED, handler);
    },

    onCommitTriggered: (callback: (event: CommitTriggerEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: CommitTriggerEvent) => callback(data);
      ipcRenderer.on(IPC.COMMIT_TRIGGERED, handler);
      return () => ipcRenderer.removeListener(IPC.COMMIT_TRIGGERED, handler);
    },

    onCommitCompleted: (callback: (event: CommitCompleteEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: CommitCompleteEvent) => callback(data);
      ipcRenderer.on(IPC.COMMIT_COMPLETED, handler);
      return () => ipcRenderer.removeListener(IPC.COMMIT_COMPLETED, handler);
    },
  },

  // ==========================================================================
  // LOCK API
  // ==========================================================================
  lock: {
    declare: (sessionId: string, files: string[], operation: 'edit' | 'read' | 'delete'): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LOCK_DECLARE, sessionId, files, operation),

    release: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LOCK_RELEASE, sessionId),

    check: (files: string[]): Promise<IpcResult<FileConflict[]>> =>
      ipcRenderer.invoke(IPC.LOCK_CHECK, files),

    list: (): Promise<IpcResult<FileLock[]>> =>
      ipcRenderer.invoke(IPC.LOCK_LIST),

    onConflictDetected: (callback: (conflicts: FileConflict[]) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, conflicts: FileConflict[]) => callback(conflicts);
      ipcRenderer.on(IPC.CONFLICT_DETECTED, handler);
      return () => ipcRenderer.removeListener(IPC.CONFLICT_DETECTED, handler);
    },
  },

  // ==========================================================================
  // CONFIG API
  // ==========================================================================
  config: {
    get: <K extends keyof AppConfig>(key: K): Promise<IpcResult<AppConfig[K]>> =>
      ipcRenderer.invoke(IPC.CONFIG_GET, key),

    set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.CONFIG_SET, key, value),

    getAll: (): Promise<IpcResult<AppConfig>> =>
      ipcRenderer.invoke(IPC.CONFIG_GET_ALL),
  },

  // ==========================================================================
  // CREDENTIAL API
  // ==========================================================================
  credential: {
    get: (key: keyof Credentials): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.CREDENTIAL_GET, key),

    set: (key: keyof Credentials, value: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.CREDENTIAL_SET, key, value),

    has: (key: keyof Credentials): Promise<IpcResult<boolean>> =>
      ipcRenderer.invoke(IPC.CREDENTIAL_HAS, key),
  },

  // ==========================================================================
  // AI/CHAT API
  // ==========================================================================
  ai: {
    chat: (messages: ChatMessage[]): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC.AI_CHAT, messages),

    startStream: (messages: ChatMessage[]): void => {
      ipcRenderer.send(IPC.AI_STREAM_START, messages);
    },

    stopStream: (): void => {
      ipcRenderer.send(IPC.AI_STREAM_STOP);
    },

    onChunk: (callback: (chunk: string) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, chunk: string) => callback(chunk);
      ipcRenderer.on(IPC.AI_STREAM_CHUNK, handler);
      return () => ipcRenderer.removeListener(IPC.AI_STREAM_CHUNK, handler);
    },

    onEnd: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC.AI_STREAM_END, handler);
      return () => ipcRenderer.removeListener(IPC.AI_STREAM_END, handler);
    },

    onError: (callback: (error: string) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on(IPC.AI_STREAM_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC.AI_STREAM_ERROR, handler);
    },

    // Mode-based prompts
    chatWithMode: (options: {
      modeId: string;
      promptKey: string;
      variables?: Record<string, string>;
      userMessage?: string;
    }): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC.AI_CHAT_WITH_MODE, options),

    startStreamWithMode: (options: {
      modeId: string;
      promptKey: string;
      variables?: Record<string, string>;
      userMessage?: string;
    }): void => {
      ipcRenderer.send(IPC.AI_STREAM_WITH_MODE, options);
    },

    listModes: (): Promise<IpcResult<Array<{ id: string; name: string; description: string }>>> =>
      ipcRenderer.invoke(IPC.AI_LIST_MODES),

    getMode: (modeId: string): Promise<IpcResult<{
      id: string;
      name: string;
      description: string;
      settings: { temperature?: number; max_tokens?: number; model?: string };
      prompts: Record<string, unknown>;
    } | null>> =>
      ipcRenderer.invoke(IPC.AI_GET_MODE, modeId),

    reloadConfig: (): Promise<IpcResult<{ modes: number; models: number }>> =>
      ipcRenderer.invoke(IPC.AI_RELOAD_CONFIG),

    getConfigSources: (): Promise<IpcResult<{
      modelsPath: string;
      modesDirectory: string;
      externalConfigPath: string | null;
      submodulePath: string | null;
    }>> =>
      ipcRenderer.invoke(IPC.AI_GET_CONFIG_SOURCES),
  },

  // ==========================================================================
  // ACTIVITY LOG API
  // ==========================================================================
  activity: {
    get: (sessionId: string, limit?: number): Promise<IpcResult<ActivityLogEntry[]>> =>
      ipcRenderer.invoke(IPC.LOG_GET, sessionId, limit),

    clear: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.LOG_CLEAR, sessionId),

    onLog: (callback: (entry: ActivityLogEntry) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, entry: ActivityLogEntry) => callback(entry);
      ipcRenderer.on(IPC.LOG_ENTRY, handler);
      return () => ipcRenderer.removeListener(IPC.LOG_ENTRY, handler);
    },
  },

  // ==========================================================================
  // AGENT API
  // Kanvas monitors agents that report into it (dashboard pattern)
  // ==========================================================================
  agent: {
    initialize: (baseDir: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.AGENT_INITIALIZE, baseDir),

    list: (): Promise<IpcResult<(AgentInfo & { isAlive: boolean; sessions: string[] })[]>> =>
      ipcRenderer.invoke(IPC.AGENT_LIST),

    get: (agentId: string): Promise<IpcResult<(AgentInfo & { isAlive: boolean; sessions: string[] }) | null>> =>
      ipcRenderer.invoke(IPC.AGENT_GET, agentId),

    getSessions: (agentId: string): Promise<IpcResult<SessionReport[]>> =>
      ipcRenderer.invoke(IPC.AGENT_SESSIONS, agentId),

    // Events - Agents report into Kanvas
    onRegistered: (callback: (agent: AgentInfo & { isAlive: boolean; sessions: string[] }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, agent: AgentInfo & { isAlive: boolean; sessions: string[] }) => callback(agent);
      ipcRenderer.on(IPC.AGENT_REGISTERED, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_REGISTERED, handler);
    },

    onUnregistered: (callback: (agentId: string) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, agentId: string) => callback(agentId);
      ipcRenderer.on(IPC.AGENT_UNREGISTERED, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_UNREGISTERED, handler);
    },

    onHeartbeat: (callback: (data: { agentId: string; timestamp: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { agentId: string; timestamp: string }) => callback(data);
      ipcRenderer.on(IPC.AGENT_HEARTBEAT, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_HEARTBEAT, handler);
    },

    onStatusChanged: (callback: (data: { agentId: string; isAlive: boolean; lastHeartbeat: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { agentId: string; isAlive: boolean; lastHeartbeat: string }) => callback(data);
      ipcRenderer.on(IPC.AGENT_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.AGENT_STATUS_CHANGED, handler);
    },

    onSessionReported: (callback: (session: SessionReport) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, session: SessionReport) => callback(session);
      ipcRenderer.on(IPC.SESSION_REPORTED, handler);
      return () => ipcRenderer.removeListener(IPC.SESSION_REPORTED, handler);
    },

    onActivityReported: (callback: (activity: AgentActivityReport) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, activity: AgentActivityReport) => callback(activity);
      ipcRenderer.on(IPC.ACTIVITY_REPORTED, handler);
      return () => ipcRenderer.removeListener(IPC.ACTIVITY_REPORTED, handler);
    },
  },

  // ==========================================================================
  // INSTANCE API
  // Create and manage agent instances from Kanvas dashboard
  // ==========================================================================
  instance: {
    create: (config: AgentInstanceConfig): Promise<IpcResult<AgentInstance>> =>
      ipcRenderer.invoke(IPC.INSTANCE_CREATE, config),

    validateRepo: (path: string): Promise<IpcResult<RepoValidation>> =>
      ipcRenderer.invoke(IPC.INSTANCE_VALIDATE_REPO, path),

    initializeKanvas: (path: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.INSTANCE_INITIALIZE_KANVAS, path),

    getInstructions: (agentType: AgentType, config: AgentInstanceConfig): Promise<IpcResult<string>> =>
      ipcRenderer.invoke(IPC.INSTANCE_GET_INSTRUCTIONS, agentType, config),

    launch: (instanceId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.INSTANCE_LAUNCH, instanceId),

    list: (): Promise<IpcResult<AgentInstance[]>> =>
      ipcRenderer.invoke(IPC.INSTANCE_LIST),

    get: (instanceId: string): Promise<IpcResult<AgentInstance | null>> =>
      ipcRenderer.invoke(IPC.INSTANCE_GET, instanceId),

    delete: (instanceId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.INSTANCE_DELETE, instanceId),

    getRecentRepos: (): Promise<IpcResult<RecentRepo[]>> =>
      ipcRenderer.invoke(IPC.RECENT_REPOS_LIST),

    addRecentRepo: (repo: RecentRepo): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.RECENT_REPOS_ADD, repo),

    removeRecentRepo: (path: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.RECENT_REPOS_REMOVE, path),

    onStatusChanged: (callback: (instance: AgentInstance) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, instance: AgentInstance) => callback(instance);
      ipcRenderer.on(IPC.INSTANCE_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.INSTANCE_STATUS_CHANGED, handler);
    },
  },

  // ==========================================================================
  // DIALOG API
  // ==========================================================================
  dialog: {
    openDirectory: (): Promise<IpcResult<string | null>> =>
      ipcRenderer.invoke(IPC.DIALOG_OPEN_DIRECTORY),

    showMessage: (options: { type: 'info' | 'warning' | 'error'; title: string; message: string }): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.DIALOG_SHOW_MESSAGE, options),
  },

  // ==========================================================================
  // APP API
  // ==========================================================================
  app: {
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke(IPC.APP_GET_VERSION),

    quit: (): void => {
      ipcRenderer.send(IPC.APP_QUIT);
    },
  },

  // ==========================================================================
  // RECOVERY API
  // Session recovery for orphaned sessions
  // ==========================================================================
  recovery: {
    scanRepo: (repoPath: string): Promise<IpcResult<Array<{
      sessionId: string;
      repoPath: string;
      sessionData: { task?: string; branchName?: string; agentType?: string };
      lastModified: Date;
    }>>> =>
      ipcRenderer.invoke(IPC.RECOVERY_SCAN_REPO, repoPath),

    scanAll: (): Promise<IpcResult<Array<{
      sessionId: string;
      repoPath: string;
      sessionData: { task?: string; branchName?: string; agentType?: string };
      lastModified: Date;
    }>>> =>
      ipcRenderer.invoke(IPC.RECOVERY_SCAN_ALL),

    recoverSession: (sessionId: string, repoPath: string): Promise<IpcResult<AgentInstance>> =>
      ipcRenderer.invoke(IPC.RECOVERY_RECOVER_SESSION, sessionId, repoPath),

    recoverMultiple: (sessions: Array<{ sessionId: string; repoPath: string }>): Promise<IpcResult<{
      recovered: AgentInstance[];
      failed: Array<{ sessionId: string; error: string }>;
    }>> =>
      ipcRenderer.invoke(IPC.RECOVERY_RECOVER_MULTIPLE, sessions),

    deleteOrphaned: (sessionId: string, repoPath: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.RECOVERY_DELETE_ORPHANED, sessionId, repoPath),

    onRecovered: (callback: (instance: AgentInstance) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, instance: AgentInstance) => callback(instance);
      ipcRenderer.on(IPC.INSTANCE_RECOVERED, handler);
      return () => ipcRenderer.removeListener(IPC.INSTANCE_RECOVERED, handler);
    },
  },

  // ==========================================================================
  // CLEANUP API
  // Repository cleanup for worktrees, branches, and Kanvas files
  // ==========================================================================
  cleanup: {
    analyze: (repoPath: string, targetBranch?: string): Promise<IpcResult<{
      repoPath: string;
      worktreesToRemove: Array<{ path: string; branch: string; isOrphaned?: boolean }>;
      branchesToDelete: Array<{ name: string; isMerged: boolean; hasAssociatedSession?: boolean }>;
      branchesToMerge: Array<{ branch: string; targetBranch: string; order: number }>;
      estimatedActions: number;
    }>> =>
      ipcRenderer.invoke(IPC.CLEANUP_ANALYZE, repoPath, targetBranch),

    execute: (plan: {
      repoPath: string;
      worktreesToRemove: Array<{ path: string; branch: string }>;
      branchesToDelete: Array<{ name: string; isMerged: boolean }>;
      branchesToMerge: Array<{ branch: string; targetBranch: string; order: number }>;
    }, options?: {
      removeWorktrees?: boolean;
      deleteMergedBranches?: boolean;
      mergeCompletedBranches?: boolean;
      deleteRemoteBranches?: boolean;
    }): Promise<IpcResult<{
      success: boolean;
      worktreesRemoved: number;
      branchesDeleted: number;
      branchesMerged: number;
      errors: string[];
    }>> =>
      ipcRenderer.invoke(IPC.CLEANUP_EXECUTE, plan, options),

    quick: (repoPath: string): Promise<IpcResult<{
      worktreesPruned: boolean;
      kanvasCleanup: {
        removedSessionFiles: number;
        removedAgentFiles: number;
        removedActivityFiles: number;
      };
    }>> =>
      ipcRenderer.invoke(IPC.CLEANUP_QUICK, repoPath),

    kanvas: (repoPath: string): Promise<IpcResult<{
      removedSessionFiles: number;
      removedAgentFiles: number;
      removedActivityFiles: number;
    }>> =>
      ipcRenderer.invoke(IPC.CLEANUP_KANVAS, repoPath),

    onProgress: (callback: (data: { message: string; result: unknown }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { message: string; result: unknown }) => callback(data);
      ipcRenderer.on(IPC.CLEANUP_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC.CLEANUP_PROGRESS, handler);
    },
  },

  // ==========================================================================
  // CONTRACT DETECTION API
  // Detect contract changes in commits (API specs, schemas, interfaces)
  // ==========================================================================
  contract: {
    analyzeCommit: (repoPath: string, commitHash?: string): Promise<IpcResult<{
      commitHash: string;
      commitMessage: string;
      timestamp: string;
      hasContractChanges: boolean;
      changes: Array<{
        file: string;
        type: string;
        changeType: 'added' | 'modified' | 'deleted';
        additions: number;
        deletions: number;
        impactLevel: 'breaking' | 'non-breaking' | 'unknown';
      }>;
      breakingChanges: Array<{
        file: string;
        type: string;
        changeType: 'added' | 'modified' | 'deleted';
        impactLevel: 'breaking';
      }>;
      summary: string;
      recommendations: string[];
    }>> =>
      ipcRenderer.invoke(IPC.CONTRACT_ANALYZE_COMMIT, repoPath, commitHash),

    analyzeRange: (repoPath: string, fromRef?: string, toRef?: string): Promise<IpcResult<Array<{
      commitHash: string;
      commitMessage: string;
      timestamp: string;
      hasContractChanges: boolean;
      changes: Array<{
        file: string;
        type: string;
        changeType: 'added' | 'modified' | 'deleted';
        additions: number;
        deletions: number;
        impactLevel: 'breaking' | 'non-breaking' | 'unknown';
      }>;
      breakingChanges: Array<{
        file: string;
        type: string;
        impactLevel: 'breaking';
      }>;
      summary: string;
      recommendations: string[];
    }>>> =>
      ipcRenderer.invoke(IPC.CONTRACT_ANALYZE_RANGE, repoPath, fromRef, toRef),

    analyzeStaged: (repoPath: string): Promise<IpcResult<Array<{
      file: string;
      type: string;
      changeType: 'added' | 'modified' | 'deleted';
      additions: number;
      deletions: number;
      impactLevel: 'breaking' | 'non-breaking' | 'unknown';
    }>>> =>
      ipcRenderer.invoke(IPC.CONTRACT_ANALYZE_STAGED, repoPath),

    getPatterns: (): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke(IPC.CONTRACT_GET_PATTERNS),

    onChangesDetected: (callback: (data: {
      repoPath: string;
      commitHash: string;
      hasBreakingChanges: boolean;
      changes: Array<{ file: string; type: string; impactLevel: string }>;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: {
        repoPath: string;
        commitHash: string;
        hasBreakingChanges: boolean;
        changes: Array<{ file: string; type: string; impactLevel: string }>;
      }) => callback(data);
      ipcRenderer.on(IPC.CONTRACT_CHANGES_DETECTED, handler);
      return () => ipcRenderer.removeListener(IPC.CONTRACT_CHANGES_DETECTED, handler);
    },
  },

  // ==========================================================================
  // REBASE WATCHER API
  // Auto-rebase on remote changes (on-demand mode)
  // ==========================================================================
  rebaseWatcher: {
    start: (config: {
      sessionId: string;
      repoPath: string;
      baseBranch: string;
      currentBranch: string;
      rebaseFrequency: 'never' | 'daily' | 'weekly' | 'on-demand';
      pollIntervalMs?: number;
    }): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_START, config),

    stop: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_STOP, sessionId),

    pause: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_PAUSE, sessionId),

    resume: (sessionId: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_RESUME, sessionId),

    getStatus: (sessionId: string): Promise<IpcResult<{
      sessionId: string;
      isWatching: boolean;
      isPaused: boolean;
      isRebasing: boolean;
      behindCount: number;
      aheadCount: number;
      lastChecked: string | null;
      lastRebaseResult: {
        success: boolean;
        message: string;
        timestamp: string;
      } | null;
    } | null>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_GET_STATUS, sessionId),

    forceCheck: (sessionId: string): Promise<IpcResult<{ hasChanges: boolean; behindCount: number }>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_FORCE_CHECK, sessionId),

    triggerRebase: (sessionId: string): Promise<IpcResult<{ success: boolean; message: string }>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_TRIGGER, sessionId),

    list: (): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke(IPC.REBASE_WATCHER_LIST),

    // Events
    onStatusChanged: (callback: (status: {
      sessionId: string;
      isWatching: boolean;
      isPaused: boolean;
      isRebasing: boolean;
      behindCount: number;
      aheadCount: number;
      lastChecked: string | null;
      lastRebaseResult: { success: boolean; message: string; timestamp: string } | null;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, status: {
        sessionId: string;
        isWatching: boolean;
        isPaused: boolean;
        isRebasing: boolean;
        behindCount: number;
        aheadCount: number;
        lastChecked: string | null;
        lastRebaseResult: { success: boolean; message: string; timestamp: string } | null;
      }) => callback(status);
      ipcRenderer.on(IPC.REBASE_WATCHER_STATUS, handler);
      return () => ipcRenderer.removeListener(IPC.REBASE_WATCHER_STATUS, handler);
    },

    onStopped: (callback: (data: { sessionId: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: { sessionId: string }) => callback(data);
      ipcRenderer.on(IPC.REBASE_WATCHER_STOPPED, handler);
      return () => ipcRenderer.removeListener(IPC.REBASE_WATCHER_STOPPED, handler);
    },

    onRemoteChangesDetected: (callback: (data: {
      sessionId: string;
      repoPath: string;
      baseBranch: string;
      behindCount: number;
      newCommits: number;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: {
        sessionId: string;
        repoPath: string;
        baseBranch: string;
        behindCount: number;
        newCommits: number;
      }) => callback(data);
      ipcRenderer.on(IPC.REBASE_REMOTE_CHANGES_DETECTED, handler);
      return () => ipcRenderer.removeListener(IPC.REBASE_REMOTE_CHANGES_DETECTED, handler);
    },

    onAutoRebaseCompleted: (callback: (data: {
      sessionId: string;
      success: boolean;
      message: string;
      hadUncommittedChanges: boolean;
    }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: {
        sessionId: string;
        success: boolean;
        message: string;
        hadUncommittedChanges: boolean;
      }) => callback(data);
      ipcRenderer.on(IPC.REBASE_AUTO_COMPLETED, handler);
      return () => ipcRenderer.removeListener(IPC.REBASE_AUTO_COMPLETED, handler);
    },
  },
};

// Expose to renderer
contextBridge.exposeInMainWorld('api', api);

// Export type for renderer usage
export type ElectronAPI = typeof api;
