#!/usr/bin/env node

/**
 * ============================================================================
 * UI UTILITIES - Rich Formatting for DevOps Agent v2.0
 * ============================================================================
 * 
 * Provides consistent, beautiful UI components across the application:
 * - Box drawing with headers and borders
 * - Color-coded status indicators
 * - Progress displays
 * - Formatted lists
 * - Help dialogs
 * - Error messages with guidance
 * 
 * ============================================================================
 */

import readline from 'readline';

// ============================================================================
// COLORS & STYLES
// ============================================================================

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Box drawing characters
export const box = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
  
  // Double lines
  doubleTopLeft: '╔',
  doubleTopRight: '╗',
  doubleBottomLeft: '╚',
  doubleBottomRight: '╝',
  doubleHorizontal: '═',
  doubleVertical: '║',
};

// Status indicators
export const status = {
  active: '🟢',
  paused: '🟡',
  stopped: '🔴',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  question: '❓',
  rocket: '🚀',
  folder: '📁',
  file: '📄',
  lock: '🔒',
  unlock: '🔓',
  branch: '🌿',
  commit: '📝',
  merge: '🔀',
  robot: '🤖',
  book: '📖',
  chart: '📊',
  clock: '🕐',
  checkmark: '✓',
  xmark: '✗',
  arrow: '→',
  point: '•',
};

// ============================================================================
// BOX DRAWING FUNCTIONS
// ============================================================================

/**
 * Draw a header box with title
 */
export function drawHeader(title, options = {}) {
  const width = options.width || 70;
  const padding = Math.floor((width - title.length - 2) / 2);
  const leftPad = ' '.repeat(padding);
  const rightPad = ' '.repeat(width - title.length - padding - 2);
  
  console.log();
  console.log(box.doubleTopLeft + box.doubleHorizontal.repeat(width) + box.doubleTopRight);
  console.log(box.doubleVertical + leftPad + title + rightPad + box.doubleVertical);
  console.log(box.doubleBottomLeft + box.doubleHorizontal.repeat(width) + box.doubleBottomRight);
  console.log();
}

/**
 * Draw a section box
 */
export function drawSection(title, content, options = {}) {
  const width = options.width || 70;
  
  // Title line
  console.log();
  console.log(box.topLeft + box.horizontal + ` ${title} ` + box.horizontal.repeat(width - title.length - 3) + box.topRight);
  
  // Content
  if (Array.isArray(content)) {
    content.forEach(line => {
      const padded = line + ' '.repeat(width - stripAnsi(line).length);
      console.log(box.vertical + ' ' + padded + box.vertical);
    });
  } else {
    const lines = content.split('\n');
    lines.forEach(line => {
      const padded = line + ' '.repeat(width - stripAnsi(line).length);
      console.log(box.vertical + ' ' + padded + box.vertical);
    });
  }
  
  // Bottom
  console.log(box.bottomLeft + box.horizontal.repeat(width + 2) + box.bottomRight);
}

/**
 * Draw a simple box
 */
export function drawBox(content, options = {}) {
  const width = options.width || 70;
  
  console.log();
  console.log(box.topLeft + box.horizontal.repeat(width + 2) + box.topRight);
  
  if (Array.isArray(content)) {
    content.forEach(line => {
      const padded = line + ' '.repeat(width - stripAnsi(line).length);
      console.log(box.vertical + ' ' + padded + ' ' + box.vertical);
    });
  } else {
    const lines = content.split('\n');
    lines.forEach(line => {
      const padded = line + ' '.repeat(width - stripAnsi(line).length);
      console.log(box.vertical + ' ' + padded + ' ' + box.vertical);
    });
  }
  
  console.log(box.bottomLeft + box.horizontal.repeat(width + 2) + box.bottomRight);
  console.log();
}

/**
 * Strip ANSI color codes for length calculation
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ============================================================================
// FORMATTED OUTPUT
// ============================================================================

/**
 * Print success message
 */
