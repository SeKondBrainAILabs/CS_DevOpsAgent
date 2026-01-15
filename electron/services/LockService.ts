/**
 * Lock Service
 * Multi-agent file coordination and conflict detection
 * Migrated from: file-coordinator.cjs
 */

import { BaseService } from './BaseService';
import { IPC } from '../../shared/ipc-channels';
import type {
  FileLock,
  FileConflict,
  AgentType,
  IpcResult,
} from '../../shared/types';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const COORD_DIR = path.join(os.homedir(), '.devops-agent', 'file-coordination');
const ACTIVE_EDITS_DIR = path.join(COORD_DIR, 'active-edits');
const COMPLETED_EDITS_DIR = path.join(COORD_DIR, 'completed-edits');

export class LockService extends BaseService {
  private locks: Map<string, FileLock> = new Map();

  async initialize(): Promise<void> {
    await fs.mkdir(ACTIVE_EDITS_DIR, { recursive: true });
    await fs.mkdir(COMPLETED_EDITS_DIR, { recursive: true });
    await this.loadLocks();
  }

  private async loadLocks(): Promise<void> {
    try {
      const files = await fs.readdir(ACTIVE_EDITS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(ACTIVE_EDITS_DIR, file), 'utf8');
          const lock = JSON.parse(content) as FileLock;

          // Check if lock is still valid (not expired)
          const declaredAt = new Date(lock.declaredAt);
          const expiresAt = new Date(declaredAt.getTime() + lock.estimatedDuration * 60 * 1000);

          if (new Date() < expiresAt) {
            this.locks.set(lock.sessionId, lock);
          } else {
            // Move expired lock to completed
            await this.moveToCompleted(file);
          }
        }
      }
    } catch {
      // Directory might not exist yet
    }
  }

  async declareFiles(
    sessionId: string,
    files: string[],
    operation: 'edit' | 'read' | 'delete',
    agentType: AgentType = 'custom',
    estimatedDuration: number = 30,
    reason?: string
  ): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      // Check for conflicts first
      const conflicts = await this.checkConflictsInternal(files, sessionId);
      if (conflicts.length > 0) {
        this.emitToRenderer(IPC.CONFLICT_DETECTED, conflicts);
        throw new Error(`Files are locked by other sessions: ${conflicts.map(c => c.file).join(', ')}`);
      }

      const lock: FileLock = {
        sessionId,
        agentType,
        files,
        operation,
        declaredAt: new Date().toISOString(),
        estimatedDuration,
        reason,
      };

      // Save lock
      this.locks.set(sessionId, lock);
      await this.saveLock(lock);
    }, 'LOCK_DECLARE_FAILED');
  }

  async releaseFiles(sessionId: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const lock = this.locks.get(sessionId);
      if (!lock) return;

      // Move to completed
      const filename = `${sessionId}.json`;
      await this.moveToCompleted(filename);

      this.locks.delete(sessionId);
    }, 'LOCK_RELEASE_FAILED');
  }

  async checkConflicts(files: string[]): Promise<IpcResult<FileConflict[]>> {
    const conflicts = await this.checkConflictsInternal(files);
    return this.success(conflicts);
  }

  private async checkConflictsInternal(
    files: string[],
    excludeSessionId?: string
  ): Promise<FileConflict[]> {
    const conflicts: FileConflict[] = [];

    for (const [lockSessionId, lock] of this.locks) {
      if (excludeSessionId && lockSessionId === excludeSessionId) continue;

      for (const file of files) {
        if (lock.files.includes(file)) {
          conflicts.push({
            file,
            conflictsWith: lock.agentType,
            session: lockSessionId,
            reason: lock.reason || 'No reason provided',
            declaredAt: lock.declaredAt,
          });
        }
      }
    }

    return conflicts;
  }

  async listDeclarations(): Promise<IpcResult<FileLock[]>> {
    return this.success(Array.from(this.locks.values()));
  }

  private async saveLock(lock: FileLock): Promise<void> {
    const filePath = path.join(ACTIVE_EDITS_DIR, `${lock.sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(lock, null, 2));
  }

  private async moveToCompleted(filename: string): Promise<void> {
    const sourcePath = path.join(ACTIVE_EDITS_DIR, filename);
    const destPath = path.join(COMPLETED_EDITS_DIR, filename);

    try {
      if (existsSync(sourcePath)) {
        await fs.rename(sourcePath, destPath);
      }
    } catch {
      // Ignore move errors
    }
  }

  async dispose(): Promise<void> {
    // Release all locks on shutdown
    for (const [sessionId] of this.locks) {
      await this.releaseFiles(sessionId);
    }
  }
}
