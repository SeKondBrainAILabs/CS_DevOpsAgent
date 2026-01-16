# PRD: Test Contracts, Feature Organization & Persistent Workers

**Version**: 1.1
**Date**: 2026-01-14
**Author**: DevOps Agent Team
**Status**: Draft

> **v1.1 Updates**: Added Dynamic Port Allocation (Section 11) and Persistent Agent Workers (Section 12)

---

## 1. Executive Summary

This PRD defines a system for tracking test contracts (Playwright E2E tests, unit tests) as first-class citizens alongside API contracts. The system introduces JSON-based contract tracking at both feature and repository levels, enforces feature-based folder organization for new code, and provides migration tools for existing codebases.

### Key Outcomes
- Automated tracking of test coverage changes per feature
- Breaking change detection for test contracts (removed tests, changed assertions)
- Feature-based code organization as a first-class pattern
- Self-service migration for legacy codebases via AI-powered refactoring

---

## 2. Problem Statement

### Current Pain Points

1. **No test contract tracking**: API contracts are detected, but test changes go unnoticed
2. **Flat folder structures**: Code becomes hard to navigate as features grow
3. **Test coverage gaps**: No visibility into which features have adequate test coverage
4. **Inconsistent organization**: Different developers organize code differently
5. **Legacy code burden**: Existing repos can't easily adopt better patterns

### User Stories (High-Level)

> "As a **team lead**, I want to see which features have breaking test changes so I can prioritize review."

> "As a **developer**, I want my agent to automatically organize new features into proper folders."

> "As a **repo owner**, I want to migrate my flat codebase to feature-based folders without breaking anything."

---

## 3. Solution Overview

### 3.1 Test Contract Detection

Extend `ContractDetectionService` to recognize test files as contracts:

```
Contract Types:
├── API Contracts (existing)
│   ├── OpenAPI specs (*.yaml, *.json)
│   ├── GraphQL schemas (*.graphql)
│   └── TypeScript interfaces (*.d.ts, types.ts)
│
└── Test Contracts (NEW)
    ├── Playwright E2E (*.spec.ts, *.e2e.ts)
    ├── Unit Tests (*.test.ts, *.spec.ts in __tests__)
    ├── Integration Tests (*.integration.ts)
    └── Test Fixtures (fixtures/*.json, mocks/*.ts)
```

### 3.2 JSON Contract Registry

Track contracts in structured JSON files:

```
.S9N_KIT_DevOpsAgent/
├── contracts/
│   ├── repo-contracts.json      # Repo-level summary
│   └── features/
│       ├── auth.contracts.json   # Per-feature contracts
│       ├── billing.contracts.json
│       └── dashboard.contracts.json
```

**repo-contracts.json schema:**
```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-14T10:00:00Z",
  "summary": {
    "totalFeatures": 5,
    "totalTests": 127,
    "coverageScore": 0.78,
    "breakingChangesLast7Days": 3
  },
  "features": {
    "auth": { "ref": "./features/auth.contracts.json" },
    "billing": { "ref": "./features/billing.contracts.json" }
  }
}
```

**{feature}.contracts.json schema:**
```json
{
  "feature": "auth",
  "version": "1.0.0",
  "lastUpdated": "2026-01-14T10:00:00Z",
  "contracts": {
    "api": [
      {
        "file": "src/features/auth/api/auth.routes.ts",
        "type": "api-endpoint",
        "endpoints": ["/api/auth/login", "/api/auth/logout"],
        "lastModified": "2026-01-13T15:00:00Z"
      }
    ],
    "e2e": [
      {
        "file": "src/features/auth/tests/auth.e2e.spec.ts",
        "type": "playwright",
        "testCount": 12,
        "assertions": ["login flow", "logout flow", "session persistence"],
        "lastModified": "2026-01-14T09:00:00Z"
      }
    ],
    "unit": [
      {
        "file": "src/features/auth/tests/auth.service.test.ts",
        "type": "jest",
        "testCount": 24,
        "coverage": { "lines": 0.92, "branches": 0.85 },
        "lastModified": "2026-01-14T08:00:00Z"
      }
    ]
  },
  "dependencies": ["database", "email-service"],
  "breakingChanges": []
}
```

