#!/usr/bin/env node

/**
 * ============================================================================
 * INSTRUCTION FORMATTER - Beautiful AI Assistant Instructions for v2.0
 * ============================================================================
 * 
 * Generates clear, structured, visually appealing instructions for AI
 * assistants working in DevOps Agent sessions.
 * 
 * Features:
 * - Numbered steps with clear hierarchy
 * - Visual separators and formatting
 * - Context-aware content
 * - Copy-paste ready format
 * - Critical information highlighted
 * 
 * ============================================================================
 */

import { colors, status, box } from './ui-utils.js';
import path from 'path';

// ============================================================================
// INSTRUCTION TEMPLATES
// ============================================================================

/**
 * Format complete instructions for an AI assistant
 * 
 * @param {Object} session - Session configuration
 * @param {string} session.id - Session ID
 * @param {string} session.task - Task name
 * @param {string} session.agent - Agent type (claude, cursor, etc.)
 * @param {string} session.worktreePath - Full path to worktree
 * @param {string} session.houseRulesPath - Path to house rules file
 * @param {Array<string>} session.declaredFiles - Optional pre-declared files
 * @param {Object} options - Formatting options
 * @returns {string} Formatted instructions
 */
export function formatInstructions(session, options = {}) {
  const lines = [];
  
  // Header
  lines.push('');
  lines.push(box.doubleTopLeft + box.doubleHorizontal.repeat(68) + box.doubleTopRight);
  lines.push(box.doubleVertical + ` ${status.robot} Instructions for Your AI Assistant`.padEnd(69) + box.doubleVertical);
  lines.push(box.doubleBottomLeft + box.doubleHorizontal.repeat(68) + box.doubleBottomRight);
  lines.push('');
  
  // Intro
  lines.push(`${colors.bright}Copy this ENTIRE message to ${session.agent}:${colors.reset}`);
  lines.push('');
  lines.push('━'.repeat(70));
  lines.push(`${status.rocket} ${colors.bright}DevOps Session Configuration${colors.reset}`);
  lines.push('');
  
  // Session Info
  lines.push(`Session ID: ${colors.cyan}${session.id}${colors.reset}`);
  lines.push(`Task: ${colors.bright}${session.task}${colors.reset}`);
  lines.push(`Working Directory: ${colors.dim}${session.worktreePath}${colors.reset}`);
  lines.push('');
  
  // Critical First Step - House Rules
  lines.push(`${colors.bright}${status.point} STEP 1: Read the house rules${colors.reset} ${colors.red}(CRITICAL - Do this first!)${colors.reset}`);
  lines.push(`   ${colors.green}cat "${session.houseRulesPath}"${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.dim}House rules contain:${colors.reset}`);
  lines.push(`   ${colors.dim}• Project conventions and coding standards${colors.reset}`);
  lines.push(`   ${colors.dim}• Testing requirements${colors.reset}`);
  lines.push(`   ${colors.dim}• Commit message format${colors.reset}`);
  lines.push(`   ${colors.dim}• File coordination protocols${colors.reset}`);
  lines.push('');
  
  // Step 2 - Switch Directory
  lines.push(`${colors.bright}${status.point} STEP 2: Switch to your workspace${colors.reset}`);
  lines.push(`   ${colors.green}cd "${session.worktreePath}"${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.dim}This is your isolated workspace. All your work happens here.${colors.reset}`);
  lines.push('');
  
  // Step 3 - File Coordination
  lines.push(`${colors.bright}${status.point} STEP 3: Declare files before editing${colors.reset} ${colors.yellow}(MANDATORY)${colors.reset}`);
  lines.push(`   ${colors.dim}Before touching ANY file, declare it in:${colors.reset}`);
  lines.push(`   ${colors.cyan}.file-coordination/active-edits/${session.agent}-${session.id}.json${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.dim}Example declaration:${colors.reset}`);
  lines.push(`   {`);
  lines.push(`     "agent": "${session.agent}",`);
  lines.push(`     "session": "${session.id}",`);
  lines.push(`     "files": ["src/auth/login.js", "src/auth/token.js"],`);
  lines.push(`     "operation": "edit",`);
  lines.push(`     "reason": "${session.task}",`);
  lines.push(`     "declaredAt": "${new Date().toISOString()}"`);
  lines.push(`   }`);
  lines.push('');
  lines.push(`   ${colors.yellow}${status.warning} Why this matters:${colors.reset}`);
  lines.push(`   ${colors.dim}• Prevents conflicts with other AI agents${colors.reset}`);
  lines.push(`   ${colors.dim}• System alerts if files are already locked${colors.reset}`);
  lines.push(`   ${colors.dim}• Ensures coordinated multi-agent workflows${colors.reset}`);
  lines.push('');
  
  // Step 4 - Making Changes
  lines.push(`${colors.bright}${status.point} STEP 4: Make your changes${colors.reset}`);
  lines.push(`   ${colors.dim}Edit the files you declared. Follow house rules for:${colors.reset}`);
  lines.push(`   ${colors.dim}• Code style and formatting${colors.reset}`);
  lines.push(`   ${colors.dim}• Testing requirements${colors.reset}`);
  lines.push(`   ${colors.dim}• Documentation standards${colors.reset}`);
  lines.push('');
  
  // Step 5 - Commit Messages
  lines.push(`${colors.bright}${status.point} STEP 5: Write commit messages${colors.reset}`);
  lines.push(`   ${colors.dim}After each logical change, write commit message to:${colors.reset}`);
  lines.push(`   ${colors.cyan}.devops-commit-${session.id}.msg${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.dim}DevOps Agent will automatically:${colors.reset}`);
  lines.push(`   ${colors.dim}• Stage all changes${colors.reset}`);
  lines.push(`   ${colors.dim}• Commit with your message${colors.reset}`);
  lines.push(`   ${colors.dim}• Push to GitHub${colors.reset}`);
  lines.push(`   ${colors.dim}• Clear the message file${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.green}${status.checkmark} Commit Message Format:${colors.reset}`);
  lines.push(`   ${colors.dim}type(scope): subject line (max 72 chars)${colors.reset}`);
  lines.push(`   ${colors.dim}${colors.reset}`);
  lines.push(`   ${colors.dim}- Bullet point 1: Specific change made${colors.reset}`);
  lines.push(`   ${colors.dim}- Bullet point 2: Another change${colors.reset}`);
  lines.push('');
  
  // File Coordination Rules
  lines.push('');
  lines.push(`${status.lock} ${colors.bright}File Coordination Protocol:${colors.reset}`);
  lines.push('');
  lines.push(`   ${colors.red}${status.error} DO NOT edit files without declaring them first${colors.reset}`);
  lines.push(`   ${colors.green}${status.checkmark} Always check .file-coordination/active-edits/ for conflicts${colors.reset}`);
  lines.push(`   ${colors.green}${status.checkmark} If another agent locked a file, ask user for guidance${colors.reset}`);
  lines.push(`   ${colors.green}${status.checkmark} Release files by deleting your declaration when done${colors.reset}`);
  lines.push('');
  
  // Testing Reminder
  if (options.testCommand) {
    lines.push(`${status.checkmark} ${colors.bright}Testing:${colors.reset}`);
    lines.push(`   ${colors.dim}Run tests before closing session:${colors.reset}`);
    lines.push(`   ${colors.green}${options.testCommand}${colors.reset}`);
    lines.push('');
  }
  
  // Docker Reminder
  if (options.dockerEnabled) {
    lines.push(`${status.checkmark} ${colors.bright}Docker:${colors.reset}`);
    lines.push(`   ${colors.dim}Containers will auto-restart after each push${colors.reset}`);
    lines.push('');
  }
  
  // Footer
  lines.push('━'.repeat(70));
  lines.push('');
  lines.push(`${status.checkmark} ${colors.green}DevOps Agent is now monitoring this session...${colors.reset}`);
  lines.push(`   ${colors.dim}Press Ctrl+C to stop monitoring${colors.reset}`);
  lines.push(`   ${colors.dim}To close session: ${colors.cyan}s9n-devops-agent close ${session.id}${colors.reset}`);
  lines.push('');
  lines.push(`${colors.dim}💡 Tip: Keep this terminal open. Open a new terminal for other work.${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format condensed instructions (for experienced users)
 */
export function formatCondensedInstructions(session) {
  const lines = [];
  
  lines.push('');
  lines.push(`${status.robot} ${colors.bright}DevOps Session: ${session.id}${colors.reset}`);
  lines.push('');
  lines.push(`${status.point} Read house rules: ${colors.green}cat "${session.houseRulesPath}"${colors.reset}`);
  lines.push(`${status.point} Switch workspace: ${colors.green}cd "${session.worktreePath}"${colors.reset}`);
  lines.push(`${status.point} Declare files: ${colors.cyan}.file-coordination/active-edits/${session.agent}-${session.id}.json${colors.reset}`);
  lines.push(`${status.point} Write commits: ${colors.cyan}.devops-commit-${session.id}.msg${colors.reset}`);
  lines.push('');
  lines.push(`${colors.dim}Full instructions: s9n-devops-agent instructions ${session.id}${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format instructions for resuming an existing session
 */
export function formatResumeInstructions(session) {
  const lines = [];
  
  lines.push('');
  lines.push(`${status.robot} ${colors.bright}Resuming Session: ${session.id}${colors.reset}`);
  lines.push('');
  lines.push(`Task: ${colors.cyan}${session.task}${colors.reset}`);
  lines.push(`Status: ${colors.yellow}Paused${colors.reset} → ${colors.green}Active${colors.reset}`);
  lines.push('');
  lines.push(`${status.point} ${colors.bright}Switch to workspace:${colors.reset}`);
  lines.push(`   ${colors.green}cd "${session.worktreePath}"${colors.reset}`);
  lines.push('');
  lines.push(`${status.point} ${colors.bright}Check your file locks:${colors.reset}`);
  lines.push(`   ${colors.green}cat .file-coordination/active-edits/${session.agent}-${session.id}.json${colors.reset}`);
  lines.push('');
  lines.push(`${status.point} ${colors.bright}Continue where you left off${colors.reset}`);
  lines.push(`   ${colors.dim}Your previous changes are preserved${colors.reset}`);
  lines.push(`   ${colors.dim}File locks are still active${colors.reset}`);
  lines.push('');
  lines.push(`${colors.dim}Write commits to: ${colors.cyan}.devops-commit-${session.id}.msg${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format multi-agent coordination message
 */
export function formatMultiAgentWarning(conflictingSession) {
  const lines = [];
  
  lines.push('');
  lines.push(colors.yellow + '⚠'.repeat(70) + colors.reset);
  lines.push(`${colors.yellow}${colors.bright} MULTI-AGENT COORDINATION ALERT${colors.reset}`);
  lines.push(colors.yellow + '⚠'.repeat(70) + colors.reset);
  lines.push('');
  lines.push(`${colors.bright}Another agent is working on related files:${colors.reset}`);
  lines.push('');
  lines.push(`   Session: ${colors.cyan}${conflictingSession.id}${colors.reset}`);
  lines.push(`   Agent: ${colors.cyan}${conflictingSession.agent}${colors.reset}`);
  lines.push(`   Task: ${conflictingSession.task}`);
  lines.push(`   Files locked: ${conflictingSession.lockedFiles.join(', ')}`);
  lines.push('');
  lines.push(`${colors.yellow}${status.warning} Recommended actions:${colors.reset}`);
  lines.push('');
  lines.push(`   1. ${colors.bright}Coordinate with user${colors.reset}`);
  lines.push(`      Ask which session should proceed first`);
  lines.push('');
  lines.push(`   2. ${colors.bright}Work on different files${colors.reset}`);
  lines.push(`      Choose non-conflicting files for now`);
  lines.push('');
  lines.push(`   3. ${colors.bright}Wait for other session to complete${colors.reset}`);
  lines.push(`      Files will be available after session closes`);
  lines.push('');
  lines.push(colors.yellow + '⚠'.repeat(70) + colors.reset);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format closing instructions
 */
export function formatClosingInstructions(session) {
  const lines = [];
  
  lines.push('');
  lines.push(`${status.checkmark} ${colors.bright}Ready to close session ${session.id}?${colors.reset}`);
  lines.push('');
  lines.push(`${colors.bright}What will happen:${colors.reset}`);
  lines.push('');
  lines.push(`   ${status.point} ${colors.cyan}Commit any pending changes${colors.reset}`);
  lines.push(`      Ensures all work is saved`);
  lines.push('');
  lines.push(`   ${status.point} ${colors.cyan}Merge to daily branch${colors.reset}`);
  lines.push(`      Integrates with today's work`);
  lines.push('');
  lines.push(`   ${status.point} ${colors.cyan}Merge to main branch${colors.reset}`);
  lines.push(`      Makes changes available to team`);
  lines.push('');
  lines.push(`   ${status.point} ${colors.cyan}Release file locks${colors.reset}`);
  lines.push(`      Files available for other agents`);
  lines.push('');
  lines.push(`   ${status.point} ${colors.cyan}Clean up worktree${colors.reset}`);
  lines.push(`      Removes session directory`);
  lines.push('');
  lines.push(`${colors.bright}Command:${colors.reset}`);
  lines.push(`   ${colors.green}s9n-devops-agent close ${session.id}${colors.reset}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format quick reference card
 */
export function formatQuickReference(session) {
  const lines = [];
  
  lines.push('');
  lines.push(box.topLeft + box.horizontal.repeat(68) + box.topRight);
  lines.push(box.vertical + ` ${colors.bright}Quick Reference - Session ${session.id}${colors.reset}`.padEnd(70) + box.vertical);
  lines.push(box.leftT + box.horizontal.repeat(68) + box.rightT);
  lines.push(box.vertical + ` ${colors.cyan}Essential Commands${colors.reset}`.padEnd(90) + box.vertical);
  lines.push(box.vertical + ' '.repeat(70) + box.vertical);
  lines.push(box.vertical + ` Switch workspace:    cd "${session.worktreePath}"`.padEnd(90) + box.vertical);
  lines.push(box.vertical + ` Declare files:       .file-coordination/active-edits/${session.agent}-${session.id}.json`.padEnd(140) + box.vertical);
  lines.push(box.vertical + ` Write commit:        .devops-commit-${session.id}.msg`.padEnd(98) + box.vertical);
  lines.push(box.vertical + ` Close session:       s9n-devops-agent close ${session.id}`.padEnd(100) + box.vertical);
  lines.push(box.bottomLeft + box.horizontal.repeat(68) + box.bottomRight);
  lines.push('');
  
  return lines.join('\n');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create session object from parameters
 */
export function createSession(id, task, agent, worktreePath, projectRoot) {
  return {
    id,
    task,
    agent,
    worktreePath,
    houseRulesPath: path.join(projectRoot, 'docs', 'houserules.md'),
    declaredFiles: [],
  };
}

/**
 * Get appropriate agent name display
 */
export function getAgentDisplayName(agentType) {
  const names = {
    claude: 'Claude',
    cursor: 'Cursor',
    copilot: 'GitHub Copilot',
    cline: 'Cline',
    warp: 'Warp',
    other: 'Other',
  };
  return names[agentType] || agentType;
}

export default {
  formatInstructions,
  formatCondensedInstructions,
  formatResumeInstructions,
  formatMultiAgentWarning,
  formatClosingInstructions,
  formatQuickReference,
  createSession,
  getAgentDisplayName,
};
