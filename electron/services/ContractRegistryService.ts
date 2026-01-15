/**
 * Contract Registry Service
 * Manages JSON-based contract tracking at repo and feature levels
 */

import { BaseService } from './BaseService';
import type { IpcResult } from '../../shared/types';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { KANVAS_PATHS } from '../../shared/agent-protocol';

// =============================================================================
// Types
// =============================================================================

export interface TestContract {
  file: string;
  type: 'playwright' | 'jest' | 'vitest' | 'integration';
  testCount: number;
  testNames: string[];
  assertions?: number;
  lastModified: string;
}

export interface ApiContract {
  file: string;
  type: 'openapi' | 'graphql' | 'protobuf' | 'typescript' | 'routes';
  endpoints?: string[];
  types?: string[];
  lastModified: string;
}

export interface FixtureContract {
  file: string;
  type: 'json' | 'mock' | 'factory';
  usedBy: string[]; // Test files that import this
  lastModified: string;
}

export interface FeatureContracts {
  feature: string;
  version: string;
  lastUpdated: string;
  contracts: {
    api: ApiContract[];
    e2e: TestContract[];
    unit: TestContract[];
    integration: TestContract[];
    fixtures: FixtureContract[];
  };
  dependencies: string[];
  coverageScore: number;
  breakingChanges: BreakingChange[];
}

export interface BreakingChange {
  id: string;
  file: string;
  type: string;
  description: string;
  timestamp: string;
  commitHash: string;
}

export interface RepoContractSummary {
  version: string;
  lastUpdated: string;
  summary: {
    totalFeatures: number;
    totalTests: number;
    totalApiContracts: number;
    coverageScore: number;
    breakingChangesLast7Days: number;
    breakingChangesLast30Days: number;
  };
  features: Record<string, { ref: string; testCount: number; coverageScore: number }>;
  recentBreakingChanges: BreakingChange[];
}

export interface FeatureOrganizationConfig {
  enabled: boolean;
  structure: 'feature-folders' | 'flat' | 'custom';
  setupCompleted: boolean;
  setupCompletedAt?: string;
  customPatterns?: string[];
}

// =============================================================================
// Service
// =============================================================================

export class ContractRegistryService extends BaseService {
  private readonly CONTRACTS_DIR = 'contracts';
  private readonly REPO_FILE = 'repo-contracts.json';
  private readonly FEATURES_DIR = 'features';

  /**
   * Initialize the contract registry for a repository
   */
  async initializeRegistry(repoPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const contractsDir = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR);
      const featuresDir = path.join(contractsDir, this.FEATURES_DIR);

      // Create directories
      if (!existsSync(contractsDir)) {
        await fs.mkdir(contractsDir, { recursive: true });
      }
      if (!existsSync(featuresDir)) {
        await fs.mkdir(featuresDir, { recursive: true });
      }

