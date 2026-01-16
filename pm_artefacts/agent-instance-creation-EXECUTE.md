# EXECUTE: Agent Instance Creation Feature

## Reference PRD
`/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/DevOpsAgent/.claude/prd/agent-instance-creation.md`

---

## Epic Overview

| Epic | Description | Priority |
|------|-------------|----------|
| EPIC-1 | Core Infrastructure & Types | P0 |
| EPIC-2 | AgentInstanceService | P0 |
| EPIC-3 | Repository Selector Component | P0 |
| EPIC-4 | Agent Type Selector Component | P1 |
| EPIC-5 | Task Configuration Component | P1 |
| EPIC-6 | Create Agent Wizard Modal | P0 |
| EPIC-7 | Instructions Generator & Modal | P1 |
| EPIC-8 | Integration & Polish | P2 |

---

## EPIC-1: Core Infrastructure & Types

### Tasks

#### 1.1 Add New Types to shared/types.ts
```typescript
// Add to shared/types.ts
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

interface RecentRepo {
  path: string;
  name: string;
  lastUsed: string;
  agentCount: number;
}
```

#### 1.2 Add IPC Channels to shared/ipc-channels.ts
```typescript
// Add to IPC object
INSTANCE_CREATE: 'instance:create',
INSTANCE_VALIDATE_REPO: 'instance:validate-repo',
INSTANCE_INITIALIZE_KANVAS: 'instance:initialize-kanvas',
INSTANCE_GET_INSTRUCTIONS: 'instance:get-instructions',
INSTANCE_LAUNCH: 'instance:launch',
INSTANCE_LIST_RECENT_REPOS: 'instance:list-recent-repos',
INSTANCE_ADD_RECENT_REPO: 'instance:add-recent-repo',

// Add to REQUEST_CHANNELS array
IPC.INSTANCE_CREATE,
IPC.INSTANCE_VALIDATE_REPO,
IPC.INSTANCE_INITIALIZE_KANVAS,
IPC.INSTANCE_GET_INSTRUCTIONS,
IPC.INSTANCE_LAUNCH,
IPC.INSTANCE_LIST_RECENT_REPOS,
IPC.INSTANCE_ADD_RECENT_REPO,
```

#### 1.3 Add Agent Instruction Templates
Create `shared/agent-instructions.ts` with instruction templates for each agent type.

---

## EPIC-2: AgentInstanceService

### Tasks

#### 2.1 Create AgentInstanceService
**File**: `electron/services/AgentInstanceService.ts`

```typescript
export class AgentInstanceService extends BaseService {
  // Validate a repository path
  async validateRepository(path: string): Promise<IpcResult<RepoValidation>>

  // Initialize .kanvas directory in repo
  async initializeKanvasDirectory(path: string): Promise<IpcResult<void>>

  // Create a new agent instance
  async createInstance(config: AgentInstanceConfig): Promise<IpcResult<AgentInstance>>

  // Generate setup instructions for agent type
  getInstructions(agentType: AgentType, config: AgentInstanceConfig): string

  // Launch DevOps Agent directly
  async launchDevOpsAgent(instance: AgentInstance): Promise<IpcResult<void>>

  // Recent repos management
  async getRecentRepos(): Promise<IpcResult<RecentRepo[]>>
  async addRecentRepo(repo: RecentRepo): Promise<IpcResult<void>>
}
```

#### 2.2 Register Service in electron/services/index.ts
Add AgentInstanceService to Services interface and initialization.

#### 2.3 Add IPC Handlers in electron/ipc/index.ts
Register handlers for all new IPC channels.

#### 2.4 Update Preload API in electron/preload.ts
Expose instance API to renderer:
```typescript
instance: {
  create: (config) => ipcRenderer.invoke(IPC.INSTANCE_CREATE, config),
  validateRepo: (path) => ipcRenderer.invoke(IPC.INSTANCE_VALIDATE_REPO, path),
  initializeKanvas: (path) => ipcRenderer.invoke(IPC.INSTANCE_INITIALIZE_KANVAS, path),
  getInstructions: (type, config) => ipcRenderer.invoke(IPC.INSTANCE_GET_INSTRUCTIONS, type, config),
  launch: (instance) => ipcRenderer.invoke(IPC.INSTANCE_LAUNCH, instance),
  getRecentRepos: () => ipcRenderer.invoke(IPC.INSTANCE_LIST_RECENT_REPOS),
}
```

---

## EPIC-3: Repository Selector Component

### Tasks

#### 3.1 Create RepoSelector Component
**File**: `renderer/components/features/RepoSelector.tsx`

Features:
- Directory picker button (uses electron dialog)
- Recent repositories list
- Repository validation status
- Display repo info (name, branch, remote)

#### 3.2 Create useRecentRepos Hook
**File**: `renderer/hooks/useRecentRepos.ts`

Hook to fetch and manage recent repositories.

---

## EPIC-4: Agent Type Selector Component

### Tasks

#### 4.1 Create AgentTypeSelector Component
**File**: `renderer/components/features/AgentTypeSelector.tsx`

Features:
- Grid of agent type cards
- Visual icons for each type
- Selected state styling
- Brief description for each
- Recommended badge for DevOps Agent

#### 4.2 Create Agent Type Icons/Assets
Add SVG icons or use existing design system for agent type visuals.

