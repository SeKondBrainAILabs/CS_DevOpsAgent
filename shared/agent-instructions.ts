/**
 * Agent Setup Instructions Templates
 * Generated instructions for each agent type
 */

import type { AgentType, AgentInstanceConfig } from './types';

export interface InstructionVars {
  repoPath: string;
  repoName: string;
  branchName: string;
  sessionId: string;
  taskDescription: string;
  systemPrompt: string;
  contextPreservation: string;
  rebaseFrequency: string;
}

/**
 * Get setup instructions for a specific agent type
 */
export function getAgentInstructions(
  agentType: AgentType,
  vars: InstructionVars
): string {
  const templates: Record<AgentType, (vars: InstructionVars) => string> = {
    claude: getClaudeInstructions,
    cursor: getCursorInstructions,
    copilot: getCopilotInstructions,
    cline: getClineInstructions,
    aider: getAiderInstructions,
    warp: getWarpInstructions,
    custom: getCustomInstructions,
  };

  return templates[agentType](vars);
}

/**
 * Generate the comprehensive prompt for Claude Code agent
 * Uses the exact format from the original DevOps Agent
 */
export function generateClaudePrompt(vars: InstructionVars): string {
  const shortSessionId = vars.sessionId.replace('sess_', '').slice(0, 8);
  const timestamp = new Date().toISOString();
  const task = vars.taskDescription || vars.branchName || 'development';

  return `I'm working in a DevOps-managed session with the following setup:
- Session ID: ${shortSessionId}
- Working Directory: ${vars.repoPath}
- Task: ${task}

Please switch to this directory before making any changes:
cd "${vars.repoPath}"

📋 IMPORTANT - READ PROJECT RULES FIRST:
Before making ANY changes, you MUST read the project's house rules at:
${vars.repoPath}/houserules.md

The house rules file contains:
- Project coding conventions and standards
- Required commit message formats
- File coordination protocols
- Branch naming and workflow rules
- Testing and review requirements

You must follow ALL rules in this file. Read it carefully before proceeding.

⚠️ FILE COORDINATION (MANDATORY):
Shared coordination directory: ${vars.repoPath}/.file-coordination/

BEFORE editing ANY files:
1. Check for conflicts: ls ${vars.repoPath}/.file-coordination/active-edits/
2. Create declaration: ${vars.repoPath}/.file-coordination/active-edits/<agent>-${shortSessionId}.json

Example declaration:
{
  "agent": "claude", "session": "${shortSessionId}",
  "files": ["src/app.js"], "operation": "edit",
  "reason": "${task}", "declaredAt": "${timestamp}",
  "estimatedDuration": 300
}

Write commit messages to: .devops-commit-${shortSessionId}.msg
(Use '>>' to append if you want to add to an existing message)
The DevOps agent will automatically commit and push changes.

⛔ IMPORTANT: STOP HERE AND WAIT
Do NOT start coding or making changes yet!
Follow the steps above in order when instructed by the user.
Wait for further instructions before proceeding.`;
}

function getClaudeInstructions(vars: InstructionVars): string {
  const shortSessionId = vars.sessionId.replace('sess_', '').slice(0, 8);
  const rebaseNote = vars.rebaseFrequency !== 'never'
    ? `- Rebase frequency: ${vars.rebaseFrequency}`
    : '';

  // Get the comprehensive prompt
  const agentPrompt = generateClaudePrompt(vars);

  return `## Setup Claude Code for ${vars.repoName}

### Quick Start

1. **Open a terminal** and navigate to your repository:
\`\`\`bash
cd "${vars.repoPath}"
\`\`\`

2. **Checkout the working branch**:
\`\`\`bash
git checkout ${vars.branchName}
\`\`\`

3. **Start Claude Code**:
\`\`\`bash
claude
\`\`\`

### Alternative: One-liner
\`\`\`bash
cd "${vars.repoPath}" && git checkout ${vars.branchName} && claude
\`\`\`

---

### Prompt for Claude Code

Copy and paste this when starting your session:

\`\`\`
${agentPrompt}
\`\`\`

${vars.contextPreservation ? `---

### Context Preservation (houserules.md)

If this repository doesn't have a \`houserules.md\` file, create one with your project rules:

\`\`\`bash
cat > "${vars.repoPath}/houserules.md" << 'EOF'
${vars.contextPreservation}
EOF
\`\`\`

You can also create a \`temp_todo.md\` file to track session progress for context recovery.
` : ''}
---

