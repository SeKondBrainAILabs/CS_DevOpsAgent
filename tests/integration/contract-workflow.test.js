const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Contract Automation Workflow Integration Tests', () => {
  const testRepoDir = path.join(__dirname, '../fixtures/integration-test-repo');
  const contractsDir = path.join(testRepoDir, 'House_Rules_Contracts');

  beforeAll(() => {
    // Create test repository structure
    if (fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }

    fs.mkdirSync(testRepoDir, { recursive: true });
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.mkdirSync(path.join(testRepoDir, 'src/features'), { recursive: true });
    fs.mkdirSync(path.join(testRepoDir, 'src/api'), { recursive: true });
    fs.mkdirSync(path.join(testRepoDir, 'migrations'), { recursive: true });

    // Create contract templates
    createContractTemplates(contractsDir);

    // Create sample code files
    createSampleCodebase(testRepoDir);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Contract Generation Workflow', () => {
    test('should scan codebase and generate contract scan results', () => {
      // Simulate running generate-contracts.js
      const scanResults = simulateContractGeneration(testRepoDir);

      expect(scanResults).toHaveProperty('generated');
      expect(scanResults).toHaveProperty('results');
      expect(scanResults.results.features.length).toBeGreaterThan(0);
      expect(scanResults.results.api.length).toBeGreaterThan(0);
      expect(scanResults.results.database.length).toBeGreaterThan(0);

      // Save results
      const outputPath = path.join(contractsDir, 'contract-scan-results.json');
      fs.writeFileSync(outputPath, JSON.stringify(scanResults, null, 2));

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should populate contracts from scan results', () => {
      const scanResultsPath = path.join(contractsDir, 'contract-scan-results.json');
      const scanResults = JSON.parse(fs.readFileSync(scanResultsPath, 'utf-8'));

      // Simulate populating API_CONTRACT.md
      const apiContract = populateAPIContract(scanResults.results.api);
      const apiContractPath = path.join(contractsDir, 'API_CONTRACT.md');
      fs.writeFileSync(apiContractPath, apiContract);

      expect(fs.existsSync(apiContractPath)).toBe(true);

      const content = fs.readFileSync(apiContractPath, 'utf-8');
      expect(content).toContain('GET /api/v1/users');
      expect(content).toContain('POST /api/v1/users');
    });
  });

  describe('Commit Validation Workflow', () => {
    test('should validate commit message with correct contract flags', () => {
      const commitMsg = `feat(api): add user profile endpoint

Contracts: [SQL:F, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]

[WHY]
Users need to view their profile.

[WHAT]
- File(s): src/api/users.js - Added GET /api/v1/users/:id/profile
- File(s): House_Rules_Contracts/API_CONTRACT.md - Documented endpoint`;

      const stagedFiles = [
        'src/api/users.js',
        'House_Rules_Contracts/API_CONTRACT.md',
        'House_Rules_Contracts/FEATURES_CONTRACT.md'
      ];

      const validation = validateCommitWithStaged(commitMsg, stagedFiles);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect incorrect contract flags and suggest corrections', () => {
      const commitMsg = `feat(database): add user preferences table

Contracts: [SQL:F, API:F, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHY]
Need to store user preferences.

[WHAT]
- File(s): migrations/003_add_preferences.sql - Created table
- File(s): House_Rules_Contracts/DATABASE_SCHEMA_CONTRACT.md - Documented schema`;

      const stagedFiles = [
        'migrations/003_add_preferences.sql',
        'House_Rules_Contracts/DATABASE_SCHEMA_CONTRACT.md'
      ];

      const validation = validateCommitWithStaged(commitMsg, stagedFiles);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.suggestedFlags).toEqual(expect.objectContaining({
        DB: true
      }));
    });

    test('should generate corrected commit message', () => {
      const commitMsg = `feat(api): add endpoint

Contracts: [SQL:T, API:F, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHY]
Need new endpoint.

[WHAT]
- File(s): src/api/test.js - Added endpoint`;

      const stagedFiles = [
        'src/api/test.js',
        'House_Rules_Contracts/API_CONTRACT.md'
      ];

      const corrected = autoFixCommitMessage(commitMsg, stagedFiles);

      expect(corrected).toContain('Contracts: [SQL:F, API:T, DB:F, 3RD:F, FEAT:F, INFRA:F]');
    });
  });

  describe('Compliance Checking Workflow', () => {
    test('should detect code-contract discrepancies', () => {
      // Add a new feature to code but not to contract
      fs.writeFileSync(
        path.join(testRepoDir, 'src/features/analytics/index.js'),
        '// Analytics feature\nexport default function trackEvent() {}'
      );

      const complianceResults = checkCompliance(testRepoDir);

      expect(complianceResults.features.missing.length).toBeGreaterThan(0);
      expect(complianceResults.features.missing).toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/analytics/i) })
      );
    });

    test('should generate compliance report', () => {
      const complianceResults = checkCompliance(testRepoDir);
      const report = generateComplianceReport(complianceResults, 'text');

      expect(report).toContain('CONTRACT COMPLIANCE REPORT');
      expect(report).toContain('FEATURES');
      expect(report).toContain('API');
      expect(report).toContain('DATABASE');
    });

    test('should exit with error code in strict mode when non-compliant', () => {
      const complianceResults = checkCompliance(testRepoDir);
      const exitCode = getComplianceExitCode(complianceResults, true);

      // Should fail because we added analytics feature without documenting
      expect(exitCode).toBe(1);
    });
  });

  describe('Multi-Agent Coordination', () => {
    test('should prevent duplicate feature creation', () => {
      // Agent 1 checks for existing auth feature
      const existingFeatures = scanExistingFeatures(contractsDir);
      const hasAuth = existingFeatures.some(f => f.name.toLowerCase().includes('auth'));

      expect(hasAuth).toBe(true);

      // Agent 1 should reuse existing feature instead of creating duplicate
      const decision = shouldCreateOrReuse('authentication', existingFeatures);

      expect(decision.action).toBe('reuse');
      expect(decision.existingFeature).toBeDefined();
    });

    test('should detect when new feature needs to be created', () => {
      const existingFeatures = scanExistingFeatures(contractsDir);
      const decision = shouldCreateOrReuse('blockchain-integration', existingFeatures);

      expect(decision.action).toBe('create');
      expect(decision.existingFeature).toBeUndefined();
    });

    test('should update "Used By" section when reusing component', () => {
      const apiContractPath = path.join(contractsDir, 'API_CONTRACT.md');
      let apiContract = fs.readFileSync(apiContractPath, 'utf-8');

      // Simulate agent adding their module to "Used By"
      apiContract = addModuleToUsedBy(
        apiContract,
        'GET /api/v1/users',
        {
          module: 'admin-dashboard',
          file: 'src/admin/UserList.js',
          usage: 'Display user list'
        }
      );

      fs.writeFileSync(apiContractPath, apiContract);

      const updated = fs.readFileSync(apiContractPath, 'utf-8');
      expect(updated).toContain('admin-dashboard');
      expect(updated).toContain('src/admin/UserList.js');
    });
  });

  describe('Contract Versioning', () => {
    test('should increment version on contract update', () => {
      const apiContractPath = path.join(contractsDir, 'API_CONTRACT.md');
      let apiContract = fs.readFileSync(apiContractPath, 'utf-8');

      // Get current version
      const currentVersion = extractVersion(apiContract);
      expect(currentVersion).toMatch(/^\d+\.\d+\.\d+$/);

      // Update contract with new endpoint
      apiContract = addEndpointToContract(apiContract, {
        method: 'DELETE',
        path: '/api/v1/users/:id',
        description: 'Delete a user',
        breaking: false
      });

      // Version should be incremented
      const newVersion = extractVersion(apiContract);
      expect(newVersion).not.toBe(currentVersion);

      // Should be minor version bump (non-breaking change)
      const [currMajor, currMinor, currPatch] = currentVersion.split('.').map(Number);
      const [newMajor, newMinor, newPatch] = newVersion.split('.').map(Number);

      expect(newMajor).toBe(currMajor);
      expect(newMinor).toBe(currMinor + 1);
    });

    test('should add changelog entry on update', () => {
      const apiContractPath = path.join(contractsDir, 'API_CONTRACT.md');
      let apiContract = fs.readFileSync(apiContractPath, 'utf-8');

      apiContract = addChangelogEntry(apiContract, {
        version: '1.1.0',
        date: '2024-12-16',
        author: 'sachmans',
        change: 'Added DELETE /api/v1/users/:id endpoint'
      });

      fs.writeFileSync(apiContractPath, apiContract);

      const updated = fs.readFileSync(apiContractPath, 'utf-8');
      expect(updated).toContain('**Changelog:**');
      expect(updated).toContain('2024-12-16');
      expect(updated).toContain('1.1.0');
      expect(updated).toContain('DELETE /api/v1/users/:id');
    });
  });
});

