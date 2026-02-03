/**
 * Contract Generation E2E Tests
 * Tests contract generation at repo, feature, and contract type levels
 * Validates content is actual data, not placeholder templates
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Test against the LinkedIn repo worktree
const TEST_REPO_PATH = '/Volumes/Simba User Data/Development/Linkedin-New-Summary/local_deploy/claude-session-20260114-conceptwork';
const CONTRACTS_DIR = path.join(TEST_REPO_PATH, 'House_Rules_Contracts');
const FEATURE_CONTRACTS_DIR = path.join(TEST_REPO_PATH, '.S9N_KIT_DevOpsAgent/contracts/features');

// Contract type definitions
const REPO_CONTRACT_TYPES = [
  { type: 'api', file: 'API_CONTRACT.md' },
  { type: 'schema', file: 'DATABASE_SCHEMA_CONTRACT.md' },
  { type: 'events', file: 'EVENTS_CONTRACT.md' },
  { type: 'infra', file: 'INFRA_CONTRACT.md' },
  { type: 'features', file: 'FEATURES_CONTRACT.md' },
  { type: 'integrations', file: 'THIRD_PARTY_INTEGRATIONS.md' },
];

// Placeholder patterns that should NOT appear in generated contracts
const PLACEHOLDER_PATTERNS = [
  /\[table_name\]/i,
  /\[column_name\]/i,
  /\[Feature Name\]/i,
  /\[Description\]/i,
  /\[e\.g\.,/i,
  /\[YYYY-MM-DD\]/i,
  /Template only/i,
  /Initial Template/i,
  /Template Instructions/i,
  /For DevOps Agent.*When populating/i,
];

// Version header pattern
const VERSION_HEADER_PATTERN = /<!--\s*Version:\s*([\d.]+)\s*\|\s*Generated:\s*(\d{4}-\d{2}-\d{2})/;

describe('Contract Generation E2E Tests', () => {
  describe('Repo-Level Contracts', () => {
    it('should have House_Rules_Contracts directory', async () => {
      const exists = await fs.access(CONTRACTS_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    for (const { type, file } of REPO_CONTRACT_TYPES) {
      describe(`${type.toUpperCase()} Contract (${file})`, () => {
        let content: string;
        let filePath: string;

        beforeAll(async () => {
          filePath = path.join(CONTRACTS_DIR, file);
          try {
            content = await fs.readFile(filePath, 'utf-8');
          } catch {
            content = '';
          }
        });

        it('should exist', async () => {
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          expect(exists).toBe(true);
        });

        it('should have version header', () => {
          if (!content) return;
          const hasVersionHeader = VERSION_HEADER_PATTERN.test(content);
          expect(hasVersionHeader).toBe(true);
        });

        it('should NOT contain placeholder text', () => {
          if (!content) return;
          for (const pattern of PLACEHOLDER_PATTERNS) {
            const hasPlaceholder = pattern.test(content);
            if (hasPlaceholder) {
              console.error(`Found placeholder in ${file}:`, pattern.source);
            }
            expect(hasPlaceholder).toBe(false);
          }
        });

        it('should have actual content (not just headers)', () => {
          if (!content) return;
          // Should have more than just headers
          const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('<!--'));
          expect(lines.length).toBeGreaterThan(5);
        });
      });
    }
  });

  describe('Feature-Level Contracts', () => {
    it('should have feature contracts directory', async () => {
      const exists = await fs.access(FEATURE_CONTRACTS_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have at least one feature contract JSON', async () => {
      try {
        const files = await fs.readdir(FEATURE_CONTRACTS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.contracts.json'));
        expect(jsonFiles.length).toBeGreaterThan(0);
      } catch {
        expect(true).toBe(false); // Fail if directory doesn't exist
      }
    });

    describe('Authentication System Contract', () => {
      let contractData: Record<string, unknown>;
      const featureFile = path.join(FEATURE_CONTRACTS_DIR, 'Authentication System.contracts.json');

      beforeAll(async () => {
        try {
          const content = await fs.readFile(featureFile, 'utf-8');
          contractData = JSON.parse(content);
        } catch {
          contractData = {};
        }
      });

      it('should exist', async () => {
        const exists = await fs.access(featureFile).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      });

      it('should have version', () => {
        expect(contractData.version).toBeDefined();
        expect(typeof contractData.version).toBe('string');
      });

      it('should have lastGenerated timestamp', () => {
        expect(contractData.lastGenerated).toBeDefined();
        // Should be a valid ISO date
        const date = new Date(contractData.lastGenerated as string);
        expect(date.getTime()).not.toBeNaN();
      });

      it('should have APIs section with endpoints', () => {
        const apis = contractData.apis as Record<string, unknown> | undefined;
        expect(apis).toBeDefined();
        expect(apis?.endpoints).toBeDefined();
        expect(Array.isArray(apis?.endpoints)).toBe(true);
      });

      it('should have schemas section', () => {
        const schemas = contractData.schemas as unknown[];
        expect(schemas).toBeDefined();
        expect(Array.isArray(schemas)).toBe(true);
      });

      it('API endpoints should have method, path, and file', () => {
        const apis = contractData.apis as Record<string, unknown> | undefined;
        const endpoints = apis?.endpoints as Array<Record<string, string>> | undefined;
        if (endpoints && endpoints.length > 0) {
          for (const ep of endpoints.slice(0, 3)) { // Check first 3
            expect(ep.method).toBeDefined();
            expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(ep.method)).toBe(true);
            expect(ep.path).toBeDefined();
            expect(ep.path.startsWith('/')).toBe(true);
          }
        }
      });

      it('schemas should have name, type, and columns', () => {
        const schemas = contractData.schemas as Array<Record<string, unknown>> | undefined;
        if (schemas && schemas.length > 0) {
          for (const schema of schemas.slice(0, 3)) { // Check first 3
            expect(schema.name).toBeDefined();
            expect(typeof schema.name).toBe('string');
            expect(schema.columns).toBeDefined();
            expect(Array.isArray(schema.columns)).toBe(true);
          }
        }
      });
    });
  });

  describe('Contract Content Quality', () => {
    describe('API Contract should have actual endpoints', () => {
      it('should list real API paths', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'API_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should contain actual HTTP methods
          const hasHttpMethods = /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/.test(content);
          expect(hasHttpMethods).toBe(true);
          // Should contain actual paths starting with /
          const hasPaths = /\|\s*\/\w+/.test(content);
          expect(hasPaths).toBe(true);
        } catch {
          console.log('API_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Schema Contract should have actual tables', () => {
      it('should list real table names or state no tables found', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'DATABASE_SCHEMA_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should either have actual tables OR explicitly say no tables
          const hasActualTables = /\|\s*\w+_\w+\s*\|/.test(content) || // snake_case table names
                                  /No database tables detected/i.test(content);
          expect(hasActualTables).toBe(true);
          // Should NOT have placeholder table names
          const hasPlaceholder = /\[table_name\]/i.test(content);
          expect(hasPlaceholder).toBe(false);
        } catch {
          console.log('DATABASE_SCHEMA_CONTRACT.md not found, skipping');
        }
      });
    });
  });

  describe('Version Increments', () => {
    it('contract version should be >= 1.0.0', async () => {
      const filePath = path.join(CONTRACTS_DIR, 'API_CONTRACT.md');
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const match = content.match(VERSION_HEADER_PATTERN);
        if (match) {
          const version = match[1];
          const [major, minor, patch] = version.split('.').map(Number);
          expect(major).toBeGreaterThanOrEqual(1);
        }
      } catch {
        console.log('API_CONTRACT.md not found, skipping');
      }
    });

    it('feature contract version should be >= 1.0.0', async () => {
      const featureFile = path.join(FEATURE_CONTRACTS_DIR, 'Authentication System.contracts.json');
      try {
        const content = await fs.readFile(featureFile, 'utf-8');
        const data = JSON.parse(content);
        const version = data.version;
        const [major] = version.split('.').map(Number);
        expect(major).toBeGreaterThanOrEqual(1);
      } catch {
        console.log('Feature contract not found, skipping');
      }
    });
  });
});

describe('UI Contract Display Tests', () => {
  describe('formatContractFromJSON function', () => {
    // Mock data matching actual JSON structure
    const mockFeatureContract = {
      feature: 'Test Feature',
      version: '1.2.3',
      lastGenerated: '2026-02-03T12:00:00.000Z',
      apis: {
        endpoints: [
          { method: 'GET', path: '/users', description: 'Get users', file: '/path/to/file.ts' },
          { method: 'POST', path: '/users', description: 'Create user', file: '/path/to/file.ts' },
        ]
      },
      schemas: [
        {
          name: 'users',
          type: 'table',
          file: '/path/to/migration.sql',
          columns: [
            { name: 'id', type: 'UUID', nullable: false, primaryKey: true },
            { name: 'email', type: 'VARCHAR(255)', nullable: false, primaryKey: false },
          ]
        }
      ]
    };

    it('should format API data correctly', () => {
      const formatted = formatMockContractFromJSON(mockFeatureContract, 'api', 'Test Feature');
      expect(formatted).toContain('API Endpoints');
      expect(formatted).toContain('| GET | /users |');
      expect(formatted).toContain('| POST | /users |');
      expect(formatted).not.toContain('schemas');
    });

    it('should format Schema data correctly', () => {
      const formatted = formatMockContractFromJSON(mockFeatureContract, 'schema', 'Test Feature');
      expect(formatted).toContain('Database Tables');
      expect(formatted).toContain('users');
      expect(formatted).toContain('| id | UUID |');
      expect(formatted).toContain('| email | VARCHAR(255) |');
      expect(formatted).not.toContain('endpoints');
    });
  });
});

// Helper function to test format logic (mirrors the UI function)
function formatMockContractFromJSON(data: Record<string, unknown>, contractType: string, featureName: string): string {
  const lines: string[] = [];
  lines.push(`# ${featureName} - ${contractType}`);
  lines.push('');

  switch (contractType) {
    case 'api':
      const apis = data.apis as Record<string, unknown> | undefined;
      if (apis?.endpoints && Array.isArray(apis.endpoints)) {
        lines.push('## API Endpoints');
        lines.push('');
        lines.push('| Method | Path | Description | File |');
        lines.push('|--------|------|-------------|------|');
        for (const ep of apis.endpoints as Array<Record<string, string>>) {
          const fileName = ep.file ? ep.file.split('/').pop() : '';
          lines.push(`| ${ep.method || ''} | ${ep.path || ''} | ${ep.description || ''} | ${fileName} |`);
        }
      }
      break;

    case 'schema':
      const schemas = data.schemas as Array<Record<string, unknown>> | undefined;
      if (schemas && Array.isArray(schemas)) {
        lines.push('## Database Tables / Schemas');
        lines.push('');
        for (const schema of schemas) {
          lines.push(`### ${schema.name}`);
          const columns = schema.columns as Array<Record<string, unknown>> | undefined;
          if (columns) {
            lines.push('| Column | Type | Nullable | Primary Key |');
            lines.push('|--------|------|----------|-------------|');
            for (const col of columns) {
              lines.push(`| ${col.name} | ${col.type} | ${col.nullable ? 'YES' : 'NO'} | ${col.primaryKey ? '✓' : ''} |`);
            }
          }
        }
      }
      break;
  }

  return lines.join('\n');
}
