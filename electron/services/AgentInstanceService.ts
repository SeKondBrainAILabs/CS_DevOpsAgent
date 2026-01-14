/**
 * AgentInstanceService
 *
 * Manages creation of agent instances from Kanvas dashboard.
 * Handles repository validation, .S9N_KIT_DevOpsAgent directory initialization,
 * and instruction generation for different agent types.
 */

import { spawn } from 'child_process';
import { mkdir, writeFile, readFile, readdir, stat, access } from 'fs/promises';
import { existsSync, constants } from 'fs';
import { join, basename } from 'path';
import { BrowserWindow } from 'electron';
import Store from 'electron-store';
import { BaseService } from './BaseService';
import { KANVAS_PATHS, FILE_COORDINATION_PATHS, DEVOPS_KIT_DIR } from '../../shared/agent-protocol';
import { getAgentInstructions, generateClaudePrompt, InstructionVars } from '../../shared/agent-instructions';
import type {
  AgentType,
  AgentInstance,
  AgentInstanceConfig,
  RepoValidation,
  RecentRepo,
  KanvasConfig,
  IpcResult,
} from '../../shared/types';

interface StoreSchema {
  recentRepos: RecentRepo[];
  instances: AgentInstance[];
}

export class AgentInstanceService extends BaseService {
  private store: Store<StoreSchema>;
  private instances: Map<string, AgentInstance> = new Map();

  constructor() {
    super();
    this.store = new Store<StoreSchema>({
      name: 'kanvas-instances',
      defaults: {
        recentRepos: [],
        instances: [],
      },
    });

    // Load existing instances
    const savedInstances = this.store.get('instances', []);
    for (const instance of savedInstances) {
      this.instances.set(instance.id, instance);
    }
  }

  /**
   * Validate a repository path
   */
  async validateRepository(repoPath: string): Promise<IpcResult<RepoValidation>> {
    try {
      // Check if path exists
      try {
        await access(repoPath, constants.R_OK);
      } catch {
        return {
          success: true,
          data: {
            isValid: false,
            isGitRepo: false,
            repoName: '',
            currentBranch: '',
            hasKanvasDir: false,
            branches: [],
            error: 'Path does not exist or is not accessible',
          },
        };
      }

      // Check if it's a directory
      const stats = await stat(repoPath);
      if (!stats.isDirectory()) {
        return {
          success: true,
          data: {
            isValid: false,
            isGitRepo: false,
            repoName: '',
            currentBranch: '',
            hasKanvasDir: false,
            branches: [],
            error: 'Path is not a directory',
          },
        };
      }

      // Check if it's a git repository
      const gitDir = join(repoPath, '.git');
      const isGitRepo = existsSync(gitDir);

      if (!isGitRepo) {
        return {
          success: true,
          data: {
            isValid: false,
            isGitRepo: false,
            repoName: basename(repoPath),
            currentBranch: '',
            hasKanvasDir: false,
            branches: [],
            error: 'Not a Git repository',
          },
        };
      }

      // Get repository info using git commands
      const { execa } = await import('execa');

      // Get current branch
      const branchResult = await execa('git', ['branch', '--show-current'], { cwd: repoPath });
      const currentBranch = branchResult.stdout.trim() || 'HEAD';

      // Get all branches
      const branchesResult = await execa('git', ['branch', '-a', '--format=%(refname:short)'], { cwd: repoPath });
      const branches = branchesResult.stdout.split('\n').filter(Boolean);

      // Get remote URL
      let remoteUrl: string | undefined;
      try {
        const remoteResult = await execa('git', ['remote', 'get-url', 'origin'], { cwd: repoPath });
        remoteUrl = remoteResult.stdout.trim();
      } catch {
        // No remote configured
      }

      // Check if DevOps Kit directory exists
      const devopsKitDir = join(repoPath, KANVAS_PATHS.baseDir);
      const hasKanvasDir = existsSync(devopsKitDir);

      return {
        success: true,
        data: {
          isValid: true,
          isGitRepo: true,
          repoName: basename(repoPath),
          currentBranch,
          remoteUrl,
          hasKanvasDir,
          branches,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate repository',
        },
      };
    }
  }