      // Create initial repo-contracts.json if it doesn't exist
      const repoFile = path.join(contractsDir, this.REPO_FILE);
      if (!existsSync(repoFile)) {
        const initialSummary: RepoContractSummary = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          summary: {
            totalFeatures: 0,
            totalTests: 0,
            totalApiContracts: 0,
            coverageScore: 0,
            breakingChangesLast7Days: 0,
            breakingChangesLast30Days: 0,
          },
          features: {},
          recentBreakingChanges: [],
        };
        await fs.writeFile(repoFile, JSON.stringify(initialSummary, null, 2));
      }

      console.log(`[ContractRegistry] Initialized registry at ${contractsDir}`);
    }, 'INIT_REGISTRY_FAILED');
  }

  /**
   * Get the repository contract summary
   */
  async getRepoSummary(repoPath: string): Promise<IpcResult<RepoContractSummary>> {
    return this.wrap(async () => {
      const repoFile = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR, this.REPO_FILE);

      if (!existsSync(repoFile)) {
        await this.initializeRegistry(repoPath);
      }

      const content = await fs.readFile(repoFile, 'utf-8');
      return JSON.parse(content) as RepoContractSummary;
    }, 'GET_REPO_SUMMARY_FAILED');
  }

  /**
   * Get contracts for a specific feature
   */
  async getFeatureContracts(repoPath: string, feature: string): Promise<IpcResult<FeatureContracts | null>> {
    return this.wrap(async () => {
      const featureFile = path.join(
        repoPath,
        KANVAS_PATHS.baseDir,
        this.CONTRACTS_DIR,
        this.FEATURES_DIR,
        `${feature}.contracts.json`
      );

      if (!existsSync(featureFile)) {
        return null;
      }

      const content = await fs.readFile(featureFile, 'utf-8');
      return JSON.parse(content) as FeatureContracts;
    }, 'GET_FEATURE_CONTRACTS_FAILED');
  }

  /**
   * Update contracts for a feature
   */
  async updateFeatureContracts(
    repoPath: string,
    feature: string,
    contracts: Partial<FeatureContracts['contracts']>
  ): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const featuresDir = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR, this.FEATURES_DIR);
      const featureFile = path.join(featuresDir, `${feature}.contracts.json`);

      // Ensure directory exists
      if (!existsSync(featuresDir)) {
        await fs.mkdir(featuresDir, { recursive: true });
      }

      // Load existing or create new
      let featureContracts: FeatureContracts;
      if (existsSync(featureFile)) {
        const content = await fs.readFile(featureFile, 'utf-8');
        featureContracts = JSON.parse(content);
      } else {
        featureContracts = {
          feature,
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          contracts: {
            api: [],
            e2e: [],
            unit: [],
            integration: [],
            fixtures: [],
          },
          dependencies: [],
          coverageScore: 0,
          breakingChanges: [],
        };
      }

      // Merge contracts
      if (contracts.api) featureContracts.contracts.api = contracts.api;
      if (contracts.e2e) featureContracts.contracts.e2e = contracts.e2e;
      if (contracts.unit) featureContracts.contracts.unit = contracts.unit;
      if (contracts.integration) featureContracts.contracts.integration = contracts.integration;
      if (contracts.fixtures) featureContracts.contracts.fixtures = contracts.fixtures;

      featureContracts.lastUpdated = new Date().toISOString();

      // Calculate coverage score
      const totalTests =
        featureContracts.contracts.e2e.reduce((sum, t) => sum + t.testCount, 0) +
        featureContracts.contracts.unit.reduce((sum, t) => sum + t.testCount, 0) +
        featureContracts.contracts.integration.reduce((sum, t) => sum + t.testCount, 0);

      const apiCount = featureContracts.contracts.api.length;
      featureContracts.coverageScore = apiCount > 0 ? Math.min(1, totalTests / (apiCount * 5)) : (totalTests > 0 ? 1 : 0);

      await fs.writeFile(featureFile, JSON.stringify(featureContracts, null, 2));

      // Update repo summary
      await this.updateRepoSummary(repoPath);

      console.log(`[ContractRegistry] Updated feature contracts: ${feature}`);
    }, 'UPDATE_FEATURE_CONTRACTS_FAILED');
  }

  /**
   * Record a breaking change
   */
  async recordBreakingChange(
    repoPath: string,
    feature: string,
    change: Omit<BreakingChange, 'id'>
  ): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const featureResult = await this.getFeatureContracts(repoPath, feature);
      if (!featureResult.success) {
        throw new Error('Could not get feature contracts');
      }

      const featureContracts = featureResult.data || {
        feature,
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        contracts: { api: [], e2e: [], unit: [], integration: [], fixtures: [] },
        dependencies: [],
        coverageScore: 0,
        breakingChanges: [],
      };

      const breakingChange: BreakingChange = {
        ...change,
        id: `bc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      };

      featureContracts.breakingChanges.push(breakingChange);

      // Keep only last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      featureContracts.breakingChanges = featureContracts.breakingChanges.filter(
        bc => new Date(bc.timestamp) > thirtyDaysAgo
      );

      await this.updateFeatureContracts(repoPath, feature, featureContracts.contracts);

      // Update repo summary with breaking change
      await this.updateRepoSummary(repoPath);

      console.log(`[ContractRegistry] Recorded breaking change in ${feature}: ${change.description}`);
    }, 'RECORD_BREAKING_CHANGE_FAILED');
  }

  /**
   * Get all features with contracts
   */
  async listFeatures(repoPath: string): Promise<IpcResult<string[]>> {
    return this.wrap(async () => {
      const featuresDir = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR, this.FEATURES_DIR);

      if (!existsSync(featuresDir)) {
        return [];
      }

      const files = await fs.readdir(featuresDir);
      return files
        .filter(f => f.endsWith('.contracts.json'))
        .map(f => f.replace('.contracts.json', ''));
    }, 'LIST_FEATURES_FAILED');
  }

  /**
   * Get feature organization config
   */
  async getFeatureOrganizationConfig(repoPath: string): Promise<IpcResult<FeatureOrganizationConfig>> {
    return this.wrap(async () => {
      const configFile = path.join(repoPath, KANVAS_PATHS.baseDir, 'config.json');

      if (!existsSync(configFile)) {
        return {
          enabled: false,
          structure: 'flat',
          setupCompleted: false,
        };
      }

      const content = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(content);

      return config.featureOrganization || {
        enabled: false,
        structure: 'flat',
        setupCompleted: false,
      };
    }, 'GET_FEATURE_ORG_CONFIG_FAILED');
  }

  /**
   * Set feature organization config
   */
  async setFeatureOrganizationConfig(
    repoPath: string,
    orgConfig: FeatureOrganizationConfig
  ): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const configFile = path.join(repoPath, KANVAS_PATHS.baseDir, 'config.json');
      const configDir = path.dirname(configFile);

      if (!existsSync(configDir)) {
        await fs.mkdir(configDir, { recursive: true });
      }

      let config: Record<string, unknown> = {};
      if (existsSync(configFile)) {
        const content = await fs.readFile(configFile, 'utf-8');
        config = JSON.parse(content);
      }

      config.featureOrganization = orgConfig;

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      console.log(`[ContractRegistry] Updated feature organization config: ${orgConfig.structure}`);
    }, 'SET_FEATURE_ORG_CONFIG_FAILED');
  }

  /**
   * Check if first-run setup is needed
   */
  async needsFirstRunSetup(repoPath: string): Promise<IpcResult<boolean>> {
    return this.wrap(async () => {
      const configResult = await this.getFeatureOrganizationConfig(repoPath);
      if (!configResult.success) return true;

      return !configResult.data?.setupCompleted;
    }, 'CHECK_FIRST_RUN_FAILED');
  }

  /**
   * Update the repo summary from all feature files
   */
  private async updateRepoSummary(repoPath: string): Promise<void> {
    const repoFile = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR, this.REPO_FILE);
    const featuresDir = path.join(repoPath, KANVAS_PATHS.baseDir, this.CONTRACTS_DIR, this.FEATURES_DIR);

    let totalTests = 0;
    let totalApiContracts = 0;
    let totalCoverage = 0;
    const features: RepoContractSummary['features'] = {};
    const allBreakingChanges: BreakingChange[] = [];

    // Read all feature files
    if (existsSync(featuresDir)) {
      const files = await fs.readdir(featuresDir);

      for (const file of files) {
        if (!file.endsWith('.contracts.json')) continue;

        const featureName = file.replace('.contracts.json', '');
        const content = await fs.readFile(path.join(featuresDir, file), 'utf-8');
        const featureData = JSON.parse(content) as FeatureContracts;

        const featureTestCount =
          featureData.contracts.e2e.reduce((sum, t) => sum + t.testCount, 0) +
          featureData.contracts.unit.reduce((sum, t) => sum + t.testCount, 0) +
          featureData.contracts.integration.reduce((sum, t) => sum + t.testCount, 0);

        totalTests += featureTestCount;
        totalApiContracts += featureData.contracts.api.length;
        totalCoverage += featureData.coverageScore;

        features[featureName] = {
          ref: `./${this.FEATURES_DIR}/${file}`,
          testCount: featureTestCount,
          coverageScore: featureData.coverageScore,
        };

        allBreakingChanges.push(...featureData.breakingChanges);
      }
    }

    const featureCount = Object.keys(features).length;
    const avgCoverage = featureCount > 0 ? totalCoverage / featureCount : 0;

    // Calculate breaking changes in time windows
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentBreakingChanges = allBreakingChanges
      .filter(bc => new Date(bc.timestamp) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summary: RepoContractSummary = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      summary: {
        totalFeatures: featureCount,
        totalTests,
        totalApiContracts,
        coverageScore: avgCoverage,
        breakingChangesLast7Days: allBreakingChanges.filter(bc => new Date(bc.timestamp) > sevenDaysAgo).length,
        breakingChangesLast30Days: recentBreakingChanges.length,
      },
      features,
      recentBreakingChanges: recentBreakingChanges.slice(0, 20), // Keep top 20
    };

    await fs.writeFile(repoFile, JSON.stringify(summary, null, 2));
  }

  /**
   * Auto-detect feature from file path
   */
  detectFeatureFromPath(filePath: string): string {
    // Check for explicit feature folder pattern
    const featureMatch = filePath.match(/features?\/([^/]+)\//i);
    if (featureMatch) {
      return featureMatch[1].toLowerCase();
    }

    // Check for common patterns like auth.service.ts -> auth
    const basename = path.basename(filePath, path.extname(filePath));
    const parts = basename.split('.');
    if (parts.length > 1) {
      return parts[0].toLowerCase();
    }

    // Fallback to parent directory
    const parentDir = path.basename(path.dirname(filePath));
    if (parentDir && parentDir !== 'src' && parentDir !== 'lib') {
      return parentDir.toLowerCase();
    }

    return 'general';
  }
}

export const contractRegistryService = new ContractRegistryService();
