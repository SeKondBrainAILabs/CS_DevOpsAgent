/**
 * Contract Detection Service
 * Detects when commits change contract-related files (API specs, schemas, interfaces)
 * and flags them for review or automatic contract updates
 */

import { BaseService } from './BaseService';
import type { IpcResult } from '../../shared/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Contract file patterns - files that define contracts between systems
const CONTRACT_PATTERNS = {
  // API Specifications
  openapi: ['**/openapi.yaml', '**/openapi.json', '**/swagger.yaml', '**/swagger.json'],
  graphql: ['**/*.graphql', '**/schema.graphql', '**/schema.gql'],
  protobuf: ['**/*.proto'],
  grpc: ['**/*_grpc.pb.go', '**/*_grpc.py'],

  // Database Schemas
  database: [
    '**/migrations/*.sql',
    '**/schema.prisma',
    '**/schema.sql',
    '**/drizzle/*.ts',
    '**/knex/migrations/*.js',
  ],

  // TypeScript/JavaScript Interfaces
  typescript: [
    '**/types/*.ts',
    '**/interfaces/*.ts',
    '**/*.d.ts',
    '**/shared/types.ts',
    '**/shared/types/*.ts',
  ],

  // JSON Schema
  jsonSchema: ['**/*.schema.json', '**/schemas/*.json'],

  // API Routes (may define implicit contracts)
  apiRoutes: [
    '**/routes/**/*.ts',
    '**/api/**/*.ts',
    '**/controllers/**/*.ts',
  ],

  // Configuration (environment contracts)
  config: [
    '**/.env.example',
    '**/config.schema.json',
    '**/app.config.ts',
  ],

  // ============================================
  // TEST CONTRACTS (Quality/Behavior contracts)
  // ============================================

  // Playwright E2E Tests
  playwrightE2E: [
    '**/*.e2e.spec.ts',
    '**/*.e2e.ts',
    '**/e2e/**/*.spec.ts',
    '**/playwright/**/*.spec.ts',
    '**/tests/e2e/**/*.ts',
  ],

  // Jest/Vitest Unit Tests
  unitTests: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',      // When not in e2e folder
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.tsx',
  ],

  // Integration Tests
  integrationTests: [
    '**/*.integration.ts',
    '**/*.integration.spec.ts',
    '**/tests/integration/**/*.ts',
  ],

  // Test Fixtures & Mocks
  testFixtures: [
    '**/fixtures/**/*.json',
    '**/fixtures/**/*.ts',
    '**/mocks/**/*.ts',
    '**/__mocks__/**/*.ts',
    '**/__fixtures__/**/*.json',
    '**/test-data/**/*.json',
  ],
};

// Test-specific contract types for special handling
const TEST_CONTRACT_TYPES = new Set([
  'playwrightE2E',
  'unitTests',
  'integrationTests',
  'testFixtures',
]);

export interface ContractChange {
  file: string;
  type: keyof typeof CONTRACT_PATTERNS;
  changeType: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  impactLevel: 'breaking' | 'non-breaking' | 'unknown';
  details?: string;
}

export interface ContractAnalysis {
  commitHash: string;
  commitMessage: string;
  timestamp: string;
  hasContractChanges: boolean;
  changes: ContractChange[];
  breakingChanges: ContractChange[];
  summary: string;
  recommendations: string[];
}