---

## EPIC-5: Task Configuration Component

### Tasks

#### 5.1 Create TaskInput Component
**File**: `renderer/components/features/TaskInput.tsx`

Features:
- Task description textarea
- Auto-generate branch name from task
- Branch name input (editable)
- Character count

#### 5.2 Create AdvancedOptions Component
**File**: `renderer/components/features/AdvancedOptions.tsx`

Features:
- Collapsible section
- Base branch selector
- Worktree toggle
- Auto-commit toggle with interval input

#### 5.3 Create Branch Name Generator Utility
**File**: `renderer/utils/branchNameGenerator.ts`

Convert task description to kebab-case branch name.

---

## EPIC-6: Create Agent Wizard Modal

### Tasks

#### 6.1 Create CreateAgentWizard Component
**File**: `renderer/components/features/CreateAgentWizard.tsx`

Features:
- Multi-step wizard (3 steps)
- Step indicator
- Navigation (back/next/create)
- Form state management
- Validation per step

#### 6.2 Create Wizard Store
**File**: `renderer/store/wizardStore.ts`

Zustand store for wizard state:
```typescript
interface WizardState {
  currentStep: number;
  repoPath: string | null;
  repoValidation: RepoValidation | null;
  agentType: AgentType | null;
  taskDescription: string;
  branchName: string;
  baseBranch: string;
  useWorktree: boolean;
  autoCommit: boolean;
  commitInterval: number;
  // Actions
  setStep(step: number): void;
  setRepoPath(path: string): void;
  // ... etc
  reset(): void;
}
```

#### 6.3 Integrate Wizard into UI
- Add trigger button to Sidebar ("Create Agent" button)
- Update NewSessionWizard or replace with CreateAgentWizard

---

## EPIC-7: Instructions Generator & Modal

### Tasks

#### 7.1 Create InstructionsModal Component
**File**: `renderer/components/features/InstructionsModal.tsx`

Features:
- Display formatted instructions
- Code blocks with syntax highlighting
- Copy button per block
- Copy All button
- Open Terminal button (for CLI agents)
- Waiting status indicator

#### 7.2 Create CopyButton Component
**File**: `renderer/components/ui/CopyButton.tsx`

Reusable copy-to-clipboard button with feedback.

#### 7.3 Create Instructions Templates
**File**: `shared/agent-instructions.ts`

Template strings for each agent type with variable interpolation.

---

## EPIC-8: Integration & Polish

### Tasks

#### 8.1 Update Sidebar
- Add prominent "Create Agent" button
- Show pending instances count badge

#### 8.2 Update DashboardCanvas
- Add pending instances section
- Show "Waiting for agent..." cards
- Timeout warning after 5 minutes

#### 8.3 Add Instance Store
**File**: `renderer/store/instanceStore.ts`

Track created instances and their connection status.

#### 8.4 Connect to AgentListenerService
When agent connects, update instance status from 'waiting' to 'active'.

#### 8.5 Polish & Testing
- Keyboard navigation in wizard
- Error handling and messages
- Loading states
- Animation polish

---

## File Summary

### New Files to Create

```
electron/
└── services/
    └── AgentInstanceService.ts

renderer/
├── components/
│   ├── features/
│   │   ├── CreateAgentWizard.tsx
│   │   ├── RepoSelector.tsx
│   │   ├── AgentTypeSelector.tsx
│   │   ├── TaskInput.tsx
│   │   ├── AdvancedOptions.tsx
│   │   └── InstructionsModal.tsx
│   └── ui/
│       └── CopyButton.tsx
├── hooks/
│   └── useRecentRepos.ts
├── store/
│   ├── wizardStore.ts
│   └── instanceStore.ts
└── utils/
    └── branchNameGenerator.ts

shared/
└── agent-instructions.ts
```

### Files to Modify

```
shared/
├── types.ts              # Add new interfaces
└── ipc-channels.ts       # Add new channels

electron/
├── services/index.ts     # Register AgentInstanceService
├── ipc/index.ts          # Add IPC handlers
└── preload.ts            # Add instance API

renderer/
├── App.tsx               # Add wizard modal trigger
└── components/
    └── layouts/
        └── Sidebar.tsx   # Add create button
```

---

## Execution Order

1. **EPIC-1** - Types and channels (foundation)
2. **EPIC-2** - Backend service (required for all UI)
3. **EPIC-3** - Repo selector (first wizard step)
4. **EPIC-4** - Agent type selector (second step)
5. **EPIC-5** - Task configuration (third step)
6. **EPIC-6** - Wizard assembly (combines steps)
7. **EPIC-7** - Instructions modal (post-creation)
8. **EPIC-8** - Integration and polish

---

## Success Criteria

- [ ] User can select a repository via directory picker
- [ ] Recent repositories are persisted and shown
- [ ] All 8 agent types are selectable
- [ ] Task description auto-generates branch name
- [ ] Advanced options work correctly
- [ ] `.kanvas` directory is created in selected repo
- [ ] Instructions are displayed for chosen agent type
- [ ] Copy buttons work for all code blocks
- [ ] DevOps Agent can be launched directly
- [ ] Pending instances appear in dashboard
- [ ] Instance updates to 'active' when agent connects
