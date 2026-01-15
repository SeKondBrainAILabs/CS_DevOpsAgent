/**
 * Activity Service
 * Activity logging and event tracking with database persistence
 */

import { BaseService } from './BaseService';
import { databaseService } from './DatabaseService';
import { IPC } from '../../shared/ipc-channels';
import type { ActivityLogEntry, LogType, IpcResult } from '../../shared/types';
import { randomBytes } from 'crypto';

export class ActivityService extends BaseService {
  // In-memory cache for fast access (also persisted to DB)
  private recentLogs: Map<string, ActivityLogEntry[]> = new Map();
  private static MAX_CACHE_SIZE = 100; // Per session in-memory cache

  // Throttle IPC emissions to renderer (batch file events)
  private pendingEmits: ActivityLogEntry[] = [];
  private emitTimer: NodeJS.Timeout | null = null;
  private static EMIT_THROTTLE_MS = 500; // Batch emissions every 500ms

  /**
   * Log an activity entry (persisted to database)
   */
  log(
    sessionId: string,
    type: LogType,
    message: string,
    details?: Record<string, unknown>,
    filePath?: string
  ): ActivityLogEntry {
    const entry: ActivityLogEntry = {
      id: randomBytes(8).toString('hex'),
      sessionId,
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
      filePath,
    };

    // Persist to database
    try {
      databaseService.insertActivityLog(entry);
    } catch (error) {
      console.warn('[ActivityService] Failed to persist activity log:', error);
    }

    // Add to in-memory cache
    if (!this.recentLogs.has(sessionId)) {
      this.recentLogs.set(sessionId, []);
    }
    const sessionLogs = this.recentLogs.get(sessionId)!;
    sessionLogs.push(entry);

    // Trim cache if too large
    if (sessionLogs.length > ActivityService.MAX_CACHE_SIZE) {
      sessionLogs.shift();
    }

    // Emit to renderer (throttled for 'file' type to reduce IPC overhead)
    if (type === 'file') {
      this.throttledEmitToRenderer(entry);
    } else {
      this.emitToRenderer(IPC.LOG_ENTRY, entry);
    }

    return entry;
  }

  /**
   * Throttled emit to renderer - batches file events to reduce IPC overhead
   */
  private throttledEmitToRenderer(entry: ActivityLogEntry): void {
    this.pendingEmits.push(entry);

    // If timer already running, the pending entries will be sent when it fires
    if (this.emitTimer) return;

    this.emitTimer = setTimeout(() => {
      // Emit all pending entries
      for (const pending of this.pendingEmits) {
        this.emitToRenderer(IPC.LOG_ENTRY, pending);
      }
      this.pendingEmits = [];
      this.emitTimer = null;
    }, ActivityService.EMIT_THROTTLE_MS);
  }

  /**
   * Log a file-related activity (for commit linking)
   */
  logFileActivity(
    sessionId: string,
    type: LogType,
    message: string,
    filePath: string,
    details?: Record<string, unknown>
  ): ActivityLogEntry {
    return this.log(sessionId, type, message, details, filePath);
  }

  /**
   * Get logs for a session (from database)
   */
  getLogs(sessionId: string, limit = 500, offset = 0): IpcResult<ActivityLogEntry[]> {
    try {
      const logs = databaseService.getActivityLogs(sessionId, limit, offset);
      return this.success(logs);
    } catch (error) {
      console.warn('[ActivityService] Failed to get logs from database:', error);
      // Fallback to in-memory cache
      const cached = this.recentLogs.get(sessionId) || [];
      return this.success(cached.slice(-limit));
    }
  }

  /**
   * Get all logs across all sessions
   */
  getAllLogs(limit = 1000): IpcResult<ActivityLogEntry[]> {
    try {
      const logs = databaseService.getAllActivityLogs(limit);
      return this.success(logs);
    } catch (error) {
      console.warn('[ActivityService] Failed to get all logs:', error);
      return this.success([]);
    }
  }

  /**
   * Get uncommitted activity logs (for linking to commits)
   */
  getUncommittedLogs(sessionId: string): ActivityLogEntry[] {
    try {
      return databaseService.getUncommittedActivityLogs(sessionId);
    } catch (error) {
      console.warn('[ActivityService] Failed to get uncommitted logs:', error);
      return [];
    }
  }

  /**
   * Link all uncommitted activities to a commit
   * Called when a commit is completed
   */
  linkToCommit(sessionId: string, commitHash: string, changedFiles?: string[]): number {
    try {
      const linkedCount = databaseService.linkActivitiesToCommit(sessionId, commitHash, changedFiles);

      // Update in-memory cache
      const cached = this.recentLogs.get(sessionId);
      if (cached) {
        for (const entry of cached) {
          if (!entry.commitHash) {
            if (!changedFiles || !entry.filePath || changedFiles.includes(entry.filePath)) {
              entry.commitHash = commitHash;
            }
          }
        }
      }

      return linkedCount;
    } catch (error) {
      console.warn('[ActivityService] Failed to link activities to commit:', error);
      return 0;
    }
  }

  /**
   * Get activities linked to a specific commit
   */
  getActivitiesForCommit(commitHash: string): IpcResult<ActivityLogEntry[]> {
    try {
      const logs = databaseService.getActivitiesForCommit(commitHash);
      return this.success(logs);
    } catch (error) {
      console.warn('[ActivityService] Failed to get activities for commit:', error);
      return this.success([]);
    }
  }

  /**
   * Clear logs for a session
   */
  clearLogs(sessionId: string): IpcResult<void> {
    try {
      databaseService.clearActivityLogs(sessionId);
      this.recentLogs.delete(sessionId);
      return this.success(undefined);
    } catch (error) {
      console.warn('[ActivityService] Failed to clear logs:', error);
      return this.error('CLEAR_FAILED', 'Failed to clear activity logs');
    }
  }

  /**
   * Load recent logs from database into cache on startup
   */
  async loadRecentLogsToCache(sessionId: string): Promise<void> {
    try {
      const logs = databaseService.getActivityLogs(sessionId, ActivityService.MAX_CACHE_SIZE);
      this.recentLogs.set(sessionId, logs.reverse()); // Reverse to get oldest first
    } catch (error) {
      console.warn('[ActivityService] Failed to load logs to cache:', error);
    }
  }

  /**
   * Get statistics about activity logs
   */
  getStats(): { totalLogs: number; sessionsWithLogs: number } {
    try {
      const dbStats = databaseService.getStats();
      return {
        totalLogs: dbStats.activityCount,
        sessionsWithLogs: dbStats.sessionCount,
      };
    } catch {
      return { totalLogs: 0, sessionsWithLogs: 0 };
    }
  }
}
