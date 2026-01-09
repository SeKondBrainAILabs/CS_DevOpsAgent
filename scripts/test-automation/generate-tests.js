#!/usr/bin/env node

/**
 * ============================================================================
 * INTELLIGENT PLAYWRIGHT TEST GENERATOR
 * ============================================================================
 * 
 * This script analyzes code changes and generates/updates Playwright tests.
 * 
 * Usage:
 *   node scripts/test-automation/generate-tests.js --files="src/login.js,src/api.js"
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Groq from 'groq-sdk';
import { credentialsManager } from '../../src/credentials-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Attempt to load credentials
credentialsManager.injectEnv();

const CONFIG = {
  rootDir: process.cwd(),
  testDir: path.join(process.cwd(), 'tests'), // Default, can be inferred
  model: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
  verbose: process.argv.includes('--verbose')
};

// Initialize Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
});

function log(msg, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', warn: '⚠️', error: '❌', debug: '🐛' };
  if (type === 'debug' && !CONFIG.verbose) return;
  console.log(`${icons[type] || ''} ${msg}`);
}

function getChangedFiles() {
  const arg = process.argv.find(a => a.startsWith('--files='));
  if (arg) {
    return arg.split('=')[1].split(',').filter(Boolean);
  }
  return [];
}

function findPlaywrightConfig() {
  const configs = ['playwright.config.ts', 'playwright.config.js'];
  for (const c of configs) {
    if (fs.existsSync(path.join(CONFIG.rootDir, c))) return c;
  }
  return null;
}

async function generateTest(sourceFile) {
  if (!fs.existsSync(sourceFile)) return;
  
  const content = fs.readFileSync(sourceFile, 'utf8');
  const testName = path.basename(sourceFile).replace(/\.(js|ts|jsx|tsx)$/, '.spec.ts');
  
  // Try to find existing test
  // Heuristic: tests/ folder or co-located with spec/test suffix
  let testPath = path.join(CONFIG.rootDir, 'tests', testName);
  
  // If not found in default tests dir, check e2e dir if exists
  if (!fs.existsSync(testPath) && fs.existsSync(path.join(CONFIG.rootDir, 'e2e'))) {
      testPath = path.join(CONFIG.rootDir, 'e2e', testName);
  }

  const existingTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf8') : '';
  const action = existingTest ? 'Updating' : 'Generating';
  
  log(`${action} test for ${sourceFile}...`, 'info');

  const prompt = `
You are a Playwright QA Automation Engineer.

SOURCE CODE (${sourceFile}):
\`\`\`javascript
${content.slice(0, 10000)}
\`\`\`

EXISTING TEST (${testPath}):
\`\`\`typescript
${existingTest.slice(0, 5000)}
\`\`\`

INSTRUCTIONS:
1. Analyze the source code to identify user flows, UI interactions, and logical paths.
2. ${existingTest ? 'Update the existing test' : 'Create a new Playwright test'} to cover the functionality.
3. Use best practices: Page Object Model (if inferred), soft assertions, and resilient selectors.
4. Ensure tests are idempotent and isolated.
5. Output ONLY the full content of the typescript test file.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert Playwright test generator.' },
        { role: 'user', content: prompt }
      ],
      model: CONFIG.model,
      temperature: 0.2,
    });

    const newContent = completion.choices[0]?.message?.content || '';
    if (newContent) {
      const cleanContent = newContent.replace(/^```typescript\n|^```javascript\n|^```\n/, '').replace(/```$/, '');
      
      // Ensure directory exists
      fs.mkdirSync(path.dirname(testPath), { recursive: true });
      fs.writeFileSync(testPath, cleanContent.trim() + '\n');
      log(`Saved test: ${testPath}`, 'success');
    }
  } catch (err) {
    log(`Failed to generate test for ${sourceFile}: ${err.message}`, 'error');
  }
}

async function main() {
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    log('Skipping test generation: No API key.', 'warn');
    return;
  }

  const configFile = findPlaywrightConfig();
  if (!configFile) {
    log('No Playwright config found. Skipping test generation.', 'info');
    return;
  }

  const files = getChangedFiles();
  if (files.length === 0) {
    log('No source files changed.', 'info');
    return;
  }

  log(`Detected Playwright project (${configFile}). Analyzing ${files.length} changed files...`, 'info');

  for (const file of files) {
    // Only generate for source files (skip config, tests, etc.)
    if (!file.match(/\.(js|ts|jsx|tsx)$/) || file.includes('.spec.') || file.includes('.test.')) continue;
    
    await generateTest(file);
  }
}

main().catch(console.error);
