/**
 * Integration Tests for MergeConflictService with REAL LLM
 * Tests AI-based conflict resolution using actual Groq API
 *
 * REQUIRES: GROQ_API_KEY environment variable to be set
 * Run with: GROQ_API_KEY=your_key npm test -- --config=jest.kanvas.config.cjs tests/kanvas/integration/MergeConflictService.realai.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MergeConflictService } from '../../../electron/services/MergeConflictService';
import { AIService } from '../../../electron/services/AIService';

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

// Conditional describe that skips if no API key
const describeWithAI = SKIP_REAL_AI_TESTS ? describe.skip : describe;

describeWithAI('MergeConflictService - Real AI Conflict Resolution', () => {
  let aiService: AIService;
  let conflictService: MergeConflictService;

  beforeAll(() => {
    if (SKIP_REAL_AI_TESTS) {
      console.log('Skipping real AI tests - GROQ_API_KEY not set');
      return;
    }

    // Create real AIService with mock ConfigService
    const mockConfig = createMockConfigService();
    aiService = new AIService(mockConfig as any);

    // Set model to kimi-k2 for long context code reasoning
    aiService.setModel('kimi-k2');

    // Create MergeConflictService with real AIService
    conflictService = new MergeConflictService(aiService as any);

    console.log('Using real Groq API with kimi-k2 model');
  });

  afterAll(() => {
    if (aiService) {
      aiService.dispose();
    }
  });

  // =========================================================================
  // Simple Import Conflict
  // =========================================================================

  it('should resolve simple import conflicts by merging both', async () => {
    console.log('\\n=== Testing Import Conflict Resolution ===');

    const conflictedContent = `import { useState } from 'react';
<<<<<<< HEAD
import { useEffect } from 'react';
import { Button } from './components/Button';
=======
import { useCallback } from 'react';
import { Input } from './components/Input';
>>>>>>> feature/add-input

export function MyComponent() {
  return <div>Hello</div>;
}
`;

    // Simulate calling the AI to resolve
    const result = await aiService.sendWithMode({
      modeId: 'merge_conflict_resolver',
      promptKey: 'resolve_conflict',
      variables: {
        file_path: 'src/components/MyComponent.tsx',
        language: 'typescript',
        current_branch: 'main',
        incoming_branch: 'feature/add-input',
        conflicted_content: conflictedContent,
      },
      userMessage: 'Resolve this conflict and output ONLY the final merged code. No explanations.',
    });

    if (!result.success) {
      console.log('\\n--- AI Error ---');
      console.log('Error:', result.error);
    }
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    console.log('\\n--- AI Resolution ---');
    console.log(result.data);

    // Verify no conflict markers remain
    expect(result.data).not.toContain('<<<<<<<');
    expect(result.data).not.toContain('=======');
    expect(result.data).not.toContain('>>>>>>>');

    // Should include imports from both sides
    expect(result.data).toContain('useEffect');
    expect(result.data).toContain('useCallback');
    expect(result.data).toContain('Button');
    expect(result.data).toContain('Input');

    console.log('\\n✅ Import conflict resolved successfully');
  }, 60000);

  // =========================================================================
  // Function Modification Conflict
  // =========================================================================

  it('should resolve function modification conflicts by merging functionality', async () => {
    console.log('\\n=== Testing Function Modification Conflict ===');

    const conflictedContent = `function processUser(user: User): ProcessedUser {
<<<<<<< HEAD
  // Added logging for debugging
  console.log('Processing user:', user.id);

  const processed = {
    ...user,
    fullName: \`\${user.firstName} \${user.lastName}\`,
  };

  return processed;
=======
  // Added validation
  if (!user.firstName || !user.lastName) {
    throw new Error('User must have first and last name');
  }

  const processed = {
    ...user,
    fullName: \`\${user.firstName} \${user.lastName}\`,
  };

  return processed;
>>>>>>> feature/add-validation
}
`;

    const result = await aiService.sendWithMode({
      modeId: 'merge_conflict_resolver',
      promptKey: 'resolve_conflict',
      variables: {
        file_path: 'src/utils/userProcessor.ts',
        language: 'typescript',
        current_branch: 'main',
        incoming_branch: 'feature/add-validation',
        conflicted_content: conflictedContent,
      },
      userMessage: 'Resolve this conflict and output ONLY the final merged code. No explanations.',
    });

    expect(result.success).toBe(true);

    console.log('\\n--- AI Resolution ---');
    console.log(result.data);

    // Should have no conflict markers
    expect(result.data).not.toContain('<<<<<<<');

    // Should include BOTH logging and validation
    expect(result.data).toContain('console.log');
    expect(result.data).toContain('throw new Error');

    console.log('\\n✅ Function modification conflict resolved');
  }, 60000);

  // =========================================================================
  // TypeScript Interface Conflict
  // =========================================================================

  it('should resolve TypeScript interface conflicts', async () => {
    console.log('\\n=== Testing TypeScript Interface Conflict ===');

    const conflictedContent = `export interface UserProfile {
  id: string;
  username: string;
<<<<<<< HEAD
  email: string;
  emailVerified: boolean;
=======
  phoneNumber: string;
  phoneVerified: boolean;
>>>>>>> feature/add-phone
  createdAt: Date;
}
`;

    const result = await aiService.sendWithMode({
      modeId: 'merge_conflict_resolver',
      promptKey: 'resolve_conflict',
      variables: {
        file_path: 'src/types/user.ts',
        language: 'typescript',
        current_branch: 'main',
        incoming_branch: 'feature/add-phone',
        conflicted_content: conflictedContent,
      },
      userMessage: 'Resolve this conflict and output ONLY the final merged code. No explanations.',
    });

    expect(result.success).toBe(true);

    console.log('\\n--- AI Resolution ---');
    console.log(result.data);

    // Should have no conflict markers
    expect(result.data).not.toContain('<<<<<<<');

    // Should include BOTH email and phone fields
    expect(result.data).toContain('email');
    expect(result.data).toContain('phoneNumber');

    console.log('\\n✅ Interface conflict resolved');
  }, 60000);

  // =========================================================================
  // Conflict Analysis
  // =========================================================================

  it('should analyze a conflict and provide recommendations', async () => {
    console.log('\\n=== Testing Conflict Analysis ===');

    const conflictedContent = `const MAX_CONNECTIONS =
<<<<<<< HEAD
100;
=======
250;
>>>>>>> feature/scale-up
`;

    const result = await aiService.sendWithMode({
      modeId: 'merge_conflict_resolver',
      promptKey: 'analyze_conflict',
      variables: {
        file_path: 'src/config/database.ts',
        conflicted_content: conflictedContent,
      },
      userMessage: 'Analyze this conflict and return ONLY valid JSON.',
    });

    expect(result.success).toBe(true);

    console.log('\\n--- AI Analysis ---');
    console.log(result.data);

    // Try to parse the JSON
    const jsonMatch = result.data?.match(/\{[\s\S]*\}/);
    expect(jsonMatch).toBeTruthy();

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      console.log('\\nParsed analysis:', analysis);

      expect(analysis).toHaveProperty('currentBranchIntent');
      expect(analysis).toHaveProperty('incomingBranchIntent');
      expect(analysis).toHaveProperty('conflictType');
      expect(analysis).toHaveProperty('recommendedStrategy');
    }

    console.log('\\n✅ Conflict analysis complete');
  }, 60000);

  // =========================================================================
  // JSON File Conflict
  // =========================================================================

  it('should resolve JSON file conflicts', async () => {
    console.log('\\n=== Testing JSON File Conflict ===');

    const conflictedContent = `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
<<<<<<< HEAD
    "react": "^18.2.0",
    "axios": "^1.5.0"
=======
    "react": "^18.2.0",
    "lodash": "^4.17.21"
>>>>>>> feature/add-lodash
  }
}
`;

    const result = await aiService.sendWithMode({
      modeId: 'merge_conflict_resolver',
      promptKey: 'resolve_conflict',
      variables: {
        file_path: 'package.json',
        language: 'json',
        current_branch: 'main',
        incoming_branch: 'feature/add-lodash',
        conflicted_content: conflictedContent,
      },
      userMessage: 'Resolve this conflict and output ONLY the final merged JSON. No explanations.',
    });

    expect(result.success).toBe(true);

    console.log('\\n--- AI Resolution ---');
    console.log(result.data);

    // Should have no conflict markers
    expect(result.data).not.toContain('<<<<<<<');

    // Should include both dependencies
    expect(result.data).toContain('axios');
    expect(result.data).toContain('lodash');

    // Should be valid JSON
    let cleanJson = result.data || '';
    const jsonBlockMatch = cleanJson.match(/```(?:json)?\n([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleanJson = jsonBlockMatch[1];
    }

    expect(() => JSON.parse(cleanJson.trim())).not.toThrow();

    console.log('\\n✅ JSON conflict resolved');
  }, 60000);
});

// Always run this test to show status
describe('Real AI Conflict Resolution Test Status', () => {
  it('should report API key status', () => {
    if (SKIP_REAL_AI_TESTS) {
      console.log('\\n⚠️  GROQ_API_KEY not set - real AI tests skipped');
      console.log('To run real AI tests:');
      console.log('  GROQ_API_KEY=your_key npm test -- --config=jest.kanvas.config.cjs tests/kanvas/integration/MergeConflictService.realai.test.ts');
    } else {
      console.log('\\n✅ GROQ_API_KEY is set - running real AI tests');
    }
    expect(true).toBe(true);
  });
});
