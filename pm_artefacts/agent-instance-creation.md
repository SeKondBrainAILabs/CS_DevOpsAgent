# PRD: Agent Instance Creation for SeKondBrain Kanvas

## Overview

**Product**: SeKondBrain Kanvas for KIT
**Feature**: Agent Instance Creation & Repository Configuration
**Version**: 1.0.0
**Date**: January 2025
**Author**: DevOps Agent

## Executive Summary

Enable users to create new agent instances directly from the Kanvas dashboard, select a target repository, configure the agent type, and receive setup instructions. Kanvas is a **dashboard** that agents report INTO - this feature bridges the gap between Kanvas (the monitoring UI) and the actual agents (separate processes) by providing a streamlined onboarding flow.

---

## Problem Statement

Currently, users must:
1. Manually set up agent sessions via CLI commands
2. Know the correct configuration for each agent type
3. Understand the file structure and worktree setup
4. Configure the `.kanvas` directory manually for agent reporting

This creates friction for new users and limits adoption of multi-agent workflows.

---

## Goals & Success Metrics

### Goals
1. Reduce agent setup time from ~10 minutes to <1 minute
2. Provide visual, guided agent creation within Kanvas
3. Support all agent types: Claude, Cursor, Copilot, Cline, Aider, Warp, Custom
4. Generate copy-paste instructions for agents that can't auto-register
5. Auto-initialize `.kanvas` directory for agent reporting

### Success Metrics
- 90% reduction in support requests for agent setup
- <60 seconds average time to create new agent instance
- 100% of agent types supported with appropriate instructions

---

## User Stories

### US-1: Create New Agent Instance
**As a** developer using Kanvas
**I want to** create a new agent instance from the dashboard
**So that** I can quickly spin up AI coding assistants for my projects

### US-2: Select Repository
**As a** developer
**I want to** select which repository the agent will work on
**So that** the agent is configured correctly for my project

### US-3: Choose Agent Type
**As a** developer
**I want to** select from supported agent types (Claude, Cursor, etc.)
**So that** I get the correct setup instructions for my preferred tool

### US-4: View Setup Instructions
**As a** developer
**I want to** see clear, copy-paste instructions after creating an agent
**So that** I can quickly start the agent and have it report to Kanvas

### US-5: Auto-Initialize Kanvas Directory
**As a** developer
**I want** Kanvas to automatically set up the `.kanvas` folder in my repo
**So that** agents can immediately start reporting their activity

---

## Feature Requirements

### FR-1: New Agent Wizard

#### FR-1.1: Repository Selection
- **Directory picker** to select a local Git repository
- **Recent repositories** list for quick access
- **Validation** that selected path is a valid Git repo
- Display repo name, current branch, and remote URL

#### FR-1.2: Agent Type Selection
| Agent Type | Auto-Register | Requires Instructions |
|------------|---------------|----------------------|
| DevOps Agent (CLI) | Yes | No - Launches directly |
| Claude Code | No | Yes - Copy command |
| Cursor | No | Yes - Workspace setup |
| GitHub Copilot | No | Yes - Extension config |
| Cline | No | Yes - Extension config |
| Aider | No | Yes - CLI command |
| Warp AI | No | Yes - Terminal config |
| Custom | No | Yes - Manual setup |

#### FR-1.3: Task Description
- **Text input** for describing the task/feature
- Used for branch naming and session identification
- Auto-generates branch name suggestion (e.g., `feature/add-dark-mode`)

#### FR-1.4: Advanced Options (Collapsible)
- **Base branch** selection (default: main/master)
- **Worktree mode** toggle (isolated worktree vs same directory)
- **Auto-commit interval** (for file-watching agents)
- **File patterns** to watch/ignore

### FR-2: Repository Initialization

