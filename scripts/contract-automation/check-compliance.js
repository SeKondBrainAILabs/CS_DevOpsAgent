#!/usr/bin/env node

/**
 * ============================================================================
 * CONTRACT COMPLIANCE CHECKER
 * ============================================================================
 * 
 * This script checks if the codebase is in sync with contract files.
 * It detects:
 * - Features in code but not in FEATURES_CONTRACT.md
 * - API endpoints in code but not in API_CONTRACT.md
 * - Database tables in migrations but not in DATABASE_SCHEMA_CONTRACT.md
 * - SQL queries in code but not in SQL_CONTRACT.json
 * - Third-party services in package.json but not in THIRD_PARTY_INTEGRATIONS.md
 * - Environment variables in code but not in INFRA_CONTRACT.md
 * 
 * Usage:
 *   node scripts/contract-automation/check-compliance.js
 *   node scripts/contract-automation/check-compliance.js --fix
 *   node scripts/contract-automation/check-compliance.js --report=json
 * 
 * Options:
 *   --fix              Generate missing contract entries
 *   --report=<format>  Output format (text|json|html)
 *   --strict           Exit with error if any discrepancies found
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  rootDir: process.cwd(),
  contractsDir: path.join(process.cwd(), 'House_Rules_Contracts'),
  fix: process.argv.includes('--fix'),
  report: getArgValue('--report') || 'text',
  strict: process.argv.includes('--strict')
};

// Helper: Get command line argument value
function getArgValue(argName) {
  const arg = process.argv.find(a => a.startsWith(argName + '='));
  return arg ? arg.split('=')[1] : null;
}

// Helper: Log
function log(message, level = 'info') {
  const colors = {
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    success: '\x1b[32m',
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

// Helper: Find files
function findFiles(pattern, dir = CONFIG.rootDir) {
  try {
    const result = execSync(`find ${dir} -type f ${pattern}`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

// ============================================================================
// CONTRACT READERS
// ============================================================================

function readFeaturesContract() {
  const filePath = path.join(CONFIG.contractsDir, 'FEATURES_CONTRACT.md');
  if (!fs.existsSync(filePath)) return [];
  
  const content = readFileSafe(filePath);
  const features = [];
  
  // Extract feature IDs and names
  const matches = content.matchAll(/Feature ID:\s*\[?(F-\d+)\]?\s*-\s*(.+)/gi);
  for (const match of matches) {
    features.push({
      id: match[1],
      name: match[2].trim()
    });
  }
  
  return features;
}

function readAPIContract() {
  const filePath = path.join(CONFIG.contractsDir, 'API_CONTRACT.md');
  if (!fs.existsSync(filePath)) return [];
  
  const content = readFileSafe(filePath);
  const endpoints = [];
  
  // Extract endpoints
  const matches = content.matchAll(/####?\s*`(GET|POST|PUT|DELETE|PATCH)\s+(.+?)`/gi);
  for (const match of matches) {
    endpoints.push({
      method: match[1].toUpperCase(),
      path: match[2].trim()
    });
  }
  
  return endpoints;
}

function readDatabaseContract() {
  const filePath = path.join(CONFIG.contractsDir, 'DATABASE_SCHEMA_CONTRACT.md');
  if (!fs.existsSync(filePath)) return [];
  
  const content = readFileSafe(filePath);
  const tables = [];
  
  // Extract table names
  const matches = content.matchAll(/###\s+Table:\s+(\w+)/gi);
  for (const match of matches) {
    tables.push(match[1]);
  }
  
  return tables;
}

function readSQLContract() {
  const filePath = path.join(CONFIG.contractsDir, 'SQL_CONTRACT.json');
  if (!fs.existsSync(filePath)) return [];
  
  try {
    const content = readFileSafe(filePath);
    const data = JSON.parse(content);
    return Object.keys(data.queries || {});
  } catch (error) {
    return [];
  }
}

function readIntegrationsContract() {
  const filePath = path.join(CONFIG.contractsDir, 'THIRD_PARTY_INTEGRATIONS.md');
  if (!fs.existsSync(filePath)) return [];
  
  const content = readFileSafe(filePath);
  const integrations = [];
  
  // Extract service names
  const matches = content.matchAll(/###\s+(.+?)\s+\(/gi);
  for (const match of matches) {
    integrations.push(match[1].trim());
  }
  
  return integrations;
}

function readInfraContract() {
  const filePath = path.join(CONFIG.contractsDir, 'INFRA_CONTRACT.md');
  if (!fs.existsSync(filePath)) return [];
  
  const content = readFileSafe(filePath);
  const envVars = [];
  
  // Extract environment variables
  const matches = content.matchAll(/`([A-Z_][A-Z0-9_]*)`/g);
  for (const match of matches) {
    if (!envVars.includes(match[1])) {
      envVars.push(match[1]);
    }
  }
  
  return envVars;
}

// ============================================================================
// CODE SCANNERS (reuse from generate-contracts.js logic)
// ============================================================================

function scanCodeForFeatures() {
  const featureDirs = [
    ...findFiles('-path "*/src/features/*" -type d'),
    ...findFiles('-path "*/src/modules/*" -type d')
  ];
  
  const features = [];
  for (const dir of featureDirs) {
    const featureName = path.basename(dir);
    if (featureName !== 'features' && featureName !== 'modules') {
      features.push(featureName);
    }
  }
  
  return features;
}

function scanCodeForEndpoints() {
  const routeFiles = [
    ...findFiles('-path "*/routes/*.js"'),
    ...findFiles('-path "*/api/*.js"'),
    ...findFiles('-path "*/controllers/*.js"')
  ];
  
  const endpoints = [];
  for (const file of routeFiles) {
    const content = readFileSafe(file);
    const matches = content.matchAll(/(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    
    for (const match of matches) {
      endpoints.push({
        method: match[2].toUpperCase(),
        path: match[3]
      });
    }
  }
  
  return endpoints;
}

function scanCodeForTables() {
  const migrationFiles = [
    ...findFiles('-path "*/migrations/*.sql"'),
    ...findFiles('-name "schema.prisma"')
  ];
  
  const tables = [];
  for (const file of migrationFiles) {
    const content = readFileSafe(file);
    
    if (file.endsWith('.sql')) {
      const matches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi);
      for (const match of matches) {
        if (!tables.includes(match[1])) {
          tables.push(match[1]);
        }
      }
    } else if (file.endsWith('.prisma')) {
      const matches = content.matchAll(/model\s+(\w+)\s*{/gi);
      for (const match of matches) {
        const tableName = match[1].toLowerCase();
        if (!tables.includes(tableName)) {
          tables.push(tableName);
        }
      }
    }
  }
  
  return tables;
}

function scanCodeForIntegrations() {
  const packageJsonPath = path.join(CONFIG.rootDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  
  const packageJson = JSON.parse(readFileSafe(packageJsonPath));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const knownServices = {
    'stripe': 'Stripe',
    '@sendgrid/mail': 'SendGrid',
    'aws-sdk': 'AWS SDK',
    '@aws-sdk/client-s3': 'AWS S3',
    'twilio': 'Twilio',
    'mailgun-js': 'Mailgun'
  };
  
  const integrations = [];
  for (const [pkg, name] of Object.entries(knownServices)) {
    if (dependencies[pkg]) {
      integrations.push(name);
    }
  }
  
  return integrations;
}

function scanCodeForEnvVars() {
  const codeFiles = findFiles('-path "*/src/*.js" -o -path "*/src/*.ts"');
  const envVars = new Set();
  
  for (const file of codeFiles) {
    const content = readFileSafe(file);
    const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const match of matches) {
      envVars.add(match[1]);
    }
  }
  
  return Array.from(envVars);
}

// ============================================================================
// COMPLIANCE CHECKING
// ============================================================================

function checkCompliance() {
  log('Checking contract compliance...');
  
  const results = {
    features: { missing: [], extra: [] },
    api: { missing: [], extra: [] },
    database: { missing: [], extra: [] },
    integrations: { missing: [], extra: [] },
    envVars: { missing: [], extra: [] }
  };
  
  // Features
  const contractFeatures = readFeaturesContract().map(f => f.name.toLowerCase());
  const codeFeatures = scanCodeForFeatures().map(f => f.toLowerCase());
  
  results.features.missing = codeFeatures.filter(f => !contractFeatures.some(cf => cf.includes(f) || f.includes(cf)));
  results.features.extra = contractFeatures.filter(cf => !codeFeatures.some(f => cf.includes(f) || f.includes(cf)));
  
  // API Endpoints
  const contractEndpoints = readAPIContract();
  const codeEndpoints = scanCodeForEndpoints();
  
  for (const endpoint of codeEndpoints) {
    const found = contractEndpoints.some(ce => 
      ce.method === endpoint.method && ce.path === endpoint.path
    );
    if (!found) {
      results.api.missing.push(`${endpoint.method} ${endpoint.path}`);
    }
  }
  
  for (const endpoint of contractEndpoints) {
    const found = codeEndpoints.some(ce => 
      ce.method === endpoint.method && ce.path === endpoint.path
    );
    if (!found) {
      results.api.extra.push(`${endpoint.method} ${endpoint.path}`);
    }
  }
  
  // Database Tables
  const contractTables = readDatabaseContract().map(t => t.toLowerCase());
  const codeTables = scanCodeForTables().map(t => t.toLowerCase());
  
  results.database.missing = codeTables.filter(t => !contractTables.includes(t));
  results.database.extra = contractTables.filter(t => !codeTables.includes(t));
  
  // Third-party Integrations
  const contractIntegrations = readIntegrationsContract().map(i => i.toLowerCase());
  const codeIntegrations = scanCodeForIntegrations().map(i => i.toLowerCase());
  
  results.integrations.missing = codeIntegrations.filter(i => !contractIntegrations.some(ci => ci.includes(i) || i.includes(ci)));
  results.integrations.extra = contractIntegrations.filter(ci => !codeIntegrations.some(i => ci.includes(i) || i.includes(ci)));
  
  // Environment Variables
  const contractEnvVars = readInfraContract();
  const codeEnvVars = scanCodeForEnvVars();
  
  results.envVars.missing = codeEnvVars.filter(v => !contractEnvVars.includes(v));
  results.envVars.extra = contractEnvVars.filter(v => !codeEnvVars.includes(v));
  
  return results;
}

// ============================================================================
// REPORTING
// ============================================================================

function generateTextReport(results) {
  log('='.repeat(80));
  log('CONTRACT COMPLIANCE REPORT');
  log('='.repeat(80));
  log('');
  
  let totalIssues = 0;
  
  // Features
  log('FEATURES:');
  if (results.features.missing.length > 0) {
    log(`  Missing in contract (${results.features.missing.length}):`, 'warn');
    results.features.missing.forEach(f => log(`    - ${f}`, 'warn'));
    totalIssues += results.features.missing.length;
  }
  if (results.features.extra.length > 0) {
    log(`  In contract but not in code (${results.features.extra.length}):`, 'info');
    results.features.extra.forEach(f => log(`    - ${f}`, 'info'));
  }
  if (results.features.missing.length === 0 && results.features.extra.length === 0) {
    log('  ✅ All features documented', 'success');
  }
  log('');
  
  // API Endpoints
  log('API ENDPOINTS:');
  if (results.api.missing.length > 0) {
    log(`  Missing in contract (${results.api.missing.length}):`, 'warn');
    results.api.missing.slice(0, 10).forEach(e => log(`    - ${e}`, 'warn'));
    if (results.api.missing.length > 10) {
      log(`    ... and ${results.api.missing.length - 10} more`, 'warn');
    }
    totalIssues += results.api.missing.length;
  }
  if (results.api.extra.length > 0) {
    log(`  In contract but not in code (${results.api.extra.length}):`, 'info');
    results.api.extra.slice(0, 10).forEach(e => log(`    - ${e}`, 'info'));
    if (results.api.extra.length > 10) {
      log(`    ... and ${results.api.extra.length - 10} more`, 'info');
    }
  }
  if (results.api.missing.length === 0 && results.api.extra.length === 0) {
    log('  ✅ All endpoints documented', 'success');
  }
  log('');
  
  // Database Tables
  log('DATABASE TABLES:');
  if (results.database.missing.length > 0) {
    log(`  Missing in contract (${results.database.missing.length}):`, 'warn');
    results.database.missing.forEach(t => log(`    - ${t}`, 'warn'));
    totalIssues += results.database.missing.length;
  }
  if (results.database.extra.length > 0) {
    log(`  In contract but not in migrations (${results.database.extra.length}):`, 'info');
    results.database.extra.forEach(t => log(`    - ${t}`, 'info'));
  }
  if (results.database.missing.length === 0 && results.database.extra.length === 0) {
    log('  ✅ All tables documented', 'success');
  }
  log('');
  
  // Third-party Integrations
  log('THIRD-PARTY INTEGRATIONS:');
  if (results.integrations.missing.length > 0) {
    log(`  Missing in contract (${results.integrations.missing.length}):`, 'warn');
    results.integrations.missing.forEach(i => log(`    - ${i}`, 'warn'));
    totalIssues += results.integrations.missing.length;
  }
  if (results.integrations.extra.length > 0) {
    log(`  In contract but not in package.json (${results.integrations.extra.length}):`, 'info');
    results.integrations.extra.forEach(i => log(`    - ${i}`, 'info'));
  }
  if (results.integrations.missing.length === 0 && results.integrations.extra.length === 0) {
    log('  ✅ All integrations documented', 'success');
  }
  log('');
  
  // Environment Variables
  log('ENVIRONMENT VARIABLES:');
  if (results.envVars.missing.length > 0) {
    log(`  Missing in contract (${results.envVars.missing.length}):`, 'warn');
    results.envVars.missing.slice(0, 10).forEach(v => log(`    - ${v}`, 'warn'));
    if (results.envVars.missing.length > 10) {
      log(`    ... and ${results.envVars.missing.length - 10} more`, 'warn');
    }
    totalIssues += results.envVars.missing.length;
  }
  if (results.envVars.extra.length > 0) {
    log(`  In contract but not in code (${results.envVars.extra.length}):`, 'info');
    results.envVars.extra.slice(0, 10).forEach(v => log(`    - ${v}`, 'info'));
    if (results.envVars.extra.length > 10) {
      log(`    ... and ${results.envVars.extra.length - 10} more`, 'info');
    }
  }
  if (results.envVars.missing.length === 0 && results.envVars.extra.length === 0) {
    log('  ✅ All environment variables documented', 'success');
  }
  log('');
  
  // Summary
  log('='.repeat(80));
  if (totalIssues === 0) {
    log('COMPLIANCE CHECK PASSED ✅', 'success');
    log('All contracts are in sync with the codebase.', 'success');
  } else {
    log(`COMPLIANCE CHECK FAILED ❌`, 'error');
    log(`Found ${totalIssues} items missing from contracts.`, 'error');
    log('Run with --fix to generate missing entries.', 'info');
  }
  log('='.repeat(80));
  
  return totalIssues === 0;
}

function generateJSONReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      features: {
        missing: results.features.missing.length,
        extra: results.features.extra.length
      },
      api: {
        missing: results.api.missing.length,
        extra: results.api.extra.length
      },
      database: {
        missing: results.database.missing.length,
        extra: results.database.extra.length
      },
      integrations: {
        missing: results.integrations.missing.length,
        extra: results.integrations.extra.length
      },
      envVars: {
        missing: results.envVars.missing.length,
        extra: results.envVars.extra.length
      }
    },
    details: results
  };
  
  console.log(JSON.stringify(report, null, 2));
  
  const totalIssues = Object.values(report.summary).reduce((sum, cat) => sum + cat.missing, 0);
  return totalIssues === 0;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  // Check if contracts directory exists
  if (!fs.existsSync(CONFIG.contractsDir)) {
    log(`Contracts directory not found: ${CONFIG.contractsDir}`, 'error');
    log('Run contract generation first or merge the contract system branch.', 'info');
    process.exit(1);
  }
  
  // Run compliance check
  const results = checkCompliance();
  
  // Generate report
  let passed;
  if (CONFIG.report === 'json') {
    passed = generateJSONReport(results);
  } else {
    passed = generateTextReport(results);
  }
  
  // Exit with appropriate code
  if (CONFIG.strict && !passed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run
main();