### Git Workflow
- **Working branch**: \`${vars.branchName}\`
- **Base branch**: The branch this was created from
${rebaseNote ? `- **Rebase**: ${vars.rebaseFrequency}` : ''}

Your activity will appear in Kanvas once Claude starts working.
`;
}

function getCursorInstructions(vars: InstructionVars): string {
  return `## Setup Cursor for ${vars.repoName}

### Quick Start

1. **Open Cursor IDE**

2. **Open the repository folder**:
   - File → Open Folder
   - Select: \`${vars.repoPath}\`

3. **Configure Kanvas reporting** (optional):
   - Open Settings (Cmd/Ctrl + ,)
   - Search for "Kanvas"
   - Set Session ID: \`${vars.sessionId}\`

### Workspace Settings
Add to \`.vscode/settings.json\`:
\`\`\`json
{
  "kanvas.sessionId": "${vars.sessionId}",
  "kanvas.enabled": true
}
\`\`\`

### Task
${vars.taskDescription}

### Branch
Make sure you're on: \`${vars.branchName}\`

\`\`\`bash
cd "${vars.repoPath}"
git checkout ${vars.branchName}
\`\`\`

---

Cursor activity will appear in Kanvas when the extension is configured.
`;
}

function getCopilotInstructions(vars: InstructionVars): string {
  return `## Setup GitHub Copilot for ${vars.repoName}

### Prerequisites
- VS Code with GitHub Copilot extension installed
- Active GitHub Copilot subscription

### Quick Start

1. **Open VS Code**

2. **Open the repository**:
\`\`\`bash
code "${vars.repoPath}"
\`\`\`

3. **Checkout the branch**:
\`\`\`bash
cd "${vars.repoPath}"
git checkout ${vars.branchName}
\`\`\`

4. **Install Kanvas Reporter extension** (optional):
   - Open Extensions (Cmd/Ctrl + Shift + X)
   - Search for "Kanvas Reporter"
   - Install and configure with Session ID: \`${vars.sessionId}\`

### Task
${vars.taskDescription}

### Manual Activity Reporting
If not using the extension, you can report activity manually by creating files in:
\`${vars.repoPath}/.kanvas/activity/\`

---

Start coding with Copilot and your activity will be tracked.
`;
}

function getClineInstructions(vars: InstructionVars): string {
  return `## Setup Cline for ${vars.repoName}

### Prerequisites
- VS Code with Cline extension installed
- API key configured (Anthropic, OpenAI, etc.)

### Quick Start

1. **Open VS Code**:
\`\`\`bash
code "${vars.repoPath}"
\`\`\`

2. **Open Cline panel** (Cmd/Ctrl + Shift + P → "Cline: Open")

3. **Configure Kanvas integration**:
   - Open Cline Settings
   - Add custom environment:
\`\`\`json
{
  "KANVAS_SESSION_ID": "${vars.sessionId}",
  "KANVAS_REPO_PATH": "${vars.repoPath}"
}
\`\`\`

### Task
Paste this into Cline:
\`\`\`
${vars.taskDescription}

Working in branch: ${vars.branchName}
\`\`\`

### Branch Setup
\`\`\`bash
cd "${vars.repoPath}"
git checkout ${vars.branchName}
\`\`\`

---

Cline will autonomously work on the task. Activity appears in Kanvas.
`;
}

function getAiderInstructions(vars: InstructionVars): string {
  return `## Setup Aider for ${vars.repoName}

### Prerequisites
- Aider installed (\`pip install aider-chat\`)
- API key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)

### Quick Start

1. **Navigate to repository**:
\`\`\`bash
cd "${vars.repoPath}"
\`\`\`

2. **Checkout the branch**:
\`\`\`bash
git checkout ${vars.branchName}
\`\`\`

3. **Start Aider with Kanvas reporting**:
\`\`\`bash
KANVAS_SESSION_ID="${vars.sessionId}" aider
\`\`\`

### Alternative: Using Aider flags
\`\`\`bash
aider --env KANVAS_SESSION_ID="${vars.sessionId}"
\`\`\`

### Task
Once Aider starts, describe your task:
\`\`\`
${vars.taskDescription}
\`\`\`

### Useful Aider Commands
- \`/add <file>\` - Add files to context
- \`/drop <file>\` - Remove files from context
- \`/commit\` - Commit changes
- \`/diff\` - Show pending changes

---

Aider commits will appear in Kanvas automatically.
`;
}

