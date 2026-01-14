/**
 * IPC Handler Registration
 * Connects main process services to renderer via IPC
 */

import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { Services } from '../services';

/**
 * Register all IPC handlers
 * Removes existing handlers first to support HMR during development
 */
export function registerIpcHandlers(services: Services, mainWindow: BrowserWindow): void {
  // Remove existing handlers first (for HMR support)
  removeIpcHandlers();
  // ==========================================================================
  // SESSION HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.SESSION_CREATE, async (_, request) => {
    return services.session.create(request);
  });

  ipcMain.handle(IPC.SESSION_LIST, async () => {
    return services.session.list();
  });

  ipcMain.handle(IPC.SESSION_GET, async (_, id: string) => {
    return services.session.get(id);
  });

  ipcMain.handle(IPC.SESSION_CLOSE, async (_, request) => {
    return services.session.close(request);
  });

  ipcMain.handle(IPC.SESSION_CLAIM, async (_, sessionId: string) => {
    return services.session.claim(sessionId);
  });

  // ==========================================================================
  // GIT HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.GIT_STATUS, async (_, sessionId: string) => {
    return services.git.getStatus(sessionId);
  });

  ipcMain.handle(IPC.GIT_COMMIT, async (_, sessionId: string, message: string) => {
    return services.git.commit(sessionId, message);
  });

  ipcMain.handle(IPC.GIT_PUSH, async (_, sessionId: string) => {
    return services.git.push(sessionId);
  });

  ipcMain.handle(IPC.GIT_MERGE, async (_, sessionId: string, targetBranch: string) => {
    return services.git.merge(sessionId, targetBranch);
  });

  ipcMain.handle(IPC.GIT_BRANCHES, async (_, sessionId: string) => {
    return services.git.listBranches(sessionId);
  });

  ipcMain.handle(IPC.GIT_CREATE_WORKTREE, async (_, sessionId: string, branchName: string, path: string) => {
    return services.git.createWorktree(sessionId, branchName, path);
  });

  ipcMain.handle(IPC.GIT_REMOVE_WORKTREE, async (_, sessionId: string) => {
    return services.git.removeWorktree(sessionId);
  });

  // ==========================================================================
  // WATCHER HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.WATCHER_START, async (_, sessionId: string) => {
    return services.watcher.start(sessionId);
  });

  ipcMain.handle(IPC.WATCHER_STOP, async (_, sessionId: string) => {
    return services.watcher.stop(sessionId);
  });

  ipcMain.handle(IPC.WATCHER_STATUS, async (_, sessionId: string) => {
    return services.watcher.isWatching(sessionId);
  });

  // ==========================================================================
  // LOCK HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.LOCK_DECLARE, async (_, sessionId: string, files: string[], operation: string) => {
    return services.lock.declareFiles(sessionId, files, operation as 'edit' | 'read' | 'delete');
  });

  ipcMain.handle(IPC.LOCK_RELEASE, async (_, sessionId: string) => {
    return services.lock.releaseFiles(sessionId);
  });

  ipcMain.handle(IPC.LOCK_CHECK, async (_, files: string[]) => {
    return services.lock.checkConflicts(files);
  });

  ipcMain.handle(IPC.LOCK_LIST, async () => {
    return services.lock.listDeclarations();
  });

  // ==========================================================================
  // CONFIG HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.CONFIG_GET, async (_, key: string) => {
    return services.config.get(key);
  });

  ipcMain.handle(IPC.CONFIG_SET, async (_, key: string, value: unknown) => {
    return services.config.set(key, value);
  });

  ipcMain.handle(IPC.CONFIG_GET_ALL, async () => {
    return services.config.getAll();
  });

  ipcMain.handle(IPC.CREDENTIAL_GET, async (_, key: string) => {
    return services.config.getCredential(key);
  });

  ipcMain.handle(IPC.CREDENTIAL_SET, async (_, key: string, value: string) => {
    return services.config.setCredential(key, value);
  });

  ipcMain.handle(IPC.CREDENTIAL_HAS, async (_, key: string) => {
    return services.config.hasCredential(key);
  });

  // ==========================================================================
  // AI HANDLERS (streaming uses on/send pattern)
  // ==========================================================================
  ipcMain.handle(IPC.AI_CHAT, async (_, messages, modelOverride?: string) => {
    return services.ai.sendMessage(messages, modelOverride as any);
  });

  ipcMain.handle(IPC.AI_GET_MODEL, async () => {
    return { success: true, data: services.ai.getModel() };
  });

  ipcMain.handle(IPC.AI_SET_MODEL, async (_, modelKey: string) => {
    try {
      services.ai.setModel(modelKey as any);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: { code: 'INVALID_MODEL', message: error instanceof Error ? error.message : 'Invalid model' },
      };
    }
  });

  ipcMain.handle(IPC.AI_LIST_MODELS, async () => {
    return { success: true, data: services.ai.getAvailableModels() };
  });

  ipcMain.on(IPC.AI_STREAM_START, async (_, messages, modelOverride?: string) => {
    try {
      for await (const chunk of services.ai.streamChat(messages, modelOverride as any)) {
        mainWindow.webContents.send(IPC.AI_STREAM_CHUNK, chunk);
      }
      mainWindow.webContents.send(IPC.AI_STREAM_END);
    } catch (error) {
      mainWindow.webContents.send(
        IPC.AI_STREAM_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  });

  ipcMain.on(IPC.AI_STREAM_STOP, () => {
    services.ai.stopStream();
  });

  // Mode-based AI handlers
  ipcMain.handle(IPC.AI_CHAT_WITH_MODE, async (_, options) => {
    return services.ai.sendWithMode(options);
  });

  ipcMain.on(IPC.AI_STREAM_WITH_MODE, async (_, options) => {
    try {
      for await (const chunk of services.ai.streamWithMode(options)) {
        mainWindow.webContents.send(IPC.AI_STREAM_CHUNK, chunk);
      }
      mainWindow.webContents.send(IPC.AI_STREAM_END);
    } catch (error) {
      mainWindow.webContents.send(
        IPC.AI_STREAM_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  });

  ipcMain.handle(IPC.AI_LIST_MODES, async () => {
    return { success: true, data: services.ai.getAvailableModes() };
  });

  ipcMain.handle(IPC.AI_GET_MODE, async (_, modeId: string) => {
    return { success: true, data: services.ai.getMode(modeId) };
  });

  ipcMain.handle(IPC.AI_RELOAD_CONFIG, async () => {
    const { getAIConfigRegistry } = await import('../services/AIConfigRegistry');
    const registry = getAIConfigRegistry();
    return registry.reload();
  });

  ipcMain.handle(IPC.AI_GET_CONFIG_SOURCES, async () => {
    const { getAIConfigRegistry } = await import('../services/AIConfigRegistry');
    const registry = getAIConfigRegistry();
    return { success: true, data: registry.getConfigSources() };
  });

  // ==========================================================================
  // ACTIVITY LOG HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.LOG_GET, async (_, sessionId: string, limit?: number) => {
    return services.activity.getLogs(sessionId, limit);
  });

  ipcMain.handle(IPC.LOG_CLEAR, async (_, sessionId: string) => {
    return services.activity.clearLogs(sessionId);
  });

  // ==========================================================================
  // AGENT LISTENER HANDLERS
  // Kanvas monitors agents that report into it
  // ==========================================================================
  ipcMain.handle(IPC.AGENT_INITIALIZE, async (_, baseDir: string) => {
    try {
      await services.agentListener.initialize(baseDir);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initialize agent listener',
        },
      };
    }
  });

  ipcMain.handle(IPC.AGENT_LIST, async () => {
    return {
      success: true,
      data: services.agentListener.getAgents(),
    };
  });

  ipcMain.handle(IPC.AGENT_GET, async (_, agentId: string) => {
    return {
      success: true,
      data: services.agentListener.getAgent(agentId) || null,
    };
  });

  ipcMain.handle(IPC.AGENT_SESSIONS, async (_, agentId: string) => {
    return {
      success: true,
      data: services.agentListener.getAgentSessions(agentId),
    };
  });

  // ==========================================================================
  // AGENT INSTANCE HANDLERS
  // Create and manage agent instances from Kanvas dashboard
  // ==========================================================================
  ipcMain.handle(IPC.INSTANCE_CREATE, async (_, config) => {
    return services.agentInstance.createInstance(config);
  });

  ipcMain.handle(IPC.INSTANCE_VALIDATE_REPO, async (_, path: string) => {
    return services.agentInstance.validateRepository(path);
  });

  ipcMain.handle(IPC.INSTANCE_INITIALIZE_KANVAS, async (_, path: string) => {
    return services.agentInstance.initializeKanvasDirectory(path);
  });

  ipcMain.handle(IPC.INSTANCE_GET_INSTRUCTIONS, async (_, agentType, config) => {
    return services.agentInstance.getInstructions(agentType, config);
  });

  ipcMain.handle(IPC.INSTANCE_LAUNCH, async (_, instanceId: string) => {
    return services.agentInstance.launchAgent(instanceId);
  });

  ipcMain.handle(IPC.INSTANCE_LIST, async () => {
    return services.agentInstance.listInstances();
  });

  ipcMain.handle(IPC.INSTANCE_GET, async (_, instanceId: string) => {
    return services.agentInstance.getInstance(instanceId);
  });

  ipcMain.handle(IPC.INSTANCE_DELETE, async (_, instanceId: string) => {
    return services.agentInstance.deleteInstance(instanceId);
  });

  ipcMain.handle(IPC.INSTANCE_CLEAR_ALL, async () => {
    return services.agentInstance.clearAllInstances();
  });

  ipcMain.handle(IPC.RECENT_REPOS_LIST, async () => {
    return services.agentInstance.getRecentRepos();
  });

  ipcMain.handle(IPC.RECENT_REPOS_ADD, async (_, repo) => {
    return services.agentInstance.addRecentRepo(repo);
  });

  ipcMain.handle(IPC.RECENT_REPOS_REMOVE, async (_, path: string) => {
    return services.agentInstance.removeRecentRepo(path);
  });

  // ==========================================================================
  // DIALOG HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return {
      success: true,
      data: result.canceled ? null : result.filePaths[0],
    };
  });

  ipcMain.handle(IPC.DIALOG_SHOW_MESSAGE, async (_, options) => {
    await dialog.showMessageBox(mainWindow, {
      type: options.type,
      title: options.title,
      message: options.message,
    });
    return { success: true };
  });

  // ==========================================================================
  // SESSION RECOVERY HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.RECOVERY_SCAN_REPO, async (_, repoPath: string) => {
    return services.sessionRecovery.scanRepoForSessions(repoPath);
  });

  ipcMain.handle(IPC.RECOVERY_SCAN_ALL, async () => {
    return services.sessionRecovery.scanAllReposForSessions();
  });

  ipcMain.handle(IPC.RECOVERY_RECOVER_SESSION, async (_, sessionId: string, repoPath: string) => {
    return services.sessionRecovery.recoverSession(sessionId, repoPath);
  });

  ipcMain.handle(IPC.RECOVERY_RECOVER_MULTIPLE, async (_, sessions: Array<{ sessionId: string; repoPath: string }>) => {
    return services.sessionRecovery.recoverMultipleSessions(sessions);
  });

  ipcMain.handle(IPC.RECOVERY_DELETE_ORPHANED, async (_, sessionId: string, repoPath: string) => {
    return services.sessionRecovery.deleteOrphanedSession(sessionId, repoPath);
  });

  // ==========================================================================
  // REPO CLEANUP HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.CLEANUP_ANALYZE, async (_, repoPath: string, targetBranch?: string) => {
    return services.repoCleanup.analyzeRepo(repoPath, targetBranch);
  });

  ipcMain.handle(IPC.CLEANUP_EXECUTE, async (_, plan, options) => {
    return services.repoCleanup.executeCleanup(plan, options);
  });

  ipcMain.handle(IPC.CLEANUP_QUICK, async (_, repoPath: string) => {
    return services.repoCleanup.quickCleanup(repoPath);
  });

  ipcMain.handle(IPC.CLEANUP_KANVAS, async (_, repoPath: string) => {
    return services.repoCleanup.cleanupKanvasDirectory(repoPath);
  });

  // ==========================================================================
  // GIT REBASE HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.GIT_FETCH, async (_, repoPath: string, remote?: string) => {
    return services.git.fetchRemote(repoPath, remote);
  });

  ipcMain.handle(IPC.GIT_CHECK_REMOTE, async (_, repoPath: string, branch: string) => {
    return services.git.checkRemoteChanges(repoPath, branch);
  });

  ipcMain.handle(IPC.GIT_REBASE, async (_, repoPath: string, targetBranch: string) => {
    return services.git.rebase(repoPath, targetBranch);
  });

  ipcMain.handle(IPC.GIT_PERFORM_REBASE, async (_, repoPath: string, baseBranch: string) => {
    return services.git.performRebase(repoPath, baseBranch);
  });

  ipcMain.handle(IPC.GIT_LIST_WORKTREES, async (_, repoPath: string) => {
    return services.git.listWorktrees(repoPath);
  });

  ipcMain.handle(IPC.GIT_PRUNE_WORKTREES, async (_, repoPath: string) => {
    return services.git.pruneWorktrees(repoPath);
  });

  ipcMain.handle(IPC.GIT_DELETE_BRANCH, async (_, repoPath: string, branchName: string, deleteRemote?: boolean) => {
    return services.git.deleteBranch(repoPath, branchName, deleteRemote);
  });

  ipcMain.handle(IPC.GIT_MERGED_BRANCHES, async (_, repoPath: string, baseBranch?: string) => {
    return services.git.getMergedBranches(repoPath, baseBranch);
  });

  // ==========================================================================
  // CONTRACT DETECTION HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.CONTRACT_ANALYZE_COMMIT, async (_, repoPath: string, commitHash?: string) => {
    return services.contractDetection.analyzeCommit(repoPath, commitHash);
  });

  ipcMain.handle(IPC.CONTRACT_ANALYZE_RANGE, async (_, repoPath: string, fromRef?: string, toRef?: string) => {
    return services.contractDetection.analyzeCommitRange(repoPath, fromRef, toRef);
  });

  ipcMain.handle(IPC.CONTRACT_ANALYZE_STAGED, async (_, repoPath: string) => {
    return services.contractDetection.analyzeStagedChanges(repoPath);
  });

  ipcMain.handle(IPC.CONTRACT_GET_PATTERNS, async () => {
    return {
      success: true,
      data: services.contractDetection.getContractFilePatterns(),
    };
  });

  // ==========================================================================
  // REBASE WATCHER HANDLERS
  // Auto-rebase on remote changes (on-demand mode)
  // ==========================================================================
  ipcMain.handle(IPC.REBASE_WATCHER_START, async (_, config) => {
    return services.rebaseWatcher.startWatching(config);
  });

  ipcMain.handle(IPC.REBASE_WATCHER_STOP, async (_, sessionId: string) => {
    return services.rebaseWatcher.stopWatching(sessionId);
  });

  ipcMain.handle(IPC.REBASE_WATCHER_PAUSE, async (_, sessionId: string) => {
    services.rebaseWatcher.pauseWatching(sessionId);
    return { success: true };
  });

  ipcMain.handle(IPC.REBASE_WATCHER_RESUME, async (_, sessionId: string) => {
    services.rebaseWatcher.resumeWatching(sessionId);
    return { success: true };
  });

  ipcMain.handle(IPC.REBASE_WATCHER_GET_STATUS, async (_, sessionId: string) => {
    return {
      success: true,
      data: services.rebaseWatcher.getWatchStatus(sessionId),
    };
  });

  ipcMain.handle(IPC.REBASE_WATCHER_FORCE_CHECK, async (_, sessionId: string) => {
    return services.rebaseWatcher.forceCheck(sessionId);
  });

  ipcMain.handle(IPC.REBASE_WATCHER_TRIGGER, async (_, sessionId: string) => {
    return services.rebaseWatcher.triggerRebase(sessionId);
  });

  ipcMain.handle(IPC.REBASE_WATCHER_LIST, async () => {
    return {
      success: true,
      data: services.rebaseWatcher.getWatchedSessions(),
    };
  });

  // ==========================================================================
  // APP HANDLERS
  // ==========================================================================
  ipcMain.handle(IPC.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.on(IPC.APP_QUIT, () => {
    app.quit();
  });
}

/**
 * Remove all IPC handlers (for cleanup/testing)
 */
export function removeIpcHandlers(): void {
  Object.values(IPC).forEach((channel) => {
    ipcMain.removeHandler(channel);
    ipcMain.removeAllListeners(channel);
  });
}