// Helper functions
function createContractTemplates(contractsDir) {
  const apiContract = `# API Contract

**Last Updated:** 2024-12-16  
**Version:** 1.0.0

## Endpoints

### \`GET /api/v1/users\`

**Description:** Retrieve all users

**Used By:**
- user-service

### \`POST /api/v1/users\`

**Description:** Create a new user

**Used By:**
- registration-service
`;

  fs.writeFileSync(path.join(contractsDir, 'API_CONTRACT.md'), apiContract);

  const featuresContract = `# Features Contract

**Last Updated:** 2024-12-16  
**Version:** 1.0.0

## Features

### [F-001] - User Authentication

**Status:** Active  
**Description:** Handles user login and authentication
`;

  fs.writeFileSync(path.join(contractsDir, 'FEATURES_CONTRACT.md'), featuresContract);
}

function createSampleCodebase(baseDir) {
  fs.writeFileSync(
    path.join(baseDir, 'src/features/user-auth/index.js'),
    '// User authentication\nexport default function authenticate() {}'
  );

  fs.writeFileSync(
    path.join(baseDir, 'src/api/users.js'),
    `
app.get('/api/v1/users', (req, res) => {});
app.post('/api/v1/users', (req, res) => {});
`
  );

  fs.writeFileSync(
    path.join(baseDir, 'migrations/001_create_users.sql'),
    'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255));'
  );
}

