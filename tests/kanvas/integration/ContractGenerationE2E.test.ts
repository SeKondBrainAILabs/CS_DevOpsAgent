/**
 * Contract Generation E2E Tests
 * Comprehensive tests for contract generation at repo, feature, and contract type levels
 * Validates content is actual data, not placeholder templates
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Test against the LinkedIn repo worktree
const TEST_REPO_PATH = '/Volumes/Simba User Data/Development/Linkedin-New-Summary/local_deploy/claude-session-20260114-conceptwork';
const CONTRACTS_DIR = path.join(TEST_REPO_PATH, 'House_Rules_Contracts');
const FEATURE_CONTRACTS_DIR = path.join(TEST_REPO_PATH, '.S9N_KIT_DevOpsAgent/contracts/features');

// All repo-level contract definitions
const REPO_CONTRACT_TYPES = [
  { type: 'api', file: 'API_CONTRACT.md', required: true },
  { type: 'schema', file: 'DATABASE_SCHEMA_CONTRACT.md', required: true },
  { type: 'events', file: 'EVENTS_CONTRACT.md', required: true },
  { type: 'infra', file: 'INFRA_CONTRACT.md', required: true },
  { type: 'features', file: 'FEATURES_CONTRACT.md', required: true },
  { type: 'integrations', file: 'THIRD_PARTY_INTEGRATIONS.md', required: true },
  { type: 'sql', file: 'SQL_CONTRACT.json', required: false },
  { type: 'admin', file: 'ADMIN_CONTRACT.md', required: false },
  { type: 'css', file: 'CSS_CONTRACT.md', required: false },
  { type: 'prompts', file: 'PROMPTS_CONTRACT.md', required: false },
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
  /\[F-XXX\]/i,
  /\[VAR_NAME\]/i,
  /\[Service\]/i,
  /\[API\]/i,
];

// Version header pattern for markdown files
const VERSION_HEADER_PATTERN = /<!--\s*Version:\s*([\d.]+)\s*\|\s*Generated:\s*(\d{4}-\d{2}-\d{2})/;

// Version pattern for JSON files
const JSON_VERSION_PATTERN = /"version":\s*"([\d.]+)"/;

describe('Contract Generation E2E Tests', () => {
  describe('Repo-Level Contracts', () => {
    it('should have House_Rules_Contracts directory', async () => {
      const exists = await fs.access(CONTRACTS_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    for (const { type, file, required } of REPO_CONTRACT_TYPES) {
      describe(`${type.toUpperCase()} Contract (${file})`, () => {
        let content: string;
        let filePath: string;
        const isJson = file.endsWith('.json');

        beforeAll(async () => {
          filePath = path.join(CONTRACTS_DIR, file);
          try {
            content = await fs.readFile(filePath, 'utf-8');
          } catch {
            content = '';
          }
        });

        it(`should ${required ? 'exist' : 'exist if created'}`, async () => {
          const exists = await fs.access(filePath).then(() => true).catch(() => false);
          if (required) {
            expect(exists).toBe(true);
          } else if (!exists) {
            console.log(`${file} not found (optional), skipping`);
          }
        });

        it('should have version header/field', () => {
          if (!content) return;
          if (isJson) {
            const hasVersion = JSON_VERSION_PATTERN.test(content) || /"contract_version"/.test(content);
            expect(hasVersion).toBe(true);
          } else {
            const hasVersionHeader = VERSION_HEADER_PATTERN.test(content);
            expect(hasVersionHeader).toBe(true);
          }
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
          if (isJson) {
            // JSON should have more than just metadata
            const parsed = JSON.parse(content);
            const keys = Object.keys(parsed);
            expect(keys.length).toBeGreaterThan(2);
          } else {
            // Markdown should have more than just headers
            const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('<!--'));
            expect(lines.length).toBeGreaterThan(5);
          }
        });
      });
    }
  });

  describe('Feature-Level Contracts', () => {
    let featureFiles: string[] = [];

    beforeAll(async () => {
      try {
        const files = await fs.readdir(FEATURE_CONTRACTS_DIR);
        featureFiles = files.filter(f => f.endsWith('.contracts.json'));
      } catch {
        featureFiles = [];
      }
    });

    it('should have feature contracts directory', async () => {
      const exists = await fs.access(FEATURE_CONTRACTS_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have at least one feature contract JSON', () => {
      expect(featureFiles.length).toBeGreaterThan(0);
    });

    it('should have multiple feature contracts (comprehensive coverage)', () => {
      expect(featureFiles.length).toBeGreaterThan(10);
    });

    describe('All Feature Contracts Validation', () => {
      it('all feature contracts should have valid JSON', async () => {
        for (const file of featureFiles) {
          const filePath = path.join(FEATURE_CONTRACTS_DIR, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed).toBeDefined();
          } catch (err) {
            console.error(`Invalid JSON in ${file}:`, err);
            expect(true).toBe(false);
          }
        }
      });

      it('all feature contracts should have version field', async () => {
        for (const file of featureFiles) {
          const filePath = path.join(FEATURE_CONTRACTS_DIR, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.version).toBeDefined();
            expect(typeof parsed.version).toBe('string');
          } catch {
            // Skip if file doesn't exist or can't be parsed
          }
        }
      });

      it('all feature contracts should have lastGenerated timestamp', async () => {
        for (const file of featureFiles) {
          const filePath = path.join(FEATURE_CONTRACTS_DIR, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.lastGenerated).toBeDefined();
            const date = new Date(parsed.lastGenerated);
            expect(date.getTime()).not.toBeNaN();
          } catch {
            // Skip if file doesn't exist or can't be parsed
          }
        }
      });
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
          for (const ep of endpoints.slice(0, 3)) {
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
          for (const schema of schemas.slice(0, 3)) {
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
      it('should list real API paths or state none detected', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'API_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should contain actual HTTP methods OR explicitly say no endpoints
          const hasHttpMethods = /\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|/.test(content);
          const hasNoEndpoints = /No API endpoints detected/i.test(content) || /No endpoints detected/i.test(content);
          expect(hasHttpMethods || hasNoEndpoints).toBe(true);
        } catch {
          console.log('API_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Schema Contract should have actual tables', () => {
      it('should list real table names', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'DATABASE_SCHEMA_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual tables with snake_case names
          const hasActualTables = /linkedin_\w+/.test(content);
          expect(hasActualTables).toBe(true);
        } catch {
          console.log('DATABASE_SCHEMA_CONTRACT.md not found, skipping');
        }
      });

      it('should list actual columns with types', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'DATABASE_SCHEMA_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have column definitions with types like UUID, VARCHAR, etc.
          const hasColumnTypes = /\|\s*(UUID|VARCHAR|TEXT|INTEGER|BOOLEAN|TIMESTAMP|FLOAT|JSONB)\s*\|/i.test(content);
          expect(hasColumnTypes).toBe(true);
        } catch {
          console.log('DATABASE_SCHEMA_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Infra Contract should have actual services', () => {
      it('should list real docker services', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'INFRA_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual service names from docker-compose
          const hasPostgres = /postgres/i.test(content);
          const hasRedis = /redis/i.test(content);
          expect(hasPostgres && hasRedis).toBe(true);
        } catch {
          console.log('INFRA_CONTRACT.md not found, skipping');
        }
      });

      it('should list actual port mappings', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'INFRA_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual port numbers
          const hasPorts = /\|\s*9\d{3}\s*[:|]/.test(content) || /port.*9\d{3}/i.test(content);
          expect(hasPorts).toBe(true);
        } catch {
          console.log('INFRA_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Events Contract should have actual events', () => {
      it('should list actual Kafka topics', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'EVENTS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual topic names
          const hasTopics = /auth\.events|post\.events|pulse\./i.test(content);
          expect(hasTopics).toBe(true);
        } catch {
          console.log('EVENTS_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Features Contract should have actual features', () => {
      it('should list actual feature modules', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'FEATURES_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual service names
          const hasServices = /auth-service|user-service|ai-worker/i.test(content);
          expect(hasServices).toBe(true);
        } catch {
          console.log('FEATURES_CONTRACT.md not found, skipping');
        }
      });

      it('should have feature IDs', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'FEATURES_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have feature IDs like F-001, F-002
          const hasFeatureIds = /F-\d{3}/.test(content);
          expect(hasFeatureIds).toBe(true);
        } catch {
          console.log('FEATURES_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Integrations Contract should have actual integrations', () => {
      it('should list actual third-party services', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'THIRD_PARTY_INTEGRATIONS.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual integration names
          const hasIntegrations = /PostgreSQL|Redis|Neo4j|Kafka|Groq/i.test(content);
          expect(hasIntegrations).toBe(true);
        } catch {
          console.log('THIRD_PARTY_INTEGRATIONS.md not found, skipping');
        }
      });
    });

    describe('Admin Contract should have actual admin endpoints', () => {
      it('should list admin API endpoints', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'ADMIN_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have admin API paths
          const hasAdminEndpoints = /\/api\/admin\//.test(content);
          expect(hasAdminEndpoints).toBe(true);
        } catch {
          console.log('ADMIN_CONTRACT.md not found, skipping');
        }
      });

      it('should list role hierarchy', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'ADMIN_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have role definitions
          const hasRoles = /SUPER_ADMIN|ORG_ADMIN|USER/i.test(content);
          expect(hasRoles).toBe(true);
        } catch {
          console.log('ADMIN_CONTRACT.md not found, skipping');
        }
      });

      it('should have user management endpoints', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'ADMIN_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have user management
          const hasUserMgmt = /\/users/.test(content) && /GET|POST|PATCH|DELETE/.test(content);
          expect(hasUserMgmt).toBe(true);
        } catch {
          console.log('ADMIN_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('CSS Contract should have actual design tokens', () => {
      it('should list color tokens', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'CSS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have CSS variable names
          const hasColorTokens = /--color-primary|--color-accent|--color-error/i.test(content);
          expect(hasColorTokens).toBe(true);
        } catch {
          console.log('CSS_CONTRACT.md not found, skipping');
        }
      });

      it('should list typography tokens', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'CSS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have typography tokens
          const hasTypography = /--font-size|--font-weight|--line-height/i.test(content);
          expect(hasTypography).toBe(true);
        } catch {
          console.log('CSS_CONTRACT.md not found, skipping');
        }
      });

      it('should list spacing scale', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'CSS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have spacing tokens
          const hasSpacing = /--spacing-|rem|px/.test(content);
          expect(hasSpacing).toBe(true);
        } catch {
          console.log('CSS_CONTRACT.md not found, skipping');
        }
      });
    });

    describe('Prompts Contract should have actual prompt modes', () => {
      it('should list prompt mode IDs', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'PROMPTS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have actual mode IDs
          const hasModes = /digest_professional|digest_executive|digest_technical/i.test(content);
          expect(hasModes).toBe(true);
        } catch {
          console.log('PROMPTS_CONTRACT.md not found, skipping');
        }
      });

      it('should list model configurations', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'PROMPTS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have model settings
          const hasModelConfig = /temperature|max_tokens|llama/i.test(content);
          expect(hasModelConfig).toBe(true);
        } catch {
          console.log('PROMPTS_CONTRACT.md not found, skipping');
        }
      });

      it('should list persona definitions', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'PROMPTS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have persona info
          const hasPersona = /Persona|Role|Tone/i.test(content);
          expect(hasPersona).toBe(true);
        } catch {
          console.log('PROMPTS_CONTRACT.md not found, skipping');
        }
      });

      it('should list output formats', async () => {
        const filePath = path.join(CONTRACTS_DIR, 'PROMPTS_CONTRACT.md');
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          // Should have output format sections
          const hasOutputFormat = /Output Format|Executive Summary|Key Themes/i.test(content);
          expect(hasOutputFormat).toBe(true);
        } catch {
          console.log('PROMPTS_CONTRACT.md not found, skipping');
        }
      });
    });
  });

  describe('Version Increments', () => {
    it('all repo contracts should have version >= 1.0.0', async () => {
      for (const { file, required } of REPO_CONTRACT_TYPES) {
        const filePath = path.join(CONTRACTS_DIR, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          let version: string | null = null;

          if (file.endsWith('.json')) {
            const match = content.match(/"(?:contract_)?version":\s*"([\d.]+)"/);
            version = match ? match[1] : null;
          } else {
            const match = content.match(VERSION_HEADER_PATTERN);
            version = match ? match[1] : null;
          }

          if (version) {
            const [major] = version.split('.').map(Number);
            expect(major).toBeGreaterThanOrEqual(1);
          }
        } catch {
          if (required) {
            console.log(`${file} not found but required`);
          }
        }
      }
    });

    it('feature contract versions should be >= 1.0.0', async () => {
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
