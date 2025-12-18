#!/usr/bin/env node

/**
 * ============================================================================
 * DEVOPS-AGENT SETUP WIZARD (v2.0)
 * ============================================================================
 * 
 * Enhanced setup experience with explanations and auto-detection.
 * 
 * What this does:
 * - Configures your developer environment
 * - Sets up git automation
 * - Creates VS Code integration
 * - Installs required dependencies
 * 
 * Why it matters:
 * - One-time setup for smooth development
 * - Personalized configuration
 * - Ready-to-use AI agent integration
 * 
 * Usage: s9n-devops-agent setup
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  colors,
  status,
  showWelcome,
  sectionTitle,
  explain,
  tip,
  warn,
  info,
  success,
  error as errorMsg,
  confirm,
  prompt as uiPrompt,
  progressStep,
  drawSection
} from './ui-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Backward compatibility log functions
const log = {
  info: (msg) => info(msg),
  success: (msg) => success(msg),
  warn: (msg) => warn(msg),
  error: (msg) => errorMsg(msg),
  header: () => console.log('\n' + '━'.repeat(70) + '\n'),
  title: (msg) => sectionTitle(msg),
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findProjectRoot() {
  let currentDir = process.cwd();
  
  // Look for .git directory to find project root
  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, '.git'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Fallback to current directory
  return process.cwd();
}

// Use UI utilities prompt with fallback
async function prompt(question) {
  // Strip ANSI codes and clean question for display
  const cleanQuestion = question.replace(/\x1b\[[0-9;]*m/g, '').trim();
  return await uiPrompt(cleanQuestion);
}

function validateInitials(initials) {
  // Remove spaces and convert to lowercase
  const cleaned = initials.replace(/\s/g, '').toLowerCase();
  
  // Check if exactly 3 letters
  if (!/^[a-z]{3}$/.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

function backupFile(filePath) {
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    log.info(`Backed up ${path.basename(filePath)} to ${path.basename(backupPath)}`);
    return backupPath;
  }
  return null;
}

// ============================================================================
// SETUP FUNCTIONS
// ============================================================================

async function setupNpmPackages(projectRoot) {
  log.header();
  log.title('📦 Installing NPM Packages');
  
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  // Check if package.json exists, create if not
  if (!fs.existsSync(packageJsonPath)) {
    log.info('Creating package.json...');
    const packageJson = {
      name: path.basename(projectRoot),
      version: '1.0.0',
      type: 'module',
      description: 'SecondBrain Development Project',
      scripts: {},
      devDependencies: {}
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    log.success('Created package.json');
  }
  
  // Read current package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Ensure type: module
  if (packageJson.type !== 'module') {
    packageJson.type = 'module';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    log.success('Set package.json type to "module"');
  }
  
  // Install required packages
  log.info('Installing chokidar and execa...');
  try {
    execSync('npm install --save-dev chokidar execa', { 
      cwd: projectRoot,
      stdio: 'inherit' 
    });
    log.success('Installed required npm packages');
  } catch (error) {
    log.warn('Could not install packages automatically. Please run: npm install --save-dev chokidar execa');
  }
  
  return packageJson;
}

function setupVSCodeSettings(projectRoot, initials) {
  log.header();
  log.title('⚙️  Setting up VS Code Configuration');
  
  const vscodeDir = path.join(projectRoot, '.vscode');
  ensureDirectoryExists(vscodeDir);
  
  // Setup settings.json
  const settingsPath = path.join(vscodeDir, 'settings.json');
  let settings = {};
  
  if (fs.existsSync(settingsPath)) {
    backupFile(settingsPath);
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      log.warn('Could not parse existing settings.json, creating new one');
    }
  }
  
  // Add cs-devops-agent settings
  settings['terminal.integrated.env.osx'] = settings['terminal.integrated.env.osx'] || {};
  settings['terminal.integrated.env.linux'] = settings['terminal.integrated.env.linux'] || {};
  settings['terminal.integrated.env.windows'] = settings['terminal.integrated.env.windows'] || {};
  
  const envVars = {
    AC_BRANCH_PREFIX: `dev_${initials}_`,
    AC_DAILY_PREFIX: `dev_${initials}_`,
    AC_TZ: 'Asia/Dubai',
    AC_PUSH: 'true',
    AC_REQUIRE_MSG: 'true',
    AC_MSG_MIN_BYTES: '20',
    AC_DEBOUNCE_MS: '1500',
    AC_MSG_DEBOUNCE_MS: '3000',
    AC_CLEAR_MSG_WHEN: 'push',
    AC_ROLLOVER_PROMPT: 'true',
    AC_DEBUG: 'false'
  };
  
  // Apply to all platforms
  Object.assign(settings['terminal.integrated.env.osx'], envVars);
  Object.assign(settings['terminal.integrated.env.linux'], envVars);
  Object.assign(settings['terminal.integrated.env.windows'], envVars);
  
  // Add file associations for commit messages
  settings['files.associations'] = settings['files.associations'] || {};
  settings['files.associations']['.claude-commit-msg'] = 'markdown';
  settings['files.associations']['CLAUDE_CHANGELOG.md'] = 'markdown';
  
  // Add file watchers
  settings['files.watcherExclude'] = settings['files.watcherExclude'] || {};
  settings['files.watcherExclude']['**/Archive/**'] = true;
  settings['files.watcherExclude']['**/__pycache__/**'] = true;
  
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  log.success(`Created/Updated VS Code settings with prefix: dev_${initials}_`);
  
  return settings;
}

function setupVSCodeTasks(projectRoot, initials) {
  log.title('📋 Setting up VS Code Tasks');
  
  const vscodeDir = path.join(projectRoot, '.vscode');
  const tasksPath = path.join(vscodeDir, 'tasks.json');
  
  let tasks = {
    version: '2.0.0',
    tasks: []
  };
  
  if (fs.existsSync(tasksPath)) {
    backupFile(tasksPath);
    try {
      tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
    } catch (e) {
      log.warn('Could not parse existing tasks.json, creating new one');
    }
  }
  
  // Remove old cs-devops-agent tasks if they exist
  tasks.tasks = tasks.tasks.filter(task => !task.label.includes('DevOps Agent'));
  
  // Add new cs-devops-agent tasks
  const autoCommitTasks = [
    {
      label: '🚀 Start DevOps Agent Worker',
      type: 'shell',
      command: 'node',
      args: ['ScriptCS_DevOpsAgent/cs-devops-agent-worker.js'],
      options: {
        env: {
          AC_BRANCH_PREFIX: `dev_${initials}_`,
          AC_DEBUG: 'true'
        }
      },
      problemMatcher: [],
      presentation: {
        echo: true,
        reveal: 'always',
        focus: false,
        panel: 'dedicated',
        showReuseMessage: false,
        clear: true
      },
      runOptions: {
        runOn: 'manual'
      }
    },
    {
      label: '🛑 Stop DevOps Agent Worker',
      type: 'shell',
      command: 'pkill -f "node.*cs-devops-agent-worker" || echo "Worker not running"',
      problemMatcher: [],
      presentation: {
        echo: true,
        reveal: 'always',
        focus: false,
        panel: 'shared'
      }
    },
    {
      label: '📝 Create Commit Message',
      type: 'shell',
      command: 'echo "feat(): " > .claude-commit-msg && code .claude-commit-msg',
      problemMatcher: [],
      presentation: {
        echo: false,
        reveal: 'never'
      }
    },
    {
      label: '📊 Show Git Status',
      type: 'shell',
      command: 'git status && echo "" && git branch --show-current',
      problemMatcher: [],
      presentation: {
        echo: true,
        reveal: 'always',
        focus: false,
        panel: 'shared'
      }
    }
  ];
  
  tasks.tasks.push(...autoCommitTasks);
  
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));
  log.success('Created/Updated VS Code tasks.json');
  
  return tasks;
}

function setupCommitFiles(projectRoot, initials) {
  log.header();
  log.title('📝 Setting up Commit Message Files');
  
  // Setup .claude-commit-msg
  const commitMsgPath = path.join(projectRoot, '.claude-commit-msg');
  if (!fs.existsSync(commitMsgPath)) {
    fs.writeFileSync(commitMsgPath, '');
    log.success('Created .claude-commit-msg file');
  } else {
    log.info('.claude-commit-msg already exists');
  }
  
  // Setup CLAUDE_CHANGELOG.md
  const changelogPath = path.join(projectRoot, 'CLAUDE_CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    const initialContent = `# Claude AI Assistant Changelog

This file tracks all changes made by Claude AI assistant to this codebase.
Each entry includes a timestamp, commit type, and detailed description.

Developer: ${initials.toUpperCase()}
Branch Prefix: dev_${initials}_
Initialized: ${new Date().toISOString()}

---

## Changelog History

`;
    fs.writeFileSync(changelogPath, initialContent);
    log.success('Created CLAUDE_CHANGELOG.md');
  } else {
    log.info('CLAUDE_CHANGELOG.md already exists');
  }
  
  // Setup Documentation/infrastructure.md
  const docDir = path.join(projectRoot, 'Documentation');
  const infraDocPath = path.join(docDir, 'infrastructure.md');
  
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
    log.success('Created Documentation directory');
  }
  
  if (!fs.existsSync(infraDocPath)) {
    const infraTemplate = `# Infrastructure Change Log

This document tracks all infrastructure changes made to the project. It is automatically updated when infrastructure-related files are modified.

## Format Guidelines

Each entry should follow this format:
\`\`\`
## [Date] - [Agent/Developer Name]
### Category: [Config|Dependencies|Build|Architecture|Database|API|Security]
**Change Type**: [Added|Modified|Removed|Fixed]
**Component**: [Affected component/service]
**Description**: Brief description of the change
**Reason**: Why this change was necessary
**Impact**: Potential impacts or considerations
**Files Changed**: 
- file1.js
- config/settings.json
\`\`\`

---

<!-- New entries will be added above this line -->`;
    
    fs.writeFileSync(infraDocPath, infraTemplate);
    log.success('Created infrastructure documentation template');
  } else {
    log.info('Documentation/infrastructure.md already exists');
  }
  
  // Setup CLAUDE.md if it doesn't exist
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) {
    const claudeRules = `# House Rules for Claude

## Developer Information
- Developer Initials: ${initials.toUpperCase()}
- Branch Prefix: dev_${initials}_
- Default Timezone: Asia/Dubai
- Project Root: ${projectRoot}

## Commit Policy
After applying any file edits, you must document changes in two places:

### 1. Single Commit Message File (\`.claude-commit-msg\`)

**Location**: \`/.claude-commit-msg\`  
**Action**: APPEND to this file (don't overwrite) - the worker will clean it  
**Format**:
\`\`\`
type(scope): subject line describing the change (max 72 characters)

- Bullet point 1: Specific file or module changed and what was done
- Bullet point 2: Behavioral change or feature added (if applicable)
- Bullet point 3: Any side effects or related updates (if applicable)
\`\`\`

**Commit Types**:
- \`feat\`: New feature or capability added
- \`fix\`: Bug fix or error correction
- \`refactor\`: Code restructuring without changing functionality
- \`docs\`: Documentation updates (README, comments, etc.)
- \`test\`: Adding or modifying tests
- \`chore\`: Maintenance tasks (configs, dependencies, cleanup)

**Rules**:
- Be specific about WHAT changed and WHERE (mention file names)
- Describe the IMPACT of the change, not just what was done
- Never include bash commands or command-line syntax
- Never attempt to run git commands directly
- Keep the subject line under 72 characters
- Use present tense ("add" not "added", "fix" not "fixed")

### 2. Changelog Documentation (\`CLAUDE_CHANGELOG.md\`)
**Location**: \`/CLAUDE_CHANGELOG.md\`  
**Action**: APPEND a new section (don't overwrite)  
**Format**:
\`\`\`markdown
## YYYY-MM-DDTHH:MM:SSZ
type(scope): exact same subject line from commit message
- Exact same bullet point 1 from commit message
- Exact same bullet point 2 from commit message
- Exact same bullet point 3 from commit message (if used)
\`\`\`

**Timestamp Format**: ISO-8601 with timezone (Z for UTC)
- Example: \`2025-09-15T14:30:00Z\`
- Use current time when making the change

### Example of Both Files

**.claude-commit-msg** (append new entries):
\`\`\`
feat(api): add webhook support for real-time notifications

- Created WebhookManager class in services/webhook_manager.py
- Added POST /api/webhooks endpoint for webhook registration
- Integrated webhook triggers into event processing pipeline
\`\`\`

**CLAUDE_CHANGELOG.md** (appended):
\`\`\`markdown
## 2025-09-15T14:35:00Z
feat(api): add webhook support for real-time notifications
- Created WebhookManager class in services/webhook_manager.py
- Added POST /api/webhooks endpoint for webhook registration
- Integrated webhook triggers into event processing pipeline
\`\`\`

## DevOps Agent Worker
The cs-devops-agent worker is configured to:
- Use branch prefix: dev_${initials}_
- Create daily branches: dev_${initials}_YYYY-MM-DD
- Auto-commit when .claude-commit-msg changes
- Handle daily rollover at midnight
- Automatically stage, commit, and push changes
- Clear commit message after successful push

## Code Quality & Documentation Standards

### BE A THOUGHTFUL ENGINEER
Write code that your future self and others can understand easily.

### 1. Module/File Headers
Every file should start with a comprehensive description:
\`\`\`javascript
/**
 * Module Name - Brief Description
 * ================================
 * 
 * This module handles [main purpose]. It provides [key functionality].
 * 
 * Key Components:
 * - ComponentA: Does X
 * - ComponentB: Handles Y
 * 
 * Dependencies:
 * - External: library1, library2
 * - Internal: module.submodule
 * 
 * Usage Example:
 *     import { MainClass } from './this-module';
 *     const instance = new MainClass();
 *     const result = instance.process();
 */
