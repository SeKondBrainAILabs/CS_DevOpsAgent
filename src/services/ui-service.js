import readline from 'readline';
import path from 'path';

export const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

export class UIService {
  constructor() {
    this.colors = COLORS;
  }

  log(message) {
    console.log(message);
  }

  logSection(title, color = COLORS.bright) {
    console.log(`\n${color}${title}${COLORS.reset}`);
  }

  logSuccess(message) {
    console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
  }

  logError(message) {
    console.error(`${COLORS.red}✗ ${message}${COLORS.reset}`);
  }

  logWarning(message) {
    console.log(`${COLORS.yellow}${message}${COLORS.reset}`);
  }

  logInfo(message) {
    console.log(`${COLORS.blue}${message}${COLORS.reset}`);
  }
  
  logDim(message) {
     console.log(`${COLORS.dim}${message}${COLORS.reset}`);
  }

  async prompt(question, defaultVal = null) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim() || defaultVal);
      });
    });
  }
  
  async promptYesNo(question, defaultYes = false) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`${question} (${defaultYes ? 'Y/n' : 'y/N'}): `, (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase();
        if (normalized === '') {
          resolve(defaultYes);
        } else {
          resolve(normalized === 'y' || normalized === 'yes');
        }
      });
    });
  }

  displayInstructions(instructions, sessionId, task, repoRoot, houseRulesPath) {
    console.log(`\n${COLORS.bgGreen}${COLORS.bright} Instructions for Your Coding Agent ${COLORS.reset}\n`);
    
    // Clean separator
    console.log(`${COLORS.yellow}══════════════════════════════════════════════════════════════${COLORS.reset}`);
    console.log(`${COLORS.bright}COPY AND PASTE THIS ENTIRE BLOCK INTO YOUR CODING AGENT BEFORE YOUR PROMPT:${COLORS.reset}`);
    console.log(`${COLORS.yellow}──────────────────────────────────────────────────────────────${COLORS.reset}`);
    console.log();
    
    // The actual copyable content - no colors inside
    console.log(`I'm working in a DevOps-managed session with the following setup:`);
    console.log(`- Session ID: ${sessionId}`);
    console.log(`- Working Directory: ${instructions.worktreePath}`);
    console.log(`- Task: ${task || 'development'}`);
    console.log(``);
    console.log(`Please switch to this directory before making any changes:`);
    console.log(`cd "${instructions.worktreePath}"`);
    console.log(``);
    console.log(`📋 IMPORTANT - READ PROJECT RULES FIRST:`);
    console.log(`Before making ANY changes, you MUST read the project's house rules at:`);
    console.log(`${houseRulesPath}`);
    console.log(``);
    console.log(`The house rules file contains:`);
    console.log(`- Project coding conventions and standards`);
    console.log(`- Required commit message formats`);
    console.log(`- File coordination protocols`);
    console.log(`- Branch naming and workflow rules`);
    console.log(`- Testing and review requirements`);
    console.log(``);
    console.log(`You must follow ALL rules in this file. Read it carefully before proceeding.`);
    console.log(``);
    
    console.log(`⚠️ FILE COORDINATION (MANDATORY):`);
    console.log(`Shared coordination directory: local_deploy/.file-coordination/`);
    console.log(``);
    console.log(`BEFORE editing ANY files:`);
    console.log(`1. Check for conflicts: ls ../../../local_deploy/.file-coordination/active-edits/`);
    console.log(`2. Create declaration: local_deploy/.file-coordination/active-edits/<agent>-${sessionId}.json`);
    console.log(``);
    console.log(`Example declaration:`);
    console.log(`{`);
    console.log(`  "agent": "claude", "session": "${sessionId}",`);
    console.log(`  "files": ["src/app.js"], "operation": "edit",`);
    console.log(`  "reason": "${task}", "declaredAt": "${new Date().toISOString()}",`);
    console.log(`  "estimatedDuration": 300`);
    console.log(`}`);
    console.log(``);
    console.log(`Write commit messages to: .devops-commit-${sessionId}.msg`);
    console.log(`The DevOps agent will automatically commit and push changes.`);
    console.log(``);
    console.log(`⛔ IMPORTANT: STOP HERE AND WAIT`);
    console.log(`Do NOT start coding or making changes yet!`);
    console.log(`Follow the steps above in order when instructed by the user.`);
    console.log(`Wait for further instructions before proceeding.`);
    console.log();
    
    console.log(`${COLORS.yellow}══════════════════════════════════════════════════════════════${COLORS.reset}`);
    console.log();
    console.log(`${COLORS.bright}${COLORS.bgYellow} IMPORTANT ${COLORS.reset} ${COLORS.yellow}Copy the text above and paste it into your coding agent${COLORS.reset}`);
    console.log();
  }
  
  async waitForConfirmation(sessionId, instructionsDir) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise(resolve => {
      rl.question(`${COLORS.green}Press Enter once you've copied and pasted the instructions to your agent...${COLORS.reset} `, resolve);
    });
    rl.close();
    
    console.log(`${COLORS.green}✓ Instructions copied${COLORS.reset}`);
    console.log(`${COLORS.dim}Full instructions saved to: ${instructionsDir}/${sessionId}.md${COLORS.reset}`);
  }
}