function getWarpInstructions(vars: InstructionVars): string {
  return `## Setup Warp AI for ${vars.repoName}

### Prerequisites
- Warp terminal installed
- Warp AI enabled in settings

### Quick Start

1. **Open Warp**

2. **Navigate to repository**:
\`\`\`bash
cd "${vars.repoPath}"
\`\`\`

3. **Set Kanvas environment**:
\`\`\`bash
export KANVAS_SESSION_ID="${vars.sessionId}"
export KANVAS_REPO_PATH="${vars.repoPath}"
\`\`\`

4. **Checkout the branch**:
\`\`\`bash
git checkout ${vars.branchName}
\`\`\`

### Warp Workflow (Optional)
Create a workflow for this project:
\`\`\`yaml
name: ${vars.repoName} Dev Session
command: |
  cd "${vars.repoPath}"
  export KANVAS_SESSION_ID="${vars.sessionId}"
  git checkout ${vars.branchName}
\`\`\`

### Task
${vars.taskDescription}

---

Use Warp AI (# key) to get help with your task. Activity tracked via git commits.
`;
}

function getCustomInstructions(vars: InstructionVars): string {
  return `## Custom Agent Setup for ${vars.repoName}

### Kanvas Integration

To integrate a custom agent with Kanvas, you have two options:

#### Option 1: Environment Variables
Set these environment variables before starting your agent:
\`\`\`bash
export KANVAS_SESSION_ID="${vars.sessionId}"
export KANVAS_REPO_PATH="${vars.repoPath}"
export KANVAS_BRANCH="${vars.branchName}"
\`\`\`

#### Option 2: File-Based Reporting
Write activity to the Kanvas directory:

**Register Agent** - Create \`${vars.repoPath}/.kanvas/agents/<agent-id>.json\`:
\`\`\`json
{
  "agentId": "your-agent-id",
  "agentType": "custom",
  "agentName": "Your Agent Name",
  "version": "1.0.0",
  "pid": 12345,
  "startedAt": "${new Date().toISOString()}",
  "capabilities": ["code-generation", "file-watching"]
}
\`\`\`

**Report Session** - Create \`${vars.repoPath}/.kanvas/sessions/${vars.sessionId}.json\`:
\`\`\`json
{
  "sessionId": "${vars.sessionId}",
  "agentId": "your-agent-id",
  "agentType": "custom",
  "task": "${vars.taskDescription}",
  "branchName": "${vars.branchName}",
  "worktreePath": "${vars.repoPath}",
  "repoPath": "${vars.repoPath}",
  "status": "active",
  "created": "${new Date().toISOString()}",
  "updated": "${new Date().toISOString()}",
  "commitCount": 0
}
\`\`\`

**Log Activity** - Append to \`${vars.repoPath}/.kanvas/activity/${vars.sessionId}.log\`:
\`\`\`json
{"agentId":"your-agent-id","sessionId":"${vars.sessionId}","type":"info","message":"Started working on task","timestamp":"${new Date().toISOString()}"}
\`\`\`

**Heartbeat** - Update \`${vars.repoPath}/.kanvas/heartbeats/<agent-id>.beat\`:
\`\`\`
${new Date().toISOString()}
\`\`\`

### Task
${vars.taskDescription}

### Branch
\`\`\`bash
cd "${vars.repoPath}"
git checkout ${vars.branchName}
\`\`\`

---

Your custom agent's activity will appear in Kanvas when files are written correctly.
`;
}

/**
 * Get a brief description for each agent type
 */
export function getAgentTypeDescription(agentType: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    claude: 'Claude Code - Full AI coding assistant with terminal access',
    cursor: 'Cursor IDE - AI-powered code editing and completion',
    copilot: 'GitHub Copilot - AI pair programmer in VS Code',
    cline: 'Cline - Autonomous coding agent for VS Code',
    aider: 'Aider - Git-aware AI pair programming in terminal',
    warp: 'Warp - AI-powered terminal with natural language commands',
    custom: 'Custom Agent - Any tool with Kanvas integration',
  };

  return descriptions[agentType];
}

/**
 * Get the launch method for each agent type
 */
export function getAgentLaunchMethod(agentType: AgentType): 'cli' | 'ide' | 'terminal' | 'manual' {
  const methods: Record<AgentType, 'cli' | 'ide' | 'terminal' | 'manual'> = {
    claude: 'cli',
    cursor: 'ide',
    copilot: 'ide',
    cline: 'ide',
    aider: 'cli',
    warp: 'terminal',
    custom: 'manual',
  };

  return methods[agentType];
}

/**
 * Check if agent can be auto-launched from Kanvas
 */
export function canAutoLaunch(agentType: AgentType): boolean {
  // Only DevOps Agent (our built-in) can be auto-launched
  // External agents require manual setup
  return false;
}
