import { execSync } from 'child_process';
import path from 'path';

export class GitService {
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
  }

  static findRepoRoot() {
    try {
      // Check if we're in a submodule
      const superproject = execSync('git rev-parse --show-superproject-working-tree', { encoding: 'utf8' }).trim();
      if (superproject) {
        return superproject;
      }
      // Not in a submodule, use current repository root
      return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    } catch (error) {
      throw new Error('Not in a git repository');
    }
  }

  isSubmodule() {
    try {
      const superproject = execSync('git rev-parse --show-superproject-working-tree', { encoding: 'utf8' }).trim();
      return !!superproject;
    } catch (e) {
      return false;
    }
  }

  getParentRemote(superprojectPath) {
    return execSync(`git -C "${superprojectPath}" remote get-url origin`, { encoding: 'utf8' }).trim();
  }

  createWorktree(branchName, worktreePath) {
    execSync(`git worktree add -b ${branchName} "${worktreePath}" HEAD`, { stdio: 'pipe' });
  }

  removeWorktree(worktreePath) {
    execSync(`git worktree remove "${worktreePath}" --force`, { stdio: 'pipe' });
  }

  pruneWorktrees() {
    execSync('git worktree prune', { stdio: 'pipe' });
  }

  configureWorktreeRemote(worktreePath, remoteUrl) {
    try {
      execSync(`git -C "${worktreePath}" remote remove origin`, { stdio: 'pipe' });
    } catch (e) {
      // Origin might not exist, continue
    }
    execSync(`git -C "${worktreePath}" remote add origin ${remoteUrl}`, { stdio: 'pipe' });
  }

  getAvailableBranches() {
    try {
      const result = execSync('git branch -a --format="%(refname:short)"', { 
        cwd: this.repoRoot,
        encoding: 'utf8' 
      });
      
      return result.split('\n')
        .filter(branch => branch.trim())
        .filter(branch => !branch.includes('HEAD'))
        .map(branch => branch.replace('origin/', ''));
    } catch (error) {
      return ['main', 'develop', 'master'];
    }
  }

  branchExists(branch) {
    try {
      execSync(`git rev-parse --verify ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
      return true;
    } catch (err) {
      return false;
    }
  }

  branchExistsRemote(branch) {
    try {
      execSync(`git ls-remote --heads origin ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
      return true;
    } catch (err) {
      return false;
    }
  }

  createBranch(branch) {
    execSync(`git checkout -b ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
    execSync(`git push -u origin ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  checkoutBranch(branch) {
    execSync(`git checkout ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  pullBranch(branch) {
    try {
      execSync(`git pull origin ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
    } catch (err) {
      // Ignore if cannot pull (e.g. new branch)
    }
  }

  fetchBranch(branch) {
    execSync(`git fetch origin ${branch}:${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  merge(branch, message, noFf = true) {
    const flags = noFf ? '--no-ff' : '';
    execSync(`git merge ${flags} ${branch} -m "${message}"`, { 
      cwd: this.repoRoot, 
      stdio: 'pipe' 
    });
  }

  push(branch) {
    execSync(`git push origin ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  deleteRemoteBranch(branch) {
    execSync(`git push origin --delete ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  deleteLocalBranch(branch) {
    execSync(`git branch -D ${branch}`, { cwd: this.repoRoot, stdio: 'pipe' });
  }

  commitAndPush(worktreePath, message, branchName) {
    execSync(`git -C "${worktreePath}" add -A`, { stdio: 'pipe' });
    execSync(`git -C "${worktreePath}" commit -m "${message}"`, { stdio: 'pipe' });
    execSync(`git -C "${worktreePath}" push origin ${branchName}`, { stdio: 'pipe' });
  }

  hasUncommittedChanges(worktreePath) {
    try {
      const status = execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf8' });
      return !!status.trim();
    } catch (err) {
      return false;
    }
  }

  getStatus(worktreePath) {
    return execSync(`git -C "${worktreePath}" status --porcelain`, { encoding: 'utf8' });
  }
}
