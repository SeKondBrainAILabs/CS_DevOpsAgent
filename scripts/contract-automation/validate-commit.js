#!/usr/bin/env node

/**
 * ============================================================================
 * COMMIT MESSAGE VALIDATOR WITH CONTRACT FLAGS
 * ============================================================================
 * 
 * This script validates commit messages and checks if contract files were
 * updated when the commit claims to modify contracts.
 * 
 * New Commit Format:
 * 
 * ```
 * feat(api): add user profile endpoint
 * 
 * Contracts: [SQL:T, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]
 * 
 * [WHY section...]
 * [WHAT section...]
 * ```
 * 
 * Contract Flags:
 *   SQL:T/F    - SQL_CONTRACT.json modified
 *   API:T/F    - API_CONTRACT.md modified
 *   DB:T/F     - DATABASE_SCHEMA_CONTRACT.md modified
 *   3RD:T/F    - THIRD_PARTY_INTEGRATIONS.md modified
 *   FEAT:T/F   - FEATURES_CONTRACT.md modified
 *   INFRA:T/F  - INFRA_CONTRACT.md modified
 * 
 * Usage:
 *   node scripts/contract-automation/validate-commit.js
 *   node scripts/contract-automation/validate-commit.js --commit-msg=.claude-commit-msg
 *   node scripts/contract-automation/validate-commit.js --check-staged
 * 
 * Options:
 *   --commit-msg=<path>  Path to commit message file (default: .claude-commit-msg)
 *   --check-staged       Check staged files in git
 *   --strict             Fail on warnings
 *   --auto-fix           Suggest correct contract flags
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  rootDir: process.cwd(),
  commitMsgFile: getArgValue('--commit-msg') || '.claude-commit-msg',
  checkStaged: process.argv.includes('--check-staged'),
  strict: process.argv.includes('--strict'),
  autoFix: process.argv.includes('--auto-fix'),
  contractsDir: 'House_Rules_Contracts'
};

// Contract file mapping
const CONTRACT_FILES = {
  SQL: 'SQL_CONTRACT.json',
  API: 'API_CONTRACT.md',
  DB: 'DATABASE_SCHEMA_CONTRACT.md',
  '3RD': 'THIRD_PARTY_INTEGRATIONS.md',
  FEAT: 'FEATURES_CONTRACT.md',
  INFRA: 'INFRA_CONTRACT.md'
};

// Helper: Get command line argument value
function getArgValue(argName) {
  const arg = process.argv.find(a => a.startsWith(argName + '='));
  return arg ? arg.split('=')[1] : null;
}

// Helper: Log with colors
function log(message, level = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    success: '\x1b[32m', // Green
    reset: '\x1b[0m'
  };
  
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]'
  }[level];
  
  const color = colors[level] || colors.reset;
  console.log(`${color}${prefix} ${message}${colors.reset}`);
}

// Helper: Read file safely
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

// ============================================================================
// COMMIT MESSAGE PARSING
// ============================================================================

function parseCommitMessage(content) {
  const lines = content.split('\n');
  
  // Extract subject line
  const subject = lines[0] || '';
  
  // Extract contract flags
  const contractLine = lines.find(l => l.trim().startsWith('Contracts:'));
  let contractFlags = {};
  
  if (contractLine) {
    const flagsMatch = contractLine.match(/\[(.*?)\]/);
    if (flagsMatch) {
      const flagsStr = flagsMatch[1];
      const flags = flagsStr.split(',').map(f => f.trim());
      
      for (const flag of flags) {
        const [key, value] = flag.split(':').map(s => s.trim());
        contractFlags[key] = value === 'T' || value === 'true';
      }
    }
  }
  
  // Extract WHY and WHAT sections
  const whyIndex = content.indexOf('[WHY');
  const whatIndex = content.indexOf('[WHAT');
  
  return {
    subject,
    contractFlags,
    hasContractLine: !!contractLine,
    hasWhy: whyIndex !== -1,
    hasWhat: whatIndex !== -1,
    raw: content
  };
}

// ============================================================================
// GIT FILE CHECKING
// ============================================================================

function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    log('Failed to get staged files. Not in a git repository?', 'warn');
    return [];
  }
}

function getModifiedContractFiles(stagedFiles) {
  const modified = {};
  
  for (const [key, filename] of Object.entries(CONTRACT_FILES)) {
    const filePath = path.join(CONFIG.contractsDir, filename);
    modified[key] = stagedFiles.includes(filePath);
  }
  
  return modified;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateCommitMessage(parsed) {
  const issues = [];
  const warnings = [];
  
  // Check subject line format
  if (!parsed.subject.match(/^(feat|fix|refactor|docs|test|chore|style)\(/)) {
    issues.push('Subject line must start with type(scope): (feat|fix|refactor|docs|test|chore|style)');
  }
  
  // Check for contract flags line
  if (!parsed.hasContractLine) {
    warnings.push('Missing "Contracts:" line. Add contract flags to enable automatic validation.');
  }
  
  // Check for WHY section
  if (!parsed.hasWhy) {
    warnings.push('Missing [WHY] section explaining motivation for changes.');
  }
  
  // Check for WHAT section
  if (!parsed.hasWhat) {
    warnings.push('Missing [WHAT] section listing specific file changes.');
  }
  
  return { issues, warnings };
}

function validateContractFlags(claimedFlags, actualModified) {
  const mismatches = [];
  const suggestions = [];
  
  // Check each contract type
  for (const [key, filename] of Object.entries(CONTRACT_FILES)) {
    const claimed = claimedFlags[key] || false;
    const actual = actualModified[key] || false;
    
    if (claimed && !actual) {
      mismatches.push({
        type: 'false_positive',
        contract: key,
        message: `Commit claims ${key}:T but ${filename} was NOT modified`
      });
      suggestions.push(`Change ${key}:T to ${key}:F`);
    }
    
    if (!claimed && actual) {
      mismatches.push({
        type: 'false_negative',
        contract: key,
        message: `${filename} was modified but commit claims ${key}:F or missing`
      });
      suggestions.push(`Change ${key}:F to ${key}:T (or add if missing)`);
    }
  }
  
  return { mismatches, suggestions };
}

// ============================================================================
// REPORTING
// ============================================================================

function generateReport(parsed, validation, contractValidation, stagedFiles) {
  log('='.repeat(80));
  log('COMMIT MESSAGE VALIDATION REPORT');
  log('='.repeat(80));
  
  // Subject line
  log(`Subject: ${parsed.subject}`);
  log('');
  
  // Contract flags
  if (parsed.hasContractLine) {
    log('Contract Flags:');
    for (const [key, value] of Object.entries(parsed.contractFlags)) {
      const status = value ? '✅ TRUE' : '❌ FALSE';
      log(`  ${key}: ${status}`);
    }
  } else {
    log('Contract Flags: ⚠️  NOT SPECIFIED', 'warn');
  }
  log('');
  
  // Validation issues
  if (validation.issues.length > 0) {
    log('ERRORS:', 'error');
    validation.issues.forEach(issue => log(`  ❌ ${issue}`, 'error'));
    log('');
  }
  
  if (validation.warnings.length > 0) {
    log('WARNINGS:', 'warn');
    validation.warnings.forEach(warning => log(`  ⚠️  ${warning}`, 'warn'));
    log('');
  }
  
  // Contract flag validation
  if (contractValidation.mismatches.length > 0) {
    log('CONTRACT FLAG MISMATCHES:', 'error');
    contractValidation.mismatches.forEach(mismatch => {
      log(`  ❌ ${mismatch.message}`, 'error');
    });
    log('');
    
    if (CONFIG.autoFix && contractValidation.suggestions.length > 0) {
      log('SUGGESTED FIXES:', 'info');
      contractValidation.suggestions.forEach(suggestion => {
        log(`  💡 ${suggestion}`, 'info');
      });
      log('');
    }
  }
  
  // Staged files
  if (CONFIG.checkStaged) {
    log('Staged Contract Files:');
    let anyStaged = false;
    for (const [key, filename] of Object.entries(CONTRACT_FILES)) {
      const filePath = path.join(CONFIG.contractsDir, filename);
      if (stagedFiles.includes(filePath)) {
        log(`  ✅ ${filename}`, 'success');
        anyStaged = true;
      }
    }
    if (!anyStaged) {
      log('  (none)', 'info');
    }
    log('');
  }
  
  // Final result
  log('='.repeat(80));
  
  const hasErrors = validation.issues.length > 0 || contractValidation.mismatches.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  
  if (hasErrors) {
    log('VALIDATION FAILED ❌', 'error');
    log('Please fix the errors above before committing.', 'error');
    return false;
  } else if (hasWarnings && CONFIG.strict) {
    log('VALIDATION FAILED ⚠️  (strict mode)', 'warn');
    log('Fix warnings or remove --strict flag.', 'warn');
    return false;
  } else if (hasWarnings) {
    log('VALIDATION PASSED WITH WARNINGS ⚠️', 'warn');
    log('Consider addressing warnings for better documentation.', 'warn');
    return true;
  } else {
    log('VALIDATION PASSED ✅', 'success');
    return true;
  }
}

// ============================================================================
// AUTO-FIX
// ============================================================================

function generateCorrectedCommitMessage(parsed, actualModified) {
  const lines = parsed.raw.split('\n');
  
  // Generate correct contract flags
  const flags = [];
  for (const [key, _] of Object.entries(CONTRACT_FILES)) {
    const value = actualModified[key] ? 'T' : 'F';
    flags.push(`${key}:${value}`);
  }
  const contractLine = `Contracts: [${flags.join(', ')}]`;
  
  // Find and replace contract line, or insert after subject
  const contractLineIndex = lines.findIndex(l => l.trim().startsWith('Contracts:'));
  
  if (contractLineIndex !== -1) {
    lines[contractLineIndex] = contractLine;
  } else {
    // Insert after subject line (index 0) and blank line
    lines.splice(2, 0, contractLine);
  }
  
  return lines.join('\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  log('='.repeat(80));
  log('COMMIT MESSAGE VALIDATOR');
  log('='.repeat(80));
  log('');
  
  // Read commit message
  const commitMsgPath = path.join(CONFIG.rootDir, CONFIG.commitMsgFile);
  if (!fs.existsSync(commitMsgPath)) {
    log(`Commit message file not found: ${commitMsgPath}`, 'error');
    process.exit(1);
  }
  
  const commitMsg = readFileSafe(commitMsgPath);
  if (!commitMsg) {
    log('Commit message is empty', 'error');
    process.exit(1);
  }
  
  // Parse commit message
  const parsed = parseCommitMessage(commitMsg);
  
  // Validate commit message format
  const validation = validateCommitMessage(parsed);
  
  // Get staged files and check contract modifications
  const stagedFiles = CONFIG.checkStaged ? getStagedFiles() : [];
  const actualModified = CONFIG.checkStaged ? getModifiedContractFiles(stagedFiles) : {};
  
  // Validate contract flags against actual changes
  const contractValidation = CONFIG.checkStaged 
    ? validateContractFlags(parsed.contractFlags, actualModified)
    : { mismatches: [], suggestions: [] };
  
  // Generate report
  const passed = generateReport(parsed, validation, contractValidation, stagedFiles);
  
  // Auto-fix if requested
  if (CONFIG.autoFix && contractValidation.mismatches.length > 0) {
    log('='.repeat(80));
    log('AUTO-FIX ENABLED', 'info');
    log('='.repeat(80));
    
    const corrected = generateCorrectedCommitMessage(parsed, actualModified);
    const correctedPath = commitMsgPath + '.corrected';
    
    fs.writeFileSync(correctedPath, corrected, 'utf8');
    log(`Corrected commit message saved to: ${correctedPath}`, 'success');
    log('Review and replace original if correct.', 'info');
  }
  
  log('='.repeat(80));
  
  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

// Run
main();