export function success(message) {
  console.log(`${colors.green}${status.checkmark}${colors.reset} ${message}`);
}

/**
 * Print error message
 */
export function error(message) {
  console.log(`${colors.red}${status.xmark}${colors.reset} ${message}`);
}

/**
 * Print warning message
 */
export function warn(message) {
  console.log(`${colors.yellow}${status.warning}${colors.reset} ${message}`);
}

/**
 * Print info message
 */
export function info(message) {
  console.log(`${colors.cyan}${status.info}${colors.reset} ${message}`);
}

/**
 * Print a section title
 */
export function sectionTitle(title) {
  console.log();
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(colors.dim + '─'.repeat(title.length) + colors.reset);
  console.log();
}

/**
 * Print an explanation
 */
export function explain(text) {
  const lines = text.split('\n');
  lines.forEach(line => {
    console.log(`${colors.dim}${line}${colors.reset}`);
  });
}

/**
 * Print a tip
 */
export function tip(message) {
  console.log(`${colors.cyan}💡 Tip:${colors.reset} ${colors.dim}${message}${colors.reset}`);
}

// ============================================================================
// INTERACTIVE PROMPTS
// ============================================================================

/**
 * Prompt user for input
 */
export async function prompt(question, defaultValue = null) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const promptText = defaultValue 
      ? `${question} ${colors.dim}[${defaultValue}]${colors.reset}: `
      : `${question}: `;
    
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirm(question, defaultYes = true) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const suffix = defaultYes ? '[Y/n]' : '[y/N]';
  
  return new Promise((resolve) => {
    rl.question(`${question} ${colors.dim}${suffix}${colors.reset}: `, (answer) => {
      rl.close();
      const cleaned = answer.trim().toLowerCase();
      
      if (cleaned === '') {
        resolve(defaultYes);
      } else {
        resolve(cleaned === 'y' || cleaned === 'yes');
      }
    });
  });
}

/**
 * Prompt for choice from list
 */
export async function choose(question, choices, options = {}) {
  console.log();
  console.log(`${colors.bright}${question}${colors.reset}`);
  console.log();
  
  choices.forEach((choice, index) => {
    const num = index + 1;
    if (typeof choice === 'object') {
      console.log(`  ${colors.bright}${num})${colors.reset} ${choice.label}`);
      if (choice.description) {
        console.log(`     ${colors.dim}${choice.description}${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.bright}${num})${colors.reset} ${choice}`);
    }
  });
  
  console.log();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const promptText = options.defaultChoice 
      ? `Your choice ${colors.dim}[${options.defaultChoice}]${colors.reset}: `
      : 'Your choice: ';
    
    rl.question(promptText, (answer) => {
      rl.close();
      const cleaned = answer.trim() || options.defaultChoice;
      const num = parseInt(cleaned);
      
      if (num >= 1 && num <= choices.length) {
        resolve(num - 1);
      } else {
        console.log(`${colors.red}Invalid choice. Please try again.${colors.reset}`);
        resolve(choose(question, choices, options));
      }
    });
  });
}

// ============================================================================
// PROGRESS & STATUS
// ============================================================================

/**
 * Show a progress step
 */
export function progressStep(step, total, message) {
  console.log(`${colors.cyan}[${step}/${total}]${colors.reset} ${message}`);
}

/**
 * Show loading spinner (returns function to stop it)
 */
export function spinner(message) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  
  process.stdout.write(`${message} ${frames[0]}`);
  
  const interval = setInterval(() => {
    index = (index + 1) % frames.length;
    process.stdout.write(`\r${message} ${frames[index]}`);
  }, 80);
  
  return () => {
    clearInterval(interval);
    process.stdout.write(`\r${message} ${colors.green}${status.checkmark}${colors.reset}\n`);
  };
}

// ============================================================================
// HELP DISPLAY
// ============================================================================

/**
 * Display contextual help
 */
