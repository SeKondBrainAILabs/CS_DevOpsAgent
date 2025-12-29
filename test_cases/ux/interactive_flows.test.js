
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Define mocks
const mockExecSync = jest.fn();
const mockReadline = {
  createInterface: jest.fn().mockReturnValue({
    question: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  })
};

// Mock dependencies
await jest.unstable_mockModule('child_process', () => ({
  execSync: mockExecSync,
  spawn: jest.fn(),
  fork: jest.fn().mockReturnValue({ on: jest.fn() }),
  exec: jest.fn()
}));

await jest.unstable_mockModule('readline', () => ({
  default: mockReadline
}));

await jest.unstable_mockModule('../../src/credentials-manager.js', () => ({
  credentialsManager: {
    injectEnv: jest.fn(),
    hasGroqApiKey: jest.fn().mockReturnValue(false),
    getGroqApiKey: jest.fn(),
    setGroqApiKey: jest.fn()
  }
}));

await jest.unstable_mockModule('../../src/house-rules-manager.js', () => ({
  default: class MockHouseRulesManager {
    constructor() {
      this.houseRulesPath = '/mock/houserules.md';
    }
    getStatus() {
      return { exists: true, needsUpdate: false };
    }
    updateHouseRules() {
      return Promise.resolve({ created: true, path: '/mock/houserules.md' });
    }
  }
}));

await jest.unstable_mockModule('../../src/docker-utils.js', () => ({
  hasDockerConfiguration: jest.fn().mockReturnValue({ hasCompose: false, composeFiles: [] })
}));

// Dynamic import
const { SessionCoordinator } = await import('../../src/session-coordinator.js');

describe('First Time User Experience (FTUE) Flows', () => {
  let coordinator;
  let consoleSpy;
  let mockRl;
  
  // Mock file system
  const mockFs = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue([]),
    statSync: jest.fn().mockReturnValue({ mtimeMs: Date.now() }),
    unlinkSync: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Spy on console
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Spy on FS
    jest.spyOn(fs, 'existsSync').mockImplementation(mockFs.existsSync);
    jest.spyOn(fs, 'readFileSync').mockImplementation(mockFs.readFileSync);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(mockFs.writeFileSync);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(mockFs.mkdirSync);
    jest.spyOn(fs, 'readdirSync').mockImplementation(mockFs.readdirSync);
    
    // Mock git root
    mockExecSync.mockReturnValue('/mock/repo');
    
    // Mock readline interface
    mockRl = {
      question: jest.fn(),
      close: jest.fn()
    };
    mockReadline.createInterface.mockReturnValue(mockRl);
    
    // Initialize coordinator
    // We need to bypass the constructor's immediate calls or mock them response
    mockFs.existsSync.mockReturnValue(true); // Assume dirs exist to avoid constructor errors
    mockFs.readFileSync.mockReturnValue('{}'); // Empty config
    
    coordinator = new SessionCoordinator();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should prompt for developer initials on first run', async () => {
    // Setup state: No global settings
    coordinator.loadGlobalSettings = jest.fn().mockReturnValue({ configured: false });
    coordinator.saveGlobalSettings = jest.fn();
    
    // Mock user input: "SDD"
    mockRl.question.mockImplementation((q, cb) => cb('SDD'));
    
    await coordinator.ensureGlobalSetup();
    
    // Verify prompt
    expect(mockRl.question).toHaveBeenCalledWith(
      expect.stringContaining('Developer initials'),
      expect.any(Function)
    );
    
    // Verify save
    expect(coordinator.saveGlobalSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        developerInitials: 'sdd',
        configured: true
      })
    );
  });

  it('should prompt for project versioning strategy on new project', async () => {
    // Setup state: No project settings
    coordinator.loadProjectSettings = jest.fn().mockReturnValue({ versioningStrategy: { configured: false } });
    coordinator.saveProjectSettings = jest.fn();
    
    // Mock sequence of inputs: 
    // 1. Is inherited? (n)
    // 2. Increment choice? (1 - default)
    mockRl.question
      .mockImplementationOnce((q, cb) => cb('n'))
      .mockImplementationOnce((q, cb) => cb('1'));
      
    await coordinator.ensureProjectSetup();
    
    // Verify save
    expect(coordinator.saveProjectSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        versioningStrategy: expect.objectContaining({
          prefix: 'v0.',
          startMinor: 20,
          dailyIncrement: 1,
          configured: true
        })
      })
    );
  });

  it('should prompt for house rules setup if missing', async () => {
    // Setup state: House rules missing
    mockFs.existsSync.mockImplementation((p) => {
      if (typeof p === 'string' && p.endsWith('houserules.md')) return false;
      return true;
    });
    
    // Mock input: Structured? (y)
    mockRl.question.mockImplementation((q, cb) => cb('y'));
    
    // Mock template reading
    mockFs.readFileSync.mockReturnValue('# Template');
    
    await coordinator.ensureHouseRulesSetup();
    
    // Verify prompts
    expect(mockRl.question).toHaveBeenCalledWith(
      expect.stringContaining('Use structured organization?'),
      expect.any(Function)
    );
    
    // Verify file creation
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('houserules.md'),
      expect.any(String)
    );
  });

  it('should check for updates once per day', async () => {
    // Setup state: Last check was > 24h ago
    coordinator.loadGlobalSettings = jest.fn().mockReturnValue({ 
      lastUpdateCheck: Date.now() - 86400001 // > 24h
    });
    coordinator.currentVersion = '1.0.0';
    
    // Mock npm view output
    mockExecSync.mockReturnValue('1.1.0');
    
    // Mock user input: Update now? (n)
    mockRl.question.mockImplementation((q, cb) => cb('n'));
    
    await coordinator.checkForUpdates();
    
    // Verify check command
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('npm view s9n-devops-agent version'),
      expect.any(Object)
    );
    
    // Verify prompt was shown (since update available)
    expect(mockRl.question).toHaveBeenCalledWith(
      expect.stringContaining('Would you like to update now?'),
      expect.any(Function)
    );
  });
});
