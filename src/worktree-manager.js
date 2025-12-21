#!/usr/bin/env node

/**
 * ============================================================================
 * WORKTREE MANAGER FOR MULTI-AGENT DEVELOPMENT
 * ============================================================================
 * 
 * This module manages Git worktrees to enable multiple AI agents to work
 * on the same codebase simultaneously without conflicts.
 * 
 * Key Features:
 * - Creates isolated worktrees for each AI agent
 * - Manages agent-specific branches
 * - Coordinates merges between agent work
 * - Prevents conflicts through branch isolation
 * 
 * Usage:
 *   node worktree-manager.js create --agent claude --task feature-x
 *   node worktree-manager.js list
 *   node worktree-manager.js merge --agent claude
 *   node worktree-manager.js cleanup --agent claude
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Base directory for worktrees (relative to main repo)
  worktreesDir: '.worktrees',
  
  // Agent naming patterns
  agentPrefix: 'agent',
  
  // Branch naming patterns
  branchPatterns: {
    agent: 'agent/${agentName}/${taskName}',
    daily: 'agent/${agentName}/daily/${date}',
    feature: 'agent/${agentName}/feature/${feature}'
  },
  
  // Supported AI agents
  knownAgents: ['claude', 'copilot', 'cursor', 'aider', 'custom'],
  
  // Colors for console output
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const log = {
  info: (msg) => console.log(`${CONFIG.colors.blue}ℹ${CONFIG.colors.reset} ${msg}`),
  success: (msg) => console.log(`${CONFIG.colors.green}✓${CONFIG.colors.reset} ${msg}`),
  warn: (msg) => console.log(`${CONFIG.colors.yellow}⚠${CONFIG.colors.reset} ${msg}`),
  error: (msg) => console.log(`${CONFIG.colors.red}✗${CONFIG.colors.reset} ${msg}`),
  agent: (agent, msg) => console.log(`${CONFIG.colors.magenta}[${agent}]${CONFIG.colors.reset} ${msg}`),
  header: (msg) => {
    console.log(`\n${CONFIG.colors.bright}${CONFIG.colors.blue}${'='.repeat(60)}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.bright}${msg}${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.bright}${CONFIG.colors.blue}${'='.repeat(60)}${CONFIG.colors.reset}\n`);
  }
};

/**
 * Execute a shell command and return the output
 */
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if we're in a git repository
 */
function checkGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 */
function getRepoRoot() {
  return execCommand('git rev-parse --show-toplevel', { silent: true });
}

/**
 * Get current branch name
 */
function getCurrentBranch() {
  return execCommand('git branch --show-current', { silent: true });
}

/**
 * Create a directory if it doesn't exist
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Format date as YYYY-MM-DD
 */
function getDateString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Generate branch name based on pattern
 */
function generateBranchName(pattern, vars) {
  let branch = pattern;
  for (const [key, value] of Object.entries(vars)) {
    branch = branch.replace(`\${${key}}`, value);
  }
  return branch;
}

// ============================================================================
// WORKTREE MANAGEMENT CLASS
// ============================================================================

class WorktreeManager {
  constructor() {
    this.repoRoot = getRepoRoot();
    this.worktreesPath = path.join(this.repoRoot, CONFIG.worktreesDir);
    this.configFile = path.join(this.worktreesPath, 'agents.json');
    this.loadConfig();
  }

  /**
   * Load or initialize agent configuration
   */
  loadConfig() {
    ensureDir(this.worktreesPath);
    
    if (fs.existsSync(this.configFile)) {
      const data = fs.readFileSync(this.configFile, 'utf8');
      this.agents = JSON.parse(data);
    } else {
      this.agents = {};
      this.saveConfig();
    }
  }

  /**
   * Save agent configuration
   */
  saveConfig() {
    fs.writeFileSync(this.configFile, JSON.stringify(this.agents, null, 2));
  }

