#!/usr/bin/env node

/**
 * ============================================================================
 * SMART ASSISTANT - Conversational UX for DevOps Agent
 * ============================================================================
 * 
 * This module provides a conversational interface (Chat UX) for the DevOps Agent.
 * It uses Groq LLM to understand user intent and execute agent commands.
 * 
 * CAPABILITIES:
 * - Answer questions about House Rules and Contracts
 * - Help start sessions with proper naming and context
 * - Analyze current project status
 * - Guide users through the development workflow
 * 
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Groq from 'groq-sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { credentialsManager } from './credentials-manager.js';
import HouseRulesManager from './house-rules-manager.js';
// We'll import SessionCoordinator dynamically to avoid circular deps if any

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize credentials
credentialsManager.injectEnv();

const CONFIG = {
  model: 'llama-3.1-70b-versatile',
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
  }
};

class SmartAssistant {
  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
    });
    
    this.history = [];
    this.repoRoot = process.cwd();
    this.houseRulesManager = new HouseRulesManager(this.repoRoot);
    
    // Tools definition for the LLM
    this.tools = [
      {
        type: "function",
        function: {
          name: "get_house_rules_summary",
          description: "Get a summary of the current project's House Rules and folder structure",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "list_contracts",
          description: "List all available contract files and their completion status",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "start_session",
          description: "Start a new development session with a specific task name",
          parameters: {
            type: "object",
            properties: {
              taskName: { type: "string", description: "The name of the task (kebab-case preferred)" },
              description: { type: "string", description: "Brief description of the task" }
            },
            required: ["taskName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_session_status",
          description: "Check the status of active sessions and locks",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    this.systemPrompt = `You are Kora, the Smart DevOps Assistant. 
Your goal is to help developers follow the House Rules and Contract System while being helpful and efficient.

CONTEXT:
- You are running inside a "DevOps Agent" environment.
- The project follows a strict "Contract System" (API, DB, Features, etc.).
- Users need to create "Sessions" to do work.
- You can execute tools to help the user.

STYLE:
- Be concise but helpful.
- Identify yourself as "Kora".
- If the user asks about starting a task, ask for a clear task name if not provided.
- If the user asks about rules, summarize them from the actual files.
- Always prefer "Structured" organization for new code.

When you want to perform an action, use the available tools.`;
  }

  /**
   * Initialize the chat session
   */
  async start() {
    console.log('\n' + '='.repeat(60));
    console.log(`${CONFIG.colors.magenta}🤖 Kora - Smart DevOps Assistant${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}Powered by Groq (${CONFIG.model})${CONFIG.colors.reset}`);
    console.log('='.repeat(60));
    console.log(`\n${CONFIG.colors.cyan}Hi! I'm Kora. How can I help you today?${CONFIG.colors.reset}`);
    console.log(`${CONFIG.colors.dim}(Try: "Start a new task for login", "Explain house rules", "Check contracts")${CONFIG.colors.reset}\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${CONFIG.colors.green}You > ${CONFIG.colors.reset}`
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const input = line.trim();
      if (!input) {
        rl.prompt();
        return;
      }

      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log(`${CONFIG.colors.magenta}Goodbye!${CONFIG.colors.reset}`);
        process.exit(0);
      }

      await this.handleUserMessage(input);
      rl.prompt();
    });
  }

  /**
   * Handle a user message through the LLM
   */
  async handleUserMessage(content) {
    // Add user message to history
    this.history.push({ role: 'user', content });

    try {
      process.stdout.write(`${CONFIG.colors.dim}Thinking...${CONFIG.colors.reset}`);
      
      const response = await this.groq.chat.completions.create({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.history
        ],
        tools: this.tools,
        tool_choice: "auto",
        temperature: 0.5,
        max_tokens: 1024
      });

      const message = response.choices[0].message;
      
      // Clear "Thinking..."
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);

      if (message.tool_calls) {
        // Handle tool calls
        await this.handleToolCalls(message.tool_calls);
      } else {
        // Just a text response
        console.log(`${CONFIG.colors.magenta}Kora > ${CONFIG.colors.reset}${message.content}\n`);
        this.history.push(message);
      }
    } catch (error) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      console.error(`${CONFIG.colors.red}Error: ${error.message}${CONFIG.colors.reset}\n`);
    }
  }

  /**
   * Execute tool calls from the LLM
   */
  async handleToolCalls(toolCalls) {
    // Add the assistant's message with tool calls to history
    this.history.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls
    });

    for (const toolCall of toolCalls) {
      const functionName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      
      console.log(`${CONFIG.colors.dim}Executing: ${functionName}...${CONFIG.colors.reset}`);
      
      let result;
      try {
        switch (functionName) {
          case 'get_house_rules_summary':
            result = await this.getHouseRulesSummary();
            break;
          case 'list_contracts':
            result = await this.listContracts();
            break;
          case 'check_session_status':
            result = await this.checkSessionStatus();
            break;
          case 'start_session':
            result = await this.startSession(args);
            break;
          default:
            result = JSON.stringify({ error: "Unknown tool" });
        }
      } catch (err) {
        result = JSON.stringify({ error: err.message });
      }

      // Add tool result to history
      this.history.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: result
      });
    }

    // Get final response from LLM after tool execution
    try {
      const response = await this.groq.chat.completions.create({
        model: CONFIG.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...this.history
        ]
      });

      const finalMessage = response.choices[0].message;
      console.log(`${CONFIG.colors.magenta}Kora > ${CONFIG.colors.reset}${finalMessage.content}\n`);
      this.history.push(finalMessage);

    } catch (error) {
      console.error(`${CONFIG.colors.red}Error getting final response: ${error.message}${CONFIG.colors.reset}`);
    }
  }

  // ==========================================================================
  // TOOL IMPLEMENTATIONS
  // ==========================================================================

  async getHouseRulesSummary() {
    const status = this.houseRulesManager.getStatus();
    const rulesPath = this.houseRulesManager.houseRulesPath;
    
    if (fs.existsSync(rulesPath)) {
      const content = fs.readFileSync(rulesPath, 'utf8');
      // Extract first 50 lines or so for context
      const summary = content.split('\n').slice(0, 50).join('\n');
      return JSON.stringify({
        exists: true,
        status: status,
        preview: summary,
        path: rulesPath
      });
    }
    return JSON.stringify({ exists: false, message: "House Rules file not found." });
  }

  async listContracts() {
    const contractsDir = path.join(this.repoRoot, 'House_Rules_Contracts');
    if (!fs.existsSync(contractsDir)) {
      return JSON.stringify({ exists: false, message: "Contracts folder not found." });
    }

    const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    return JSON.stringify({
      exists: true,
      files: files,
      location: contractsDir
    });
  }

  async checkSessionStatus() {
    // We need to import SessionCoordinator here to avoid top-level await/circular deps issues
    // Note: In a real implementation we might want to refactor SessionCoordinator to be more modular
    // For now, we'll check the file system directly which is safer/faster for this tool
    
    const sessionsDir = path.join(this.repoRoot, 'local_deploy/sessions');
    const locksDir = path.join(this.repoRoot, 'local_deploy/session-locks');
    
    let activeSessions = [];
    let activeLocks = [];

    if (fs.existsSync(sessionsDir)) {
      activeSessions = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    }

    if (fs.existsSync(locksDir)) {
      activeLocks = fs.readdirSync(locksDir);
    }

    return JSON.stringify({
      activeSessionsCount: activeSessions.length,
      activeLocksCount: activeLocks.length,
      sessions: activeSessions,
      locks: activeLocks
    });
  }

  async startSession(args) {
    return JSON.stringify({
      success: true,
      message: `I cannot start the session process directly from this chat yet (interactive limitation), but you can run: 'npm start' and enter task name: '${args.taskName}'`,
      command_to_run: `npm start`
    });
  }
}

export { SmartAssistant };

// Run the assistant only if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assistant = new SmartAssistant();
  assistant.start().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}