### 3.3 Feature-Based Folder Structure

Recommended structure for new features:

```
src/
├── features/
│   ├── auth/
│   │   ├── index.ts              # Public exports
│   │   ├── api/
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   └── auth.service.ts
│   │   ├── models/
│   │   │   └── user.model.ts
│   │   ├── tests/
│   │   │   ├── auth.e2e.spec.ts
│   │   │   ├── auth.service.test.ts
│   │   │   └── fixtures/
│   │   │       └── users.json
│   │   └── types/
│   │       └── auth.types.ts
│   │
│   └── billing/
│       └── ... (same structure)
│
├── shared/                        # Cross-cutting concerns
│   ├── utils/
│   ├── middleware/
│   └── types/
│
└── config/
```

### 3.4 First-Run UX Flow

When an agent runs for the first time in a repo:

```
┌─────────────────────────────────────────────────────────────┐
│  Welcome to DevOps Agent!                                   │
│                                                             │
│  We detected this repo doesn't have feature-based           │
│  organization yet. Would you like to enable it?             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ○ Enable feature folders (Recommended)              │   │
│  │   New code will be organized into src/features/     │   │
│  │                                                     │   │
│  │ ○ Keep current structure                            │   │
│  │   Agent will follow existing patterns               │   │
│  │                                                     │   │
│  │ ○ Migrate existing code (Advanced)                  │   │
│  │   AI will reorganize your codebase                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ Skip for now ]                    [ Apply & Continue ]   │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Migration System

For existing codebases, offer AI-powered migration:

**Migration Modes:**
1. **Prompt-based**: Generate instructions for coding agent to execute
2. **AI Worker**: Use Kimik2/Qwen to generate migration plan + execute

**Migration Flow:**
```
1. Analyze current structure
2. Detect feature boundaries (via imports, naming, semantics)
3. Generate migration plan (JSON)
4. Preview changes (file moves, import updates)
5. Execute migration (atomic commits per feature)
6. Validate (run tests, check imports)
7. Rollback if needed
```

---

## 4. Detailed Requirements

### 4.1 Test Contract Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| TC-001 | Detect Playwright test files (*.spec.ts, *.e2e.ts) | P0 |
| TC-002 | Detect Jest/Vitest unit tests (*.test.ts, __tests__/) | P0 |
| TC-003 | Parse test file to extract test names and assertions | P1 |
| TC-004 | Detect removed/renamed tests as breaking changes | P0 |
| TC-005 | Track test fixtures as dependencies | P2 |
| TC-006 | Calculate test coverage per feature | P1 |

### 4.2 Contract JSON Registry

| ID | Requirement | Priority |
|----|-------------|----------|
| CR-001 | Create repo-contracts.json on first scan | P0 |
| CR-002 | Create per-feature contract files | P0 |
| CR-003 | Update contracts on every commit | P0 |
| CR-004 | Track breaking changes history (last 30 days) | P1 |
| CR-005 | Generate coverage score from test counts | P1 |
| CR-006 | Support custom contract patterns via config | P2 |

### 4.3 House Rules Update

| ID | Requirement | Priority |
|----|-------------|----------|
| HR-001 | Add feature-folder organization rule | P0 |
| HR-002 | Define naming conventions for features | P1 |
| HR-003 | Require tests in feature folder | P1 |
| HR-004 | Define public API via index.ts exports | P2 |

### 4.4 First-Run UX

| ID | Requirement | Priority |
|----|-------------|----------|
| UX-001 | Show setup dialog on first agent run | P0 |
| UX-002 | Persist choice in .S9N_KIT_DevOpsAgent/config.json | P0 |
| UX-003 | Allow changing preference later via settings | P1 |
| UX-004 | Show preview of what will change | P1 |

### 4.5 Migration System

| ID | Requirement | Priority |
|----|-------------|----------|
| MG-001 | Analyze codebase to detect feature boundaries | P0 |
| MG-002 | Generate migration plan as JSON | P0 |
| MG-003 | Preview mode (dry-run) | P0 |
| MG-004 | Execute migration with atomic commits | P1 |
| MG-005 | Update all imports automatically | P0 |
| MG-006 | Support rollback via git | P1 |
| MG-007 | Integrate Kimik2/Qwen for smart migration | P1 |
| MG-008 | Validate migration (run tests) | P0 |

---

## 5. Technical Architecture

### 5.1 New Services

```typescript
// electron/services/TestContractService.ts
class TestContractService {
  analyzeTestFile(filePath: string): TestContract;
  detectBreakingChanges(before: TestContract, after: TestContract): BreakingChange[];
  calculateCoverage(feature: string): CoverageReport;
}