\`\`\`

### 2. Function/Method Documentation
\`\`\`javascript
/**
 * Execute a named process with the provided input.
 * 
 * This method runs through each step sequentially,
 * passing output from one step as input to the next.
 * 
 * @param {string} processName - Name of process to execute
 * @param {string} inputText - Initial input text to process
 * @param {Object} [context] - Optional context for variable substitution
 * @returns {ProcessResult} Object containing success status and outputs
 * @throws {Error} If processName doesn't exist
 * @throws {ConnectionError} If service is unavailable
 * 
 * @example
 * const result = await processor.execute("validate", "input data");
 * if (result.success) {
 *     console.log(result.output);
 * }
 */
async function executeProcess(processName, inputText, context) {
    // Step 1: Validate process exists
    if (!processes[processName]) {
        throw new Error(\`Process '\${processName}' not found\`);
    }
    
    // Step 2: Initialize execution context
    // This tracks state across all process steps
    const executionContext = initContext(context);
    
    // Step 3: Execute each step sequentially
    // Note: Future versions will support parallel execution
    for (const step of process.steps) {
        // Process step with automatic retry on failure
        const stepResult = await executeStep(step, executionContext);
        // ...
    }
}
\`\`\`

### 3. Inline Comments
\`\`\`javascript
// Good inline comments explain WHY, not WHAT
const retryDelay = 1000; // Wait 1 second between retries to avoid rate limiting

// Document complex logic
if (mode === 'production') {
    // Force secure connections in production
    // This ensures data privacy for sensitive operations
    options.secure = true;
} else if (mode === 'development') {
    // Allow insecure connections for local testing
    // Speeds up development workflow
    options.secure = false;
}

// Explain non-obvious code
// Using exponential backoff to avoid overwhelming the API
const waitTime = Math.min(2 ** attempt * 0.5, 30); // Cap at 30 seconds
\`\`\`

### 4. TODO/FIXME Comments
\`\`\`javascript
// TODO(${initials}, YYYY-MM-DD): Implement caching for frequent requests
// This would reduce API calls by ~40% based on usage patterns

// FIXME(${initials}, YYYY-MM-DD): Handle edge case when input is null
// Current behavior: Throws unhandled exception
// Desired: Return graceful error message
\`\`\`

### 5. Configuration & Constants
\`\`\`javascript
// Configuration constants should explain their purpose and valid ranges
const MAX_RETRIES = 3; // Maximum retry attempts for failed operations
const TIMEOUT_MS = 30000; // Request timeout in milliseconds (30 seconds)
const BATCH_SIZE = 100; // Process items in batches to manage memory

// Document configuration structures
const MODES = {
    'fast': 'Prioritize speed over accuracy',
    'balanced': 'Balance between speed and accuracy',
    'accurate': 'Prioritize accuracy over speed'
};
\`\`\`

### 6. Error Handling Comments
\`\`\`javascript
try {
    const response = await apiClient.request(endpoint);
} catch (error) {
    if (error.code === 'ECONNREFUSED') {
        // Service might be starting up or under maintenance
        // Retry with exponential backoff before failing
        logger.warn(\`Service unavailable: \${error.message}\`);
        return await retryWithBackoff(request);
    } else if (error.code === 'INVALID_INPUT') {
        // Invalid input is unrecoverable - notify user
        logger.error(\`Invalid input: \${error.message}\`);
        throw error;
    }
}
\`\`\`

## Code Quality Standards
- Ensure all changes maintain existing code style and conventions
- Add appropriate error handling for new functionality
- Update related documentation when changing functionality
- Write self-documenting code with clear variable and function names
- Add JSDoc comments for all public functions and classes
- Comment complex algorithms and business logic
- Document assumptions and constraints
- Include examples in function documentation

## File Organization
- Use descriptive file names that reflect their purpose
- Group related changes in a single commit when they're part of the same feature
- If making multiple unrelated changes, document them separately
- Keep files focused on a single responsibility
- Create new files rather than making existing files too large

## Testing Guidelines
- Write tests for new functionality
- Update tests when modifying existing functionality
- Ensure all tests pass before committing
- Document test scenarios and expected outcomes
- Include edge cases in test coverage

## Communication
- When asked about changes, reference the CLAUDE_CHANGELOG.md for history
- Provide context about why changes were made, not just what was changed
- Alert user to any breaking changes or required migrations
- Be clear about dependencies and prerequisites

## Image and Asset Creation
- **NEVER create or generate images without explicit user permission**
- Always ask before creating any image files (PNG, JPG, SVG, etc.)
- Do not automatically generate placeholder images or logos
- Wait for specific user request before creating visual assets

## Version Control Best Practices
- Make atomic commits - each commit should represent one logical change
- Write meaningful commit messages following the conventional format
- Review changes before committing to ensure quality
- Don't commit commented-out code - remove it or document why it's kept
- Keep commits focused and avoid mixing unrelated changes

## Security Considerations
- Never commit sensitive information (passwords, API keys, tokens)
- Use environment variables for configuration that varies by environment
- Validate all user input before processing
- Follow the principle of least privilege
- Document security considerations in code comments

## Performance Guidelines
- Comment on performance implications of algorithms
- Document O(n) complexity for non-trivial algorithms
- Explain caching strategies where implemented
- Note potential bottlenecks or scaling concerns
- Include performance considerations in technical decisions
`;
    fs.writeFileSync(claudeMdPath, claudeRules);
    log.success('Created CLAUDE.md with house rules');
  } else {
    log.info('CLAUDE.md already exists');
  }
  
  // Update .gitignore
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    let gitignore = fs.readFileSync(gitignorePath, 'utf8');
    
    // Check if entries already exist
    const entriesToAdd = [
      '.claude-commit-msg',
      '**/Archive/',
      '*.backup.*'
    ];
    
    let modified = false;
    for (const entry of entriesToAdd) {
      if (!gitignore.includes(entry)) {
        gitignore += `\n${entry}`;
        modified = true;
      }
    }
    
    if (modified) {
      gitignore += '\n';
      fs.writeFileSync(gitignorePath, gitignore);
      log.success('Updated .gitignore');
    }
  }
}

