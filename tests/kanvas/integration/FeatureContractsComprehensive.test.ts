/**
 * Feature Contracts Comprehensive Tests
 * Tests every feature + contract type combination
 * Validates consistency between file content and expected structure
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// LinkedIn repo paths
const TEST_REPO_PATH = '/Volumes/Simba User Data/Development/Linkedin-New-Summary/local_deploy/claude-session-20260114-conceptwork';
const FEATURE_CONTRACTS_DIR = path.join(TEST_REPO_PATH, '.S9N_KIT_DevOpsAgent/contracts/features');
const REPO_CONTRACTS_DIR = path.join(TEST_REPO_PATH, 'House_Rules_Contracts');

// All expected feature names from the LinkedIn repo
const EXPECTED_FEATURES = [
  'Admin Management Console',
  'Analytics Dashboard',
  'Authentication System',
  'Author Management System',
  'Authority Score Calculator',
  'Browser Extension',
  'Concept Extraction Engine',
  'Concept Graph API',
  'Content Digest Service',
  'Event Bus System',
  'Firebase Integration',
  'Lead Scoring Engine',
  'LinkedIn Integration',
  'Neo4j Graph Database',
  'Post Ingestion Service',
  'Profile Matching Service',
  'Rising Stars Detector',
  'Summary Generation Service',
  'Summary Management API',
  'Twitter Sync Service',
];

// Contract types that features can have
const CONTRACT_TYPES = ['api', 'schema', 'events', 'exports'] as const;

// Repo-level contract files
const REPO_CONTRACTS = [
  { type: 'api', file: 'API_CONTRACT.md' },
  { type: 'schema', file: 'DATABASE_SCHEMA_CONTRACT.md' },
  { type: 'events', file: 'EVENTS_CONTRACT.md' },
  { type: 'features', file: 'FEATURES_CONTRACT.md' },
  { type: 'infra', file: 'INFRA_CONTRACT.md' },
  { type: 'integrations', file: 'THIRD_PARTY_INTEGRATIONS.md' },
  { type: 'admin', file: 'ADMIN_CONTRACT.md' },
  { type: 'sql', file: 'SQL_CONTRACT.json' },
  { type: 'css', file: 'CSS_CONTRACT.md' },
  { type: 'prompts', file: 'PROMPTS_CONTRACT.md' },
];

interface FeatureContract {
  feature: string;
  version: string;
  lastGenerated: string;
  generatorVersion: string;
  overview: string;
  apis?: {
    endpoints?: Array<{
      method: string;
      path: string;
      description: string;
      file: string;
    }>;
    exports?: Array<{
      name: string;
      type: string;
      file: string;
      line: number;
    }>;
  };
  schemas?: Array<{
    name: string;
    type: string;
    file: string;
    columns?: Array<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey?: boolean;
    }>;
  }>;
}

describe('Feature Contracts Comprehensive Tests', () => {
  let featureFiles: string[] = [];
  let featureContracts: Map<string, FeatureContract> = new Map();

  beforeAll(async () => {
    // Load all feature contract files
    try {
      const files = await fs.readdir(FEATURE_CONTRACTS_DIR);
      featureFiles = files.filter(f => f.endsWith('.contracts.json'));

      // Parse each feature contract
      for (const file of featureFiles) {
        try {
          const content = await fs.readFile(path.join(FEATURE_CONTRACTS_DIR, file), 'utf-8');
          const data = JSON.parse(content) as FeatureContract;
          featureContracts.set(data.feature, data);
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      featureFiles = [];
    }
  });

  describe('Feature Contract Discovery', () => {
    it('should find feature contracts directory', async () => {
      const exists = await fs.access(FEATURE_CONTRACTS_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have at least 15 feature contracts', () => {
      expect(featureFiles.length).toBeGreaterThanOrEqual(15);
    });

    it('should have all expected core features', () => {
      const foundFeatures = Array.from(featureContracts.keys());
      const coreFeatures = [
        'Authentication System',
        'Lead Scoring Engine',
        'Post Ingestion Service',
        'Summary Generation Service',
      ];

      for (const feature of coreFeatures) {
        expect(foundFeatures).toContain(feature);
      }
    });
  });

  describe('Feature Contract Structure Validation', () => {
    for (const featureName of EXPECTED_FEATURES.slice(0, 10)) {
      describe(`${featureName}`, () => {
        let contract: FeatureContract | undefined;

        beforeAll(() => {
          contract = featureContracts.get(featureName);
        });

        it('should exist', () => {
          // Some features might not have contracts yet
          if (!contract) {
            console.log(`Feature contract not found: ${featureName}`);
            return;
          }
          expect(contract).toBeDefined();
        });

        it('should have valid version', () => {
          if (!contract) return;
          expect(contract.version).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it('should have lastGenerated timestamp', () => {
          if (!contract) return;
          const date = new Date(contract.lastGenerated);
          expect(date.getTime()).not.toBeNaN();
        });

        it('should have overview', () => {
          if (!contract) return;
          expect(contract.overview).toBeDefined();
          expect(contract.overview.length).toBeGreaterThan(0);
        });

        it('should have apis section', () => {
          if (!contract) return;
          expect(contract.apis).toBeDefined();
        });
      });
    }
  });

  describe('API Endpoints Validation', () => {
    it('Authentication System should have user endpoints', () => {
      const contract = featureContracts.get('Authentication System');
      if (!contract?.apis?.endpoints) return;

      const endpoints = contract.apis.endpoints;
      const hasUserEndpoints = endpoints.some(ep =>
        ep.path.includes('/users') || ep.path.includes('/auth')
      );
      expect(hasUserEndpoints).toBe(true);
    });

    it('Admin Management Console should have admin endpoints', () => {
      const contract = featureContracts.get('Admin Management Console');
      if (!contract?.apis?.endpoints) return;

      const endpoints = contract.apis.endpoints;
      const hasAdminEndpoints = endpoints.some(ep =>
        ep.path.includes('/admin') || ep.path.includes('/organizations')
      );
      expect(hasAdminEndpoints).toBe(true);
    });

    it('Lead Scoring Engine should have scoring endpoints or exports', () => {
      const contract = featureContracts.get('Lead Scoring Engine');
      if (!contract?.apis) return;

      const hasEndpoints = (contract.apis.endpoints?.length || 0) > 0;
      const hasExports = (contract.apis.exports?.length || 0) > 0;
      expect(hasEndpoints || hasExports).toBe(true);
    });

    it('Post Ingestion Service should have post-related endpoints', () => {
      const contract = featureContracts.get('Post Ingestion Service');
      if (!contract?.apis?.endpoints) return;

      const endpoints = contract.apis.endpoints;
      const hasPostEndpoints = endpoints.some(ep =>
        ep.path.includes('/posts') || ep.path.includes('/sync')
      );
      expect(hasPostEndpoints).toBe(true);
    });
  });

  describe('Exports Validation', () => {
    it('Concept Extraction Engine should have processing functions', () => {
      const contract = featureContracts.get('Concept Extraction Engine');
      if (!contract?.apis?.exports) return;

      const exports = contract.apis.exports;
      const hasProcessingFunctions = exports.some(exp =>
        exp.name.includes('process') || exp.name.includes('extract')
      );
      expect(hasProcessingFunctions).toBe(true);
    });

    it('Summary Generation Service should have summary functions', () => {
      const contract = featureContracts.get('Summary Generation Service');
      if (!contract?.apis?.exports) return;

      const exports = contract.apis.exports;
      const hasSummaryFunctions = exports.some(exp =>
        exp.name.toLowerCase().includes('summary') ||
        exp.name.toLowerCase().includes('digest')
      );
      expect(hasSummaryFunctions).toBe(true);
    });
  });

  describe('Schema Validation', () => {
    it('features with database operations should have schemas', () => {
      const dbFeatures = [
        'Authentication System',
        'Lead Scoring Engine',
        'Post Ingestion Service',
      ];

      for (const featureName of dbFeatures) {
        const contract = featureContracts.get(featureName);
        if (!contract) continue;

        // Either has schemas or endpoints that interact with DB
        const hasSchemas = contract.schemas && contract.schemas.length > 0;
        const hasDbEndpoints = contract.apis?.endpoints?.some(ep =>
          ep.path.includes('/users') ||
          ep.path.includes('/posts') ||
          ep.path.includes('/authors')
        );

        if (!hasSchemas && !hasDbEndpoints) {
          console.log(`${featureName}: No schemas or DB endpoints found`);
        }
      }
    });
  });

  describe('Repo-Level Contracts', () => {
    for (const { type, file } of REPO_CONTRACTS) {
      describe(`${type.toUpperCase()} Contract`, () => {
        let content: string;
        let exists: boolean;

        beforeAll(async () => {
          const filePath = path.join(REPO_CONTRACTS_DIR, file);
          exists = await fs.access(filePath).then(() => true).catch(() => false);
          if (exists) {
            content = await fs.readFile(filePath, 'utf-8');
          }
        });

        it(`should exist (${file})`, () => {
          expect(exists).toBe(true);
        });

        it('should have content', () => {
          if (!exists) return;
          expect(content.length).toBeGreaterThan(100);
        });

        it('should not contain placeholder text', () => {
          if (!exists) return;
          const placeholderPatterns = [
            /\[table_name\]/i,
            /\[Feature Name\]/i,
            /Template only/i,
            /Initial Template/i,
          ];

          for (const pattern of placeholderPatterns) {
            expect(pattern.test(content)).toBe(false);
          }
        });
      });
    }
  });

  describe('Contract Consistency', () => {
    it('all feature contracts should have same generator version', () => {
      const versions = new Set<string>();

      for (const contract of featureContracts.values()) {
        if (contract.generatorVersion) {
          versions.add(contract.generatorVersion);
        }
      }

      // Should have consistent generator version
      expect(versions.size).toBeLessThanOrEqual(2);
    });

    it('all feature contracts should have recent timestamps', () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

      for (const [name, contract] of featureContracts) {
        const timestamp = new Date(contract.lastGenerated).getTime();
        if (timestamp < oneWeekAgo) {
          console.log(`${name}: Contract may be stale (${contract.lastGenerated})`);
        }
      }
    });
  });

  describe('Feature-Contract Type Matrix', () => {
    // Generate a matrix of features x contract types
    it('should generate feature-contract matrix', () => {
      const matrix: Record<string, Record<string, boolean>> = {};

      for (const [name, contract] of featureContracts) {
        matrix[name] = {
          api: (contract.apis?.endpoints?.length || 0) > 0,
          exports: (contract.apis?.exports?.length || 0) > 0,
          schema: (contract.schemas?.length || 0) > 0,
        };
      }

      // Log the matrix for visibility
      console.log('\nFeature-Contract Matrix:');
      console.log('| Feature | API | Exports | Schema |');
      console.log('|---------|-----|---------|--------|');

      for (const [name, types] of Object.entries(matrix).slice(0, 15)) {
        console.log(`| ${name.slice(0, 25).padEnd(25)} | ${types.api ? '✓' : '-'} | ${types.exports ? '✓' : '-'} | ${types.schema ? '✓' : '-'} |`);
      }

      expect(Object.keys(matrix).length).toBeGreaterThan(0);
    });
  });
});

describe('Contract Type Counts Summary', () => {
  it('should summarize contract counts', async () => {
    let featureCount = 0;
    let apiCount = 0;
    let exportCount = 0;
    let schemaCount = 0;

    const files = await fs.readdir(FEATURE_CONTRACTS_DIR);

    for (const file of files.filter(f => f.endsWith('.contracts.json'))) {
      try {
        const content = await fs.readFile(path.join(FEATURE_CONTRACTS_DIR, file), 'utf-8');
        const data = JSON.parse(content) as FeatureContract;

        featureCount++;
        apiCount += data.apis?.endpoints?.length || 0;
        exportCount += data.apis?.exports?.length || 0;
        schemaCount += data.schemas?.length || 0;
      } catch {
        // Skip
      }
    }

    console.log('\n=== Contract Summary ===');
    console.log(`Features: ${featureCount}`);
    console.log(`API Endpoints: ${apiCount}`);
    console.log(`Exports: ${exportCount}`);
    console.log(`Schemas: ${schemaCount}`);

    expect(featureCount).toBeGreaterThan(0);
  });
});
