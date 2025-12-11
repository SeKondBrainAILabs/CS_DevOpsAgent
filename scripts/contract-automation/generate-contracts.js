#!/usr/bin/env node

/**
 * ============================================================================
 * CONTRACT GENERATION SCRIPT
 * ============================================================================
 * 
 * This script scans the codebase and generates populated contract files.
 * It uses local file system operations, regex, and AST parsing.
 * 
 * Usage:
 *   node scripts/contract-automation/generate-contracts.js
 *   node scripts/contract-automation/generate-contracts.js --contract=features
 *   node scripts/contract-automation/generate-contracts.js --validate-only
 * 
 * Options:
 *   --contract=<name>  Generate specific contract (features, api, database, sql, integrations, infra)
 *   --validate-only    Only validate existing contracts, don't generate
 *   --output=<path>    Output directory (default: House_Rules_Contracts/)
 *   --verbose          Detailed logging
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
  contractsDir: path.join(process.cwd(), 'House_Rules_Contracts'),
  srcDir: path.join(process.cwd(), 'src'),
  verbose: process.argv.includes('--verbose'),
  validateOnly: process.argv.includes('--validate-only'),
  specificContract: getArgValue('--contract'),
  outputDir: getArgValue('--output') || path.join(process.cwd(), 'House_Rules_Contracts')
};

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

// Helper: Find files matching glob pattern
function findFiles(pattern, dir = CONFIG.rootDir) {
  try {
    const result = execSync(`find ${dir} -type f ${pattern}`, { encoding: 'utf8' });
    return result.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
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
// FEATURE SCANNER
// ============================================================================

function scanFeatures() {
  log('Scanning for features...');
  
  const features = [];
  
  // Find feature directories
  const featureDirs = [
    ...findFiles('-path "*/src/features/*" -type d', CONFIG.rootDir),
    ...findFiles('-path "*/src/modules/*" -type d', CONFIG.rootDir)
  ];
  
  log(`Found ${featureDirs.length} potential feature directories`, 'debug');
  
  for (const dir of featureDirs) {
    const featureName = path.basename(dir);
    if (featureName === 'features' || featureName === 'modules') continue;
    
    const files = findFiles(`-path "${dir}/*" -name "*.js" -o -name "*.ts"`, CONFIG.rootDir);
    
    if (files.length > 0) {
      features.push({
        id: `F-${String(features.length + 1).padStart(3, '0')}`,
        name: featureName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        path: dir,
        files: files,
        status: 'active',
        priority: 'medium',
        completion: 100
      });
    }
  }
  
  log(`Discovered ${features.length} features`, 'success');
  return features;
}

// ============================================================================
// DATABASE SCHEMA SCANNER
// ============================================================================

function scanDatabaseSchema() {
  log('Scanning for database schema...');
  
  const tables = [];
  
  // Find migration files
  const migrationFiles = [
    ...findFiles('-path "*/migrations/*.sql"', CONFIG.rootDir),
    ...findFiles('-path "*/migrations/*.js"', CONFIG.rootDir),
    ...findFiles('-path "*/alembic/*.py"', CONFIG.rootDir)
  ];
  
  log(`Found ${migrationFiles.length} migration files`, 'debug');
  
  // Find Prisma schema
  const prismaFiles = findFiles('-name "schema.prisma"', CONFIG.rootDir);
  
  // Parse CREATE TABLE statements from SQL files
  for (const file of migrationFiles) {
    if (file.endsWith('.sql')) {
      const content = readFileSafe(file);
      const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi);
      
      for (const match of tableMatches) {
        const tableName = match[1];
        const columns = match[2];
        
        // Parse columns
        const columnLines = columns.split(',').map(l => l.trim()).filter(Boolean);
        const parsedColumns = columnLines.map(line => {
          const parts = line.split(/\s+/);
          return {
            name: parts[0],
            type: parts[1] || 'UNKNOWN',
            nullable: !line.includes('NOT NULL'),
            isPrimaryKey: line.includes('PRIMARY KEY')
          };
        });
        
        tables.push({
          name: tableName,
          columns: parsedColumns,
          source: file,
          created: fs.statSync(file).birthtime.toISOString().split('T')[0]
        });
      }
    }
  }
  
  // Parse Prisma schema
  for (const file of prismaFiles) {
    const content = readFileSafe(file);
    const modelMatches = content.matchAll(/model\s+(\w+)\s*{([\s\S]*?)}/gi);
    
    for (const match of modelMatches) {
      const tableName = match[1].toLowerCase();
      const fields = match[2];
      
      const fieldLines = fields.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
      const parsedColumns = fieldLines.map(line => {
        const parts = line.split(/\s+/);
        return {
          name: parts[0],
          type: parts[1] || 'UNKNOWN',
          nullable: !line.includes('@default') && line.includes('?'),
          isPrimaryKey: line.includes('@id')
        };
      });
      
      tables.push({
        name: tableName,
        columns: parsedColumns,
        source: file,
        created: fs.statSync(file).birthtime.toISOString().split('T')[0]
      });
    }
  }
  
  log(`Discovered ${tables.length} database tables`, 'success');
  return tables;
}

// ============================================================================
// SQL QUERY SCANNER
// ============================================================================

function scanSQLQueries() {
  log('Scanning for SQL queries...');
  
  const queries = {};
  let queryCount = 0;
  
  // Find SQL files
  const sqlFiles = findFiles('-name "*.sql" -not -path "*/migrations/*"', CONFIG.rootDir);
  
  // Find code files with SQL
  const codeFiles = [
    ...findFiles('-path "*/src/*.js" -o -path "*/src/*.ts"', CONFIG.rootDir),
    ...findFiles('-path "*/src/*.py"', CONFIG.rootDir)
  ];
  
  log(`Scanning ${sqlFiles.length} SQL files and ${codeFiles.length} code files`, 'debug');
  
  // Parse SQL files
  for (const file of sqlFiles) {
    const content = readFileSafe(file);
    const queryName = path.basename(file, path.extname(file));
    
    if (content.match(/SELECT|INSERT|UPDATE|DELETE/i)) {
      const queryId = queryName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      queries[queryId] = {
        id: queryId,
        name: queryName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        sql: content.trim(),
        operation_type: content.match(/^(SELECT|INSERT|UPDATE|DELETE)/i)?.[1]?.toUpperCase() || 'UNKNOWN',
        source: file,
        parameters: extractParameters(content),
        used_by_modules: []
      };
      queryCount++;
    }
  }
  
  // Parse inline SQL in code files
  for (const file of codeFiles) {
    const content = readFileSafe(file);
    
    // Match SQL strings (simple heuristic)
    const sqlMatches = content.matchAll(/['"`](SELECT|INSERT|UPDATE|DELETE)[\s\S]*?['"`]/gi);
    
    for (const match of sqlMatches) {
      const sql = match[0].slice(1, -1); // Remove quotes
      const operation = match[1].toUpperCase();
      
      // Generate query ID from first table name
      const tableMatch = sql.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
      const tableName = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : 'unknown';
      
      const queryId = `${operation.toLowerCase()}_${tableName}_inline_${queryCount}`;
      
      if (!queries[queryId]) {
        queries[queryId] = {
          id: queryId,
          name: `${operation} ${tableName}`,
          sql: sql.trim(),
          operation_type: operation,
          source: file,
          parameters: extractParameters(sql),
          used_by_modules: [{
            module: path.dirname(file).split('/').pop(),
            file: file.replace(CONFIG.rootDir + '/', ''),
            function: 'inline',
            usage: 'Inline SQL query'
          }]
        };
        queryCount++;
      }
    }
  }
  
  log(`Discovered ${Object.keys(queries).length} SQL queries`, 'success');
  return queries;
}

function extractParameters(sql) {
  const params = [];
  
  // Match $1, $2, etc. (PostgreSQL style)
  const pgParams = sql.matchAll(/\$(\d+)/g);
  for (const match of pgParams) {
    params.push({
      name: `param${match[1]}`,
      type: 'unknown',
      required: true,
      position: parseInt(match[1])
    });
  }
  
  // Match ? (MySQL style)
  const mysqlParams = sql.match(/\?/g);
  if (mysqlParams) {
    mysqlParams.forEach((_, i) => {
      params.push({
        name: `param${i + 1}`,
        type: 'unknown',
        required: true,
        position: i + 1
      });
    });
  }
  
  // Match :name (named parameters)
  const namedParams = sql.matchAll(/:(\w+)/g);
  for (const match of namedParams) {
    params.push({
      name: match[1],
      type: 'unknown',
      required: true
    });
  }
  
  return params;
}

// ============================================================================
// API ENDPOINT SCANNER
// ============================================================================

function scanAPIEndpoints() {
  log('Scanning for API endpoints...');
  
  const endpoints = [];
  
  // Find route files
  const routeFiles = [
    ...findFiles('-path "*/routes/*.js" -o -path "*/routes/*.ts"', CONFIG.rootDir),
    ...findFiles('-path "*/api/*.js" -o -path "*/api/*.ts"', CONFIG.rootDir),
    ...findFiles('-path "*/controllers/*.js" -o -path "*/controllers/*.ts"', CONFIG.rootDir)
  ];
  
  log(`Scanning ${routeFiles.length} route/controller files`, 'debug');
  
  for (const file of routeFiles) {
    const content = readFileSafe(file);
    
    // Match Express routes: app.get('/path', ...)
    const expressRoutes = content.matchAll(/(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    
    for (const match of expressRoutes) {
      const method = match[2].toUpperCase();
      const path = match[3];
      
      endpoints.push({
        method,
        path,
        source: file.replace(CONFIG.rootDir + '/', ''),
        controller: path.dirname(file).split('/').pop(),
        status: 'active'
      });
    }
    
    // Match FastAPI routes: @app.get('/path')
    const fastAPIRoutes = content.matchAll(/@(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi);
    
    for (const match of fastAPIRoutes) {
      const method = match[2].toUpperCase();
      const path = match[3];
      
      endpoints.push({
        method,
        path,
        source: file.replace(CONFIG.rootDir + '/', ''),
        controller: path.dirname(file).split('/').pop(),
        status: 'active'
      });
    }
  }
  
  log(`Discovered ${endpoints.length} API endpoints`, 'success');
  return endpoints;
}

// ============================================================================
// THIRD-PARTY INTEGRATION SCANNER
// ============================================================================

function scanThirdPartyIntegrations() {
  log('Scanning for third-party integrations...');
  
  const integrations = [];
  
  // Check package.json
  const packageJsonPath = path.join(CONFIG.rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSafe(packageJsonPath));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Known third-party services
    const knownServices = {
      'stripe': { name: 'Stripe', purpose: 'Payment processing' },
      '@sendgrid/mail': { name: 'SendGrid', purpose: 'Email delivery' },
      'aws-sdk': { name: 'AWS SDK', purpose: 'AWS services' },
      '@aws-sdk/client-s3': { name: 'AWS S3', purpose: 'Object storage' },
      'twilio': { name: 'Twilio', purpose: 'SMS/Voice' },
      'mailgun-js': { name: 'Mailgun', purpose: 'Email delivery' },
      'axios': { name: 'Axios', purpose: 'HTTP client (check for API calls)' }
    };
    
    for (const [pkg, info] of Object.entries(knownServices)) {
      if (dependencies[pkg]) {
        integrations.push({
          service: info.name,
          purpose: info.purpose,
          package: pkg,
          version: dependencies[pkg],
          status: 'active'
        });
      }
    }
  }
  
  // Check for integration folders
  const integrationDirs = findFiles('-path "*/src/integrations/*" -type d', CONFIG.rootDir);
  
  for (const dir of integrationDirs) {
    const serviceName = path.basename(dir);
    if (serviceName !== 'integrations' && !integrations.find(i => i.service.toLowerCase() === serviceName)) {
      integrations.push({
        service: serviceName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        purpose: 'Unknown - check code',
        bindingModule: dir.replace(CONFIG.rootDir + '/', ''),
        status: 'active'
      });
    }
  }
  
  log(`Discovered ${integrations.length} third-party integrations`, 'success');
  return integrations;
}

// ============================================================================
// ENVIRONMENT VARIABLE SCANNER
// ============================================================================

function scanEnvironmentVariables() {
  log('Scanning for environment variables...');
  
  const envVars = new Set();
  
  // Check .env.example
  const envExamplePath = path.join(CONFIG.rootDir, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    const content = readFileSafe(envExamplePath);
    const matches = content.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm);
    for (const match of matches) {
      envVars.add(match[1]);
    }
  }
  
  // Scan code for process.env usage
  const codeFiles = findFiles('-path "*/src/*.js" -o -path "*/src/*.ts"', CONFIG.rootDir);
  
  for (const file of codeFiles) {
    const content = readFileSafe(file);
    const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
    for (const match of matches) {
      envVars.add(match[1]);
    }
  }
  
  const envVarsList = Array.from(envVars).sort().map(name => ({
    name,
    type: inferEnvVarType(name),
    category: inferEnvVarCategory(name),
    required: !name.includes('OPTIONAL')
  }));
  
  log(`Discovered ${envVarsList.length} environment variables`, 'success');
  return envVarsList;
}

function inferEnvVarType(name) {
  if (name.includes('PORT') || name.includes('TIMEOUT') || name.includes('MAX') || name.includes('LIMIT')) {
    return 'integer';
  }
  if (name.includes('ENABLED') || name.includes('DEBUG') || name.includes('SSL')) {
    return 'boolean';
  }
  return 'string';
}

function inferEnvVarCategory(name) {
  if (name.startsWith('DATABASE_') || name.startsWith('DB_')) return 'database';
  if (name.startsWith('REDIS_')) return 'cache';
  if (name.startsWith('JWT_') || name.startsWith('AUTH_')) return 'authentication';
  if (name.startsWith('AWS_')) return 'aws';
  if (name.startsWith('FEATURE_')) return 'feature_flags';
  if (name.startsWith('LOG_')) return 'logging';
  return 'application';
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  log('='.repeat(80));
  log('CONTRACT GENERATION SCRIPT');
  log('='.repeat(80));
  
  // Ensure contracts directory exists
  if (!fs.existsSync(CONFIG.contractsDir)) {
    log(`Creating contracts directory: ${CONFIG.contractsDir}`);
    fs.mkdirSync(CONFIG.contractsDir, { recursive: true });
  }
  
  const results = {
    features: null,
    database: null,
    sql: null,
    api: null,
    integrations: null,
    envVars: null
  };
  
  // Scan based on options
  if (!CONFIG.specificContract || CONFIG.specificContract === 'features') {
    results.features = scanFeatures();
  }
  
  if (!CONFIG.specificContract || CONFIG.specificContract === 'database') {
    results.database = scanDatabaseSchema();
  }
  
  if (!CONFIG.specificContract || CONFIG.specificContract === 'sql') {
    results.sql = scanSQLQueries();
  }
  
  if (!CONFIG.specificContract || CONFIG.specificContract === 'api') {
    results.api = scanAPIEndpoints();
  }
  
  if (!CONFIG.specificContract || CONFIG.specificContract === 'integrations') {
    results.integrations = scanThirdPartyIntegrations();
  }
  
  if (!CONFIG.specificContract || CONFIG.specificContract === 'infra') {
    results.envVars = scanEnvironmentVariables();
  }
  
  // Save results
  if (!CONFIG.validateOnly) {
    const outputPath = path.join(CONFIG.outputDir, 'contract-scan-results.json');
    writeJSON(outputPath, {
      generated: new Date().toISOString(),
      results
    });
    log(`Results saved to: ${outputPath}`, 'success');
  }
  
  // Summary
  log('='.repeat(80));
  log('SCAN COMPLETE', 'success');
  log('='.repeat(80));
  if (results.features) log(`Features: ${results.features.length}`);
  if (results.database) log(`Database Tables: ${results.database.length}`);
  if (results.sql) log(`SQL Queries: ${Object.keys(results.sql).length}`);
  if (results.api) log(`API Endpoints: ${results.api.length}`);
  if (results.integrations) log(`Third-party Integrations: ${results.integrations.length}`);
  if (results.envVars) log(`Environment Variables: ${results.envVars.length}`);
  log('='.repeat(80));
}

// Run
main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