// electron/services/ContractRegistryService.ts
class ContractRegistryService {
  initializeRegistry(repoPath: string): void;
  updateFeatureContracts(feature: string, contracts: Contract[]): void;
  getRepoSummary(): RepoContractSummary;
  getFeatureContracts(feature: string): FeatureContracts;
}

// electron/services/MigrationService.ts
class MigrationService {
  analyzeStructure(repoPath: string): StructureAnalysis;
  detectFeatures(repoPath: string): DetectedFeature[];
  generateMigrationPlan(repoPath: string): MigrationPlan;
  executeMigration(plan: MigrationPlan): MigrationResult;
  rollbackMigration(repoPath: string): void;
}
```

### 5.2 AI Worker Integration

```typescript
// For migration using Kimik2/Qwen
interface MigrationPrompt {
  systemPrompt: string;
  codebaseContext: string;
  targetStructure: string;
  constraints: string[];
}

const MIGRATION_SYSTEM_PROMPT = `
You are a code migration specialist. Your task is to reorganize a codebase
into feature-based folders while:
1. Preserving all functionality
2. Updating all imports correctly
3. Maintaining test coverage
4. Creating proper index.ts exports

Output a JSON migration plan with:
- files to move
- import updates required
- new files to create (index.ts)
- validation steps
`;
```

### 5.3 IPC Channels

```typescript
// New IPC channels
export const IPC = {
  // ... existing

  // Test Contracts
  TEST_CONTRACT_ANALYZE: 'test-contract:analyze',
  TEST_CONTRACT_GET_COVERAGE: 'test-contract:get-coverage',

  // Contract Registry
  REGISTRY_INIT: 'registry:init',
  REGISTRY_GET_REPO: 'registry:get-repo',
  REGISTRY_GET_FEATURE: 'registry:get-feature',
  REGISTRY_UPDATE: 'registry:update',

  // Migration
  MIGRATION_ANALYZE: 'migration:analyze',
  MIGRATION_PLAN: 'migration:plan',
  MIGRATION_PREVIEW: 'migration:preview',
  MIGRATION_EXECUTE: 'migration:execute',
  MIGRATION_ROLLBACK: 'migration:rollback',

  // First-run
  SETUP_GET_STATUS: 'setup:get-status',
  SETUP_APPLY_CHOICE: 'setup:apply-choice',
};
```

---

## 6. UI/UX Specifications

### 6.1 Contracts Tab Enhancement

```
┌─────────────────────────────────────────────────────────────┐
│ Contracts                                      [Refresh]    │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Feature: auth                              Coverage: 92% │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ API Contracts          │ Test Contracts                 │ │
│ │ ├─ auth.routes.ts      │ ├─ E2E: auth.e2e.spec.ts (12) │ │
│ │ └─ auth.types.ts       │ ├─ Unit: auth.test.ts (24)    │ │
│ │                        │ └─ Fixtures: users.json        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Feature: billing                           Coverage: 78% │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ⚠️ Breaking Changes (2)                                  │ │
│ │ • Removed test: "should handle refund"                  │ │
│ │ • Changed assertion in "payment flow"                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Migration Dialog

