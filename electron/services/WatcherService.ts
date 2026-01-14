/**
 * Watcher Service
 * File watching and auto-commit engine
 * Migrated from: cs-devops-agent-worker.js
 */

import { BaseService } from './BaseService';
import { IPC } from '../../shared/ipc-channels';
import type {
  FileChangeEvent,
  CommitTriggerEvent,
  CommitCompleteEvent,
  IpcResult,
} from '../../shared/types';
import type { GitService } from './GitService';
import type { ActivityService } from './ActivityService';
import chokidar, { FSWatcher } from 'chokidar';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';

interface WatcherInstance {
  sessionId: string;
  worktreePath: string;
  watcher: FSWatcher;
  commitMsgFile: string;
}

export class WatcherService extends BaseService {
  private watchers: Map<string, WatcherInstance> = new Map();
  private gitService: GitService;
  private activityService: ActivityService;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(git: GitService, activity: ActivityService) {
    super();
    this.gitService = git;
    this.activityService = activity;
  }

  async start(sessionId: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      if (this.watchers.has(sessionId)) {
        return; // Already watching
      }

      // Get session worktree path from git service
      // This would normally come from SessionService, but we'll use a simple approach
      const worktreePath = await this.getWorktreePath(sessionId);
      if (!worktreePath) {
        throw new Error('Session worktree not found - use startWithPath instead');
      }

      return this.startWithPath(sessionId, worktreePath);
    }, 'WATCHER_START_FAILED');
  }

  /**
   * Start watching a specific path (called by AgentInstanceService)
   */
  async startWithPath(sessionId: string, worktreePath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      if (this.watchers.has(sessionId)) {
        return; // Already watching
      }

      const commitMsgFile = path.join(worktreePath, `.devops-commit-${sessionId.replace('sess_', '').slice(0, 8)}.msg`);

      // Create watcher
      const watcher = chokidar.watch(worktreePath, {
        ignored: [
          /(^|[\/\\])\../, // Ignore dotfiles
          '**/node_modules/**',
          '**/.git/**',
          '**/.worktrees/**',
          '**/dist/**',
          '**/build/**',
        ],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      const instance: WatcherInstance = {
        sessionId,
        worktreePath,
        watcher,
        commitMsgFile,
      };

      // Handle file events
      watcher.on('add', (filePath) => this.handleFileChange(instance, filePath, 'add'));
      watcher.on('change', (filePath) => this.handleFileChange(instance, filePath, 'change'));
      watcher.on('unlink', (filePath) => this.handleFileChange(instance, filePath, 'unlink'));

      watcher.on('error', (error) => {
        this.activityService.log(sessionId, 'error', `Watcher error: ${error.message}`);
      });

      this.watchers.set(sessionId, instance);
      this.activityService.log(sessionId, 'success', 'File watcher started');
    }, 'WATCHER_START_FAILED');
  }

  async stop(sessionId: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const instance = this.watchers.get(sessionId);
      if (!instance) return;

      await instance.watcher.close();
      this.watchers.delete(sessionId);

      // Clear debounce timer
      const timer = this.debounceTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(sessionId);
      }

      this.activityService.log(sessionId, 'info', 'File watcher stopped');
    }, 'WATCHER_STOP_FAILED');
  }

  async isWatching(sessionId: string): Promise<IpcResult<boolean>> {
    return this.success(this.watchers.has(sessionId));
  }

  private handleFileChange(
    instance: WatcherInstance,
    filePath: string,
    type: 'add' | 'change' | 'unlink'
  ): void {
    const { sessionId, commitMsgFile } = instance;
    const relativePath = path.relative(instance.worktreePath, filePath);

    // Emit file change event
    const event: FileChangeEvent = {
      sessionId,
      filePath: relativePath,
      type,
      timestamp: new Date().toISOString(),
    };
    this.emitToRenderer(IPC.FILE_CHANGED, event);
    this.activityService.log(sessionId, 'file', `File ${type}: ${relativePath}`);

    // Check if this is the commit message file
    if (filePath === commitMsgFile && type === 'change') {
      this.triggerCommit(instance);
    }
  }

  private async triggerCommit(instance: WatcherInstance): Promise<void> {
    const { sessionId, commitMsgFile } = instance;

    // Debounce commits
    const existingTimer = this.debounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(sessionId);

      try {
        // Read commit message
        if (!existsSync(commitMsgFile)) return;
        const message = (await fs.readFile(commitMsgFile, 'utf8')).trim();
        if (!message) return;

        // Emit commit triggered event
        const triggerEvent: CommitTriggerEvent = {
          sessionId,
          message,
          timestamp: new Date().toISOString(),
        };
        this.emitToRenderer(IPC.COMMIT_TRIGGERED, triggerEvent);
        this.activityService.log(sessionId, 'commit', `Commit triggered: ${message.substring(0, 50)}...`);

        // Perform commit
        const result = await this.gitService.commit(sessionId, message);
        if (!result.success) {
          throw new Error(result.error?.message || 'Commit failed');
        }

        // Clear commit message file
        await fs.writeFile(commitMsgFile, '');

        // Get file count
        const status = await this.gitService.getStatus(sessionId);
        const filesChanged = status.data?.changes.length || 0;

        // Emit commit completed event
        const completeEvent: CommitCompleteEvent = {
          sessionId,
          commitHash: result.data!.hash,
          message,
          filesChanged,
          timestamp: new Date().toISOString(),
        };
        this.emitToRenderer(IPC.COMMIT_COMPLETED, completeEvent);
        this.activityService.log(
          sessionId,
          'success',
          `Commit complete: ${result.data!.shortHash}`
        );

        // Auto-push (could be configurable)
        await this.gitService.push(sessionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.activityService.log(sessionId, 'error', `Commit failed: ${message}`);
      }
    }, 1000);

    this.debounceTimers.set(sessionId, timer);
  }

  private async getWorktreePath(sessionId: string): Promise<string | null> {
    // This would normally query SessionService
    // For now, return null and let caller handle
    return null;
  }

  async dispose(): Promise<void> {
    for (const [sessionId] of this.watchers) {
      await this.stop(sessionId);
    }
  }
}
