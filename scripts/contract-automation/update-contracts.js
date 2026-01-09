#!/usr/bin/env node

/**
 * ============================================================================
 * INTELLIGENT CONTRACT UPDATE SCRIPT
 * ============================================================================
 * 
 * This script orchestrates the contract update process:
 * 1. Scans the codebase using generate-contracts.js (static analysis)
 * 2. Reads existing Markdown contracts
 * 3. Uses LLM to intelligently merge new findings into the existing documentation
 * 4. Updates the contract files in place
 * 
 * Usage:
 *   node scripts/contract-automation/update-contracts.js
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
  contractsDir: path.join(process.cwd(), 'House_Rules_Contracts'),
  scriptsDir: __dirname,
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

// 1. Run Static Scan
function runStaticScan() {
  log('Running static codebase scan...', 'info');
  const generateScript = path.join(CONFIG.scriptsDir, 'generate-contracts.js');
  
  try {
    execSync(`node "${generateScript}" --output="${CONFIG.contractsDir}"`, { stdio: 'pipe' });
    const resultsPath = path.join(CONFIG.contractsDir, 'contract-scan-results.json');
    if (fs.existsSync(resultsPath)) {
      return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    }
  } catch (err) {
    log(`Static scan failed: ${err.message}`, 'error');
  }
  return null;
}

// 2. Update a specific contract file using LLM
async function updateContractFile(filename, scanSection, scanData, systemPrompt) {
  const filePath = path.join(CONFIG.contractsDir, filename);
  let currentContent = '';
  
  if (fs.existsSync(filePath)) {
    currentContent = fs.readFileSync(filePath, 'utf8');
  } else {
    log(`${filename} does not exist, creating new...`, 'warn');
    currentContent = `# ${filename.replace('.md', '').replace(/_/g, ' ')}\n\n(Auto-generated contract)\n`;
  }

  // If no scan data for this section, skip (or maybe verify completeness?)
  if (!scanData || (Array.isArray(scanData) && scanData.length === 0)) {
    log(`No scan data found for ${filename}, skipping update.`, 'debug');
    return;
  }

  log(`Updating ${filename} with LLM...`, 'info');

  const prompt = `
You are maintaining a technical contract file: ${filename}.

CURRENT CONTENT:
\`\`\`markdown
${currentContent}
\`\`\`

NEW SCAN DATA (from code analysis):
\`\`\`json
${JSON.stringify(scanData, null, 2).slice(0, 15000)} 
\`\`\`
(Note: JSON truncated if too large)

INSTRUCTIONS:
1. Update the contract documentation to reflect the NEW SCAN DATA.
2. Preserve existing manual descriptions, context, or business logic if they are still valid.
3. Add new items found in the scan.
4. Mark items as "Missing from code" or remove them if they are in the contract but not in the scan (use your judgment - if it looks like a planned feature, keep it marked as planned).
5. Maintain the existing Markdown structure/format.
6. Output ONLY the full updated Markdown content. Do not include prologue/epilogue text.
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: CONFIG.model,
      temperature: 0.1, // Low temp for stability
    });

    const newContent = completion.choices[0]?.message?.content || '';
    if (newContent) {
      // Strip markdown code blocks if the LLM wrapped it
      const cleanContent = newContent.replace(/^```markdown\n/, '').replace(/```$/, '');
      fs.writeFileSync(filePath, cleanContent.trim() + '\n');
      log(`Updated ${filename}`, 'success');
    }
  } catch (err) {
    log(`Failed to update ${filename}: ${err.message}`, 'error');
  }
}

// Main orchestration
async function main() {
  // 1. Always run Static Scan first to ensure JSON data is fresh
  const scanResult = runStaticScan();
  if (!scanResult || !scanResult.results) {
    log('Scan produced no results.', 'error');
    return;
  }

  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    log('Skipping intelligent markdown update: No API key found. (JSON results updated)', 'warn');
    return;
  }
  
  const data = scanResult.results;

  // 2. Update API Contract
  await updateContractFile(
    'API_CONTRACT.md', 
    'api', 
    data.api, 
    'You are an API documentation expert. Maintain a single source of truth for API endpoints.'
  );

  // 3. Update Database Schema
  await updateContractFile(
    'DATABASE_SCHEMA_CONTRACT.md', 
    'database', 
    data.database, 
    'You are a Database Architect. Maintain the schema contract based on migrations and Prisma schemas.'
  );

  // 4. Update Features
  await updateContractFile(
    'FEATURES_CONTRACT.md', 
    'features', 
    data.features, 
    'You are a Product Owner. Maintain the features list, tracking status based on code existence.'
  );

  // 5. Update Integrations
  await updateContractFile(
    'THIRD_PARTY_INTEGRATIONS.md', 
    'integrations', 
    data.integrations, 
    'You are a Solution Architect. Track third-party dependencies and their purpose.'
  );

  // 6. Update Infra (Env Vars)
  await updateContractFile(
    'INFRA_CONTRACT.md', 
    'envVars', 
    data.envVars, 
    'You are a DevOps Engineer. Maintain the environment variable contract (Infrastructure).'
  );

  log('All contracts processed.', 'success');
}

main().catch(console.error);