```
┌─────────────────────────────────────────────────────────────┐
│ Migrate to Feature Folders                          [X]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Analysis Results:                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Detected 8 potential features:                          │ │
│ │                                                         │ │
│ │ ✓ auth (12 files, 3 tests)                             │ │
│ │ ✓ billing (8 files, 2 tests)                           │ │
│ │ ✓ dashboard (15 files, 4 tests)                        │ │
│ │ ✓ notifications (6 files, 1 test)                      │ │
│ │ ? user-profile (4 files, 0 tests) - needs review       │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Migration Method:                                           │
│ ○ Generate prompt for coding agent                         │
│ ● Use AI Worker (Kimik2) - Recommended                     │
│ ○ Manual (just update house rules)                         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Preview: 47 files will be moved, 89 imports updated    │ │
│ │ Estimated time: ~15 minutes                             │ │
│ │ Commits: 8 (one per feature)                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [ Cancel ]  [ Preview Changes ]  [ Start Migration ]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. House Rules Template Update

```markdown
# House Rules for DevOps Agent

## Code Organization (CRITICAL)

### Feature-Based Folders
All new features MUST be placed in their own subfolder under `src/features/`:

```
src/features/{feature-name}/
├── index.ts           # Public exports ONLY
├── api/               # Route handlers, controllers
├── services/          # Business logic
├── models/            # Data models, entities
├── types/             # TypeScript types/interfaces
└── tests/             # ALL tests for this feature
    ├── {feature}.e2e.spec.ts
    ├── {feature}.test.ts
    └── fixtures/
```

### Rules
1. **One feature = one folder** - Never mix features
2. **Tests live with features** - Not in a separate /tests folder
3. **Public API via index.ts** - Other features import from index.ts only
4. **No cross-feature imports** - Use shared/ for common code
5. **Naming convention**: `{feature}.{type}.ts` (e.g., `auth.service.ts`)

### Shared Code
Cross-cutting concerns go in `src/shared/`:
- Utils, helpers
- Middleware
- Common types
- Base classes

### Test Requirements
Every feature MUST have:
- [ ] At least one E2E test (*.e2e.spec.ts)
- [ ] Unit tests for services (*.test.ts)
- [ ] Test fixtures in tests/fixtures/

## Commit Message Format
...existing rules...
```

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test contract detection accuracy | >95% | Manual audit of 100 files |
| Migration success rate | >90% | Tests pass after migration |
| User adoption of feature folders | >70% | Config analytics |
| Breaking change detection accuracy | >90% | PR review audit |
| Migration time (avg repo) | <30 min | Automated logging |

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Migration breaks imports | High | Medium | Comprehensive import analysis + rollback |
| AI generates incorrect moves | Medium | Medium | Preview + human approval required |
| Large repos take too long | Medium | Low | Incremental migration by feature |
| Test detection false positives | Low | Medium | Configurable patterns |

---

## 10. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Test Contract Detection | 1 sprint | TC-001 to TC-004, CR-001 to CR-003 |
| Phase 2: Contract Registry UI | 1 sprint | Enhanced Contracts tab, feature view |
| Phase 3: House Rules + First-Run | 0.5 sprint | HR-001 to HR-003, UX-001 to UX-003 |
| Phase 4: Migration System | 2 sprints | MG-001 to MG-008 |
| Phase 5: AI Worker Integration | 1 sprint | Kimik2/Qwen prompts, validation |
| Phase 6: Infrastructure Improvements | 0.5 sprint | DP-001 to DP-004 (Dynamic Port) |
| Phase 7: Persistent Agent Workers | 2 sprints | PW-001 to PW-010 (Worker architecture) |

---

## 11. Dynamic Port Allocation

### Problem
When multiple instances of Kanvas run simultaneously (e.g., different projects), port conflicts occur on the default port 5173. Users see errors like "EADDRINUSE" and must manually stop other instances.

### Solution
Implement automatic port detection on app startup:

1. **Port Detection Flow**:
   ```
   1. Check if preferred port (5173) is available
   2. If busy, find next available port in range 5173-5183
   3. Log which port is being used
   4. Start dev server on available port
   ```

2. **Implementation**:
   - Use `detect-port` library for reliable port detection
   - Configure in `electron.vite.config.ts` with async config
   - Set `strictPort: false` for fallback capability

3. **User Experience**:
   - Silent for users - just works
   - Console log shows actual port being used
   - Multiple Kanvas instances can run simultaneously

### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| DP-001 | Auto-detect free port on startup | P0 |
| DP-002 | Use port range 5173-5183 | P0 |
| DP-003 | Log port usage to console | P1 |
| DP-004 | Handle port conflicts gracefully | P0 |

---

## 12. Persistent Agent Workers

### Problem
Currently, agents are tied to session lifecycle. When Kanvas is closed or sessions end, agents stop working. Users want agents to continue working in the background until explicitly stopped.

### Solution
Implement a worker-based architecture for agents:

### 12.1 Worker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     KANVAS DASHBOARD                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Worker 1  │  │   Worker 2  │  │   Worker 3  │         │
│  │   (Claude)  │  │   (Cursor)  │  │   (Aider)   │         │
│  │   Running   │  │   Paused    │  │   Running   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Worker Manager Service                  │   │
│  │  - Start/Stop/Pause workers                         │   │
│  │  - Monitor health (heartbeats)                      │   │
│  │  - Persist state across restarts                    │   │
│  │  - Queue tasks for workers                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Worker States

```typescript
type WorkerState =
  | 'initializing'  // Setting up worktree, environment
  | 'running'       // Actively processing tasks
  | 'paused'        // Temporarily suspended (user-initiated)
  | 'waiting'       // Idle, waiting for tasks
  | 'error'         // Encountered an error
  | 'stopped';      // Explicitly stopped by user