function createRunScripts(projectRoot, initials, packageJson) {
  log.header();
  log.title('🎯 Creating Run Scripts');
  
  // Update package.json scripts
  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['cs-devops-agent'] = 'node ScriptCS_DevOpsAgent/cs-devops-agent-worker.js';
  packageJson.scripts['cs-devops-agent:debug'] = 'AC_DEBUG=true node ScriptCS_DevOpsAgent/cs-devops-agent-worker.js';
  packageJson.scripts['cs-devops-agent:setup'] = 'node ScriptCS_DevOpsAgent/setup-cs-devops-agent.js';
  
  const packageJsonPath = path.join(projectRoot, 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  log.success('Updated package.json scripts');
  
  // Create a personalized shell script
  const scriptContent = `#!/bin/bash
# DevOps Agent Worker Runner for ${initials.toUpperCase()}
# Generated on ${new Date().toISOString()}

echo "🚀 Starting DevOps Agent Worker"
echo "Developer: ${initials.toUpperCase()}"
echo "Branch Prefix: dev_${initials}_"
echo ""

# Export environment variables
export AC_BRANCH_PREFIX="dev_${initials}_"
export AC_DAILY_PREFIX="dev_${initials}_"
export AC_TZ="Asia/Dubai"
export AC_PUSH="true"
export AC_REQUIRE_MSG="true"
export AC_MSG_MIN_BYTES="20"
export AC_DEBOUNCE_MS="1500"
export AC_MSG_DEBOUNCE_MS="3000"
export AC_CLEAR_MSG_WHEN="push"
# Daily rollover is automatic - no prompting needed
export AC_ROLLOVER_PROMPT="false"
export AC_DEBUG="false"

# Check for debug flag
if [ "$1" == "--debug" ] || [ "$1" == "-d" ]; then
  export AC_DEBUG="true"
  echo "🐛 Debug mode enabled"
fi

# Check for no-push flag
if [ "$1" == "--no-push" ] || [ "$1" == "-n" ]; then
  export AC_PUSH="false"
  echo "📦 Push disabled (local commits only)"
fi

# Run the cs-devops-agent worker
node ScriptCS_DevOpsAgent/cs-devops-agent-worker.js
`;
  
  const scriptPath = path.join(projectRoot, `run-cs-devops-agent-${initials}.sh`);
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');
  log.success(`Created personalized run script: run-cs-devops-agent-${initials}.sh`);
  
  // Create a .env.example file
  const envExampleContent = `# DevOps Agent Worker Configuration
# Copy to .env and customize as needed

# Developer Settings
AC_BRANCH_PREFIX=dev_${initials}_
AC_DAILY_PREFIX=dev_${initials}_

# Timezone (for daily branch creation)
AC_TZ=Asia/Dubai

# Git Settings
AC_PUSH=true

# Message Requirements
AC_REQUIRE_MSG=true
AC_MSG_MIN_BYTES=20
AC_MSG_PATTERN=^(feat|fix|refactor|docs|test|chore)(\\([^)]+\\))?:\\s

# Timing Settings
AC_DEBOUNCE_MS=1500
AC_MSG_DEBOUNCE_MS=3000

# Behavior
AC_CLEAR_MSG_WHEN=push
# Daily rollover is automatic
AC_ROLLOVER_PROMPT=false
AC_DEBUG=false
`;
  
  const envExamplePath = path.join(projectRoot, '.env.example');
  fs.writeFileSync(envExamplePath, envExampleContent);
  log.success('Created .env.example file');
}

function printInstructions(initials) {
  log.header();
  log.title('✅ Setup Complete!');
  console.log('');
  log.info(`Developer Initials: ${colors.bright}${initials.toUpperCase()}${colors.reset}`);
  log.info(`Branch Prefix: ${colors.bright}dev_${initials}_${colors.reset}`);
  console.log('');
  
  log.title('📚 Quick Start Guide:');
  console.log('');
  console.log('1. Start the cs-devops-agent worker:');
  console.log(`   ${colors.green}npm run cs-devops-agent${colors.reset}`);
  console.log(`   ${colors.yellow}OR${colors.reset}`);
  console.log(`   ${colors.green}./run-cs-devops-agent-${initials}.sh${colors.reset}`);
  console.log(`   ${colors.yellow}OR${colors.reset}`);
  console.log(`   ${colors.green}Use VS Code: Cmd+Shift+P → Tasks: Run Task → 🚀 Start DevOps Agent Worker${colors.reset}`);
  console.log('');
  
  console.log('2. Make your code changes');
  console.log('');
  
  console.log('3. Create a commit message:');
  console.log(`   ${colors.green}echo "feat(module): description" > .claude-commit-msg${colors.reset}`);
  console.log(`   ${colors.yellow}OR${colors.reset}`);
  console.log(`   ${colors.green}Use VS Code: Cmd+Shift+P → Tasks: Run Task → 📝 Create Commit Message${colors.reset}`);
  console.log('');
  
  console.log('4. The worker will automatically commit and push!');
  console.log('');
  
  log.title('🎯 Daily Workflow:');
  console.log('');
  console.log(`• Your daily branches will be: ${colors.bright}dev_${initials}_YYYY-MM-DD${colors.reset}`);
  console.log('• The worker automatically creates new daily branches at midnight');
  console.log('• Commits require valid conventional format (feat/fix/docs/etc)');
  console.log('• Message file is cleared after successful push');
  console.log('');
  
  log.title('📁 Files Created/Updated:');
  console.log('');
  console.log('• .vscode/settings.json - VS Code environment settings');
  console.log('• .vscode/tasks.json - VS Code task shortcuts');
  console.log('• package.json - NPM scripts');
  console.log(`• run-cs-devops-agent-${initials}.sh - Personal run script`);
  console.log('• .claude-commit-msg - Commit message file');
  console.log('• CLAUDE_CHANGELOG.md - Change tracking');
  console.log('• CLAUDE.md - House rules for Claude');
  console.log('• .env.example - Configuration template');
  console.log('');
  
  log.title('🔧 Debugging:');
  console.log('');
  console.log('Run with debug output:');
  console.log(`   ${colors.green}npm run cs-devops-agent:debug${colors.reset}`);
  console.log(`   ${colors.yellow}OR${colors.reset}`);
  console.log(`   ${colors.green}./run-cs-devops-agent-${initials}.sh --debug${colors.reset}`);
  console.log('');
  
  log.title('📖 Environment Variables:');
  console.log('');
  console.log('See .env.example for all configuration options');
  console.log('');
  
  log.header();
}

async function setupEnvFile(projectRoot) {
  log.header();
  log.title('🔑 Setting up Environment Variables');
  
  const envPath = path.join(projectRoot, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    log.info('.env file already exists');
  } else {
    log.info('Creating .env file');
  }
  
  // Check for OPENAI_API_KEY
  if (!envContent.includes('OPENAI_API_KEY=')) {
    console.log();
    explain(`
${colors.bright}Groq API Key Setup${colors.reset}
The contract automation features use Groq LLM (via OpenAI compatibility).
You can enter your API key now, or set it later in the .env file.
    `);
    
    const apiKey = await prompt('Enter Groq API Key (leave empty to skip)');
    
    if (apiKey) {
      const newLine = envContent.endsWith('\n') || envContent === '' ? '' : '\n';
      envContent += `${newLine}# Groq API Key for Contract Automation\nOPENAI_API_KEY=${apiKey}\n`;
      fs.writeFileSync(envPath, envContent);
      log.success('Added OPENAI_API_KEY to .env');
    } else {
      log.warn('Skipped Groq API Key. Contract automation features may not work.');
      if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, '# Environment Variables\n');
      }
    }
  } else {
    log.info('OPENAI_API_KEY is already configured in .env');
  }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

