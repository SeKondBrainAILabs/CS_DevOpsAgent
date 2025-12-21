
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';

// Define mocks
const mockGroqCreate = jest.fn();

// Mock dependencies
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

describe('Guardrails and Persona', () => {
  let assistant;
  let consoleSpy;

  beforeEach(() => {
    mockGroqCreate.mockReset();
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    
    // Mock fs for housekeeping
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('# Mock House Rules');
    jest.spyOn(fs, 'readdirSync').mockReturnValue([]);

    assistant = new SmartAssistant();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should enforce Kora persona in system prompt', () => {
    const prompt = assistant.systemPrompt;
    
    // Identity verification
    expect(prompt).toContain('You are Kora');
    expect(prompt).toContain('Smart DevOps Assistant');
    
    // Context verification
    expect(prompt).toContain('DevOps Agent');
    expect(prompt).toContain('Contract System');
    expect(prompt).toContain('Sessions');
    
    // Style verification
    expect(prompt).toContain('Be concise');
    expect(prompt).toContain('Structured');
  });

  it('should restrict tools to safe operations only', () => {
    const toolNames = assistant.tools.map(t => t.function.name);
    
    // Whitelist of allowed tools
    const allowedTools = [
      'get_house_rules_summary',
      'list_contracts',
      'start_session',
      'check_session_status'
    ];
    
    // Verify all tools are in the whitelist
    toolNames.forEach(name => {
      expect(allowedTools).toContain(name);
    });
    
    // Explicitly check dangerous tools are missing
    expect(toolNames).not.toContain('run_shell_command');
    expect(toolNames).not.toContain('exec');
    expect(toolNames).not.toContain('delete_file');
  });

  it('should pass conversation history to LLM to maintain context', async () => {
    // Setup a mock response
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'I am Kora.', tool_calls: null } }]
    });

    // Send first message
    await assistant.handleUserMessage('Who are you?');
    
    // Send second message
    mockGroqCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'I help with DevOps.', tool_calls: null } }]
    });
    await assistant.handleUserMessage('What do you do?');

    // Verify the second call includes previous history
    const secondCallArgs = mockGroqCreate.mock.calls[1][0];
    const messages = secondCallArgs.messages;
    
    // Expected: System, User1, Assistant1, User2
    // However, depending on how agent-chat pushes history, we need to inspect carefully.
    // The history array in assistant.history accumulates messages.
    // The messages sent to Groq are: [system, ...history]
    
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('system');
    
    // User1
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Who are you?');
    
    // Assistant1 - this is what failed. 
    // In agent-chat.js:
    // console.log(...)
    // this.history.push(message); 
    // The mock response message is what gets pushed.
    
    expect(messages[2].role).toBe('assistant');
    expect(messages[2].content).toBe('I am Kora.');
    
    // User2
    expect(messages[3].role).toBe('user');
    expect(messages[3].content).toBe('What do you do?');
  });

  it('should handle attempts to run arbitrary commands by guiding user to start_session', async () => {
    // Simulate user asking to run a command
    // We expect the LLM (mocked here) to respond by calling start_session tool or explaining
    // Since we mock the LLM, we can't test its "decision" logic without a real model,
    // but we can test that IF it calls the tool, it works as expected.
    
    // Let's verify the tools definition provided to the LLM explicitly describes intent
    const startSessionTool = assistant.tools.find(t => t.function.name === 'start_session');
    expect(startSessionTool.function.description).toContain('Start a new development session');
    expect(startSessionTool.function.parameters.required).toContain('taskName');
  });
});
