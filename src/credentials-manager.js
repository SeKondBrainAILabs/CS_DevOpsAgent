import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.join(__dirname, '..');

const CREDENTIALS_PATH = path.join(rootDir, 'local_deploy', 'credentials.json');

// Simple obfuscation to prevent casual shoulder surfing
// NOTE: This is NOT strong encryption. In a production environment with sensitive keys,
// one should rely on system keychains or proper secret management services.
// Since this is a local dev tool, this prevents accidental plain text commits/reads.
const obfuscate = (text) => Buffer.from(text).toString('base64');
const deobfuscate = (text) => Buffer.from(text, 'base64').toString('utf8');

export class CredentialsManager {
  constructor() {
    this.credentials = {};
    this.load();
  }

  load() {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      try {
        const rawData = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
        const data = JSON.parse(rawData);
        
        // Deobfuscate sensitive values
        if (data.groqApiKey) {
          data.groqApiKey = deobfuscate(data.groqApiKey);
        }
        
        this.credentials = data;
      } catch (error) {
        console.error('Failed to load credentials:', error.message);
        this.credentials = {};
      }
    }
  }

  save() {
    try {
      // Ensure local_deploy exists
      const localDeployDir = path.dirname(CREDENTIALS_PATH);
      if (!fs.existsSync(localDeployDir)) {
        fs.mkdirSync(localDeployDir, { recursive: true });
      }

      // Clone and obfuscate
      const dataToSave = { ...this.credentials };
      if (dataToSave.groqApiKey) {
        dataToSave.groqApiKey = obfuscate(dataToSave.groqApiKey);
      }

      fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
      console.error('Failed to save credentials:', error.message);
    }
  }

  setGroqApiKey(key) {
    if (!key) return;
    this.credentials.groqApiKey = key;
    this.credentials.updatedAt = new Date().toISOString();
    this.save();
  }

  getGroqApiKey() {
    return this.credentials.groqApiKey || null;
  }

  hasGroqApiKey() {
    return !!this.credentials.groqApiKey;
  }

  clearAll() {
    this.credentials = {};
    if (fs.existsSync(CREDENTIALS_PATH)) {
      fs.unlinkSync(CREDENTIALS_PATH);
    }
  }

  /**
   * Injects the Groq API Key into process.env.OPENAI_API_KEY
   * This ensures compatibility with existing scripts that rely on env vars
   * @returns {boolean} true if key was injected or already existed
   */
  injectEnv() {
    // If already set in environment, don't overwrite unless empty
    if (process.env.OPENAI_API_KEY) {
      return true;
    }

    const key = this.getGroqApiKey();
    if (key) {
      process.env.OPENAI_API_KEY = key;
      return true;
    }

    return false;
  }
}

// Singleton instance
export const credentialsManager = new CredentialsManager();