function cleanupDevOpsAgentFiles(projectRoot) {
  log.header();
  log.title('🧹 Cleaning Up DevOpsAgent Files');
  
  const scriptsDir = path.join(projectRoot, 'ScriptCS_DevOpsAgent');
  
  // Check if this is a submodule deployment
  const isSubmodule = fs.existsSync(path.join(scriptsDir, '.git'));
  const devOpsAgentRoot = isSubmodule ? scriptsDir : path.join(projectRoot, 'DevOpsAgent');
  
  if (!fs.existsSync(devOpsAgentRoot)) {
    log.info('No DevOpsAgent directory to clean up');
    return;
  }
  
  // Files to rename/archive in the DevOpsAgent folder
  const filesToRename = [
    { source: 'CLAUDE.md', target: 'CLAUDE.md.template' },
    { source: 'houserules.md', target: 'houserules.md.template' },
    { source: 'package.json', target: 'package.json.template' },
    { source: '.env.example', target: '.env.template' }
  ];
  
  for (const file of filesToRename) {
    const sourcePath = path.join(devOpsAgentRoot, file.source);
    const targetPath = path.join(devOpsAgentRoot, file.target);
    
    if (fs.existsSync(sourcePath) && !fs.existsSync(targetPath)) {
      try {
        fs.renameSync(sourcePath, targetPath);
        log.success(`Renamed ${file.source} to ${file.target} in DevOpsAgent folder`);
      } catch (error) {
        log.warn(`Could not rename ${file.source}: ${error.message}`);
      }
    }
  }
  
  // Create a .gitignore in DevOpsAgent to ignore deployed files
  const devOpsGitignore = path.join(devOpsAgentRoot, '.gitignore');
  if (!fs.existsSync(devOpsGitignore)) {
    const ignoreContent = `# Ignore deployed files to avoid conflicts\n*.deployed\n.env\nnode_modules/\n`;
    fs.writeFileSync(devOpsGitignore, ignoreContent);
    log.success('Created .gitignore in DevOpsAgent folder');
  }
}