export class ContractDetectionService extends BaseService {
  /**
   * Analyze a commit for contract-related changes
   */
  async analyzeCommit(repoPath: string, commitHash = 'HEAD'): Promise<IpcResult<ContractAnalysis>> {
    return this.wrap(async () => {
      // Get commit info
      const { stdout: commitInfo } = await execAsync(
        `git log -1 --format="%H|%s|%aI" ${commitHash}`,
        { cwd: repoPath }
      );
      const [hash, message, timestamp] = commitInfo.trim().split('|');

      // Get changed files with stats
      const { stdout: diffStat } = await execAsync(
        `git diff-tree --no-commit-id --name-status -r ${commitHash}`,
        { cwd: repoPath }
      );

      const changes: ContractChange[] = [];
      const lines = diffStat.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const [status, file] = line.split('\t');
        const contractType = this.detectContractType(file);

        if (contractType) {
          const changeType = status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified';

          // Get diff stats for the file
          let additions = 0;
          let deletions = 0;
          try {
            const { stdout: stats } = await execAsync(
              `git diff --numstat ${commitHash}^..${commitHash} -- "${file}"`,
              { cwd: repoPath }
            );
            const [add, del] = stats.trim().split('\t');
            additions = parseInt(add) || 0;
            deletions = parseInt(del) || 0;
          } catch {
            // First commit or binary file
          }

          const impactLevel = await this.assessImpact(repoPath, file, commitHash, changeType);

          changes.push({
            file,
            type: contractType,
            changeType,
            additions,
            deletions,
            impactLevel,
          });
        }
      }

      const breakingChanges = changes.filter(c => c.impactLevel === 'breaking');
      const recommendations = this.generateRecommendations(changes);

      const analysis: ContractAnalysis = {
        commitHash: hash,
        commitMessage: message,
        timestamp,
        hasContractChanges: changes.length > 0,
        changes,
        breakingChanges,
        summary: this.generateSummary(changes),
        recommendations,
      };

      console.log(`[ContractDetection] Analyzed commit ${hash.substring(0, 7)}: ${changes.length} contract changes`);
      return analysis;
    }, 'ANALYZE_COMMIT_FAILED');
  }

  /**
   * Analyze multiple commits in a range
   */
  async analyzeCommitRange(
    repoPath: string,
    fromRef = 'HEAD~10',
    toRef = 'HEAD'
  ): Promise<IpcResult<ContractAnalysis[]>> {
    return this.wrap(async () => {
      const { stdout } = await execAsync(
        `git log --format="%H" ${fromRef}..${toRef}`,
        { cwd: repoPath }
      );

      const commits = stdout.trim().split('\n').filter(Boolean);
      const analyses: ContractAnalysis[] = [];

      for (const commit of commits) {
        const result = await this.analyzeCommit(repoPath, commit);
        if (result.success && result.data && result.data.hasContractChanges) {
          analyses.push(result.data);
        }
      }

      return analyses;
    }, 'ANALYZE_RANGE_FAILED');
  }

  /**
   * Scan staged changes for contract modifications
   */
  async analyzeStagedChanges(repoPath: string): Promise<IpcResult<ContractChange[]>> {
    return this.wrap(async () => {
      const { stdout } = await execAsync(
        'git diff --cached --name-status',
        { cwd: repoPath }
      );

      const changes: ContractChange[] = [];
      const lines = stdout.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const [status, file] = line.split('\t');
        const contractType = this.detectContractType(file);

        if (contractType) {
          changes.push({
            file,
            type: contractType,
            changeType: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
            additions: 0,
            deletions: 0,
            impactLevel: 'unknown', // Can't determine without more context
          });
        }
      }

      return changes;
    }, 'ANALYZE_STAGED_FAILED');
  }

  /**
   * Watch a repository for contract changes (returns files to watch)
   */
  getContractFilePatterns(): string[] {
    const patterns: string[] = [];
    for (const typePatterns of Object.values(CONTRACT_PATTERNS)) {
      patterns.push(...typePatterns);
    }
    return patterns;
  }

  /**
   * Detect the type of contract based on file path
   */
  private detectContractType(filePath: string): keyof typeof CONTRACT_PATTERNS | null {
    const normalizedPath = filePath.toLowerCase();

    for (const [type, patterns] of Object.entries(CONTRACT_PATTERNS)) {
      for (const pattern of patterns) {
        // Convert glob to simple pattern matching
        const regex = this.globToRegex(pattern);
        if (regex.test(normalizedPath)) {
          return type as keyof typeof CONTRACT_PATTERNS;
        }
      }
    }

    return null;
  }

  /**
   * Assess the impact level of a change
   */
  private async assessImpact(
    repoPath: string,
    file: string,
    commitHash: string,
    changeType: 'added' | 'modified' | 'deleted'
  ): Promise<'breaking' | 'non-breaking' | 'unknown'> {
    // Deletions are often breaking
    if (changeType === 'deleted') {
      return 'breaking';
    }

    // Additions are usually non-breaking
    if (changeType === 'added') {
      return 'non-breaking';
    }

    try {
      // Get the actual diff to analyze
      const { stdout: diff } = await execAsync(
        `git diff ${commitHash}^..${commitHash} -- "${file}"`,
        { cwd: repoPath, maxBuffer: 1024 * 1024 }
      );

      // Look for breaking change indicators
      const breakingIndicators = [
        /^-\s*(required|mandatory)/im,           // Required fields removed
        /^-\s*(export\s+)?interface/im,          // Interface removed
        /^-\s*(export\s+)?type/im,               // Type removed
        /^-\s*[a-zA-Z]+\s*:\s*\w+/im,           // Field removed
        /DELETE.*COLUMN/i,                        // SQL column deletion
        /DROP.*TABLE/i,                           // SQL table drop
        /BREAKING/i,                              // Explicit breaking marker
      ];

      for (const indicator of breakingIndicators) {
        if (indicator.test(diff)) {
          return 'breaking';
        }
      }

      return 'non-breaking';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate a human-readable summary
   */
  private generateSummary(changes: ContractChange[]): string {
    if (changes.length === 0) {
      return 'No contract changes detected.';
    }

    const byType = new Map<string, number>();
    for (const change of changes) {
      byType.set(change.type, (byType.get(change.type) || 0) + 1);
    }

    const breaking = changes.filter(c => c.impactLevel === 'breaking').length;
    const parts: string[] = [];

    parts.push(`${changes.length} contract file(s) changed`);

    const typeDescs: string[] = [];
    for (const [type, count] of byType) {
      typeDescs.push(`${count} ${type}`);
    }
    parts.push(`(${typeDescs.join(', ')})`);

    if (breaking > 0) {
      parts.push(`- ${breaking} potentially breaking`);
    }

    return parts.join(' ');
  }

  /**
   * Generate recommendations based on changes
   */
  private generateRecommendations(changes: ContractChange[]): string[] {
    const recommendations: string[] = [];

    const hasBreaking = changes.some(c => c.impactLevel === 'breaking');
    const hasApi = changes.some(c => ['openapi', 'graphql', 'protobuf'].includes(c.type));
    const hasDatabase = changes.some(c => c.type === 'database');
    const hasTypes = changes.some(c => c.type === 'typescript');

    if (hasBreaking) {
      recommendations.push('Review breaking changes before merging');
      recommendations.push('Consider versioning the API if changes are significant');
      recommendations.push('Update consumer documentation');
    }

    if (hasApi) {
      recommendations.push('Regenerate client SDKs if applicable');
      recommendations.push('Update API documentation');
    }

    if (hasDatabase) {
      recommendations.push('Test migrations on a staging database');
      recommendations.push('Ensure rollback migration exists');
      recommendations.push('Check for data loss implications');
    }

    if (hasTypes) {
      recommendations.push('Run type checking across dependent projects');
      recommendations.push('Update shared type packages if published');
    }

    if (changes.length > 0) {
      recommendations.push('Notify dependent teams of contract changes');
    }

    return recommendations;
  }

  /**
   * Convert glob pattern to regex
   */
  private globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*\*/g, '.*')                 // ** matches anything
      .replace(/\*/g, '[^/]*');               // * matches non-slash

    return new RegExp(`^${escaped}$`, 'i');
  }
}

export const contractDetectionService = new ContractDetectionService();
