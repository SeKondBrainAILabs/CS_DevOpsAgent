/**
 * Session Recovery Service
 * Scans repositories for orphaned sessions and allows recovery
 */

import { BaseService } from './BaseService';
import { BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import Store from 'electron-store';
import { KANVAS_PATHS } from '../../shared/agent-protocol';
import type { IpcResult, AgentInstance, RecentRepo } from '../../shared/types';
import type { SessionReport } from '../../shared/agent-protocol';

interface OrphanedSession {
  sessionId: string;
  repoPath: string;
  sessionFile: string;
  sessionData: SessionReport;
  hasMatchingInstance: boolean;
  lastModified: Date;
}

interface RecoveryResult {
  recovered: number;
  failed: number;
  sessions: OrphanedSession[];
}

interface StoreSchema {
  recentRepos: RecentRepo[];
  instances: AgentInstance[];
}

export class SessionRecoveryService extends BaseService {
  private store: Store<StoreSchema>;

  constructor() {
    super();
    this.store = new Store<StoreSchema>({
      name: 'kanvas-instances',
      defaults: {
        recentRepos: [],
        instances: [],
      },
    });
  }

  /**
   * Scan a repository for session files
   */
  async scanRepoForSessions(repoPath: string): Promise<IpcResult<OrphanedSession[]>> {
    return this.wrap(async () => {
      const sessionsDir = path.join(repoPath, KANVAS_PATHS.sessions);
      const orphanedSessions: OrphanedSession[] = [];

      if (!existsSync(sessionsDir)) {
        return orphanedSessions;
      }

      // Get all session files
      const files = await fs.readdir(sessionsDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      // Get stored instances to check for matches
      const storedInstances = this.store.get('instances', []);

      for (const file of sessionFiles) {
        const sessionFile = path.join(sessionsDir, file);
        try {
          const content = await fs.readFile(sessionFile, 'utf-8');
          const sessionData = JSON.parse(content) as SessionReport;

          // Check if there's a matching instance in our store
          const hasMatchingInstance = storedInstances.some(
            inst => inst.sessionId === sessionData.sessionId
          );

          // Get file stats for last modified time
          const stats = await fs.stat(sessionFile);

          orphanedSessions.push({
            sessionId: sessionData.sessionId,
            repoPath,
            sessionFile,
            sessionData,
            hasMatchingInstance,
            lastModified: stats.mtime,
          });
        } catch (error) {
          console.warn(`[SessionRecoveryService] Could not parse session file: ${file}`, error);
        }
      }

      return orphanedSessions;
    }, 'SCAN_SESSIONS_FAILED');
  }

  /**
   * Scan all recent repos for orphaned sessions
   */
  async scanAllReposForSessions(): Promise<IpcResult<OrphanedSession[]>> {
    return this.wrap(async () => {
      const recentRepos = this.store.get('recentRepos', []);
      const allOrphaned: OrphanedSession[] = [];

      for (const repo of recentRepos) {
        const result = await this.scanRepoForSessions(repo.path);
        if (result.success && result.data) {
          // Only include sessions without matching instances
          const orphaned = result.data.filter(s => !s.hasMatchingInstance);
          allOrphaned.push(...orphaned);
        }
      }

      // Sort by last modified, newest first
      allOrphaned.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      return allOrphaned;
    }, 'SCAN_ALL_REPOS_FAILED');
  }

  /**
   * Recover an orphaned session by creating an instance for it
   */
  async recoverSession(sessionId: string, repoPath: string): Promise<IpcResult<AgentInstance>> {
    return this.wrap(async () => {
      const sessionsDir = path.join(repoPath, KANVAS_PATHS.sessions);
      const sessionFile = path.join(sessionsDir, `${sessionId}.json`);

      if (!existsSync(sessionFile)) {
        throw new Error(`Session file not found: ${sessionFile}`);
      }

      const content = await fs.readFile(sessionFile, 'utf-8');
      const sessionData = JSON.parse(content) as SessionReport;

      // Create a new instance from the session data
      const instanceId = `inst_recovered_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const instance: AgentInstance = {
        id: instanceId,
        config: {
          repoPath: sessionData.repoPath || repoPath,
          agentType: sessionData.agentType || 'claude',
          branchName: sessionData.branchName,
          baseBranch: 'main', // Default, we don't have this info
          taskDescription: sessionData.task || 'Recovered session',
          rebaseFrequency: 'never',
        },
        status: 'waiting',
        createdAt: sessionData.created || new Date().toISOString(),
        sessionId: sessionData.sessionId,
        instructions: '', // Will need to regenerate
      };

      // Save to store
      const instances = this.store.get('instances', []);
      instances.push(instance);
      this.store.set('instances', instances);

      // Emit to renderer
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send('session:reported', sessionData);
        win.webContents.send('instance:recovered', instance);
      }

      console.log(`[SessionRecoveryService] Recovered session: ${sessionId}`);
      return instance;
    }, 'RECOVER_SESSION_FAILED');
  }

  /**
   * Delete orphaned session files that are no longer needed
   */
  async deleteOrphanedSession(sessionId: string, repoPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const sessionsDir = path.join(repoPath, KANVAS_PATHS.sessions);
      const sessionFile = path.join(sessionsDir, `${sessionId}.json`);

      if (existsSync(sessionFile)) {
        await fs.unlink(sessionFile);
        console.log(`[SessionRecoveryService] Deleted orphaned session file: ${sessionFile}`);
      }

      // Also try to delete associated agent file
      const agentsDir = path.join(repoPath, KANVAS_PATHS.agents);
      const files = existsSync(agentsDir) ? await fs.readdir(agentsDir) : [];
      for (const file of files) {
        if (file.includes(sessionId.slice(-8))) {
          await fs.unlink(path.join(agentsDir, file));
          console.log(`[SessionRecoveryService] Deleted associated agent file: ${file}`);
        }
      }
    }, 'DELETE_ORPHANED_SESSION_FAILED');
  }

  /**
   * Recover multiple sessions at once
   */
  async recoverMultipleSessions(sessions: Array<{ sessionId: string; repoPath: string }>): Promise<IpcResult<RecoveryResult>> {
    return this.wrap(async () => {
      const result: RecoveryResult = {
        recovered: 0,
        failed: 0,
        sessions: [],
      };

      for (const { sessionId, repoPath } of sessions) {
        const recoveryResult = await this.recoverSession(sessionId, repoPath);
        if (recoveryResult.success) {
          result.recovered++;
        } else {
          result.failed++;
        }
      }

      return result;
    }, 'RECOVER_MULTIPLE_FAILED');
  }
}

export const sessionRecoveryService = new SessionRecoveryService();
