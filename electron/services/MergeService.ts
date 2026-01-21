/**
 * Merge Service
 * Handles merge preview and execution for the merge workflow modal
 */

import { BaseService } from './BaseService';
import type { IpcResult, MergePreview, MergeResult } from '../../shared/types';

export class MergeService extends BaseService {
  /**
   * Execute a git command (uses dynamic import for ESM-only execa)
   */
  private async git(args: string[], cwd: string): Promise<{ stdout: string; exitCode: number }> {
    try {
      const { execa } = await import('execa');
      const result = await execa('git', args, { cwd, reject: false });
      return { stdout: result.stdout.trim(), exitCode: result.exitCode ?? 0 };
    } catch (error) {
      return { stdout: '', exitCode: 1 };
    }
  }

  /**
   * Preview a merge without actually executing it
   */
  async previewMerge(
    repoPath: string,
    sourceBranch: string,
    targetBranch: string
  ): Promise<IpcResult<MergePreview>> {
    return this.wrap(async () => {
      // Fetch latest from remote
      await this.git(['fetch', 'origin'], repoPath);

      // Get current branch
      const { stdout: currentBranch } = await this.git(['branch', '--show-current'], repoPath);

      // Check if we need to checkout target branch first
      const needsCheckout = currentBranch !== targetBranch;

      // Get ahead/behind counts
      const { stdout: revList } = await this.git(
        ['rev-list', '--left-right', '--count', `${targetBranch}...${sourceBranch}`],
        repoPath
      );
      const [behindBy, aheadBy] = revList.split('\t').map(Number);

      // Get commit count between branches
      const { stdout: commitCountStr } = await this.git(
        ['rev-list', '--count', `${targetBranch}..${sourceBranch}`],
        repoPath
      );
      const commitCount = parseInt(commitCountStr, 10) || 0;

      // Get files that would be changed
      const { stdout: diffOutput } = await this.git(
        ['diff', '--numstat', `${targetBranch}...${sourceBranch}`],
        repoPath
      );

      const filesChanged = diffOutput
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [additions, deletions, path] = line.split('\t');
          return {
            path,
            additions: parseInt(additions, 10) || 0,
            deletions: parseInt(deletions, 10) || 0,
            status: 'modified' as const,
          };
        });

      // Check for conflicts by doing a dry-run merge
      let hasConflicts = false;
      let conflictingFiles: string[] = [];
      let canMerge = true;

      // Save current state
      const { stdout: currentHead } = await this.git(['rev-parse', 'HEAD'], repoPath);

      try {
        // Attempt merge without committing
        const { exitCode } = await this.git(
          ['merge', '--no-commit', '--no-ff', sourceBranch],
          repoPath
        );

        if (exitCode !== 0) {
          hasConflicts = true;
          canMerge = false;

          // Get conflicting files
          const { stdout: conflictOutput } = await this.git(['diff', '--name-only', '--diff-filter=U'], repoPath);
          conflictingFiles = conflictOutput.split('\n').filter(Boolean);
        }
      } catch {
        hasConflicts = true;
        canMerge = false;
      } finally {
        // Always abort the test merge
        await this.git(['merge', '--abort'], repoPath);
        // Reset to original state
        await this.git(['reset', '--hard', currentHead], repoPath);
      }

      return {
        sourceBranch,
        targetBranch,
        canMerge,
        hasConflicts,
        conflictingFiles,
        filesChanged,
        commitCount,
        aheadBy: aheadBy || 0,
        behindBy: behindBy || 0,
      };
    }, 'MERGE_PREVIEW_FAILED');
  }

  /**
   * Execute a merge
   */
  async executeMerge(
    repoPath: string,
    sourceBranch: string,
    targetBranch: string,
    options: {
      deleteWorktree?: boolean;
      deleteLocalBranch?: boolean;
      deleteRemoteBranch?: boolean;
      worktreePath?: string;
    } = {}
  ): Promise<IpcResult<MergeResult>> {
    return this.wrap(async () => {
      // Get current branch
      const { stdout: currentBranch } = await this.git(['branch', '--show-current'], repoPath);

      // Checkout target branch if needed
      if (currentBranch !== targetBranch) {
        const { exitCode } = await this.git(['checkout', targetBranch], repoPath);
        if (exitCode !== 0) {
          throw new Error(`Failed to checkout ${targetBranch}`);
        }
      }

      // Pull latest changes
      await this.git(['pull', 'origin', targetBranch], repoPath);

      // Perform the merge
      const { exitCode, stdout } = await this.git(
        ['merge', sourceBranch, '-m', `Merge branch '${sourceBranch}' into ${targetBranch}`],
        repoPath
      );

      if (exitCode !== 0) {
        // Get conflicting files
        const { stdout: conflictOutput } = await this.git(['diff', '--name-only', '--diff-filter=U'], repoPath);
        const conflictingFiles = conflictOutput.split('\n').filter(Boolean);

        // Abort the merge
        await this.git(['merge', '--abort'], repoPath);

        return {
          success: false,
          message: 'Merge failed due to conflicts',
          conflictingFiles,
        };
      }

      // Get merge commit hash
      const { stdout: mergeCommitHash } = await this.git(['rev-parse', 'HEAD'], repoPath);

      // Get files changed count
      const { stdout: diffStatOutput } = await this.git(
        ['diff', '--stat', `${targetBranch}@{1}..HEAD`],
        repoPath
      );
      const filesChangedMatch = diffStatOutput.match(/(\d+) files? changed/);
      const filesChanged = filesChangedMatch ? parseInt(filesChangedMatch[1], 10) : 0;

      // Push merged changes
      await this.git(['push', 'origin', targetBranch], repoPath);

      // Cleanup: Delete worktree if requested
      if (options.deleteWorktree && options.worktreePath) {
        await this.git(['worktree', 'remove', options.worktreePath, '--force'], repoPath);
        await this.git(['worktree', 'prune'], repoPath);
      }

      // Cleanup: Delete local branch if requested
      if (options.deleteLocalBranch) {
        await this.git(['branch', '-D', sourceBranch], repoPath);
      }

      // Cleanup: Delete remote branch if requested
      if (options.deleteRemoteBranch) {
        await this.git(['push', 'origin', '--delete', sourceBranch], repoPath);
      }

      return {
        success: true,
        message: `Successfully merged ${sourceBranch} into ${targetBranch}`,
        mergeCommitHash,
        filesChanged,
      };
    }, 'MERGE_EXECUTE_FAILED');
  }

  /**
   * Abort an in-progress merge
   */
  async abortMerge(repoPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      await this.git(['merge', '--abort'], repoPath);
    }, 'MERGE_ABORT_FAILED');
  }
}
