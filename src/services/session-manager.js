import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class SessionManager {
  constructor(repoRoot, configService, gitService) {
    this.repoRoot = repoRoot;
    this.configService = configService;
    this.gitService = gitService;
    
    // Config constants
    this.sessionsDir = 'local_deploy/sessions';
    this.locksDir = 'local_deploy/session-locks';
    this.worktreesDir = 'local_deploy/worktrees';
    this.instructionsDir = 'local_deploy/instructions';
    
    this.sessionsPath = path.join(this.repoRoot, this.sessionsDir);
    this.locksPath = path.join(this.repoRoot, this.locksDir);
    this.worktreesPath = path.join(this.repoRoot, this.worktreesDir);
    this.instructionsPath = path.join(this.repoRoot, this.instructionsDir);
    
    this.ensureDirectories();
    this.cleanupStaleLocks();
  }

  ensureDirectories() {
    [this.sessionsPath, this.locksPath, this.worktreesPath, this.instructionsPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Ensure file-coordination directory
    const fileCoordinationDir = path.join(this.repoRoot, 'local_deploy', '.file-coordination');
    const activeEditsDir = path.join(fileCoordinationDir, 'active-edits');
    const completedEditsDir = path.join(fileCoordinationDir, 'completed-edits');
    
    [fileCoordinationDir, activeEditsDir, completedEditsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  cleanupStaleLocks() {
    // Clean up locks older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    
    if (fs.existsSync(this.locksPath)) {
      const locks = fs.readdirSync(this.locksPath);
      locks.forEach(lockFile => {
        const lockPath = path.join(this.locksPath, lockFile);
        const stats = fs.statSync(lockPath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(lockPath);
        }
      });
    }
  }

  generateSessionId() {
    const timestamp = Date.now().toString(36).slice(-4);
    const random = crypto.randomBytes(2).toString('hex');
    return `${timestamp}-${random}`;
  }

  createSession(options, devInitials) {
     const sessionId = this.generateSessionId();
     const task = options.task || 'development';
     const agentType = options.agent || 'claude';
     
     // Create worktree name/path
     const worktreeName = `${devInitials}-${agentType}-${sessionId}-${task.replace(/\s+/g, '-')}`;
     const worktreePath = path.join(this.worktreesPath, worktreeName);
     const branchName = `${devInitials}/${agentType}/${sessionId}/${task.replace(/\s+/g, '-')}`;

     // Git operations
     this.gitService.createWorktree(branchName, worktreePath);
     
     // Submodule logic handled by GitService or skipped for MVP
     if (this.gitService.isSubmodule()) {
         // TODO: Implement submodule remote configuration using GitService
     }
     
     const lockData = {
        sessionId,
        agentType,
        task,
        worktreePath,
        branchName,
        created: new Date().toISOString(),
        status: 'active',
        pid: process.pid,
        developerInitials: devInitials,
        mergeConfig: options.mergeConfig,
        dockerConfig: options.dockerConfig
     };

     this.saveLock(sessionId, lockData);
     const instructions = this.generateClaudeInstructions(lockData);
     this.saveInstructions(sessionId, instructions.markdown);
     this.createWorktreeConfig(worktreePath, lockData);
     
     // Store instructions in lockData return
     lockData.instructions = instructions;
     
     return {
        sessionId,
        worktreePath,
        branchName,
        lockFile: path.join(this.locksPath, `${sessionId}.lock`),
        instructionsFile: path.join(this.instructionsPath, `${sessionId}.md`),
        task,
        instructions
     };
  }

  saveLock(sessionId, data) {
      fs.writeFileSync(path.join(this.locksPath, `${sessionId}.lock`), JSON.stringify(data, null, 2));
  }
  
  saveInstructions(sessionId, markdown) {
      fs.writeFileSync(path.join(this.instructionsPath, `${sessionId}.md`), markdown);
  }
  
  createWorktreeConfig(worktreePath, sessionData) {
    // Session config file
    const configPath = path.join(worktreePath, '.devops-session.json');
    fs.writeFileSync(configPath, JSON.stringify(sessionData, null, 2));
    
    // Commit message file
    const msgFile = path.join(worktreePath, `.devops-commit-${sessionData.sessionId}.msg`);
    fs.writeFileSync(msgFile, '');
    
    // VS Code settings
    const vscodeDir = path.join(worktreePath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      fs.mkdirSync(vscodeDir, { recursive: true });
    }
    
    const settings = {
      'window.title': `${sessionData.agentType.toUpperCase()} Session ${sessionData.sessionId} - ${sessionData.task}`,
      'terminal.integrated.env.osx': {
        'DEVOPS_SESSION_ID': sessionData.sessionId,
        'DEVOPS_WORKTREE': path.basename(worktreePath),
        'DEVOPS_BRANCH': sessionData.branchName,
        'AC_MSG_FILE': `.devops-commit-${sessionData.sessionId}.msg`,
        'AC_BRANCH_PREFIX': `${sessionData.developerInitials || 'dev'}_${sessionData.agentType}_${sessionData.sessionId}_`
      }
    };
    
    fs.writeFileSync(
      path.join(vscodeDir, 'settings.json'),
      JSON.stringify(settings, null, 2)
    );
    
    // README
    const readme = `# DevOps Session: ${sessionData.sessionId}\n\n## Task\n${sessionData.task}\n\n## Session Details\n- **Session ID:** ${sessionData.sessionId}\n- **Branch:** ${sessionData.branchName}\n- **Created:** ${sessionData.created}\n- **Agent Type:** ${sessionData.agentType}\n`;
    fs.writeFileSync(path.join(worktreePath, 'SESSION_README.md'), readme);
    
    // Gitignore
    const gitignorePath = path.join(worktreePath, '.gitignore');
    let gitignoreContent = '';
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    const sessionPatterns = [
      '# DevOps session management files',
      '.devops-commit-*.msg',
      '.devops-session.json', 
      'SESSION_README.md',
      '.session-cleanup-requested',
      '.worktree-session',
      '.agent-config',
      '.session-*',
      '.devops-command-*'
    ];
    
    let needsUpdate = false;
    for (const pattern of sessionPatterns) {
      if (!gitignoreContent.includes(pattern)) {
        needsUpdate = true;
        break;
      }
    }
    
    if (needsUpdate) {
      if (!gitignoreContent.endsWith('\n') && gitignoreContent.length > 0) {
        gitignoreContent += '\n';
      }
      gitignoreContent += '\n' + sessionPatterns.join('\n') + '\n';
      fs.writeFileSync(gitignorePath, gitignoreContent);
    }
  }
  
  generateClaudeInstructions(sessionData) {
    const { sessionId, worktreePath, branchName, task } = sessionData;
    
    const plaintext = `\nSESSION_ID: ${sessionId}\nWORKTREE: ${worktreePath}\nBRANCH: ${branchName}\nTASK: ${task}\n\nINSTRUCTIONS:\n1. Change to worktree directory: cd "${worktreePath}"\n2. Verify branch: git branch --show-current\n3. Make your changes for: ${task}\n4. Write commit message to: .devops-commit-${sessionId}.msg\n5. The DevOps agent will auto-commit and push your changes\n`;

    const markdown = `# DevOps Session Instructions\n\n## Session Information\n- **Session ID:** \`${sessionId}\`\n- **Task:** ${task}\n- **Worktree Path:** \`${worktreePath}\`\n- **Branch:** \`${branchName}\`\n\n## 🚨 CRITICAL: File Coordination Protocol\n\n**BEFORE editing any files, you MUST:**\n\n1. **Declare your intent** by creating:\n   \`\`\`json\n   // File: ${path.join(this.repoRoot, 'local_deploy/.file-coordination/active-edits')}/<agent>-${sessionId}.json\n   {\n     "agent": "<your-name>",\n     "session": "${sessionId}",\n     "files": ["list", "files", "to", "edit"],\n     "operation": "edit",\n     "reason": "${task}",\n     "declaredAt": "<ISO-8601-timestamp>",\n     "estimatedDuration": 300\n   }\n   \`\`\`\n`;

    const shellCommand = `cd "${worktreePath}" && echo "Session ${sessionId} ready"`;

    return {
      plaintext,
      markdown,
      shellCommand,
      worktreePath,
      sessionId
    };
  }

  getActiveSessions() {
      if (!fs.existsSync(this.locksPath)) return [];
      return fs.readdirSync(this.locksPath)
        .filter(f => f.endsWith('.lock'))
        .map(f => JSON.parse(fs.readFileSync(path.join(this.locksPath, f), 'utf8')));
  }

  getSession(sessionId) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    if (!fs.existsSync(lockFile)) return null;
    return JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  }
  
  updateSession(sessionId, data) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    fs.writeFileSync(lockFile, JSON.stringify(data, null, 2));
  }

  removeSessionLock(sessionId) {
    const lockFile = path.join(this.locksPath, `${sessionId}.lock`);
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }
}
