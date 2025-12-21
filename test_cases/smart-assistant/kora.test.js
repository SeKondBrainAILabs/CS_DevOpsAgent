import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';

// Define mocks
const mockGroqCreate = jest.fn();

// Use unstable_mockModule for ESM mocking
await jest.unstable_mockModule('groq-sdk', () => {
  return {
    default: class MockGroq {
      constructor() {
        this.chat = {
          completions: {
            create: mockGroqCreate
          }
        };
      }
    }
  };
});

await jest.unstable_mockModule('readline', () => ({
  default: {
    createInterface: jest.fn().mockReturnValue({
      on: jest.fn(),
      prompt: jest.fn(),
      close: jest.fn(),
      cursorTo: jest.fn(),
      clearLine: jest.fn()
    }),
    cursorTo: jest.fn(),
    clearLine: jest.fn()
  }
}));

await jest.unstable_mockModule('../../src/credentials-manager.js', () => ({
  credentialsManager: {
    injectEnv: jest.fn()
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
  }
}));

// Dynamic import after mocking
const { SmartAssistant } = await import('../../src/agent-chat.js');

describe('Kora (Smart Assistant)', () => {
  let assistant;
  let consoleSpy;

  beforeEach(() => {
    // Clear mocks
    mockGroqCreate.mockReset();
    jest.clearAllMocks();
    
    // Silence console output
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    // Mock fs
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('# Mock House Rules');
    jest.spyOn(fs, 'readdirSync').mockReturnValue(['API_CONTRACT.md']);

    assistant = new SmartAssistant();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with correct system prompt', () => {
    expect(assistant.systemPrompt).toContain('You are Kora');
    expect(assistant.systemPrompt).toContain('DevOps Assistant');
  });

  it('should handle user message and call Groq', async () => {
    // Mock Groq response
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Hello! I am Kora.',
          tool_calls: null
        }
      }]
    });

    await assistant.handleUserMessage('Hello');

    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(mockGroqCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'llama-3.1-70b-versatile',
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'Hello' })
      ])
    }));
    
    expect(assistant.history).toHaveLength(2); // User + Assistant
    expect(assistant.history[1].content).toBe('Hello! I am Kora.');
  });

  it('should execute tools when requested', async () => {
    // 1. LLM decides to call a tool
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call_123',
            function: {
              name: 'get_house_rules_summary',
              arguments: '{}'
            }
          }]
        }
      }]
    });

    // 2. LLM response after tool execution
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Here are the house rules.',
          tool_calls: null
        }
      }]
    });

    await assistant.handleUserMessage('Show me house rules');

    // Check tool execution
    expect(assistant.history).toHaveLength(4); // User + ToolCall + ToolResult + FinalResponse
    
    // Verify tool result in history
    const toolResult = assistant.history[2];
    expect(toolResult.role).toBe('tool');
    expect(toolResult.name).toBe('get_house_rules_summary');
    expect(toolResult.content).toContain('Mock House Rules');
    
    // Verify both LLM calls
    expect(mockGroqCreate).toHaveBeenCalledTimes(2);
  });

  it('should handle tool errors gracefully', async () => {
    // Mock tool call failure
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'call_error',
            function: {
              name: 'unknown_tool',
              arguments: '{}'
            }
          }]
        }
      }]
    });

    // Final response mock
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'I encountered an error.',
          tool_calls: null
        }
      }]
    });

    await assistant.handleUserMessage('Run bad tool');

    const toolResult = assistant.history[2];
    expect(toolResult.content).toContain('Unknown tool');
  });
  
  it('should implement list_contracts tool correctly', async () => {
    const result = await assistant.listContracts();
    expect(result).toContain('API_CONTRACT.md');
    expect(result).toContain('exists":true');
  });

  it('should implement start_session tool correctly', async () => {
    const result = await assistant.startSession({ taskName: 'new-task' });
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.command_to_run).toBe('npm start');
  });
});