// ============================================================================
// MAIN SETUP FLOW
// ============================================================================

async function main() {
  console.clear();
  
  // Show welcome
  showWelcome('DevOps Agent Setup Wizard');
  console.log();
  
  explain(`
Welcome to the DevOps Agent setup! This wizard will configure everything
you need to start working with AI assistants on your project.

${colors.bright}What we'll set up:${colors.reset}
${status.checkmark} Your personal developer configuration
${status.checkmark} Git automation and branch management  
${status.checkmark} VS Code integration and shortcuts
${status.checkmark} Required npm dependencies

${colors.dim}This takes about 2 minutes.${colors.reset}
  `);
  console.log();
  
  // Find project root
  const projectRoot = findProjectRoot();
  log.info(`Project root: ${projectRoot}`);
  
  // Ensure ScriptCS_DevOpsAgent directory exists
  const scriptsDir = path.join(projectRoot, 'ScriptCS_DevOpsAgent');
  if (!fs.existsSync(scriptsDir)) {
    log.error('ScriptCS_DevOpsAgent folder not found! Please copy the folder to your project root.');
    log.info('Run: cp -r ScriptCS_DevOpsAgent /path/to/your/project/');
    process.exit(1);
  }
  
  // Get developer initials
  console.log();
  sectionTitle('Developer Identification');
  explain(`
${colors.bright}What:${colors.reset} Your 3-letter initials (e.g., abc, xyz)
${colors.bright}Why:${colors.reset} Identifies your branches and configuration
${colors.bright}How:${colors.reset} Creates branches like dev_abc_2025-10-31
  `);
  
  let initials = null;
  while (!initials) {
    const input = await prompt('Enter your 3-letter initials');
    initials = validateInitials(input);
    
    if (!initials) {
      errorMsg('Please enter exactly 3 letters (a-z)');
      tip('Examples: abc, xyz, jdoe');
    }
  }
  
  success(`Using initials: ${colors.cyan}${initials.toUpperCase()}${colors.reset}`);
  tip(`Your branches will be named: ${colors.cyan}dev_${initials}_YYYY-MM-DD${colors.reset}`);
  console.log();
  
  // Confirm before proceeding
  drawSection('Configuration Summary', [
    `${status.folder} Branch prefix: ${colors.cyan}dev_${initials}_${colors.reset}`,
    `${status.branch} Daily branches: ${colors.cyan}dev_${initials}_YYYY-MM-DD${colors.reset}`,
    `${status.checkmark} VS Code settings and tasks`,
    `${status.checkmark} NPM packages and scripts`,
    `${status.checkmark} Commit message files`,
    `${status.checkmark} House rules for AI agents`
  ]);
  console.log();
  
  const proceed = await confirm('Ready to configure DevOps Agent?', true);
  
  if (!proceed) {
    warn('Setup cancelled');
    process.exit(0);
  }
  
  console.log();
  info('Starting configuration...');
  console.log();
  
  try {
    // Run setup steps
    const packageJson = await setupNpmPackages(projectRoot);
    setupVSCodeSettings(projectRoot, initials);
    setupVSCodeTasks(projectRoot, initials);
    setupCommitFiles(projectRoot, initials);
    createRunScripts(projectRoot, initials, packageJson);
    
    // Setup .env with API keys
    await setupEnvFile(projectRoot);
    
    // Clean up DevOpsAgent files to avoid duplicates
    cleanupDevOpsAgentFiles(projectRoot);
    
    // Print instructions
    printInstructions(initials);
    
  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);