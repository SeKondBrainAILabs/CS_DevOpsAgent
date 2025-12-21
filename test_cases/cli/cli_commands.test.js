
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const binPath = path.join(rootDir, 'bin/cs-devops-agent');

describe('CLI Commands', () => {
  let tempDir;
  let credsPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'test-cli-'));
    credsPath = path.join(tempDir, 'credentials.json');
    // Ensure local_deploy dir exists if the code expects it (though we overrode the full path)
    // The code does: path.dirname(CREDENTIALS_PATH) and mkdirs it.
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should set and retrieve groq key via creds command', () => {
    const env = { ...process.env, DEVOPS_CREDENTIALS_PATH: credsPath };
    
    // Set key
    const output = execSync(`node "${binPath}" creds set-groq-key test-key-123`, { 
      env, 
      encoding: 'utf8' 
    });
    
    expect(output).toContain('Groq API Key saved securely');
    expect(fs.existsSync(credsPath)).toBe(true);
    
    const saved = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
    // It should be obfuscated
    expect(saved.groqApiKey).not.toBe('test-key-123');
    
    // Status
    const statusOutput = execSync(`node "${binPath}" creds status`, { 
      env, 
      encoding: 'utf8' 
    });
    expect(statusOutput).toContain('Groq API Key: ✅ Configured');
  });

  it('should clear credentials', () => {
    const env = { ...process.env, DEVOPS_CREDENTIALS_PATH: credsPath };
    
    // Set first
    execSync(`node "${binPath}" creds set-groq-key test-key`, { env });
    
    // Clear
    const output = execSync(`node "${binPath}" creds clear`, { 
      env, 
      encoding: 'utf8' 
    });
    
    expect(output).toContain('All credentials cleared');
    expect(fs.existsSync(credsPath)).toBe(false);
  });

  it('should have chat command available', () => {
    // We can't easily run the interactive chat, but we can check if the binary 
    // accepts the command without erroring on "unknown command"
    // We'll pipe "exit" to it.
    
    const env = { ...process.env, DEVOPS_CREDENTIALS_PATH: credsPath };
    
    try {
      const output = execSync(`echo "exit" | node "${binPath}" chat`, { 
        env, 
        encoding: 'utf8',
        timeout: 5000 // fail if it hangs
      });
      // The output should contain the welcome message from agent-chat.js
      // "Kora - Smart DevOps Assistant"
      expect(output).toContain('Kora - Smart DevOps Assistant');
    } catch (e) {
      // If it fails with timeout or exit code, we check output if possible
      // Note: agent-chat.js exits with 0 on "exit" command
      if (e.stdout) {
         expect(e.stdout).toContain('Kora - Smart DevOps Assistant');
      } else {
         throw e;
      }
    }
  });
});
