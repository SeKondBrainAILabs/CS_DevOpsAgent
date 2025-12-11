#!/usr/bin/env node

/**
 * ============================================================================
 * LLM-POWERED CONTRACT ANALYSIS SCRIPT
 * ============================================================================
 * 
 * This script uses Groq LLM to perform intelligent analysis of code and
 * generate human-readable contract documentation.
 * 
 * Usage:
 *   node scripts/contract-automation/analyze-with-llm.js --scan-results=path/to/results.json
 *   node scripts/contract-automation/analyze-with-llm.js --analyze-file=src/features/auth/index.js
 *   node scripts/contract-automation/analyze-with-llm.js --validate-contracts
 * 
 * Options:
 *   --scan-results=<path>   Use scan results from generate-contracts.js
 *   --analyze-file=<path>   Analyze specific file
 *   --validate-contracts    Validate existing contracts for completeness
 *   --model=<name>          Groq model to use (default: llama-3.1-70b-versatile)
 *   --verbose               Detailed logging
 * 
 * Environment Variables:
 *   OPENAI_API_KEY          Required - Groq API key (OpenAI-compatible endpoint)
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { credentialsManager } from '../../src/credentials-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Attempt to load credentials manager for local key injection
credentialsManager.injectEnv();

// Configuration
const CONFIG = {
  rootDir: process.cwd(),
  contractsDir: path.join(process.cwd(), 'House_Rules_Contracts'),
  verbose: process.argv.includes('--verbose'),
  scanResults: getArgValue('--scan-results'),
  analyzeFile: getArgValue('--analyze-file'),
  validateContracts: process.argv.includes('--validate-contracts'),
  model: getArgValue('--model') || 'llama-3.1-70b-versatile'
};

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
});

// Helper: Get command line argument value
function getArgValue(argName) {
  const arg = process.argv.find(a => a.startsWith(argName + '='));
  return arg ? arg.split('=')[1] : null;
}

// Helper: Log with optional verbose mode
function log(message, level = 'info') {
  const prefix = {
    info: '[INFO]',
    warn: '[WARN]',
    error: '[ERROR]',
    success: '[SUCCESS]',
    debug: '[DEBUG]'
  }[level];
  
  if (level === 'debug' && !CONFIG.verbose) return;
  
  console.log(`${prefix} ${message}`);
}

// Helper: Read file safely
function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    log(`Failed to read ${filePath}: ${error.message}`, 'warn');
    return '';
  }
}

// Helper: Write JSON file
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ============================================================================
// LLM INTERACTION
// ============================================================================

async function callLLM(prompt, systemPrompt = 'You are a helpful assistant.') {
  try {
    log(`Calling LLM (${CONFIG.model})...`, 'debug');
    
    const response = await groq.chat.completions.create({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more deterministic output
      max_tokens: 4000
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    log(`LLM call failed: ${error.message}`, 'error');
    throw error;
  }
}

// ============================================================================
// FEATURE ANALYSIS
// ============================================================================

async function analyzeFeatures(features) {
  log('Analyzing features with LLM...');
  
  const systemPrompt = `You are a software architect analyzing a codebase. 
Your task is to analyze feature information and provide detailed documentation including:
- Clear feature descriptions
- User stories
- Acceptance criteria
- Dependencies
- Priority assessment

Output should be in JSON format.`;
  
  const prompt = `Analyze these features and provide detailed documentation for each:

${JSON.stringify(features, null, 2)}

For each feature, provide:
1. A clear description (2-3 sentences)
2. A user story in format: "As a [user type], I want to [action] so that [benefit]"
3. 3-5 acceptance criteria
4. Likely dependencies on other features
5. Priority assessment (critical/high/medium/low) with reasoning

Return as JSON array with same structure plus new fields: description, userStory, acceptanceCriteria, dependencies, priorityReasoning.`;
  
  const result = await callLLM(prompt, systemPrompt);
  
  try {
    return JSON.parse(result);
  } catch (error) {
    log('Failed to parse LLM response as JSON, returning raw text', 'warn');
    return { raw: result };
  }
}

// ============================================================================
// API ENDPOINT ANALYSIS
// ============================================================================

async function analyzeAPIEndpoints(endpoints) {
  log('Analyzing API endpoints with LLM...');
  
  const systemPrompt = `You are an API documentation expert.
Analyze API endpoints and provide comprehensive documentation including:
- Endpoint purpose and description
- Expected request/response formats
- Authentication requirements
- Error scenarios
- Usage examples

Output should be in JSON format.`;
  
  const prompt = `Analyze these API endpoints and provide detailed documentation:

${JSON.stringify(endpoints.slice(0, 20), null, 2)}

For each endpoint, infer and provide:
1. Purpose and description
2. Likely authentication requirement (yes/no)
3. Expected request parameters (path, query, body)
4. Expected response format
5. Common error scenarios
6. Usage example (curl command)

Return as JSON array with enhanced documentation.`;
  
  const result = await callLLM(prompt, systemPrompt);
  
  try {
    return JSON.parse(result);
  } catch (error) {
    log('Failed to parse LLM response as JSON, returning raw text', 'warn');
    return { raw: result };
  }
}

// ============================================================================
// SQL QUERY ANALYSIS
// ============================================================================

async function analyzeSQLQueries(queries) {
  log('Analyzing SQL queries with LLM...');
  
  const systemPrompt = `You are a database expert analyzing SQL queries.
Provide insights on:
- Query purpose and description
- Performance considerations
- Security concerns
- Suggested optimizations
- Parameter types and validation

Output should be in JSON format.`;
  
  const queryList = Object.values(queries).slice(0, 10);
  
  const prompt = `Analyze these SQL queries and provide documentation:

${JSON.stringify(queryList, null, 2)}

For each query, provide:
1. Clear description of what it does
2. Performance notes (indexes needed, complexity)
3. Security notes (SQL injection risks, data sensitivity)
4. Parameter types and validation rules
5. Suggested optimizations if any

Return as JSON array with enhanced documentation.`;
  
  const result = await callLLM(prompt, systemPrompt);
  
  try {
    return JSON.parse(result);
  } catch (error) {
    log('Failed to parse LLM response as JSON, returning raw text', 'warn');
    return { raw: result };
  }
}

// ============================================================================
// THIRD-PARTY INTEGRATION ANALYSIS
// ============================================================================

async function analyzeIntegrations(integrations) {
  log('Analyzing third-party integrations with LLM...');
  
  const systemPrompt = `You are a software integration expert.
Analyze third-party service integrations and provide:
- Service purpose and use cases
- Best practices for integration
- Error handling strategies
- Security considerations
- Cost optimization tips

Output should be in JSON format.`;
  
  const prompt = `Analyze these third-party integrations and provide documentation:

${JSON.stringify(integrations, null, 2)}

For each integration, provide:
1. Detailed purpose and use cases
2. Recommended error handling strategy
3. Security best practices
4. Rate limiting considerations
5. Cost optimization suggestions
6. Alternative services (if applicable)

Return as JSON array with enhanced documentation.`;
  
  const result = await callLLM(prompt, systemPrompt);
  
  try {
    return JSON.parse(result);
  } catch (error) {
    log('Failed to parse LLM response as JSON, returning raw text', 'warn');
    return { raw: result };
  }
}

// ============================================================================
// FILE ANALYSIS
// ============================================================================

async function analyzeFile(filePath) {
  log(`Analyzing file: ${filePath}`);
  
  const content = readFileSafe(filePath);
  if (!content) {
    throw new Error(`Could not read file: ${filePath}`);
  }
  
  const systemPrompt = `You are a code analysis expert.
Analyze the provided code file and extract:
- Purpose and functionality
- API endpoints (if any)
- Database queries (if any)
- Third-party integrations (if any)
- Environment variables used
- Dependencies on other modules
- Security considerations
- Suggested improvements

Provide structured analysis in JSON format.`;
  
  const prompt = `Analyze this code file and provide comprehensive documentation:

File: ${filePath}

\`\`\`
${content.slice(0, 10000)} ${content.length > 10000 ? '... (truncated)' : ''}
\`\`\`

Provide:
1. Module purpose and description
2. Exported functions/classes with descriptions
3. API endpoints defined (method, path, purpose)
4. Database queries used (with purpose)
5. Third-party services integrated
6. Environment variables required
7. Dependencies on other modules
8. Security considerations
9. Suggested improvements or concerns

Return as structured JSON.`;
  
  const result = await callLLM(prompt, systemPrompt);
  
  try {
    return JSON.parse(result);
  } catch (error) {
    log('Failed to parse LLM response as JSON, returning raw text', 'warn');
    return { raw: result };
  }
}

// ============================================================================
// CONTRACT VALIDATION
// ============================================================================

async function validateContracts() {
  log('Validating existing contracts with LLM...');
  
  const contracts = {
    features: path.join(CONFIG.contractsDir, 'FEATURES_CONTRACT.md'),
    api: path.join(CONFIG.contractsDir, 'API_CONTRACT.md'),
    database: path.join(CONFIG.contractsDir, 'DATABASE_SCHEMA_CONTRACT.md'),
    sql: path.join(CONFIG.contractsDir, 'SQL_CONTRACT.json'),
    integrations: path.join(CONFIG.contractsDir, 'THIRD_PARTY_INTEGRATIONS.md'),
    infra: path.join(CONFIG.contractsDir, 'INFRA_CONTRACT.md')
  };
  
  const validation = {};
  
  for (const [name, filePath] of Object.entries(contracts)) {
    if (!fs.existsSync(filePath)) {
      validation[name] = {
        exists: false,
        complete: false,
        issues: ['Contract file does not exist']
      };
      continue;
    }
    
    const content = readFileSafe(filePath);
    
    const systemPrompt = `You are a documentation quality expert.
Analyze contract documentation and identify:
- Completeness (are all sections filled?)
- Missing information
- Inconsistencies
- Suggestions for improvement

Output should be in JSON format.`;
    
    const prompt = `Analyze this contract file for completeness and quality:

File: ${name}

\`\`\`
${content.slice(0, 5000)} ${content.length > 5000 ? '... (truncated)' : ''}
\`\`\`

Provide:
1. Is the contract complete? (true/false)
2. Completion percentage (0-100)
3. List of missing sections or information
4. List of inconsistencies or errors
5. Suggestions for improvement

Return as JSON with fields: complete, completionPercentage, missingSections, inconsistencies, suggestions.`;
    
    const result = await callLLM(prompt, systemPrompt);
    
    try {
      validation[name] = JSON.parse(result);
      validation[name].exists = true;
    } catch (error) {
      validation[name] = {
        exists: true,
        complete: false,
        error: 'Failed to parse validation result',
        raw: result
      };
    }
  }
  
  return validation;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('='.repeat(80));
  log('LLM-POWERED CONTRACT ANALYSIS');
  log('='.repeat(80));
  
  // Check API key
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is required. Please set it or run "s9n-devops-agent setup" to configure your Groq API key.');
  }
  
  let results = {};
  
  // Analyze scan results
  if (CONFIG.scanResults) {
    log(`Loading scan results from: ${CONFIG.scanResults}`);
    const scanData = JSON.parse(readFileSafe(CONFIG.scanResults));
    
    if (scanData.results.features) {
      results.features = await analyzeFeatures(scanData.results.features);
    }
    
    if (scanData.results.api) {
      results.api = await analyzeAPIEndpoints(scanData.results.api);
    }
    
    if (scanData.results.sql) {
      results.sql = await analyzeSQLQueries(scanData.results.sql);
    }
    
    if (scanData.results.integrations) {
      results.integrations = await analyzeIntegrations(scanData.results.integrations);
    }
  }
  
  // Analyze specific file
  if (CONFIG.analyzeFile) {
    results.fileAnalysis = await analyzeFile(CONFIG.analyzeFile);
  }
  
  // Validate contracts
  if (CONFIG.validateContracts) {
    results.validation = await validateContracts();
  }
  
  // Save results
  const outputPath = path.join(CONFIG.contractsDir, 'llm-analysis-results.json');
  writeJSON(outputPath, {
    generated: new Date().toISOString(),
    model: CONFIG.model,
    results
  });
  
  log(`Results saved to: ${outputPath}`, 'success');
  
  // Summary
  log('='.repeat(80));
  log('ANALYSIS COMPLETE', 'success');
  log('='.repeat(80));
  
  if (results.validation) {
    log('Contract Validation Results:');
    for (const [name, result] of Object.entries(results.validation)) {
      if (result.exists) {
        const status = result.complete ? '✅' : '⚠️';
        const pct = result.completionPercentage || 0;
        log(`  ${status} ${name}: ${pct}% complete`);
      } else {
        log(`  ❌ ${name}: Does not exist`);
      }
    }
  }
  
  log('='.repeat(80));
}

// Run
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