#### FR-2.1: .kanvas Directory Setup
Create the following structure in the selected repository:
```
.kanvas/
├── agents/          # Agent registration files
├── sessions/        # Session status files
├── activity/        # Activity log files
├── commands/        # Kanvas → Agent commands
├── heartbeats/      # Agent heartbeat files
└── config.json      # Kanvas configuration
```

#### FR-2.2: Configuration File
```json
{
  "version": "1.0.0",
  "repoPath": "/path/to/repo",
  "initialized": "2025-01-11T12:00:00Z",
  "settings": {
    "autoCommit": true,
    "commitInterval": 30000,
    "watchPatterns": ["**/*"],
    "ignorePatterns": ["node_modules/**", ".git/**"]
  }
}
```

#### FR-2.3: Git Configuration
- Add `.kanvas/` to `.gitignore` (agent data shouldn't be committed)
- Optional: Create initial branch for agent work

### FR-3: Setup Instructions Generator

#### FR-3.1: DevOps Agent (Auto-Launch)
```bash
# Kanvas launches directly
s9n-devops-agent start --repo /path/to/repo --task "Add dark mode" --branch feature/add-dark-mode
```

#### FR-3.2: Claude Code Instructions
```markdown
## Setup Claude Code for this Repository

1. Open a new terminal in: `/path/to/repo`

2. Start Claude Code with Kanvas reporting:
   ```bash
   claude --kanvas-report
   ```

3. Or manually export the session:
   ```bash
   export KANVAS_SESSION_ID="abc123"
   export KANVAS_AGENT_ID="claude-$(hostname)"
   claude
   ```

Your activity will appear in Kanvas automatically.
```

#### FR-3.3: Cursor Instructions
```markdown
## Setup Cursor for this Repository

1. Open Cursor IDE

2. Open folder: `/path/to/repo`

3. Install Kanvas extension (if available) or:
   - Open Settings → Extensions
   - Search for "Kanvas Reporter"
   - Enable for this workspace

4. The agent will register automatically when you start coding.
```

#### FR-3.4: Aider Instructions
```markdown
## Setup Aider for this Repository

1. Navigate to the repository:
   ```bash
   cd /path/to/repo
   ```

2. Start Aider with Kanvas reporting:
   ```bash
   aider --kanvas-session abc123
   ```

   Or use environment variables:
   ```bash
   export KANVAS_REPORT=true
   export KANVAS_SESSION_ID=abc123
   aider
   ```
```

### FR-4: Post-Creation Flow

#### FR-4.1: Instruction Modal
- Display formatted instructions based on agent type
- **Copy All** button for entire instruction block
- **Copy** buttons for individual commands
- **Open in Terminal** button (for CLI agents)
- **Done** button to close and start monitoring

#### FR-4.2: Session Placeholder
- Create placeholder session in Kanvas with "Waiting for agent..." status
- Show timeout warning if agent doesn't connect within 5 minutes
- Auto-update when agent registers

#### FR-4.3: Quick Actions
- **Launch DevOps Agent** - Direct launch for built-in agent
- **Open VS Code** - Open repo in VS Code
- **Open Terminal** - Open terminal at repo path
- **Copy Path** - Copy repo path to clipboard

---

## Technical Requirements

### TR-1: New IPC Channels
```typescript
// Add to shared/ipc-channels.ts
AGENT_INSTANCE_CREATE: 'agent-instance:create',
AGENT_INSTANCE_VALIDATE_REPO: 'agent-instance:validate-repo',
AGENT_INSTANCE_INITIALIZE_KANVAS: 'agent-instance:initialize-kanvas',
AGENT_INSTANCE_GET_INSTRUCTIONS: 'agent-instance:get-instructions',
AGENT_INSTANCE_LAUNCH: 'agent-instance:launch',
```

### TR-2: New Service - AgentInstanceService
```typescript
// electron/services/AgentInstanceService.ts
class AgentInstanceService {
  validateRepository(path: string): Promise<RepoValidation>
  initializeKanvasDirectory(path: string): Promise<void>
  createAgentInstance(config: AgentInstanceConfig): Promise<AgentInstance>
  generateInstructions(agentType: AgentType, config: AgentInstanceConfig): string
  launchAgent(instance: AgentInstance): Promise<void>
}
```

### TR-3: New Types
```typescript
// shared/types.ts additions
interface AgentInstanceConfig {
  repoPath: string;
  agentType: AgentType;
  taskDescription: string;
  branchName: string;
  baseBranch: string;
  useWorktree: boolean;
  autoCommit: boolean;
  commitInterval: number;
}

interface AgentInstance {
  id: string;
  config: AgentInstanceConfig;
  status: 'pending' | 'waiting' | 'active' | 'error';
  createdAt: string;
  instructions?: string;
}

interface RepoValidation {
  isValid: boolean;
  isGitRepo: boolean;
  repoName: string;
  currentBranch: string;
  remoteUrl?: string;
  hasKanvasDir: boolean;
  error?: string;
}
```

### TR-4: UI Components

#### New Components to Create:
1. `CreateAgentWizard.tsx` - Multi-step wizard modal
2. `RepoSelector.tsx` - Repository selection with validation
3. `AgentTypeSelector.tsx` - Visual agent type picker
4. `TaskInput.tsx` - Task description with branch name generator
5. `AdvancedOptions.tsx` - Collapsible advanced settings
6. `InstructionsModal.tsx` - Post-creation instructions display
7. `CopyButton.tsx` - Reusable copy-to-clipboard button

#### Update Existing:
- `Sidebar.tsx` - Add "Create Agent" prominent button
- `DashboardCanvas.tsx` - Show pending agent instances

### TR-5: Recent Repositories Storage
```typescript
// Use electron-store for persistence
interface RecentRepo {
  path: string;
  name: string;
  lastUsed: string;
  agentCount: number;
}
```

---

## UI/UX Design

### Wizard Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Agent Instance                            [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1 of 3: Select Repository                             │
│  ─────────────────────────────────────                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📁 Browse...                          [Select Folder] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recent Repositories:                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📂 my-project         ~/Development/my-project       │   │
│  │ 📂 api-service        ~/work/api-service             │   │
│  │ 📂 frontend-app       ~/projects/frontend-app        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                          [Cancel] [Next →] │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Agent Instance                            [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 2 of 3: Choose Agent Type                             │
│  ─────────────────────────────────────                      │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    🤖    │  │    📝    │  │    🔷    │  │    ⚡    │   │
│  │  Claude  │  │  Cursor  │  │ Copilot  │  │  Cline   │   │
│  │  [CLI]   │  │  [IDE]   │  │ [VSCode] │  │ [VSCode] │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │    🔧    │  │    🖥️    │  │    ⚙️    │                  │
│  │  Aider   │  │   Warp   │  │  Custom  │                  │
│  │  [CLI]   │  │ [Term]   │  │ [Manual] │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ⭐ DevOps Agent (Recommended)                        │  │
│  │  Full integration with Kanvas - auto file watching,   │  │
│  │  auto-commit, and real-time activity reporting.       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│                                       [← Back] [Next →]    │
└─────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│  Create New Agent Instance                            [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 3 of 3: Configure Session                             │
│  ─────────────────────────────────────                      │
│                                                             │
│  Task Description *                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Add dark mode toggle to settings page               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Branch Name                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ feature/add-dark-mode-toggle                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ✨ Auto-generated from task description                    │
│                                                             │
│  ▼ Advanced Options                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Base Branch:     [main           ▼]                 │   │
│  │ Use Worktree:    [✓] Isolated worktree              │   │
│  │ Auto-Commit:     [✓] Every 30 seconds               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                   [← Back] [Create Agent]  │
└─────────────────────────────────────────────────────────────┘
```

### Instructions Modal (Post-Creation)

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Agent Instance Created!                           [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Setup Claude Code                                          │
│  ─────────────────                                          │
│                                                             │
│  1. Open a terminal and navigate to your repository:        │
│     ┌─────────────────────────────────────────────────┐    │
│     │ cd /Users/dev/my-project                        │ 📋 │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  2. Start Claude Code with Kanvas reporting:                │
│     ┌─────────────────────────────────────────────────┐    │
│     │ export KANVAS_SESSION=abc123def456              │ 📋 │
│     │ claude                                          │    │
│     └─────────────────────────────────────────────────┘    │
│                                                             │
│  3. Your activity will appear in Kanvas automatically!      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⏳ Waiting for agent to connect...                  │   │
│  │     Session ID: abc123def456                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Copy All Instructions]        [Open Terminal]    [Done]  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `AgentInstanceService`
2. Add IPC channels and handlers
3. Implement `.kanvas` directory initialization
4. Add types and interfaces

### Phase 2: Repository Selection
1. Create `RepoSelector` component
2. Implement directory picker integration
3. Add repository validation
4. Implement recent repos storage

### Phase 3: Agent Type Selection
1. Create `AgentTypeSelector` component
2. Design agent type cards with icons
3. Add descriptions for each type

### Phase 4: Configuration & Instructions
1. Create `TaskInput` component
2. Implement branch name auto-generation
3. Create `AdvancedOptions` component
4. Build instructions generator for each agent type

### Phase 5: Wizard Assembly
1. Create `CreateAgentWizard` modal
2. Implement step navigation
3. Create `InstructionsModal`
4. Add post-creation actions

### Phase 6: Integration
1. Update Sidebar with create button
2. Add pending instances to dashboard
3. Implement agent connection detection
4. Add timeout warnings

---

## Dependencies

### Internal
- `shared/agent-protocol.ts` - Agent communication protocol
- `electron/services/AgentListenerService.ts` - Agent monitoring
- `renderer/store/agentStore.ts` - Agent state management

### External
- `electron` - Dialog for directory picker
- `electron-store` - Persist recent repositories
- `chokidar` - File watching for `.kanvas` directory

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent doesn't support Kanvas reporting | High | Provide manual setup instructions, periodic status check |
| User selects non-Git directory | Medium | Validation with clear error message |
| Multiple agents on same repo | Medium | Support multiple sessions, show warning |
| Instructions become outdated | Low | Version instructions, link to docs |

---

## Future Enhancements

1. **Agent Templates** - Pre-configured setups for common scenarios
2. **Team Sharing** - Share agent configs with team members
3. **Cloud Sync** - Sync recent repos across devices
4. **Agent Marketplace** - Discover and install agent plugins
5. **Automated Setup** - Browser extensions for IDE-based agents

---

## Appendix: Agent Type Details

### DevOps Agent (Built-in)
- **Launch Method**: Direct spawn from Kanvas
- **Reporting**: Native integration, real-time
- **Features**: File watching, auto-commit, worktree management

### Claude Code
- **Launch Method**: Terminal command
- **Reporting**: Via environment variables or `--kanvas-report` flag
- **Features**: Full AI coding assistant

### Cursor
- **Launch Method**: IDE application
- **Reporting**: Via extension or workspace config
- **Features**: AI-powered code editing

### GitHub Copilot
- **Launch Method**: VS Code extension
- **Reporting**: Via companion extension
- **Features**: Code completion, chat

### Cline
- **Launch Method**: VS Code extension
- **Reporting**: Via extension settings
- **Features**: Autonomous coding agent

### Aider
- **Launch Method**: Terminal command
- **Reporting**: Via CLI flags or env vars
- **Features**: Git-aware AI pair programming

### Warp
- **Launch Method**: Terminal application
- **Reporting**: Via Warp workflows
- **Features**: AI-powered terminal

### Custom
- **Launch Method**: User-defined
- **Reporting**: Manual file-based
- **Features**: Any tool with file output
