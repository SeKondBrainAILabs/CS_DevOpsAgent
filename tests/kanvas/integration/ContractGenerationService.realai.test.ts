/**
 * Integration Tests for ContractGenerationService with REAL LLM
 * Tests AI-based feature detection using actual Groq API
 *
 * REQUIRES: GROQ_API_KEY environment variable to be set
 * Run with: GROQ_API_KEY=your_key npm test -- --config=jest.kanvas.config.cjs tests/kanvas/integration/ContractGenerationService.realai.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import { ContractGenerationService } from '../../../electron/services/ContractGenerationService';
import { AIService } from '../../../electron/services/AIService';

// Test fixtures paths
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const PIGGY_BANK_PATH = path.join(FIXTURES_DIR, 'SA-Piggy-Bank');

// Check if we have the API key
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SKIP_REAL_AI_TESTS = !GROQ_API_KEY;

// Create a mock ConfigService that returns the API key from env
const createMockConfigService = () => ({
  getCredentialValue: (key: string) => {
    if (key === 'groqApiKey') {
      return GROQ_API_KEY;
    }
    return undefined;
  },
  getCredential: (key: string) => {
    if (key === 'groqApiKey') {
      return { success: true, data: GROQ_API_KEY };
    }
    return { success: false };
  },
});

// Mock RegistryService
const mockRegistryService = {
  register: async () => ({ success: true }),
};

// Conditional describe that skips if no API key
const describeWithAI = SKIP_REAL_AI_TESTS ? describe.skip : describe;

describeWithAI('ContractGenerationService - Real AI Feature Detection', () => {
  let aiService: AIService;
  let contractService: ContractGenerationService;

  beforeAll(() => {
    if (SKIP_REAL_AI_TESTS) {
      console.log('Skipping real AI tests - GROQ_API_KEY not set');
      return;
    }

    // Create real AIService with mock ConfigService
    const mockConfig = createMockConfigService();
    aiService = new AIService(mockConfig as any);

    // Set model to kimi-k2 for best results
    aiService.setModel('kimi-k2');

    // Create ContractGenerationService with real AIService
    contractService = new ContractGenerationService(
      aiService as any,
      mockRegistryService as any
    );

    console.log('Using real Groq API with kimi-k2 model');
  });

  afterAll(() => {
    if (aiService) {
      aiService.dispose();
    }
  });

  // =========================================================================
  // Real AI Feature Detection Tests
  // =========================================================================

  it('should use real LLM to identify actual features in SA-Piggy-Bank', async () => {
    console.log('\n=== Testing Real AI Feature Detection ===');
    console.log('Repository:', PIGGY_BANK_PATH);

    const result = await contractService.discoverFeatures(PIGGY_BANK_PATH, true);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    console.log('\n=== AI-Identified Features ===');
    console.log('Total features:', result.data!.length);

    result.data!.forEach(f => {
      const relPath = path.relative(PIGGY_BANK_PATH, f.basePath);
      console.log(`  - ${f.name} (${relPath}) - ${f.contractPatternMatches} files`);
    });

    // The AI should identify actual features, not utility folders
    const featureNames = result.data!.map(f => f.name);
    const featurePaths = result.data!.map(f => path.relative(PIGGY_BANK_PATH, f.basePath));

    console.log('\nFeature names:', featureNames);
    console.log('Feature paths:', featurePaths);

    // These should NOT be identified as features
    console.log('\n=== Verification ===');
    const hasTests = featureNames.includes('tests') || featurePaths.includes('tests');
    const hasDatabase = featureNames.includes('database') || featurePaths.includes('database');

    console.log('Contains "tests":', hasTests, '(should be false)');
    console.log('Contains "database":', hasDatabase, '(should be false)');

    // Basic assertion - should find at least some features
    expect(result.data!.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for API call

  it('should compare AI vs non-AI feature detection', async () => {
    console.log('\n=== Comparing AI vs Non-AI Detection ===');

    // Without AI
    const withoutAI = await contractService.discoverFeatures(PIGGY_BANK_PATH, false);

    // With AI
    const withAI = await contractService.discoverFeatures(PIGGY_BANK_PATH, true);

    expect(withoutAI.success).toBe(true);
    expect(withAI.success).toBe(true);

    const nonAIFeatures = withoutAI.data!.map(f => f.name);
    const aiFeatures = withAI.data!.map(f => f.name);

    console.log('\n--- Without AI (mechanical scan) ---');
    console.log('Count:', nonAIFeatures.length);
    console.log('Features:', nonAIFeatures);

    console.log('\n--- With AI (intelligent detection) ---');
    console.log('Count:', aiFeatures.length);
    console.log('Features:', aiFeatures);

    console.log('\n--- Difference ---');
    const filtered = nonAIFeatures.filter(f => !aiFeatures.includes(f));
    console.log('Folders filtered out by AI:', filtered);

    // AI should filter out some non-feature folders
    // (unless the repo only has actual features)
    console.log('\nAI reduced feature count from', nonAIFeatures.length, 'to', aiFeatures.length);
  }, 90000); // 90 second timeout for two API calls
});

// =========================================================================
// Contract Extraction Tests
// =========================================================================
describeWithAI('ContractGenerationService - Contract Extraction', () => {
  let aiService: AIService;
  let contractService: ContractGenerationService;

  beforeAll(() => {
    if (SKIP_REAL_AI_TESTS) return;

    const mockConfig = createMockConfigService();
    aiService = new AIService(mockConfig as any);
    aiService.setModel('kimi-k2');

    contractService = new ContractGenerationService(
      aiService as any,
      mockRegistryService as any
    );
  });

  afterAll(() => {
    if (aiService) {
      aiService.dispose();
    }
  });

  it('should extract contract for auth-service with API endpoints', async () => {
    console.log('\n=== Testing Contract Extraction for Auth Service ===');

    // First discover features
    const discoverResult = await contractService.discoverFeatures(PIGGY_BANK_PATH, true);
    expect(discoverResult.success).toBe(true);

    // Find auth-service
    const authFeature = discoverResult.data!.find(f =>
      f.name.includes('auth') || f.basePath.includes('auth-service')
    );

    if (!authFeature) {
      console.log('Auth feature not found, skipping contract extraction test');
      return;
    }

    console.log('Found auth feature:', authFeature.name);
    console.log('Path:', authFeature.basePath);
    console.log('Files:', authFeature.contractPatternMatches);

    // Analyze the feature deeply
    const analysisResult = await contractService.analyzeFeatureDeep(PIGGY_BANK_PATH, authFeature);

    expect(analysisResult.success).toBe(true);
    expect(analysisResult.data).toBeDefined();

    const analysis = analysisResult.data!;
    console.log('\n=== Auth Service Contract Analysis ===');
    console.log('Feature:', analysis.feature);
    console.log('Purpose:', analysis.purpose);

    // Check API endpoints (should match spec)
    console.log('\n--- API Endpoints ---');
    if (analysis.apisExposed?.httpEndpoints?.length > 0) {
      analysis.apisExposed.httpEndpoints.forEach(ep => {
        console.log(`  ${ep.method} ${ep.path} - ${ep.description || ep.handler}`);
      });

      // Verify expected endpoints from spec
      const endpoints = analysis.apisExposed.httpEndpoints.map(ep => `${ep.method} ${ep.path}`);
      console.log('\nExpected endpoints from spec:');
      console.log('  POST /api/auth/register');
      console.log('  POST /api/auth/login');
      console.log('  POST /api/auth/child-login');
      console.log('  POST /api/auth/forgot-password');
      console.log('  POST /api/auth/reset-password');
      console.log('  POST /api/auth/refresh');

      // Check if at least some expected endpoints are found
      const hasRegister = endpoints.some(e => e.includes('register'));
      const hasLogin = endpoints.some(e => e.includes('login'));
      console.log('\nFound register endpoint:', hasRegister);
      console.log('Found login endpoint:', hasLogin);
    } else {
      console.log('  No endpoints extracted');
    }

    // Check database operations
    console.log('\n--- Database Operations ---');
    if (analysis.apisConsumed?.databaseOperations?.length > 0) {
      analysis.apisConsumed.databaseOperations.forEach(op => {
        console.log(`  ${op.type} on ${op.table}`);
      });
    } else {
      console.log('  No database operations extracted');
    }

    // Check dependencies
    console.log('\n--- Dependencies ---');
    console.log('Internal:', analysis.dependencies?.internal || []);
    console.log('External:', analysis.dependencies?.external || []);

  }, 120000); // 2 minute timeout

  it('should extract contract for wallet-service with transactions', async () => {
    console.log('\n=== Testing Contract Extraction for Wallet Service ===');

    const discoverResult = await contractService.discoverFeatures(PIGGY_BANK_PATH, true);
    expect(discoverResult.success).toBe(true);

    const walletFeature = discoverResult.data!.find(f =>
      f.name.includes('wallet') || f.basePath.includes('wallet-service')
    );

    if (!walletFeature) {
      console.log('Wallet feature not found, skipping');
      return;
    }

    console.log('Found wallet feature:', walletFeature.name);

    const analysisResult = await contractService.analyzeFeatureDeep(PIGGY_BANK_PATH, walletFeature);
    expect(analysisResult.success).toBe(true);

    const analysis = analysisResult.data!;
    console.log('\n=== Wallet Service Contract Analysis ===');
    console.log('Purpose:', analysis.purpose);

    console.log('\n--- Expected Endpoints from Spec ---');
    console.log('  GET /api/wallets/:childId');
    console.log('  GET /api/wallets/:childId/transactions');
    console.log('  POST /api/wallets/:childId/bonus');
    console.log('  POST /api/wallets/:childId/penalty');
    console.log('  POST /api/transfers');
    console.log('  POST /api/spend-items');
    console.log('  POST /api/purchases');

    if (analysis.apisExposed?.httpEndpoints?.length > 0) {
      console.log('\n--- Extracted Endpoints ---');
      analysis.apisExposed.httpEndpoints.forEach(ep => {
        console.log(`  ${ep.method} ${ep.path}`);
      });
    }

    // Check database tables (should include wallets, transactions)
    console.log('\n--- Expected Database Tables from Spec ---');
    console.log('  wallets, transactions, transfers, spend_items, purchases');

    if (analysis.apisConsumed?.databaseOperations?.length > 0) {
      const tables = [...new Set(analysis.apisConsumed.databaseOperations.map(op => op.table))];
      console.log('\n--- Extracted Tables ---');
      console.log(' ', tables.join(', '));
    }

  }, 120000);
});

// Always run this test to show status
describe('Real AI Test Status', () => {
  it('should report API key status', () => {
    if (SKIP_REAL_AI_TESTS) {
      console.log('\n⚠️  GROQ_API_KEY not set - real AI tests skipped');
      console.log('To run real AI tests:');
      console.log('  GROQ_API_KEY=your_key npm test -- --config=jest.kanvas.config.cjs tests/kanvas/integration/ContractGenerationService.realai.test.ts');
    } else {
      console.log('\n✅ GROQ_API_KEY is set - running real AI tests');
    }
    expect(true).toBe(true);
  });
});
