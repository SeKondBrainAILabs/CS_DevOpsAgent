#!/usr/bin/env node

/**
 * ============================================================================
 * AI COMMIT MESSAGE GENERATOR (via Groq/Llama 3)
 * ============================================================================
 * 
 * Generates conventional commit messages by analyzing staged changes.
 * Enforces project House Rules and commit conventions.
 * 
 * Usage:
 *   node scripts/generate-ai-commit.js
 *   node scripts/generate-ai-commit.js --dry-run
 * 
 * Configuration:
 *   Requires GROQ_API_KEY in .env or environment
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import Groq from 'groq-sdk';
import { credentialsManager } from '../src/credentials-manager.js';

// Inject credentials
credentialsManager.injectEnv();

const CONFIG = {
  model: 'llama-3.1-70b-versatile',
  maxDiffLength: 12000, // Characters
  houseRulesPath: 'houserules.md'
};

async function main() {
  try {
    // 1. Check for API Key
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY not found. Cannot generate AI commit message.');
      process.exit(1);
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // 2. Get Staged Diff
    let diff = '';
    try {
      diff = execSync('git diff --cached', { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    } catch (e) {
      console.error('❌ Failed to get git diff. Are there staged changes?');
      process.exit(1);
    }

    if (!diff.trim()) {
      console.log('ℹ️ No staged changes to analyze.');
      process.exit(0);
    }

    // Truncate diff if too large
    if (diff.length > CONFIG.maxDiffLength) {
      diff = diff.substring(0, CONFIG.maxDiffLength) + '\n... (truncated)';
    }

    // 3. Read House Rules (if available)
    let houseRules = '';
    if (fs.existsSync(CONFIG.houseRulesPath)) {
      houseRules = fs.readFileSync(CONFIG.houseRulesPath, 'utf8');
      // Truncate house rules to essential sections if needed to save context
      houseRules = houseRules.substring(0, 5000); 
    }

    // 4. Construct Prompt
    const prompt = `
You are a senior DevOps engineer and code reviewer.
Generate a conventional commit message for the following git diff.

CONTEXT:
- Project uses Semantic Versioning.
- Strict House Rules are in effect.

HOUSE RULES SUMMARY:
${houseRules}

INSTRUCTIONS:
1. Format: <type>(<scope>): <subject>
2. Followed by a blank line and a bulleted list of changes.
3. Type must be one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
4. Scope is the affected module/component (optional).
5. Subject must be imperative, lowercase, no period.
6. Check the diff for any violations of House Rules (e.g. console.logs, hardcoded secrets) and mention them in the body if critical.
7. Output ONLY the commit message. No markdown blocks, no conversational text.

GIT DIFF:
${diff}
`;

    // 5. Call AI
    console.log('🤖 Analyzing changes with Llama 3...');
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: prompt }
      ],
      model: CONFIG.model,
      temperature: 0.2, // Low temperature for deterministic output
      max_tokens: 500,
    });

    const commitMsg = completion.choices[0]?.message?.content?.trim();

    if (!commitMsg) {
      throw new Error('Received empty response from AI.');
    }

    // 6. Output or Save
    // If --dry-run, just print
    if (process.argv.includes('--dry-run')) {
      console.log('\n--- Generated Message ---\n');
      console.log(commitMsg);
      console.log('\n-------------------------\n');
    } else {
      // Determine output file
      const agentName = process.env.AGENT_NAME || 'claude';
      const outputFile = `.${agentName.toLowerCase()}-commit-msg`;
      fs.writeFileSync(outputFile, commitMsg);
      console.log(`✅ Commit message written to ${outputFile}`);
    }

  } catch (error) {
    console.error(`❌ Error generating commit message: ${error.message}`);
    process.exit(1);
  }
}

main();
