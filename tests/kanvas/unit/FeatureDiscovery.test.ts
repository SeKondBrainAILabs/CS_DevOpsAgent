
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ContractGenerationService } from '../../../electron/services/ContractGenerationService';

// Mock dependencies
const mockAIService = {
  sendWithMode: jest.fn(),
  on: jest.fn(),
  emit: jest.fn(),
};
const mockRegistryService = {
  register: jest.fn(),
};

describe('Feature Discovery Real FS', () => {
  let tempDir: string;
  let service: ContractGenerationService;

  beforeEach(async () => {
    // Create temp dir
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kanvas-test-'));
    service = new ContractGenerationService(mockAIService as any, mockRegistryService as any);
  });

  afterEach(async () => {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('should discover features in a standard src/features structure', async () => {
    // Setup directory structure
    const authDir = path.join(tempDir, 'src/features/auth');
    const usersDir = path.join(tempDir, 'src/features/users');
    
    await fs.mkdir(path.join(authDir, 'routes'), { recursive: true }); // Make it a dir for detection
    await fs.mkdir(usersDir, { recursive: true });
    
    await fs.writeFile(path.join(tempDir, 'package.json'), '{"name": "test-app"}');
    // Add some files that match CONTRACT_PATTERNS
    await fs.writeFile(path.join(authDir, 'routes/index.ts'), '// API routes');
    await fs.writeFile(path.join(authDir, 'types.ts'), '// Types');
    await fs.writeFile(path.join(usersDir, 'controller.ts'), '// Controller');

    // Run discovery (useAI = false to avoid mocking AI for now)
    const result = await service.discoverFeatures(tempDir, false);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    
    if (result.data) {
      const featureNames = result.data.map(f => f.name).sort();
      // "auth" and "users" are expected
      expect(featureNames).toContain('auth');
      expect(featureNames).toContain('users');
      
      const authFeature = result.data.find(f => f.name === 'auth');
      expect(authFeature).toBeDefined();
      // Check for routes/index.ts in api files
      const hasRoute = authFeature?.files.api.some(f => f.includes('routes') && f.includes('index.ts'));
      expect(hasRoute).toBe(true);
    }
  });

  it('should identify a root-level feature if no sub-features found', async () => {
    // Setup directory structure with just files in root
    await fs.writeFile(path.join(tempDir, 'package.json'), '{"name": "simple-app"}');
    await fs.writeFile(path.join(tempDir, 'index.ts'), '// Entry');
    await fs.writeFile(path.join(tempDir, 'api.ts'), '// API');

    const result = await service.discoverFeatures(tempDir, false);
    
    expect(result.success).toBe(true);
    if (result.data) {
      expect(result.data).toHaveLength(1);
      // The current implementation uses the directory name for root feature
      // so we expect the temp dir name
      expect(result.data[0].name).toBe(path.basename(tempDir));
    }
  });
});
