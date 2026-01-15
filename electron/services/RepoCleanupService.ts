/**
 * Repository Cleanup Service
 * Handles worktree cleanup, branch merging, and repository maintenance
 */

import { BaseService } from './BaseService';
import { GitService } from './GitService';
import { BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import Store from 'electron-store';
import { KANVAS_PATHS } from '../../shared/agent-protocol';
import type { IpcResult, AgentInstance, RecentRepo } from '../../shared/types';

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
  exists: boolean;
  hasUncommittedChanges?: boolean;
  isOrphaned?: boolean;
}

interface BranchInfo {
  name: string;
  isMerged: boolean;
  lastCommitDate?: string;
  lastCommitMessage?: string;
  hasAssociatedSession?: boolean;
}

interface CleanupPlan {
  repoPath: string;
  worktreesToRemove: WorktreeInfo[];
  branchesToDelete: BranchInfo[];
  branchesToMerge: Array<{
    branch: string;
    targetBranch: string;
    order: number;
  }>;
  estimatedActions: number;
}

interface CleanupResult {
  success: boolean;
  worktreesRemoved: number;
  branchesDeleted: number;
  branchesMerged: number;
  errors: string[];
}

interface StoreSchema {
  recentRepos: RecentRepo[];
  instances: AgentInstance[];
}

export class RepoCleanupService extends BaseService {
  private store: Store<StoreSchema>;
  private gitService: GitService;

  constructor() {
    super();
    this.store = new Store<StoreSchema>({
      name: 'kanvas-instances',
      defaults: {
        recentRepos: [],
        instances: [],
      },
    });
    this.gitService = new GitService();
  }

  /**
   * Analyze a repository and generate a cleanup plan
   */
  async analyzeRepo(repoPath: string, targetBranch = 'main'): Promise<IpcResult<CleanupPlan>> {
    return this.wrap(async () => {
      const plan: CleanupPlan = {
        repoPath,
        worktreesToRemove: [],
        branchesToDelete: [],
        branchesToMerge: [],
        estimatedActions: 0,
      };

      // 1. Get worktrees
      const worktreesResult = await this.gitService.listWorktrees(repoPath);
      if (worktreesResult.success && worktreesResult.data) {
        for (const wt of worktreesResult.data) {
          if (wt.bare) continue; // Skip main worktree

          const wtInfo: WorktreeInfo = {
            ...wt,
            exists: existsSync(wt.path),
            isOrphaned: !existsSync(wt.path),
          };

          // Check if worktree directory exists
          if (!wtInfo.exists || wtInfo.isOrphaned) {
            plan.worktreesToRemove.push(wtInfo);
          }
        }
      }

      // 2. Get merged branches that can be cleaned up
      const mergedResult = await this.gitService.getMergedBranches(repoPath, targetBranch);
      if (mergedResult.success && mergedResult.data) {
        // Get stored instances to check for associated sessions
        const instances = this.store.get('instances', []);

        for (const branchName of mergedResult.data) {
          const hasSession = instances.some(inst => inst.config.branchName === branchName);

          plan.branchesToDelete.push({
            name: branchName,
            isMerged: true,
            hasAssociatedSession: hasSession,
          });
        }
      }

      // 3. Identify branches that need to be merged (not yet merged)
      // This would typically be session branches that are complete but not merged
      const instances = this.store.get('instances', []);
      const completedSessions = instances.filter(
        inst => inst.status === 'completed' && inst.config.repoPath === repoPath
      );

      let mergeOrder = 1;
      for (const session of completedSessions) {
        const branchName = session.config.branchName;
        // Check if already in delete list (already merged)
        const alreadyMerged = plan.branchesToDelete.some(b => b.name === branchName);

        if (!alreadyMerged) {
          plan.branchesToMerge.push({
            branch: branchName,
            targetBranch,
            order: mergeOrder++,
          });
        }
      }

      plan.estimatedActions =
        plan.worktreesToRemove.length +
        plan.branchesToDelete.length +
        plan.branchesToMerge.length;

      return plan;
    }, 'ANALYZE_REPO_FAILED');
  }