  /**
   * Initialize .S9N_KIT_DevOpsAgent directory in a repository
   * This is the per-repo installation directory for the DevOps Agent
   */
  async initializeKanvasDirectory(repoPath: string): Promise<IpcResult<void>> {
    try {
      const devopsKitDir = join(repoPath, KANVAS_PATHS.baseDir);

      // Create all required directories
      const dirs = [
        // DevOps Agent Kit directories
        KANVAS_PATHS.baseDir,
        KANVAS_PATHS.agents,
        KANVAS_PATHS.sessions,
        KANVAS_PATHS.activity,
        KANVAS_PATHS.commands,
        KANVAS_PATHS.heartbeats,
        // File coordination directories (for multi-agent file locking)
        FILE_COORDINATION_PATHS.baseDir,
        FILE_COORDINATION_PATHS.activeEdits,
        FILE_COORDINATION_PATHS.completedEdits,
      ];

      for (const dir of dirs) {
        const fullPath = join(repoPath, dir);
        if (!existsSync(fullPath)) {
          await mkdir(fullPath, { recursive: true });
        }
      }

      // Create config file
      const config: KanvasConfig = {
        version: '1.0.0',
        repoPath,
        initialized: new Date().toISOString(),
        settings: {
          autoCommit: true,
          commitInterval: 30000,
          watchPatterns: ['**/*'],
          ignorePatterns: ['node_modules/**', '.git/**', `${DEVOPS_KIT_DIR}/**`],
        },
      };

      const configPath = join(devopsKitDir, 'config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2));

      // Create placeholder houserules.md (teams can commit this)
      const houserulesPath = join(devopsKitDir, 'houserules.md');
      if (!existsSync(houserulesPath)) {
        const houserulesContent = `# House Rules for DevOps Agent

This file defines team-specific rules and guidelines for AI agents working in this repository.
You can commit this file to share rules with your team.

## Code Style
- Follow existing patterns in the codebase
- Use TypeScript strict mode

## Git Workflow
- Create feature branches from main
- Use conventional commit messages

## Testing
- Write tests for new features
- Ensure existing tests pass before committing

---
*This file was auto-generated. Feel free to customize it for your team.*
`;
        await writeFile(houserulesPath, houserulesContent);
      }

      // Add .S9N_KIT_DevOpsAgent to .gitignore (except houserules.md)
      const gitignorePath = join(repoPath, '.gitignore');
      try {
        let gitignore = '';
        if (existsSync(gitignorePath)) {
          gitignore = await readFile(gitignorePath, 'utf-8');
        }

        // Add DevOps Kit directory but exclude houserules.md so it can be committed
        if (!gitignore.includes(DEVOPS_KIT_DIR)) {
          gitignore += `
# DevOps Agent Kit (local data - do not commit)
${DEVOPS_KIT_DIR}/
!${DEVOPS_KIT_DIR}/houserules.md
`;
        }
        if (!gitignore.includes('.devops-commit-')) {
          gitignore += '\n# DevOps commit message files\n.devops-commit-*.msg\n';
        }
        await writeFile(gitignorePath, gitignore);
      } catch {
        // Ignore gitignore errors
      }

      console.log(`[AgentInstanceService] Initialized ${DEVOPS_KIT_DIR} directory in ${repoPath}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INIT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to initialize DevOps Kit directory',
        },
      };
    }
  }

  /**
   * Create a new agent instance
   */
  async createInstance(config: AgentInstanceConfig): Promise<IpcResult<AgentInstance>> {
    try {
      // Validate repository first
      const validation = await this.validateRepository(config.repoPath);
      if (!validation.success || !validation.data?.isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_REPO',
            message: validation.data?.error || 'Invalid repository',
          },
        };
      }

      // Initialize .kanvas directory if needed
      if (!validation.data.hasKanvasDir) {
        const initResult = await this.initializeKanvasDirectory(config.repoPath);
        if (!initResult.success) {
          return initResult as IpcResult<AgentInstance>;
        }
      }

      // Generate unique ID
      const id = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Generate instructions
      const instructionVars: InstructionVars = {
        repoPath: config.repoPath,
        repoName: basename(config.repoPath),
        branchName: config.branchName,
        sessionId,
        taskDescription: config.taskDescription,
        systemPrompt: config.systemPrompt || '',
        contextPreservation: config.contextPreservation || '',
        rebaseFrequency: config.rebaseFrequency || 'never',
      };

      const instructions = getAgentInstructions(config.agentType, instructionVars);

      // Generate the standalone prompt for easy copying (only for Claude)
      const prompt = config.agentType === 'claude'
        ? generateClaudePrompt(instructionVars)
        : undefined;

      // Create instance
      const instance: AgentInstance = {
        id,
        config,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        instructions,
        prompt,
        sessionId,
      };

      // Save instance
      this.instances.set(id, instance);
      this.saveInstances();

      // Add to recent repos
      await this.addRecentRepo({
        path: config.repoPath,
        name: basename(config.repoPath),
        lastUsed: new Date().toISOString(),
        agentCount: 1,
      });

      // Create the branch if it doesn't exist
      await this.createBranchIfNeeded(config);

      // Create session file so it appears in the dashboard
      await this.createSessionFile(config, sessionId);

      // Emit status change event
      this.emitStatusChange(instance);

      console.log(`[AgentInstanceService] Created agent instance ${id} for ${config.agentType} in ${config.repoPath}`);

      return { success: true, data: instance };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create agent instance',
        },
      };
    }
  }

  /**
   * Create session file in .kanvas/sessions/ so it appears in dashboard
   */
  private async createSessionFile(config: AgentInstanceConfig, sessionId: string): Promise<void> {
    try {
      const sessionsDir = join(config.repoPath, KANVAS_PATHS.sessions);

      // Ensure sessions directory exists
      if (!existsSync(sessionsDir)) {
        await mkdir(sessionsDir, { recursive: true });
      }

      const agentId = `kanvas-${config.agentType}-${sessionId.slice(-8)}`;
      const now = new Date().toISOString();

      // Create session report
      const sessionReport = {
        sessionId,
        agentId,
        agentType: config.agentType,
        task: config.taskDescription || `${config.agentType} session`,
        branchName: config.branchName,
        worktreePath: config.repoPath,
        repoPath: config.repoPath,
        status: 'idle' as const,
        created: now,
        updated: now,
        commitCount: 0,
      };

      // Write session file
      const sessionFile = join(sessionsDir, `${sessionId}.json`);
      await writeFile(sessionFile, JSON.stringify(sessionReport, null, 2));

      // Also create an agent registration so the session shows up properly
      const agentsDir = join(config.repoPath, KANVAS_PATHS.agents);
      if (!existsSync(agentsDir)) {
        await mkdir(agentsDir, { recursive: true });
      }

      const agentInfo = {
        agentId,
        agentType: config.agentType,
        agentName: `${config.agentType.charAt(0).toUpperCase()}${config.agentType.slice(1)} (${basename(config.repoPath)})`,
        version: '1.0.0',
        pid: process.pid,
        startedAt: now,
        repoPath: config.repoPath,
        capabilities: ['code-generation', 'file-editing'],
        sessions: [sessionId],
      };

      const agentFile = join(agentsDir, `${agentId}.json`);
      await writeFile(agentFile, JSON.stringify(agentInfo, null, 2));

      // Emit session and agent to renderer so they show up immediately
      const windows = BrowserWindow.getAllWindows();
      console.log(`[AgentInstanceService] Emitting session to ${windows.length} windows:`, sessionReport.sessionId);
      for (const win of windows) {
        win.webContents.send('session:reported', sessionReport);
        win.webContents.send('agent:registered', {
          ...agentInfo,
          lastHeartbeat: now,
          isAlive: true,
        });
      }

      console.log(`[AgentInstanceService] Created session file: ${sessionFile}`);
    } catch (error) {
      console.warn(`[AgentInstanceService] Could not create session file: ${error}`);
      // Don't fail the whole operation if session file creation fails
    }
  }

  /**
   * Create branch if it doesn't exist
   */
  private async createBranchIfNeeded(config: AgentInstanceConfig): Promise<void> {
    try {
      const { execa } = await import('execa');

      // Check if branch exists
      const branchResult = await execa('git', ['branch', '--list', config.branchName], { cwd: config.repoPath });

      if (!branchResult.stdout.trim()) {
        // Branch doesn't exist, create it
        await execa('git', ['checkout', '-b', config.branchName, config.baseBranch], { cwd: config.repoPath });
        console.log(`[AgentInstanceService] Created branch ${config.branchName} from ${config.baseBranch}`);

        // Switch back to original branch
        await execa('git', ['checkout', '-'], { cwd: config.repoPath });
      }
    } catch (error) {
      console.warn(`[AgentInstanceService] Could not create branch: ${error}`);
      // Don't fail the whole operation if branch creation fails
    }
  }

  /**
   * Get instructions for a specific agent type
   */
  getInstructions(agentType: AgentType, config: AgentInstanceConfig): IpcResult<string> {
    const vars: InstructionVars = {
      repoPath: config.repoPath,
      repoName: basename(config.repoPath),
      branchName: config.branchName,
      sessionId: `sess_${Date.now()}`,
      taskDescription: config.taskDescription,
    };

    return {
      success: true,
      data: getAgentInstructions(agentType, vars),
    };
  }

  /**
   * Launch DevOps Agent for an instance
   */
  async launchAgent(instanceId: string): Promise<IpcResult<void>> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Instance not found',
        },
      };
    }

    // DevOps Agent launch not yet implemented
    // This would spawn the CLI agent process
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Direct agent launch not yet implemented',
      },
    };
  }

  /**
   * List all instances
   */
  listInstances(): IpcResult<AgentInstance[]> {
    return {
      success: true,
      data: Array.from(this.instances.values()),
    };
  }

  /**
   * Get a specific instance
   */
  getInstance(instanceId: string): IpcResult<AgentInstance | null> {
    return {
      success: true,
      data: this.instances.get(instanceId) || null,
    };
  }

  /**
   * Delete an instance
   */
  deleteInstance(instanceId: string): IpcResult<void> {
    const deleted = this.instances.delete(instanceId);
    if (deleted) {
      this.saveInstances();
      // Notify renderer to remove the session
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send('instance:deleted', instanceId);
      }
    }
    return { success: true };
  }

  /**
   * Restart an instance - reinitializes repo, creates new session with same config
   */
  async restartInstance(sessionId: string): Promise<IpcResult<AgentInstance>> {
    try {
      // Find instance by sessionId
      let targetInstance: AgentInstance | undefined;
      for (const instance of this.instances.values()) {
        if (instance.sessionId === sessionId) {
          targetInstance = instance;
          break;
        }
      }

      if (!targetInstance) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Instance with session ${sessionId} not found`,
          },
        };
      }

      const config = targetInstance.config;
      const oldInstanceId = targetInstance.id;

      console.log(`[AgentInstanceService] Restarting session ${sessionId} in ${config.repoPath}`);

      // Clean up old session files from .S9N_KIT_DevOpsAgent
      await this.cleanupSessionFiles(config.repoPath, sessionId);

      // Delete old instance
      this.instances.delete(oldInstanceId);

      // Re-initialize the .S9N_KIT_DevOpsAgent directory (ensures structure is correct)
      const initResult = await this.initializeKanvasDirectory(config.repoPath);
      if (!initResult.success) {
        return {
          success: false,
          error: initResult.error || { code: 'INIT_ERROR', message: 'Failed to reinitialize directory' },
        };
      }

      // Create new instance with same config (this generates new session ID)
      const newInstance = await this.createInstance(config);

      if (newInstance.success && newInstance.data) {
        // Notify renderer of the restart (old session removed, new one added)
        const windows = BrowserWindow.getAllWindows();
        for (const win of windows) {
          win.webContents.send('session:closed', sessionId);
        }

        console.log(`[AgentInstanceService] Session restarted: ${sessionId} -> ${newInstance.data.sessionId}`);
      }

      return newInstance;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESTART_ERROR',
          message: error instanceof Error ? error.message : 'Failed to restart instance',
        },
      };
    }
  }

  /**
   * Clean up session files from .S9N_KIT_DevOpsAgent directory
   */
  private async cleanupSessionFiles(repoPath: string, sessionId: string): Promise<void> {
    const { unlink } = await import('fs/promises');
    const shortSessionId = sessionId.replace('sess_', '').slice(0, 8);

    // Files to clean up
    const filesToRemove = [
      // Session file
      join(repoPath, KANVAS_PATHS.sessions, `${sessionId}.json`),
      // Activity log
      join(repoPath, KANVAS_PATHS.activity, `${sessionId}.log`),
      // Command file
      join(repoPath, KANVAS_PATHS.commands, `${sessionId}.cmd`),
      // Commit message file
      join(repoPath, `.devops-commit-${shortSessionId}.msg`),
    ];

    // Also clean up any active edit declarations for this session
    const activeEditsDir = join(repoPath, FILE_COORDINATION_PATHS.activeEdits);
    if (existsSync(activeEditsDir)) {
      try {
        const editFiles = await readdir(activeEditsDir);
        for (const file of editFiles) {
          if (file.includes(shortSessionId)) {
            filesToRemove.push(join(activeEditsDir, file));
          }
        }
      } catch {
        // Ignore errors reading active edits
      }
    }

    // Remove files
    for (const filePath of filesToRemove) {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
          console.log(`[AgentInstanceService] Cleaned up: ${filePath}`);
        }
      } catch (error) {
        console.warn(`[AgentInstanceService] Could not remove ${filePath}:`, error);
      }
    }
  }

  /**
   * Clear all instances and sessions
   */
  clearAllInstances(): IpcResult<{ count: number }> {
    const count = this.instances.size;
    this.instances.clear();
    this.store.set('instances', []);

    // Notify renderer to clear all sessions
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('instances:cleared');
    }

    console.log(`[AgentInstanceService] Cleared ${count} instances`);
    return { success: true, data: { count } };
  }

  /**
   * Update instance status
   */
  updateInstanceStatus(instanceId: string, status: AgentInstance['status'], error?: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      if (error) {
        instance.error = error;
      }
      this.saveInstances();
      this.emitStatusChange(instance);
    }
  }

  // Recent repos management

  async getRecentRepos(): Promise<IpcResult<RecentRepo[]>> {
    return {
      success: true,
      data: this.store.get('recentRepos', []),
    };
  }

  async addRecentRepo(repo: RecentRepo): Promise<IpcResult<void>> {
    const repos = this.store.get('recentRepos', []);

    // Update existing or add new
    const existingIndex = repos.findIndex(r => r.path === repo.path);
    if (existingIndex >= 0) {
      repos[existingIndex] = {
        ...repos[existingIndex],
        lastUsed: repo.lastUsed,
        agentCount: repos[existingIndex].agentCount + 1,
      };
    } else {
      repos.unshift(repo);
    }

    // Keep only last 10
    const trimmed = repos.slice(0, 10);
    this.store.set('recentRepos', trimmed);

    return { success: true };
  }

  async removeRecentRepo(path: string): Promise<IpcResult<void>> {
    const repos = this.store.get('recentRepos', []);
    const filtered = repos.filter(r => r.path !== path);
    this.store.set('recentRepos', filtered);
    return { success: true };
  }

  // Private helpers

  private saveInstances(): void {
    this.store.set('instances', Array.from(this.instances.values()));
  }

  private emitStatusChange(instance: AgentInstance): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('instance:status-changed', instance);
    }
  }

  /**
   * Emit all stored sessions to renderer on app startup
   * This ensures sessions persist across app restarts
   */
  emitStoredSessions(): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length === 0) {
      console.log('[AgentInstanceService] No windows available to emit sessions');
      return;
    }

    const instances = Array.from(this.instances.values());
    console.log(`[AgentInstanceService] Emitting ${instances.length} stored sessions to renderer`);

    for (const instance of instances) {
      if (!instance.sessionId) continue;

      const shortSessionId = instance.sessionId.replace('sess_', '').slice(0, 8);
      const agentId = `kanvas-${instance.config.agentType}-${shortSessionId}`;
      const now = new Date().toISOString();

      // Create session report from instance
      const sessionReport = {
        sessionId: instance.sessionId,
        agentId,
        agentType: instance.config.agentType,
        task: instance.config.taskDescription || instance.config.branchName || `${instance.config.agentType} session`,
        branchName: instance.config.branchName,
        worktreePath: instance.config.repoPath,
        repoPath: instance.config.repoPath,
        status: instance.status === 'running' ? 'active' as const : 'idle' as const,
        created: instance.createdAt,
        updated: now,
        commitCount: 0,
      };

      // Create agent info
      const agentInfo = {
        agentId,
        agentType: instance.config.agentType,
        agentName: `${instance.config.agentType.charAt(0).toUpperCase()}${instance.config.agentType.slice(1)} (${basename(instance.config.repoPath)})`,
        version: '1.0.0',
        pid: process.pid,
        startedAt: instance.createdAt,
        repoPath: instance.config.repoPath,
        capabilities: ['code-generation', 'file-editing'],
        sessions: [instance.sessionId],
        lastHeartbeat: now,
        isAlive: instance.status === 'running',
      };

      // Emit to all windows
      for (const win of windows) {
        win.webContents.send('session:reported', sessionReport);
        win.webContents.send('agent:registered', agentInfo);
      }
    }
  }
}

export const agentInstanceService = new AgentInstanceService();