```

### 12.3 Worker Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Initialize  │────▶│   Running    │────▶│   Stopped    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │ ▲                    ▲
                           ▼ │                    │
                     ┌──────────────┐             │
                     │   Paused     │─────────────┘
                     └──────────────┘
```

### 12.4 Worker Features

| Feature | Description |
|---------|-------------|
| **Auto-start** | Workers can be configured to start on Kanvas launch |
| **Background execution** | Continue working even when Kanvas window is minimized |
| **Heartbeat monitoring** | Detect if worker process dies unexpectedly |
| **Task queue** | Queue multiple tasks for workers to process |
| **State persistence** | Survive Kanvas restarts |
| **Resource limits** | Configurable memory/CPU limits per worker |

### 12.5 Worker Control UI

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Workers                                    [+ New]     │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 🟢 Claude Worker (feature/auth)                       │   │
│ │ Status: Running | Commits: 12 | Last active: 2m ago   │   │
│ │ Task: Implementing login flow                         │   │
│ │                          [⏸ Pause] [⏹ Stop] [📋 Logs]  │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 🟡 Cursor Worker (feature/billing)                    │   │
│ │ Status: Paused | Commits: 5 | Last active: 1h ago     │   │
│ │ Task: API integration                                 │   │
│ │                         [▶ Resume] [⏹ Stop] [📋 Logs]  │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ ⚫ Aider Worker (feature/dashboard)                   │   │
│ │ Status: Stopped | Commits: 8 | Last active: 3h ago    │   │
│ │ Task: Dashboard redesign                              │   │
│ │                         [▶ Start] [🗑 Delete] [📋 Logs] │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| PW-001 | Workers run independently of sessions | P0 |
| PW-002 | Workers can be started/stopped/paused via UI | P0 |
| PW-003 | Workers persist state across Kanvas restarts | P0 |
| PW-004 | Workers support heartbeat monitoring | P1 |
| PW-005 | Workers can be configured to auto-start | P1 |
| PW-006 | Workers log all activity to terminal view | P0 |
| PW-007 | Workers support task queuing | P2 |
| PW-008 | Workers respect resource limits | P2 |
| PW-009 | UI shows worker status in dashboard | P0 |
| PW-010 | Workers can run multiple agents simultaneously | P1 |

### 12.6 Technical Implementation