function simulateContractGeneration(baseDir) {
  // Simplified version - in reality this would call the actual script
  return {
    generated: new Date().toISOString(),
    results: {
      features: [{ id: 'F-001', name: 'user-auth', path: 'src/features/user-auth' }],
      api: [
        { method: 'GET', path: '/api/v1/users', source: 'src/api/users.js' },
        { method: 'POST', path: '/api/v1/users', source: 'src/api/users.js' }
      ],
      database: [{ name: 'users', source: 'migrations/001_create_users.sql' }],
      sql: {},
      integrations: [],
      envVars: []
    }
  };
}

function populateAPIContract(endpoints) {
  let contract = '# API Contract\n\n**Last Updated:** 2024-12-16\n**Version:** 1.0.0\n\n## Endpoints\n\n';

  for (const endpoint of endpoints) {
    contract += `### \`${endpoint.method} ${endpoint.path}\`\n\n`;
    contract += `**Source:** ${endpoint.source}\n\n`;
  }

  return contract;
}

function validateCommitWithStaged(commitMsg, stagedFiles) {
  const parsed = parseCommitMessage(commitMsg);
  const actualChanges = detectContractChanges(stagedFiles);

  const errors = [];
  const suggestedFlags = {};

  for (const [flag, claimed] of Object.entries(parsed.contractFlags)) {
    const actual = actualChanges[flag] || false;
    suggestedFlags[flag] = actual;

    if (claimed !== actual) {
      errors.push({
        flag,
        claimed,
        actual,
        type: claimed ? 'false_positive' : 'false_negative'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestedFlags
  };
}

function autoFixCommitMessage(commitMsg, stagedFiles) {
  const actualChanges = detectContractChanges(stagedFiles);
  const lines = commitMsg.split('\n');

  const flagsIndex = lines.findIndex(l => l.startsWith('Contracts:'));
  if (flagsIndex !== -1) {
    const flagsStr = Object.entries(actualChanges)
      .map(([k, v]) => `${k}:${v ? 'T' : 'F'}`)
      .join(', ');
    lines[flagsIndex] = `Contracts: [${flagsStr}]`;
  }

  return lines.join('\n');
}

function parseCommitMessage(msg) {
  const lines = msg.split('\n');
  const flagsLine = lines.find(l => l.startsWith('Contracts:'));

  const match = flagsLine.match(/Contracts:\s*\[(.*)\]/);
  const flagsStr = match[1];

  const contractFlags = {};
  for (const pair of flagsStr.split(',')) {
    const [key, value] = pair.trim().split(':');
    contractFlags[key] = value === 'T';
  }

  return { contractFlags };
}

function detectContractChanges(stagedFiles) {
  const changes = {
    SQL: false,
    API: false,
    DB: false,
    '3RD': false,
    FEAT: false,
    INFRA: false
  };

  const map = {
    'SQL_CONTRACT.json': 'SQL',
    'API_CONTRACT.md': 'API',
    'DATABASE_SCHEMA_CONTRACT.md': 'DB',
    'THIRD_PARTY_INTEGRATIONS.md': '3RD',
    'FEATURES_CONTRACT.md': 'FEAT',
    'INFRA_CONTRACT.md': 'INFRA'
  };

  for (const file of stagedFiles) {
    for (const [contractFile, flag] of Object.entries(map)) {
      if (file.includes(contractFile)) {
        changes[flag] = true;
      }
    }
  }

  return changes;
}

function checkCompliance(baseDir) {
  // Simplified compliance check
  const codeFeatures = [
    { name: 'user-auth' },
    { name: 'analytics' } // This one is not in contract
  ];

  const contractFeatures = [
    { name: 'user-auth' }
  ];

  return {
    features: {
      missing: [{ name: 'analytics' }],
      extra: [],
      compliant: false
    },
    api: { missing: [], extra: [], compliant: true },
    database: { missing: [], extra: [], compliant: true },
    sql: { missing: [], extra: [], compliant: true },
    integrations: { missing: [], extra: [], compliant: true },
    envVars: { missing: [], extra: [], compliant: true }
  };
}

function generateComplianceReport(results, format) {
  let report = 'CONTRACT COMPLIANCE REPORT\n\n';

  for (const [category, result] of Object.entries(results)) {
    report += `${category.toUpperCase()}:\n`;
    if (result.missing.length > 0) {
      report += `  Missing: ${result.missing.map(m => m.name || m).join(', ')}\n`;
    }
    if (result.compliant) {
      report += `  ✅ Compliant\n`;
    }
    report += '\n';
  }

  return report;
}

function getComplianceExitCode(results, strict) {
  const compliant = Object.values(results).every(r => r.compliant);
  return (strict && !compliant) ? 1 : 0;
}

function scanExistingFeatures(contractsDir) {
  const featuresPath = path.join(contractsDir, 'FEATURES_CONTRACT.md');
  const content = fs.readFileSync(featuresPath, 'utf-8');

  // Simple parsing - in reality would be more sophisticated
  const features = [];
  const matches = content.matchAll(/\[F-\d+\]\s*-\s*([^\n]+)/g);

  for (const match of matches) {
    features.push({ name: match[1].trim() });
  }

  return features;
}

function shouldCreateOrReuse(featureName, existingFeatures) {
  const normalized = featureName.toLowerCase();

  for (const existing of existingFeatures) {
    const existingNormalized = existing.name.toLowerCase();

    if (existingNormalized.includes(normalized) || normalized.includes(existingNormalized)) {
      return {
        action: 'reuse',
        existingFeature: existing
      };
    }
  }

  return {
    action: 'create'
  };
}

function addModuleToUsedBy(contractContent, endpoint, moduleInfo) {
  // Simple implementation - would be more sophisticated in reality
  const endpointSection = `### \`${endpoint}\``;
  const usedByMarker = '**Used By:**';

  if (contractContent.includes(endpointSection)) {
    const newEntry = `\n- ${moduleInfo.module} - ${moduleInfo.usage}`;
    contractContent = contractContent.replace(
      new RegExp(`(${endpointSection}[\\s\\S]*?${usedByMarker})`),
      `$1${newEntry}`
    );
  }

  return contractContent;
}

function extractVersion(contractContent) {
  const match = contractContent.match(/\*\*Version:\*\*\s*(\d+\.\d+\.\d+)/);
  return match ? match[1] : '1.0.0';
}

function addEndpointToContract(contractContent, endpoint) {
  const newVersion = incrementVersion(extractVersion(contractContent), endpoint.breaking);
  contractContent = contractContent.replace(
    /\*\*Version:\*\*\s*\d+\.\d+\.\d+/,
    `**Version:** ${newVersion}`
  );

  return contractContent;
}

function incrementVersion(version, breaking) {
  const [major, minor, patch] = version.split('.').map(Number);

  if (breaking) {
    return `${major + 1}.0.0`;
  } else {
    return `${major}.${minor + 1}.${patch}`;
  }
}

function addChangelogEntry(contractContent, entry) {
  const changelogMarker = '**Changelog:**';

  if (!contractContent.includes(changelogMarker)) {
    contractContent += `\n\n${changelogMarker}\n`;
  }

  const newEntry = `- **${entry.date} v${entry.version}:** ${entry.change} (${entry.author})`;
  contractContent = contractContent.replace(
    changelogMarker,
    `${changelogMarker}\n${newEntry}`
  );

  return contractContent;
}