  /**
   * Create a new worktree for an AI agent
   */
  createWorktree(agentName, taskName, options = {}) {
    log.header(`Creating Worktree for Agent: ${agentName}`);
    
    // Validate agent name
    if (!agentName || agentName.length < 2) {
      throw new Error('Agent name must be at least 2 characters');
    }
    
    // Generate paths and names
    const worktreeName = `${agentName}-${taskName || getDateString()}`;
    const worktreePath = path.join(this.worktreesPath, worktreeName);
    const branchName = generateBranchName(
      options.branchPattern || CONFIG.branchPatterns.agent,
      {
        agentName,
        taskName: taskName || 'main',
        date: getDateString(),
        feature: options.feature || taskName
      }
    );
    
    // Check if worktree already exists
    if (fs.existsSync(worktreePath)) {
      log.warn(`Worktree already exists at: ${worktreePath}`);
      return { path: worktreePath, branch: branchName, exists: true };
    }
    
    // Create the worktree
    log.info(`Creating worktree at: ${worktreePath}`);
    log.info(`Branch: ${branchName}`);
    
    try {
      // Create new branch and worktree
      execCommand(`git worktree add -b ${branchName} "${worktreePath}" HEAD`, { silent: false });
      
      // Update agent configuration
      this.agents[agentName] = {
        name: agentName,
        worktrees: [
          ...(this.agents[agentName]?.worktrees || []),
          {
            name: worktreeName,
            path: worktreePath,
            branch: branchName,
            task: taskName,
            created: new Date().toISOString(),
            status: 'active'
          }
        ]
      };
      
      this.saveConfig();
      
      // Setup agent-specific configuration
      this.setupAgentConfig(agentName, worktreePath, options);
      
      log.success(`Worktree created successfully!`);
      log.info(`Agent ${agentName} can now work in: ${worktreePath}`);
      
      return { path: worktreePath, branch: branchName, exists: false };
      
    } catch (error) {
      log.error(`Failed to create worktree: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup agent-specific configuration in the worktree
   */
  setupAgentConfig(agentName, worktreePath, options) {
    log.info('Setting up agent-specific configuration...');
    
    // Create .agent-config file
    const agentConfig = {
      agent: agentName,
      worktree: path.basename(worktreePath),
      created: new Date().toISOString(),
      task: options.task || 'general',
      autoCommit: {
        enabled: true,
        prefix: `agent_${agentName}_`,
        messagePrefix: `[${agentName.toUpperCase()}]`,
        pushOnCommit: options.autoPush !== false
      }
    };
    
    fs.writeFileSync(
      path.join(worktreePath, '.agent-config'),
      JSON.stringify(agentConfig, null, 2)
    );
    
    // Create agent-specific commit message file
    fs.writeFileSync(
      path.join(worktreePath, `.${agentName}-commit-msg`),
      ''
    );
    
    // Create agent-specific VS Code settings
    const vscodeDir = path.join(worktreePath, '.vscode');
    ensureDir(vscodeDir);
    
    const settings = {
      'window.title': `${agentName.toUpperCase()} - ${options.task || 'Workspace'}`,
      'terminal.integrated.env.osx': {
        'AGENT_NAME': agentName,
        'AGENT_WORKTREE': path.basename(worktreePath),
        'AC_BRANCH_PREFIX': `agent_${agentName}_`,
        'AC_MSG_FILE': `.${agentName}-commit-msg`
      }
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
    
    log.success('Agent configuration created');
  }

  /**
   * List all worktrees and their agents
   */
  listWorktrees() {
    log.header('Active Worktrees');
    
    // Get git worktree list
    const worktrees = execCommand('git worktree list --porcelain', { silent: true })
      .split('\n\n')
      .filter(w => w)
      .map(w => {
        const lines = w.split('\n');
        const worktreePath = lines[0].replace('worktree ', '');
        const branch = lines[2]?.replace('branch refs/heads/', '') || 'detached';
        return { path: worktreePath, branch };
      });
    
    // Display main repository
    const mainWorktree = worktrees.find(w => w.path === this.repoRoot);
    if (mainWorktree) {
      console.log(`${CONFIG.colors.bright}Main Repository:${CONFIG.colors.reset}`);
      console.log(`  Path: ${mainWorktree.path}`);
      console.log(`  Branch: ${mainWorktree.branch}`);
      console.log('');
    }
    
    // Display agent worktrees
    console.log(`${CONFIG.colors.bright}Agent Worktrees:${CONFIG.colors.reset}`);
    
    let agentWorktreeCount = 0;
    for (const [agentName, agentData] of Object.entries(this.agents)) {
      const activeWorktrees = (agentData.worktrees || []).filter(w => w.status === 'active');
      
      if (activeWorktrees.length > 0) {
        console.log(`\n${CONFIG.colors.magenta}[${agentName}]${CONFIG.colors.reset}`);
        
        for (const wt of activeWorktrees) {
          const exists = fs.existsSync(wt.path);
          const status = exists ? CONFIG.colors.green + '✓' : CONFIG.colors.red + '✗';
          
          console.log(`  ${status}${CONFIG.colors.reset} ${wt.name}`);
          console.log(`     Branch: ${wt.branch}`);
          console.log(`     Task: ${wt.task || 'N/A'}`);
          console.log(`     Created: ${new Date(wt.created).toLocaleDateString()}`);
          
          if (!exists) {
            console.log(`     ${CONFIG.colors.yellow}(Worktree missing - may need cleanup)${CONFIG.colors.reset}`);
          }
          
          agentWorktreeCount++;
        }
      }
    }
    
    if (agentWorktreeCount === 0) {
      console.log('  No agent worktrees found');
    }
    
    console.log(`\nTotal worktrees: ${worktrees.length}`);
  }

  /**
   * Merge agent's work back to main branch
   */
  async mergeAgentWork(agentName, options = {}) {
    log.header(`Merging ${agentName}'s Work`);
    
    const agentData = this.agents[agentName];
    if (!agentData) {
      log.error(`No worktrees found for agent: ${agentName}`);
      return;
    }
    
    const activeWorktrees = (agentData.worktrees || []).filter(w => w.status === 'active');
    if (activeWorktrees.length === 0) {
      log.warn(`No active worktrees for agent: ${agentName}`);
      return;
    }
    
    // Let user select which worktree to merge
    console.log('Select worktree to merge:');
    activeWorktrees.forEach((wt, idx) => {
      console.log(`  ${idx + 1}. ${wt.name} (${wt.branch})`);
    });
    
    const selection = await this.promptUser('Enter number: ');
    const selectedIdx = parseInt(selection) - 1;
    
    if (selectedIdx < 0 || selectedIdx >= activeWorktrees.length) {
      log.error('Invalid selection');
      return;
    }
    
    const worktree = activeWorktrees[selectedIdx];
    const targetBranch = options.target || 'main';
    
    log.info(`Merging ${worktree.branch} into ${targetBranch}...`);
    
    try {
      // Save current branch
      const currentBranch = getCurrentBranch();
      
      // Checkout target branch
      execCommand(`git checkout ${targetBranch}`);
      
      // Merge agent's branch
      const mergeMessage = `Merge ${agentName}'s work: ${worktree.task || 'updates'}`;
      execCommand(`git merge ${worktree.branch} -m "${mergeMessage}"`);
      
      log.success(`Successfully merged ${worktree.branch} into ${targetBranch}`);
      
      // Ask if should delete the branch
      const shouldDelete = await this.promptUser('Delete merged branch? (y/n): ');
      if (shouldDelete.toLowerCase() === 'y') {
        execCommand(`git branch -d ${worktree.branch}`);
        worktree.status = 'merged';
        this.saveConfig();
        log.success('Branch deleted');
      }
      
      // Return to original branch
      if (currentBranch) {
        execCommand(`git checkout ${currentBranch}`);
      }
      
    } catch (error) {
      log.error(`Merge failed: ${error.message}`);
      log.info('You may need to resolve conflicts manually');
    }
  }

  /**
   * Clean up worktrees for an agent
   */
  async cleanupWorktrees(agentName, options = {}) {
    log.header(`Cleaning Up ${agentName}'s Worktrees`);
    
    const agentData = this.agents[agentName];
    if (!agentData) {
      log.warn(`No worktrees found for agent: ${agentName}`);
      return;
    }
    
    const worktrees = agentData.worktrees || [];
    let cleaned = 0;
    
    for (const wt of worktrees) {
      const exists = fs.existsSync(wt.path);
      
      if (!exists && !options.force) {
        log.info(`Worktree already removed: ${wt.name}`);
        wt.status = 'removed';
        cleaned++;
        continue;
      }
      
      if (options.all || wt.status === 'merged' || !exists) {
        try {
          // Remove worktree
          if (exists) {
            log.info(`Removing worktree: ${wt.name}`);
            execCommand(`git worktree remove "${wt.path}" --force`);
          }
          
          // Delete branch if requested
          if (options.deleteBranches) {
            execCommand(`git branch -D ${wt.branch}`, { ignoreError: true });
            log.info(`Deleted branch: ${wt.branch}`);
          }
          
          wt.status = 'removed';
          cleaned++;
          
        } catch (error) {
          log.error(`Failed to remove ${wt.name}: ${error.message}`);
        }
      }
    }
    
    // Clean up agent data if all worktrees removed
    if (worktrees.every(wt => wt.status === 'removed')) {
      delete this.agents[agentName];
      log.info(`Removed agent configuration for: ${agentName}`);
    }
    
    this.saveConfig();
    log.success(`Cleaned up ${cleaned} worktree(s)`);
  }

  /**
   * Run cs-devops-agent worker in a specific worktree
   */
  runCS_DevOpsAgent(agentName, worktreeName) {
    const agentData = this.agents[agentName];
    if (!agentData) {
      log.error(`Agent not found: ${agentName}`);
      return;
    }
    
    const worktree = agentData.worktrees.find(w => w.name === worktreeName);
    if (!worktree) {
      log.error(`Worktree not found: ${worktreeName}`);
      return;
    }
    
    log.header(`Starting DevOps Agent for ${agentName}`);
    log.info(`Worktree: ${worktree.path}`);
    log.info(`Branch: ${worktree.branch}`);
    
    // Set up environment variables
    const env = {
      ...process.env,
      AGENT_NAME: agentName,
      AGENT_WORKTREE: worktreeName,
      AC_BRANCH_PREFIX: `agent_${agentName}_`,
      AC_MSG_FILE: `.${agentName}-commit-msg`,
      AC_WORKING_DIR: worktree.path
    };
    
    // Start cs-devops-agent worker
    const autoCommitPath = path.join(this.repoRoot, 'cs-devops-agent-worker.js');
    const child = spawn('node', [autoCommitPath], {
      cwd: worktree.path,
      env,
      stdio: 'inherit'
    });
    
    child.on('exit', (code) => {
      log.info(`Auto-commit worker exited with code: ${code}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log.info('Stopping cs-devops-agent worker...');
      child.kill('SIGINT');
      process.exit(0);
    });
  }

  /**
   * Prompt user for input
   */
  promptUser(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  /**
   * Create parallel workspace for multiple agents
   */
  async createParallelWorkspace(agents, task) {
    log.header('Creating Parallel Workspace for Multiple Agents');
    
    const workspace = {
      id: `parallel-${Date.now()}`,
      task,
      agents: [],
      created: new Date().toISOString()
    };
    
    for (const agent of agents) {
      log.info(`Setting up workspace for: ${agent}`);
      
      const result = this.createWorktree(agent, task, {
        feature: task,
        autoPush: false
      });
      
      workspace.agents.push({
        name: agent,
        ...result
      });
    }
    
    // Save workspace configuration
    const workspaceFile = path.join(this.worktreesPath, 'workspaces.json');
    let workspaces = {};
    
    if (fs.existsSync(workspaceFile)) {
      workspaces = JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
    }
    
    workspaces[workspace.id] = workspace;
    fs.writeFileSync(workspaceFile, JSON.stringify(workspaces, null, 2));
    
    log.success(`Parallel workspace created: ${workspace.id}`);
    log.info(`Agents ready: ${agents.join(', ')}`);
    
    return workspace;
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!checkGitRepo()) {
    log.error('Not in a git repository!');
    process.exit(1);
  }
  
  const manager = new WorktreeManager();
  
  switch (command) {
    case 'create': {
      const agentIdx = args.indexOf('--agent');
      const taskIdx = args.indexOf('--task');
      
      if (agentIdx === -1 || !args[agentIdx + 1]) {
        log.error('Usage: worktree-manager create --agent <name> --task <task>');
        process.exit(1);
      }
      
      const agentName = args[agentIdx + 1];
      const taskName = taskIdx !== -1 ? args[taskIdx + 1] : null;
      
      manager.createWorktree(agentName, taskName);
      break;
    }
    
    case 'list': {
      manager.listWorktrees();
      break;
    }
    
    case 'merge': {
      const agentIdx = args.indexOf('--agent');
      
      if (agentIdx === -1 || !args[agentIdx + 1]) {
        log.error('Usage: worktree-manager merge --agent <name>');
        process.exit(1);
      }
      
      const agentName = args[agentIdx + 1];
      await manager.mergeAgentWork(agentName);
      break;
    }
    
    case 'cleanup': {
      const agentIdx = args.indexOf('--agent');
      
      if (agentIdx === -1 || !args[agentIdx + 1]) {
        log.error('Usage: worktree-manager cleanup --agent <name> [--all] [--delete-branches]');
        process.exit(1);
      }
      
      const agentName = args[agentIdx + 1];
      const options = {
        all: args.includes('--all'),
        deleteBranches: args.includes('--delete-branches'),
        force: args.includes('--force')
      };
      
      await manager.cleanupWorktrees(agentName, options);
      break;
    }
    
    case 'cs-devops-agent': {
      const agentIdx = args.indexOf('--agent');
      const worktreeIdx = args.indexOf('--worktree');
      
      if (agentIdx === -1 || !args[agentIdx + 1] || worktreeIdx === -1 || !args[worktreeIdx + 1]) {
        log.error('Usage: worktree-manager cs-devops-agent --agent <name> --worktree <name>');
        process.exit(1);
      }
      
      const agentName = args[agentIdx + 1];
      const worktreeName = args[worktreeIdx + 1];
      
      manager.runCS_DevOpsAgent(agentName, worktreeName);
      break;
    }
    
    case 'parallel': {
      const agentsIdx = args.indexOf('--agents');
      const taskIdx = args.indexOf('--task');
      
      if (agentsIdx === -1 || taskIdx === -1) {
        log.error('Usage: worktree-manager parallel --agents agent1,agent2,agent3 --task <task>');
        process.exit(1);
      }
      
      const agents = args[agentsIdx + 1].split(',');
      const task = args[taskIdx + 1];
      
      await manager.createParallelWorkspace(agents, task);
      break;
    }
    
    default: {
      console.log(`
${CONFIG.colors.bright}Worktree Manager - Multi-Agent Development System${CONFIG.colors.reset}

Commands:
  create    Create a new worktree for an AI agent
            worktree-manager create --agent <name> --task <task>
            
  list      List all active worktrees and agents
            worktree-manager list
            
  merge     Merge an agent's work back to main
            worktree-manager merge --agent <name>
            
  cleanup   Clean up worktrees for an agent
            worktree-manager cleanup --agent <name> [--all] [--delete-branches]
            
  cs-devops-agent  Run cs-devops-agent in an agent's worktree
            worktree-manager cs-devops-agent --agent <name> --worktree <name>
            
  parallel  Create parallel workspace for multiple agents
            worktree-manager parallel --agents agent1,agent2 --task <task>

Examples:
  # Create worktree for Claude to work on authentication
  worktree-manager create --agent claude --task auth-feature
  
  # Create parallel workspace for 3 agents
  worktree-manager parallel --agents claude,copilot,cursor --task refactor-api
  
  # List all worktrees
  worktree-manager list
  
  # Merge Claude's work
  worktree-manager merge --agent claude
  
  # Clean up merged worktrees
  worktree-manager cleanup --agent claude --delete-branches
      `);
    }
  }
}

// Run if called directly
const isMainModule = process.argv[1] === __filename;
if (isMainModule) {
  main().catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export default WorktreeManager;