export function showHelp(topic, content) {
  console.log();
  console.log(box.doubleTopLeft + box.doubleHorizontal.repeat(68) + box.doubleTopRight);
  console.log(box.doubleVertical + `  ${status.question} Help: ${topic}` + ' '.repeat(68 - topic.length - 11) + box.doubleVertical);
  console.log(box.doubleBottomLeft + box.doubleHorizontal.repeat(68) + box.doubleBottomRight);
  console.log();
  
  if (typeof content === 'object') {
    Object.entries(content).forEach(([section, text]) => {
      console.log(`${colors.bright}${colors.cyan}${section.toUpperCase()}:${colors.reset}`);
      console.log(text);
      console.log();
    });
  } else {
    console.log(content);
    console.log();
  }
  
  console.log(`${colors.dim}[Press any key to continue]${colors.reset}`);
  
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

// ============================================================================
// ERROR DISPLAY WITH GUIDANCE
// ============================================================================

/**
 * Display error with actionable guidance
 */
export function showError(errorMessage, guidance) {
  console.log();
  console.log(`${colors.red}${status.error} Error: ${errorMessage}${colors.reset}`);
  console.log();
  
  if (guidance.what) {
    console.log(`${colors.bright}💡 What happened?${colors.reset}`);
    console.log(`   ${guidance.what}`);
    console.log();
  }
  
  if (guidance.why) {
    console.log(`${colors.bright}🔍 Why did this happen?${colors.reset}`);
    if (Array.isArray(guidance.why)) {
      guidance.why.forEach(reason => {
        console.log(`   ${status.point} ${reason}`);
      });
    } else {
      console.log(`   ${guidance.why}`);
    }
    console.log();
  }
  
  if (guidance.fix) {
    console.log(`${colors.bright}${colors.green}🔧 How to fix:${colors.reset}`);
    if (Array.isArray(guidance.fix)) {
      guidance.fix.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    } else {
      console.log(`   ${guidance.fix}`);
    }
    console.log();
  }
  
  if (guidance.learn) {
    console.log(`${colors.dim}📚 Learn more: ${guidance.learn}${colors.reset}`);
    console.log();
  }
}

// ============================================================================
// WELCOME BANNER
// ============================================================================

/**
 * Display welcome banner
 */
export function showWelcome(version = '2.0.0') {
  console.log();
  console.log(box.doubleTopLeft + box.doubleHorizontal.repeat(68) + box.doubleTopRight);
  console.log(box.doubleVertical + '                                                                    ' + box.doubleVertical);
  console.log(box.doubleVertical + `   ${status.robot} ${colors.bright}Welcome to DevOps Agent${colors.reset}` + ' '.repeat(36) + box.doubleVertical);
  console.log(box.doubleVertical + '                                                                    ' + box.doubleVertical);
  console.log(box.doubleVertical + `   ${colors.dim}AI-Powered Git Workflow Automation${colors.reset}` + ' '.repeat(30) + box.doubleVertical);
  console.log(box.doubleVertical + `   ${colors.dim}Version ${version}${colors.reset}` + ' '.repeat(52 - version.length) + box.doubleVertical);
  console.log(box.doubleVertical + '                                                                    ' + box.doubleVertical);
  console.log(box.doubleBottomLeft + box.doubleHorizontal.repeat(68) + box.doubleBottomRight);
  console.log();
}

/**
 * Display copyright
 */
export function showCopyright() {
  console.log();
  console.log(`${colors.dim}Copyright © 2025 SeKondBrain AI Labs Limited. All rights reserved.${colors.reset}`);
  console.log(`${colors.dim}Licensed under the MIT License${colors.reset}`);
  console.log();
}

export default {
  colors,
  box,
  status,
  drawHeader,
  drawSection,
  drawBox,
  success,
  error,
  warn,
  info,
  sectionTitle,
  explain,
  tip,
  prompt,
  confirm,
  choose,
  progressStep,
  spinner,
  showHelp,
  showError,
  showWelcome,
  showCopyright,
};