```typescript
// electron/services/WorkerManagerService.ts
interface WorkerConfig {
  id: string;
  agentType: AgentType;
  repoPath: string;
  branchName: string;
  task: string;
  autoStart: boolean;
  maxMemoryMB?: number;
}

interface Worker {
  id: string;
  config: WorkerConfig;
  state: WorkerState;
  pid?: number;
  startedAt?: string;
  lastHeartbeat?: string;
  commitCount: number;
  currentTask?: string;
}

class WorkerManagerService {
  // Worker lifecycle
  createWorker(config: WorkerConfig): Promise<Worker>;
  startWorker(workerId: string): Promise<void>;
  stopWorker(workerId: string): Promise<void>;
  pauseWorker(workerId: string): Promise<void>;
  resumeWorker(workerId: string): Promise<void>;
  deleteWorker(workerId: string): Promise<void>;

  // Worker status
  getWorker(workerId: string): Worker | null;
  listWorkers(): Worker[];
  getWorkerLogs(workerId: string, limit?: number): LogEntry[];

  // Task management
  queueTask(workerId: string, task: string): Promise<void>;
  getTaskQueue(workerId: string): string[];

  // Health monitoring
  checkHealth(): Promise<HealthReport>;
  handleDeadWorker(workerId: string): Promise<void>;
}
```

### 12.7 IPC Channels

```typescript
// New IPC channels for workers
export const IPC = {
  // ... existing channels

  // Worker management
  WORKER_CREATE: 'worker:create',
  WORKER_START: 'worker:start',
  WORKER_STOP: 'worker:stop',
  WORKER_PAUSE: 'worker:pause',
  WORKER_RESUME: 'worker:resume',
  WORKER_DELETE: 'worker:delete',
  WORKER_LIST: 'worker:list',
  WORKER_GET: 'worker:get',
  WORKER_LOGS: 'worker:logs',
  WORKER_QUEUE_TASK: 'worker:queue-task',

  // Worker events (main → renderer)
  WORKER_STATE_CHANGED: 'worker:state-changed',
  WORKER_HEARTBEAT: 'worker:heartbeat',
  WORKER_ERROR: 'worker:error',
  WORKER_TASK_COMPLETED: 'worker:task-completed',
};
```

---

## Appendix A: Contract File Patterns

```typescript
const TEST_CONTRACT_PATTERNS = {
  playwright: [
    '**/*.spec.ts',
    '**/*.e2e.ts',
    '**/*.e2e.spec.ts',
    '**/e2e/**/*.ts',
    '**/playwright/**/*.ts',
  ],
  jest: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.tsx',
  ],
  vitest: [
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/vitest/**/*.ts',
  ],
  fixtures: [
    '**/fixtures/**/*.json',
    '**/fixtures/**/*.ts',
    '**/mocks/**/*.ts',
    '**/__mocks__/**/*.ts',
  ],
};
```

---

## Appendix B: Migration Prompt Template

```markdown
# Migration Task: Reorganize to Feature Folders

## Current Structure
{codebase_tree}

## Target Structure
src/features/{feature}/
  - index.ts (public exports)
  - api/ (routes, controllers)
  - services/ (business logic)
  - models/ (data models)
  - types/ (TypeScript types)
  - tests/ (e2e, unit, fixtures)

## Detected Features
{detected_features}

## Your Task
1. For each feature, identify all related files
2. Generate move commands preserving git history
3. Update ALL imports (both internal and cross-feature)
4. Create index.ts with public exports
5. Ensure no circular dependencies

## Output Format
{
  "features": [
    {
      "name": "auth",
      "moves": [
        {"from": "src/auth/login.ts", "to": "src/features/auth/services/login.service.ts"}
      ],
      "importUpdates": [
        {"file": "src/app.ts", "old": "from './auth/login'", "new": "from '@/features/auth'"}
      ],
      "newFiles": [
        {"path": "src/features/auth/index.ts", "content": "export * from './services/login.service';"}
      ]
    }
  ],
  "validation": ["npm test", "npm run typecheck"]
}
```