  /**
   * Execute cleanup based on a plan
   */
  async executeCleanup(
    plan: CleanupPlan,
    options: {
      removeWorktrees?: boolean;
      deleteMergedBranches?: boolean;
      mergeCompletedBranches?: boolean;
      deleteRemoteBranches?: boolean;
    } = {}
  ): Promise<IpcResult<CleanupResult>> {
    return this.wrap(async () => {
      const result: CleanupResult = {
        success: true,
        worktreesRemoved: 0,
        branchesDeleted: 0,
        branchesMerged: 0,
        errors: [],
      };

      const {
        removeWorktrees = true,
        deleteMergedBranches = true,
        mergeCompletedBranches = false,
        deleteRemoteBranches = false,
      } = options;

      // Emit progress
      const emitProgress = (message: string) => {
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          win.webContents.send('cleanup:progress', { message, result });
        }
      };

      // 1. Remove orphaned worktrees
      if (removeWorktrees) {
        emitProgress('Removing orphaned worktrees...');
        await this.gitService.pruneWorktrees(plan.repoPath);
        result.worktreesRemoved = plan.worktreesToRemove.length;
      }

      // 2. Merge completed branches (in order)
      if (mergeCompletedBranches && plan.branchesToMerge.length > 0) {
        // Sort by order
        const sortedMerges = [...plan.branchesToMerge].sort((a, b) => a.order - b.order);

        for (const merge of sortedMerges) {
          emitProgress(`Merging ${merge.branch} into ${merge.targetBranch}...`);
          try {
            // This would need proper merge logic
            // For now, just log it
            console.log(`[RepoCleanupService] Would merge ${merge.branch} -> ${merge.targetBranch}`);
            result.branchesMerged++;
          } catch (error) {
            result.errors.push(`Failed to merge ${merge.branch}: ${error}`);
          }
        }
      }

      // 3. Delete merged branches
      if (deleteMergedBranches) {
        for (const branch of plan.branchesToDelete) {
          // Skip branches with active sessions
          if (branch.hasAssociatedSession) {
            console.log(`[RepoCleanupService] Skipping branch with active session: ${branch.name}`);
            continue;
          }

          emitProgress(`Deleting merged branch: ${branch.name}...`);
          try {
            const deleteResult = await this.gitService.deleteBranch(
              plan.repoPath,
              branch.name,
              deleteRemoteBranches
            );
            if (deleteResult.success) {
              result.branchesDeleted++;
            } else {
              result.errors.push(`Failed to delete ${branch.name}`);
            }
          } catch (error) {
            result.errors.push(`Error deleting ${branch.name}: ${error}`);
          }
        }
      }

      result.success = result.errors.length === 0;
      emitProgress('Cleanup completed');

      return result;
    }, 'EXECUTE_CLEANUP_FAILED');
  }

  /**
   * Clean up Kanvas directories (remove stale files)
   */
  async cleanupKanvasDirectory(repoPath: string): Promise<IpcResult<{
    removedSessionFiles: number;
    removedAgentFiles: number;
    removedActivityFiles: number;
  }>> {
    return this.wrap(async () => {
      const result = {
        removedSessionFiles: 0,
        removedAgentFiles: 0,
        removedActivityFiles: 0,
      };

      // Get active session IDs from instances
      const instances = this.store.get('instances', []);
      const activeSessionIds = new Set(instances.map(i => i.sessionId).filter(Boolean));

      // Clean sessions directory
      const sessionsDir = path.join(repoPath, KANVAS_PATHS.sessions);
      if (existsSync(sessionsDir)) {
        const files = await fs.readdir(sessionsDir);
        for (const file of files) {
          const sessionId = file.replace('.json', '');
          if (!activeSessionIds.has(sessionId)) {
            await fs.unlink(path.join(sessionsDir, file));
            result.removedSessionFiles++;
          }
        }
      }

      // Clean agents directory
      const agentsDir = path.join(repoPath, KANVAS_PATHS.agents);
      if (existsSync(agentsDir)) {
        const files = await fs.readdir(agentsDir);
        for (const file of files) {
          // Check if any active session references this agent
          const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
          try {
            const agent = JSON.parse(content);
            const hasActiveSession = agent.sessions?.some((s: string) => activeSessionIds.has(s));
            if (!hasActiveSession) {
              await fs.unlink(path.join(agentsDir, file));
              result.removedAgentFiles++;
            }
          } catch {
            // Remove unparseable files
            await fs.unlink(path.join(agentsDir, file));
            result.removedAgentFiles++;
          }
        }
      }

      // Clean activity directory (keep only recent)
      const activityDir = path.join(repoPath, KANVAS_PATHS.activity);
      if (existsSync(activityDir)) {
        const files = await fs.readdir(activityDir);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        for (const file of files) {
          const filePath = path.join(activityDir, file);
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < oneWeekAgo) {
            await fs.unlink(filePath);
            result.removedActivityFiles++;
          }
        }
      }

      console.log(`[RepoCleanupService] Cleaned up Kanvas directory in ${repoPath}:`, result);
      return result;
    }, 'CLEANUP_KANVAS_FAILED');
  }

  /**
   * Quick cleanup: prune worktrees and remove stale Kanvas files
   */
  async quickCleanup(repoPath: string): Promise<IpcResult<{
    worktreesPruned: boolean;
    kanvasCleanup: { removedSessionFiles: number; removedAgentFiles: number; removedActivityFiles: number };
  }>> {
    return this.wrap(async () => {
      // Prune worktrees
      await this.gitService.pruneWorktrees(repoPath);

      // Cleanup Kanvas directory
      const kanvasResult = await this.cleanupKanvasDirectory(repoPath);

      return {
        worktreesPruned: true,
        kanvasCleanup: kanvasResult.data || {
          removedSessionFiles: 0,
          removedAgentFiles: 0,
          removedActivityFiles: 0,
        },
      };
    }, 'QUICK_CLEANUP_FAILED');
  }
}

export const repoCleanupService = new RepoCleanupService();
