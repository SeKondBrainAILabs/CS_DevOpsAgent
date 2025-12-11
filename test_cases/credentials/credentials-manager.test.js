import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';

// We need to use a slightly different approach to mock ESM modules with Jest
// For now, we'll integration test with a temporary file path if possible, 
// or mock fs methods. 
// Since credentials-manager.js uses a hardcoded path relative to __dirname,
// it's hard to swap the path without dependency injection.
// Ideally, we'd refactor CredentialsManager to accept a path in constructor.

// Let's modify CredentialsManager slightly to be more testable first? 
// No, let's try to mock fs.readFileSync and fs.writeFileSync.

// We will use jest.unstable_mockModule if available or just spyOn fs methods
// since we are importing 'fs' in the module.

// However, standard Jest with ESM can be tricky.
// Let's try a simpler approach: 
// 1. Rename the real credentials file if it exists.
// 2. Run tests.
// 3. Restore the file.
// But that's risky if tests crash.

// Better approach:
// We'll trust the CredentialsManager to read/write to the correct path,
// but we will spy on fs.writeFileSync and fs.readFileSync to verify behavior
// and prevent actual disk writes to the production file.

import { credentialsManager, CredentialsManager } from '../../src/credentials-manager.js';

const mockCredentials = {
  groqApiKey: Buffer.from('test-api-key').toString('base64'),
  updatedAt: '2025-01-01T00:00:00.000Z'
};

describe('CredentialsManager', () => {
  let writeSpy;
  let readSpy;
  let existsSpy;
  let mkdirSpy;
  let unlinkSpy;

  beforeEach(() => {
    // Clear the singleton's credentials for each test
    credentialsManager.credentials = {};
    
    // Reset env var
    delete process.env.OPENAI_API_KEY;

    // Spy on FS methods
    writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockCredentials));
    existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should load credentials on initialization', () => {
    // Create a new instance to trigger load()
    const manager = new CredentialsManager();
    expect(readSpy).toHaveBeenCalled();
    expect(manager.getGroqApiKey()).toBe('test-api-key');
  });

  test('should return null if no API key is set', () => {
    readSpy.mockReturnValue('{}');
    const manager = new CredentialsManager();
    expect(manager.getGroqApiKey()).toBeNull();
  });

  test('should save obfuscated API key', () => {
    const manager = new CredentialsManager();
    // Reset mocks to ignore the initial load
    writeSpy.mockClear();
    
    manager.setGroqApiKey('new-secret-key');
    
    expect(writeSpy).toHaveBeenCalled();
    const args = writeSpy.mock.calls[0];
    const savedData = JSON.parse(args[1]);
    
    // Check if saved data has obfuscated key
    expect(savedData.groqApiKey).not.toBe('new-secret-key');
    expect(Buffer.from(savedData.groqApiKey, 'base64').toString('utf8')).toBe('new-secret-key');
  });

  test('should inject API key into environment', () => {
    const manager = new CredentialsManager();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
    
    const result = manager.injectEnv();
    
    expect(result).toBe(true);
    expect(process.env.OPENAI_API_KEY).toBe('test-api-key');
  });

  test('should not overwrite existing environment variable', () => {
    process.env.OPENAI_API_KEY = 'existing-key';
    const manager = new CredentialsManager();
    
    const result = manager.injectEnv();
    
    expect(result).toBe(true);
    expect(process.env.OPENAI_API_KEY).toBe('existing-key');
  });

  test('should clear all credentials', () => {
    const manager = new CredentialsManager();
    manager.clearAll();
    
    expect(unlinkSpy).toHaveBeenCalled();
    expect(manager.hasGroqApiKey()).toBe(false);
  });
});
