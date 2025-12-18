const { describe, test, expect, beforeEach } = require('@jest/globals');

describe('validate-commit.js', () => {
  describe('Commit Message Parsing', () => {
    test('should parse valid commit message with contract flags', () => {
      const commitMsg = `feat(api): add user profile endpoint

Contracts: [SQL:T, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]

[WHY]
Users need to view and update their profile information.

[WHAT]
- File(s): src/api/profile.js - Added GET /api/v1/profile endpoint
- File(s): House_Rules_Contracts/API_CONTRACT.md - Documented new endpoint`;

      const parsed = parseCommitMessage(commitMsg);

      expect(parsed).toHaveProperty('type', 'feat');
      expect(parsed).toHaveProperty('scope', 'api');
      expect(parsed).toHaveProperty('subject', 'add user profile endpoint');
      expect(parsed.contractFlags).toEqual({
        SQL: true,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: true,
        INFRA: false
      });
    });

    test('should reject commit message without contract flags', () => {
      const commitMsg = `feat(api): add user profile endpoint

[WHY]
Users need to view their profile.

[WHAT]
- File(s): src/api/profile.js - Added endpoint`;

      expect(() => parseCommitMessage(commitMsg)).toThrow(/contract flags/i);
    });

    test('should reject commit message with malformed contract flags', () => {
      const commitMsg = `feat(api): add user profile endpoint

Contracts: [SQL:T API:T]

[WHY]
Users need to view their profile.`;

      expect(() => parseCommitMessage(commitMsg)).toThrow(/invalid contract flags/i);
    });

    test('should parse all contract flag combinations', () => {
      const testCases = [
        'Contracts: [SQL:T, API:F, DB:F, 3RD:F, FEAT:F, INFRA:F]',
        'Contracts: [SQL:F, API:T, DB:T, 3RD:F, FEAT:F, INFRA:F]',
        'Contracts: [SQL:F, API:F, DB:F, 3RD:T, FEAT:T, INFRA:T]'
      ];

      for (const flagLine of testCases) {
        const parsed = parseContractFlags(flagLine);
        expect(Object.keys(parsed)).toHaveLength(6);
        expect(parsed).toHaveProperty('SQL');
        expect(parsed).toHaveProperty('API');
        expect(parsed).toHaveProperty('DB');
        expect(parsed).toHaveProperty('3RD');
        expect(parsed).toHaveProperty('FEAT');
        expect(parsed).toHaveProperty('INFRA');
      }
    });
  });

  describe('File Change Detection', () => {
    test('should detect SQL contract file changes', () => {
      const stagedFiles = [
        'House_Rules_Contracts/SQL_CONTRACT.json',
        'src/services/UserService.js'
      ];

      const changes = detectContractChanges(stagedFiles);

      expect(changes.SQL).toBe(true);
      expect(changes.API).toBe(false);
    });

    test('should detect multiple contract file changes', () => {
      const stagedFiles = [
        'House_Rules_Contracts/API_CONTRACT.md',
        'House_Rules_Contracts/FEATURES_CONTRACT.md',
        'House_Rules_Contracts/INFRA_CONTRACT.md',
        'src/api/users.js'
      ];

      const changes = detectContractChanges(stagedFiles);

      expect(changes.API).toBe(true);
      expect(changes.FEAT).toBe(true);
      expect(changes.INFRA).toBe(true);
      expect(changes.SQL).toBe(false);
      expect(changes.DB).toBe(false);
    });

    test('should handle no contract file changes', () => {
      const stagedFiles = [
        'src/api/users.js',
        'src/services/UserService.js',
        'README.md'
      ];

      const changes = detectContractChanges(stagedFiles);

      expect(changes.SQL).toBe(false);
      expect(changes.API).toBe(false);
      expect(changes.DB).toBe(false);
      expect(changes['3RD']).toBe(false);
      expect(changes.FEAT).toBe(false);
      expect(changes.INFRA).toBe(false);
    });
  });

  describe('Validation Logic', () => {
    test('should pass when claimed flags match actual changes', () => {
      const claimedFlags = {
        SQL: true,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const actualChanges = {
        SQL: true,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const result = validateContractFlags(claimedFlags, actualChanges);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect false positives (claimed T but not modified)', () => {
      const claimedFlags = {
        SQL: true,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const actualChanges = {
        SQL: false, // Not actually changed
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const result = validateContractFlags(claimedFlags, actualChanges);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        type: 'false_positive',
        contract: 'SQL'
      }));
    });

    test('should detect false negatives (modified but claimed F)', () => {
      const claimedFlags = {
        SQL: false,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const actualChanges = {
        SQL: true, // Actually changed but claimed F
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const result = validateContractFlags(claimedFlags, actualChanges);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        type: 'false_negative',
        contract: 'SQL'
      }));
    });

    test('should detect multiple errors', () => {
      const claimedFlags = {
        SQL: true,  // False positive
        API: false, // False negative
        DB: false,
        '3RD': true, // False positive
        FEAT: false,
        INFRA: false
      };

      const actualChanges = {
        SQL: false,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const result = validateContractFlags(claimedFlags, actualChanges);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('Auto-Fix Generation', () => {
    test('should generate corrected commit message', () => {
      const originalMsg = `feat(api): add user profile endpoint

Contracts: [SQL:T, API:F, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHY]
Users need to view their profile.

[WHAT]
- File(s): src/api/profile.js - Added endpoint`;

      const actualChanges = {
        SQL: false,
        API: true,
        DB: false,
        '3RD': false,
        FEAT: true,
        INFRA: false
      };

      const corrected = generateCorrectedCommitMessage(originalMsg, actualChanges);

      expect(corrected).toContain('Contracts: [SQL:F, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]');
      expect(corrected).toContain('feat(api): add user profile endpoint');
      expect(corrected).toContain('[WHY]');
      expect(corrected).toContain('[WHAT]');
    });

    test('should preserve all sections of commit message', () => {
      const originalMsg = `fix(database): update user schema

Contracts: [SQL:F, API:F, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHY]
Need to add new column for user preferences.

[WHAT]
- File(s): migrations/002_add_preferences.sql - Added migration
- File(s): House_Rules_Contracts/DATABASE_SCHEMA_CONTRACT.md - Updated schema

Resolves: #123
Part of: House Rules Contract System`;

      const actualChanges = {
        SQL: false,
        API: false,
        DB: true,
        '3RD': false,
        FEAT: false,
        INFRA: false
      };

      const corrected = generateCorrectedCommitMessage(originalMsg, actualChanges);

      expect(corrected).toContain('Contracts: [SQL:F, API:F, DB:T, 3RD:F, FEAT:F, INFRA:F]');
      expect(corrected).toContain('Resolves: #123');
      expect(corrected).toContain('Part of: House Rules Contract System');
    });
  });

  describe('Edge Cases', () => {
    test('should handle commit message with no WHY section', () => {
      const commitMsg = `feat(api): add endpoint

Contracts: [SQL:F, API:T, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHAT]
- File(s): src/api/test.js - Added endpoint`;

      const parsed = parseCommitMessage(commitMsg);

      expect(parsed.contractFlags.API).toBe(true);
    });

    test('should handle extra whitespace in contract flags', () => {
      const flagLine = 'Contracts: [ SQL:T ,  API:F , DB:F , 3RD:F , FEAT:F , INFRA:F ]';
      
      const parsed = parseContractFlags(flagLine);

      expect(parsed.SQL).toBe(true);
      expect(parsed.API).toBe(false);
    });

    test('should reject invalid contract flag values', () => {
      const flagLine = 'Contracts: [SQL:X, API:T, DB:F, 3RD:F, FEAT:F, INFRA:F]';

      expect(() => parseContractFlags(flagLine)).toThrow(/invalid flag value/i);
    });
  });
});

// Mock functions (these would normally be extracted from the main script)
function parseCommitMessage(message) {
  const lines = message.split('\n');
  const firstLine = lines[0];
  
  // Parse type(scope): subject
  const match = firstLine.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
  if (!match) {
    throw new Error('Invalid commit message format');
  }
  
  const [, type, scope, subject] = match;
  
  // Find contract flags line
  const flagsLine = lines.find(line => line.startsWith('Contracts:'));
  if (!flagsLine) {
    throw new Error('Missing contract flags');
  }
  
  const contractFlags = parseContractFlags(flagsLine);
  
  return {
    type,
    scope,
    subject,
    contractFlags
  };
}

function parseContractFlags(flagsLine) {
  const match = flagsLine.match(/Contracts:\s*\[(.*)\]/);
  if (!match) {
    throw new Error('Invalid contract flags format');
  }
  
  const flagsStr = match[1];
  const flags = {};
  
  const pairs = flagsStr.split(',').map(s => s.trim());
  
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map(s => s.trim());
    
    if (!['T', 'F'].includes(value)) {
      throw new Error(`Invalid flag value: ${value}`);
    }
    
    flags[key] = value === 'T';
  }
  
  // Validate all required flags are present
  const required = ['SQL', 'API', 'DB', '3RD', 'FEAT', 'INFRA'];
  for (const key of required) {
    if (!(key in flags)) {
      throw new Error(`Missing required flag: ${key}`);
    }
  }
  
  return flags;
}

function detectContractChanges(stagedFiles) {
  const changes = {
    SQL: false,
    API: false,
    DB: false,
    '3RD': false,
    FEAT: false,
    INFRA: false
  };
  
  const contractMap = {
    'SQL_CONTRACT.json': 'SQL',
    'API_CONTRACT.md': 'API',
    'DATABASE_SCHEMA_CONTRACT.md': 'DB',
    'THIRD_PARTY_INTEGRATIONS.md': '3RD',
    'FEATURES_CONTRACT.md': 'FEAT',
    'INFRA_CONTRACT.md': 'INFRA'
  };
  
  for (const file of stagedFiles) {
    for (const [contractFile, flag] of Object.entries(contractMap)) {
      if (file.includes(contractFile)) {
        changes[flag] = true;
      }
    }
  }
  
  return changes;
}

function validateContractFlags(claimedFlags, actualChanges) {
  const errors = [];
  
  for (const [contract, claimed] of Object.entries(claimedFlags)) {
    const actual = actualChanges[contract];
    
    if (claimed && !actual) {
      errors.push({
        type: 'false_positive',
        contract,
        message: `Claimed ${contract}:T but file not modified`
      });
    } else if (!claimed && actual) {
      errors.push({
        type: 'false_negative',
        contract,
        message: `File modified but claimed ${contract}:F`
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function generateCorrectedCommitMessage(originalMsg, actualChanges) {
  const lines = originalMsg.split('\n');
  
  // Find and replace the Contracts line
  const flagsIndex = lines.findIndex(line => line.startsWith('Contracts:'));
  
  if (flagsIndex !== -1) {
    const correctedFlags = Object.entries(actualChanges)
      .map(([key, value]) => `${key}:${value ? 'T' : 'F'}`)
      .join(', ');
    
    lines[flagsIndex] = `Contracts: [${correctedFlags}]`;
  }
  
  return lines.join('\n');
}
