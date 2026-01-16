# Epics, Stories & Test Cases
## Test Contracts, Feature Organization & Persistent Workers

> **v1.1 Updates**: Added Epic 7 (Dynamic Port Allocation) and Epic 8 (Persistent Agent Workers)

---

# Epic 1: Test Contract Detection System

**Epic ID**: E-TC
**Goal**: Extend contract detection to recognize and track test files as first-class contracts
**Business Value**: Visibility into test coverage changes, breaking test detection, quality gates

---

## Story 1.1: Playwright Test Detection

**Story ID**: E-TC-S01
**Title**: As a developer, I want Playwright E2E tests detected as contracts so I can track test coverage changes

**Acceptance Criteria**:
- [ ] Detect files matching `*.spec.ts`, `*.e2e.ts`, `*.e2e.spec.ts`
- [ ] Detect files in `e2e/`, `playwright/`, `tests/e2e/` directories
- [ ] Extract test names from `test()` and `test.describe()` blocks
- [ ] Count assertions per test file
- [ ] Store detected tests in contract registry

**Technical Notes**:
- Use AST parsing (ts-morph) to extract test blocks
- Handle both `test('name', ...)` and `test.describe('suite', ...)` patterns

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-TC-S01-T01 | Detect basic Playwright spec | 1. Create `auth.e2e.spec.ts` with 3 tests<br>2. Run contract analysis | File detected, 3 tests counted |
| E-TC-S01-T02 | Detect nested test.describe | 1. Create spec with nested describes<br>2. Run analysis | All nested tests detected |
| E-TC-S01-T03 | Handle test.skip and test.only | 1. Create spec with skipped tests<br>2. Run analysis | Skipped tests marked appropriately |
| E-TC-S01-T04 | Detect in e2e/ subdirectory | 1. Create `tests/e2e/login.spec.ts`<br>2. Run analysis | File detected as E2E test |
| E-TC-S01-T05 | Ignore non-test .spec.ts | 1. Create `types.spec.ts` (TypeSpec file)<br>2. Run analysis | Not detected as test (no test() calls) |

---

## Story 1.2: Unit Test Detection

**Story ID**: E-TC-S02
**Title**: As a developer, I want Jest/Vitest unit tests detected as contracts

**Acceptance Criteria**:
- [ ] Detect files matching `*.test.ts`, `*.test.tsx`
- [ ] Detect files in `__tests__/` directories
- [ ] Extract test names from `it()`, `test()`, `describe()` blocks
- [ ] Differentiate between Jest and Vitest patterns
- [ ] Track test count per file

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-TC-S02-T01 | Detect Jest test file | 1. Create `auth.service.test.ts`<br>2. Run analysis | Detected as unit test |
| E-TC-S02-T02 | Detect __tests__ directory | 1. Create `__tests__/utils.ts`<br>2. Run analysis | Detected as unit test |
| E-TC-S02-T03 | Extract it() test names | 1. Create test with `it('should...')`<br>2. Run analysis | Test names extracted |
| E-TC-S02-T04 | Handle nested describe blocks | 1. Create deeply nested test structure<br>2. Run analysis | All tests at all levels counted |
| E-TC-S02-T05 | Detect .test.tsx React tests | 1. Create `Button.test.tsx`<br>2. Run analysis | Detected as unit test |

---

## Story 1.3: Test Fixture Detection

**Story ID**: E-TC-S03
**Title**: As a developer, I want test fixtures tracked as contract dependencies

**Acceptance Criteria**:
- [ ] Detect JSON fixtures in `fixtures/`, `__fixtures__/` directories
- [ ] Detect mock files in `mocks/`, `__mocks__/` directories
- [ ] Link fixtures to tests that import them
- [ ] Track fixture changes as potential breaking changes

**Story Points**: 3

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-TC-S03-T01 | Detect JSON fixtures | 1. Create `fixtures/users.json`<br>2. Run analysis | Detected as fixture |
| E-TC-S03-T02 | Detect mock modules | 1. Create `__mocks__/api.ts`<br>2. Run analysis | Detected as mock |
| E-TC-S03-T03 | Link fixture to test | 1. Create test importing fixture<br>2. Run analysis | Dependency relationship tracked |
| E-TC-S03-T04 | Flag modified fixture | 1. Modify fixture JSON<br>2. Commit<br>3. Run analysis | Change flagged in dependent tests |

---

## Story 1.4: Breaking Test Change Detection

**Story ID**: E-TC-S04
**Title**: As a team lead, I want to be alerted when tests are removed or significantly modified

**Acceptance Criteria**:
- [ ] Detect removed test files as breaking changes
- [ ] Detect removed individual tests within a file
- [ ] Detect renamed tests (remove + add)
- [ ] Detect modified assertions (heuristic-based)
- [ ] Emit breaking change events to UI

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-TC-S04-T01 | Detect removed test file | 1. Delete `auth.test.ts`<br>2. Commit<br>3. Run analysis | Breaking change: file removed |
| E-TC-S04-T02 | Detect removed test case | 1. Remove one `test()` from file<br>2. Commit<br>3. Run analysis | Breaking change: test removed |
| E-TC-S04-T03 | Detect renamed test | 1. Rename test name string<br>2. Commit<br>3. Run analysis | Detected as rename (not break) |
| E-TC-S04-T04 | Detect assertion change | 1. Change `expect().toBe()` value<br>2. Commit<br>3. Run analysis | Warning: assertion modified |
| E-TC-S04-T05 | No false positive for additions | 1. Add new test<br>2. Commit<br>3. Run analysis | No breaking change flagged |

---

# Epic 2: Contract JSON Registry

**Epic ID**: E-CR
**Goal**: Structured JSON storage for contracts at repo and feature levels
**Business Value**: Persistent tracking, historical analysis, cross-session visibility

---

## Story 2.1: Repository Contract Registry

**Story ID**: E-CR-S01
**Title**: As a repo owner, I want a central JSON file tracking all contracts

**Acceptance Criteria**:
- [ ] Create `.S9N_KIT_DevOpsAgent/contracts/repo-contracts.json` on init
- [ ] Include summary metrics (total features, tests, coverage)
- [ ] Reference per-feature contract files
- [ ] Update automatically on each commit analysis
- [ ] Include last 30 days of breaking changes

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-CR-S01-T01 | Initialize registry | 1. Run `initializeRegistry()`<br>2. Check filesystem | `repo-contracts.json` created |
| E-CR-S01-T02 | Valid JSON schema | 1. Generate registry<br>2. Validate against schema | Schema validates |
| E-CR-S01-T03 | Update on commit | 1. Make commit with contract change<br>2. Run analysis | Registry updated |
| E-CR-S01-T04 | Track breaking changes | 1. Remove a test<br>2. Commit<br>3. Check registry | Breaking change in history |
| E-CR-S01-T05 | Prune old history | 1. Add 40 days of changes<br>2. Check registry | Only last 30 days kept |

---

## Story 2.2: Feature Contract Files

**Story ID**: E-CR-S02
**Title**: As a developer, I want per-feature contract files for granular tracking

**Acceptance Criteria**:
- [ ] Create `features/{name}.contracts.json` per detected feature
- [ ] Include API, E2E, unit test contracts
- [ ] Track dependencies between features
- [ ] Include coverage metrics per feature
- [ ] Support manual feature definition override

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-CR-S02-T01 | Create feature file | 1. Detect feature "auth"<br>2. Check filesystem | `auth.contracts.json` created |
| E-CR-S02-T02 | Include all contract types | 1. Add API, E2E, unit test to feature<br>2. Run analysis | All three types in JSON |
| E-CR-S02-T03 | Track dependencies | 1. Feature imports from "shared"<br>2. Run analysis | Dependency listed |
| E-CR-S02-T04 | Calculate coverage | 1. Add tests<br>2. Run analysis | Coverage score calculated |
| E-CR-S02-T05 | Manual override | 1. Create `.contracts.override.json`<br>2. Run analysis | Override applied |

---

## Story 2.3: Contract Registry Service

**Story ID**: E-CR-S03
**Title**: As a developer, I want a service to read/write contract registry

**Acceptance Criteria**:
- [ ] `initializeRegistry(repoPath)` - create structure
- [ ] `updateFeatureContracts(feature, contracts)` - update feature file
- [ ] `getRepoSummary()` - return summary metrics
- [ ] `getFeatureContracts(feature)` - return feature contracts
- [ ] Handle concurrent updates safely

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-CR-S03-T01 | Initialize empty repo | 1. Call `initializeRegistry()`<br>2. Check result | Registry created, success returned |
| E-CR-S03-T02 | Update feature | 1. Call `updateFeatureContracts('auth', [...])` | Feature file updated |
| E-CR-S03-T03 | Get summary | 1. Populate registry<br>2. Call `getRepoSummary()` | Correct summary returned |
| E-CR-S03-T04 | Concurrent updates | 1. Call update from 2 processes<br>2. Check file | No data corruption |
| E-CR-S03-T05 | Handle missing feature | 1. Call `getFeatureContracts('nonexistent')` | Null/empty returned gracefully |

---

# Epic 3: House Rules & First-Run Setup

**Epic ID**: E-HR
**Goal**: Configure coding agents to use feature-based folders with guided setup
**Business Value**: Consistent codebase organization, reduced cognitive load, better collaboration

---

## Story 3.1: Update House Rules Template

**Story ID**: E-HR-S01
**Title**: As a repo owner, I want house rules that enforce feature-based organization

**Acceptance Criteria**:
- [ ] Add "Feature-Based Folders" section to template
- [ ] Define folder structure requirements
- [ ] Include naming conventions
- [ ] Require tests in feature folder
- [ ] Define shared/ usage guidelines

**Story Points**: 2

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-HR-S01-T01 | Template includes section | 1. Init new repo<br>2. Check houserules.md | Feature folder section present |
| E-HR-S01-T02 | Structure documented | 1. Read template | Folder structure clearly defined |
| E-HR-S01-T03 | Conventions listed | 1. Read template | Naming conventions documented |

---

## Story 3.2: First-Run Detection

**Story ID**: E-HR-S02
**Title**: As a user, I want to be prompted on first agent run in a repo

**Acceptance Criteria**:
- [ ] Detect if repo has been setup before (check config)
- [ ] Show setup dialog only on first run
- [ ] Allow skip with "don't ask again" option
- [ ] Store setup status in `.S9N_KIT_DevOpsAgent/config.json`

**Story Points**: 3

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-HR-S02-T01 | Show on first run | 1. Create new session in fresh repo | Setup dialog shown |
| E-HR-S02-T02 | Don't show after setup | 1. Complete setup<br>2. Create new session | No dialog shown |
| E-HR-S02-T03 | Skip with don't ask | 1. Click "Skip, don't ask again" | Config saved, no future prompt |
| E-HR-S02-T04 | Show again if config missing | 1. Delete config.json<br>2. Create session | Dialog shown again |

---

## Story 3.3: Setup Dialog UI

**Story ID**: E-HR-S03
**Title**: As a user, I want a clear dialog to choose organization preference

**Acceptance Criteria**:
- [ ] Three options: Enable feature folders, Keep current, Migrate existing
- [ ] "Recommended" badge on feature folders option
- [ ] Preview of what will change
- [ ] Skip/Apply buttons
- [ ] Responsive design

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-HR-S03-T01 | All options visible | 1. Open dialog | Three radio options shown |
| E-HR-S03-T02 | Recommended badge | 1. Open dialog | Feature folders marked recommended |
| E-HR-S03-T03 | Skip button works | 1. Click "Skip for now" | Dialog closes, no config change |
| E-HR-S03-T04 | Apply saves choice | 1. Select option<br>2. Click Apply | Config saved with choice |
| E-HR-S03-T05 | Preview for migrate | 1. Select "Migrate existing" | Preview section appears |

---

## Story 3.4: Settings Override

**Story ID**: E-HR-S04
**Title**: As a user, I want to change organization preference later

**Acceptance Criteria**:
- [ ] Add "Code Organization" section in Settings
- [ ] Show current preference
- [ ] Allow changing preference
- [ ] Warn if changing from feature-based to flat

**Story Points**: 3

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-HR-S04-T01 | Section in settings | 1. Open Settings | Code Organization section visible |
| E-HR-S04-T02 | Shows current pref | 1. Set to feature-based<br>2. Open Settings | "Feature-based" shown as current |
| E-HR-S04-T03 | Change preference | 1. Change setting<br>2. Save | Config updated |
| E-HR-S04-T04 | Warning on downgrade | 1. Change from feature to flat | Warning dialog shown |

---

# Epic 4: Migration System

**Epic ID**: E-MG
**Goal**: Automated migration of existing codebases to feature-based folders
**Business Value**: Adoption path for legacy repos, reduced manual refactoring

---

## Story 4.1: Structure Analysis

**Story ID**: E-MG-S01
**Title**: As a user, I want the system to analyze my current code structure

**Acceptance Criteria**:
- [ ] Scan all source files
- [ ] Identify potential feature boundaries
- [ ] Use imports/exports to group related files
- [ ] Use naming patterns to suggest features
- [ ] Generate analysis report

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S01-T01 | Scan all files | 1. Run analysis on repo | All .ts/.tsx files scanned |
| E-MG-S01-T02 | Detect feature by name | 1. Files named `auth*.ts`<br>2. Run analysis | "auth" feature suggested |
| E-MG-S01-T03 | Detect by imports | 1. Files importing each other<br>2. Run analysis | Grouped into same feature |
| E-MG-S01-T04 | Handle shared code | 1. Utils imported everywhere<br>2. Run analysis | Marked as "shared", not feature |
| E-MG-S01-T05 | Generate report | 1. Run analysis | JSON report with features |

---

## Story 4.2: Migration Plan Generation

**Story ID**: E-MG-S02
**Title**: As a user, I want a detailed migration plan before execution

**Acceptance Criteria**:
- [ ] Generate list of file moves
- [ ] Generate import update list
- [ ] Generate new index.ts files
- [ ] Estimate time/effort
- [ ] Output as JSON for review

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S02-T01 | Generate file moves | 1. Run plan generation | List of from/to paths |
| E-MG-S02-T02 | Generate import updates | 1. Run plan generation | List of import changes |
| E-MG-S02-T03 | Generate index.ts | 1. Run plan generation | Content for index files |
| E-MG-S02-T04 | Estimate time | 1. Run plan generation | Time estimate provided |
| E-MG-S02-T05 | Valid JSON output | 1. Run plan generation<br>2. Parse JSON | Valid JSON, matches schema |

---

## Story 4.3: Preview Mode

**Story ID**: E-MG-S03
**Title**: As a user, I want to preview migration changes before applying

**Acceptance Criteria**:
- [ ] Dry-run mode that makes no changes
- [ ] Show diff of import updates
- [ ] Show file tree before/after
- [ ] Highlight potential issues
- [ ] Export preview as HTML report

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S03-T01 | No filesystem changes | 1. Run preview<br>2. Check filesystem | No files moved |
| E-MG-S03-T02 | Show import diff | 1. Run preview | Import changes displayed |
| E-MG-S03-T03 | Show tree comparison | 1. Run preview | Before/after tree shown |
| E-MG-S03-T04 | Flag issues | 1. Preview with circular import<br>2. Check report | Issue highlighted |
| E-MG-S03-T05 | Export HTML | 1. Run preview<br>2. Export | HTML file generated |

---

## Story 4.4: Migration Execution

**Story ID**: E-MG-S04
**Title**: As a user, I want to execute migration with atomic commits

**Acceptance Criteria**:
- [ ] Execute plan with progress tracking
- [ ] One commit per feature migration
- [ ] Update all imports correctly
- [ ] Create index.ts files
- [ ] Handle errors gracefully with partial rollback

**Story Points**: 13

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S04-T01 | Execute successfully | 1. Run migration on valid plan | All files moved, imports updated |
| E-MG-S04-T02 | Atomic commits | 1. Run migration<br>2. Check git log | One commit per feature |
| E-MG-S04-T03 | Imports updated | 1. Run migration<br>2. Check imports | All imports point to new paths |
| E-MG-S04-T04 | Index files created | 1. Run migration<br>2. Check features/ | index.ts in each feature |
| E-MG-S04-T05 | Partial rollback | 1. Inject error mid-migration<br>2. Check state | Completed features kept, failed rolled back |

---

## Story 4.5: Migration Validation

**Story ID**: E-MG-S05
**Title**: As a user, I want automated validation that migration succeeded

**Acceptance Criteria**:
- [ ] Run TypeScript type check after migration
- [ ] Run test suite after migration
- [ ] Check for broken imports
- [ ] Report validation results
- [ ] Auto-rollback if validation fails (optional)

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S05-T01 | TypeScript check | 1. Complete migration<br>2. Run tsc | Type check passes |
| E-MG-S05-T02 | Tests pass | 1. Complete migration<br>2. Run tests | All tests pass |
| E-MG-S05-T03 | Report broken imports | 1. Inject broken import<br>2. Validate | Broken import reported |
| E-MG-S05-T04 | Auto-rollback | 1. Enable auto-rollback<br>2. Fail validation | Changes rolled back |
| E-MG-S05-T05 | Success report | 1. Successful migration<br>2. Check report | All green, summary shown |

---

## Story 4.6: Rollback System

**Story ID**: E-MG-S06
**Title**: As a user, I want to rollback a failed migration

**Acceptance Criteria**:
- [ ] Track migration start commit
- [ ] Provide one-click rollback
- [ ] Git reset to pre-migration state
- [ ] Clean up any partial changes
- [ ] Preserve migration log for debugging

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-MG-S06-T01 | Track start commit | 1. Start migration | Start commit hash saved |
| E-MG-S06-T02 | One-click rollback | 1. Click rollback button | Reset to start commit |
| E-MG-S06-T03 | Clean partial changes | 1. Fail mid-migration<br>2. Rollback | No orphaned files |
| E-MG-S06-T04 | Preserve logs | 1. Rollback | Migration log still available |
| E-MG-S06-T05 | Multiple rollback attempts | 1. Rollback<br>2. Retry migration<br>3. Rollback again | Works correctly |

---

# Epic 5: AI Worker Integration

**Epic ID**: E-AI
**Goal**: Use AI models (Kimik2/Qwen) for intelligent migration
**Business Value**: Smarter feature detection, better migration quality, handles edge cases

---

## Story 5.1: Migration Prompt Engineering

**Story ID**: E-AI-S01
**Title**: As a developer, I want robust prompts for AI-powered migration

**Acceptance Criteria**:
- [ ] System prompt defines migration rules
- [ ] Context includes full codebase tree
- [ ] Output schema enforced (JSON)
- [ ] Handle large codebases with chunking
- [ ] Include validation instructions

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-AI-S01-T01 | Valid JSON output | 1. Send prompt to AI<br>2. Parse response | Valid JSON returned |
| E-AI-S01-T02 | Correct schema | 1. Get AI response<br>2. Validate schema | Matches expected schema |
| E-AI-S01-T03 | Handle large repo | 1. Send 1000+ file repo<br>2. Check response | Response generated (chunked) |
| E-AI-S01-T04 | Preserve imports | 1. Get migration plan<br>2. Check imports | All imports accounted for |
| E-AI-S01-T05 | No hallucinated files | 1. Get migration plan<br>2. Check file paths | All files exist in repo |

---

## Story 5.2: Kimik2/Qwen Integration

**Story ID**: E-AI-S02
**Title**: As a user, I want to use Kimik2 or Qwen for migration

**Acceptance Criteria**:
- [ ] Support Kimik2 API integration
- [ ] Support Qwen API integration
- [ ] Model selection in migration dialog
- [ ] Handle API errors gracefully
- [ ] Show token usage estimate

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-AI-S02-T01 | Kimik2 integration | 1. Select Kimik2<br>2. Run migration | API called, response processed |
| E-AI-S02-T02 | Qwen integration | 1. Select Qwen<br>2. Run migration | API called, response processed |
| E-AI-S02-T03 | Model selection | 1. Open migration dialog | Model dropdown available |
| E-AI-S02-T04 | API error handling | 1. Simulate API error | Graceful error message |
| E-AI-S02-T05 | Token estimate | 1. Preview migration | Token count shown |

---

## Story 5.3: Prompt-Based Migration (Coding Agent)

**Story ID**: E-AI-S03
**Title**: As a user, I want to generate migration instructions for my coding agent

**Acceptance Criteria**:
- [ ] Generate step-by-step migration instructions
- [ ] Format for Claude/GPT coding agents
- [ ] Include all file moves and import updates
- [ ] Copy-to-clipboard support
- [ ] Track completion via file markers

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-AI-S03-T01 | Generate instructions | 1. Select "Generate prompt"<br>2. Click generate | Instructions generated |
| E-AI-S03-T02 | Correct format | 1. Generate instructions | Follows markdown format |
| E-AI-S03-T03 | Copy to clipboard | 1. Generate<br>2. Click copy | Copied to clipboard |
| E-AI-S03-T04 | Complete instructions | 1. Generate<br>2. Review | All moves/imports included |
| E-AI-S03-T05 | Track completion | 1. Agent completes migration<br>2. Check markers | Completion detected |

---

# Epic 6: Enhanced UI

**Epic ID**: E-UI
**Goal**: Update Kanvas UI to show test contracts and migration options
**Business Value**: Visual feedback, actionable insights, smooth workflows

---

## Story 6.1: Contracts Tab - Test Contracts View

**Story ID**: E-UI-S01
**Title**: As a user, I want to see test contracts alongside API contracts

**Acceptance Criteria**:
- [ ] Show E2E tests section
- [ ] Show unit tests section
- [ ] Show fixtures section
- [ ] Group by feature
- [ ] Show test count per file

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-UI-S01-T01 | E2E section visible | 1. Open Contracts tab | E2E section shown |
| E-UI-S01-T02 | Unit tests visible | 1. Open Contracts tab | Unit tests section shown |
| E-UI-S01-T03 | Group by feature | 1. Open Contracts tab | Contracts grouped under features |
| E-UI-S01-T04 | Test count shown | 1. Open Contracts tab | Count next to each file |
| E-UI-S01-T05 | Empty state | 1. Repo with no tests<br>2. Open Contracts tab | "No tests detected" message |

---

## Story 6.2: Contracts Tab - Breaking Changes Alert

**Story ID**: E-UI-S02
**Title**: As a user, I want to see breaking test changes prominently

**Acceptance Criteria**:
- [ ] Alert banner for breaking changes
- [ ] List of specific breaking changes
- [ ] Link to affected files
- [ ] Dismiss/acknowledge button
- [ ] History of recent breaking changes

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-UI-S02-T01 | Alert banner | 1. Remove test<br>2. Open Contracts tab | Alert banner shown |
| E-UI-S02-T02 | List changes | 1. Multiple breaking changes<br>2. Check alert | All changes listed |
| E-UI-S02-T03 | File links | 1. Click file in alert | Navigates to file |
| E-UI-S02-T04 | Dismiss works | 1. Click dismiss | Alert hidden |
| E-UI-S02-T05 | History view | 1. Click "View history" | Past 30 days shown |

---

## Story 6.3: Migration Dialog

**Story ID**: E-UI-S03
**Title**: As a user, I want a polished migration dialog

**Acceptance Criteria**:
- [ ] Analysis results display
- [ ] Feature list with file counts
- [ ] Migration method selection
- [ ] Preview panel
- [ ] Progress indicator during execution

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-UI-S03-T01 | Analysis display | 1. Open migration dialog | Analysis results shown |
| E-UI-S03-T02 | Feature list | 1. Open dialog | Features with counts listed |
| E-UI-S03-T03 | Method selection | 1. Open dialog | Three method options |
| E-UI-S03-T04 | Preview panel | 1. Click "Preview Changes" | Preview panel opens |
| E-UI-S03-T05 | Progress indicator | 1. Start migration | Progress bar/spinner shown |

---

## Story 6.4: Coverage Dashboard

**Story ID**: E-UI-S04
**Title**: As a team lead, I want a coverage dashboard per feature

**Acceptance Criteria**:
- [ ] Coverage percentage per feature
- [ ] Visual indicator (progress bar/badge)
- [ ] Trend over time (sparkline)
- [ ] Filter by coverage threshold
- [ ] Export coverage report

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-UI-S04-T01 | Coverage shown | 1. Open Contracts tab | Coverage % per feature |
| E-UI-S04-T02 | Visual indicator | 1. View feature | Progress bar shown |
| E-UI-S04-T03 | Trend sparkline | 1. View feature | Trend line visible |
| E-UI-S04-T04 | Filter by threshold | 1. Set filter to 80%<br>2. Apply | Only <80% shown |
| E-UI-S04-T05 | Export report | 1. Click export | Report downloaded |

---

# Epic 7: Dynamic Port Allocation

**Epic ID**: E-DP
**Goal**: Automatically find available port on startup to avoid conflicts
**Business Value**: Multiple Kanvas instances can run simultaneously, no manual port management

---

## Story 7.1: Port Detection on Startup

**Story ID**: E-DP-S01
**Title**: As a user, I want Kanvas to automatically find a free port so I can run multiple instances

**Acceptance Criteria**:
- [ ] Check if preferred port (5173) is available on startup
- [ ] If busy, automatically find next available port in range 5173-5183
- [ ] Log which port is being used to console
- [ ] App starts successfully regardless of port conflicts

**Technical Notes**:
- Use `detect-port` library
- Configure via async electron.vite.config.ts
- Set `strictPort: false` for fallback

**Story Points**: 3

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-DP-S01-T01 | Use preferred port | 1. No other Kanvas running<br>2. Start Kanvas | Uses port 5173 |
| E-DP-S01-T02 | Find alternate port | 1. Block port 5173<br>2. Start Kanvas | Uses 5174 or next free |
| E-DP-S01-T03 | Log port usage | 1. Start Kanvas<br>2. Check console | Port logged to console |
| E-DP-S01-T04 | Multiple instances | 1. Start Kanvas A<br>2. Start Kanvas B | Both run on different ports |

---

## Story 7.2: Port Range Configuration

**Story ID**: E-DP-S02
**Title**: As a developer, I want to configure the port range for Kanvas

**Acceptance Criteria**:
- [ ] Environment variable to set preferred port (KANVAS_PORT)
- [ ] Environment variable to set port range (KANVAS_PORT_RANGE)
- [ ] Fallback to defaults if not set

**Story Points**: 2

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-DP-S02-T01 | Custom preferred port | 1. Set KANVAS_PORT=6000<br>2. Start Kanvas | Uses port 6000 |
| E-DP-S02-T02 | Custom port range | 1. Set KANVAS_PORT_RANGE=5200-5210<br>2. Block 5173<br>3. Start | Uses port in custom range |
| E-DP-S02-T03 | Default fallback | 1. No env vars<br>2. Start Kanvas | Uses default 5173 range |

---

# Epic 8: Persistent Agent Workers

**Epic ID**: E-PW
**Goal**: Agents run as persistent background workers until explicitly stopped
**Business Value**: Continuous autonomous development, survive app restarts, multiple agents simultaneously

---

## Story 8.1: Worker Manager Service

**Story ID**: E-PW-S01
**Title**: As a developer, I want a service to manage persistent agent workers

**Acceptance Criteria**:
- [ ] Create WorkerManagerService in electron/services
- [ ] Support creating, starting, stopping, pausing workers
- [ ] Persist worker state in electron-store
- [ ] Handle worker process spawning and monitoring
- [ ] Clean up dead workers

**Technical Notes**:
- Use electron-store for state persistence
- Spawn worker processes using Node child_process
- Implement heartbeat ping/pong

**Story Points**: 13

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S01-T01 | Create worker | 1. Call createWorker(config) | Worker created with pending state |
| E-PW-S01-T02 | Start worker | 1. Create worker<br>2. Call startWorker(id) | Worker process spawned, state=running |
| E-PW-S01-T03 | Stop worker | 1. Start worker<br>2. Call stopWorker(id) | Process killed, state=stopped |
| E-PW-S01-T04 | Pause worker | 1. Start worker<br>2. Call pauseWorker(id) | Process paused, state=paused |
| E-PW-S01-T05 | Resume worker | 1. Pause worker<br>2. Call resumeWorker(id) | Process resumed, state=running |
| E-PW-S01-T06 | State persistence | 1. Create workers<br>2. Restart Kanvas | Workers restored from store |
| E-PW-S01-T07 | Dead worker detection | 1. Start worker<br>2. Kill process externally | Worker marked as error |

---

## Story 8.2: Worker IPC Channels

**Story ID**: E-PW-S02
**Title**: As a developer, I want IPC channels for worker management

**Acceptance Criteria**:
- [ ] Add worker:* channels to ipc-channels.ts
- [ ] Implement handlers in ipc/index.ts
- [ ] Add preload API for renderer access
- [ ] Support worker events (state changes, heartbeats, errors)

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S02-T01 | List workers | 1. Create workers<br>2. Call worker:list | All workers returned |
| E-PW-S02-T02 | Get worker | 1. Create worker<br>2. Call worker:get | Worker details returned |
| E-PW-S02-T03 | State change event | 1. Start worker | worker:state-changed emitted |
| E-PW-S02-T04 | Heartbeat event | 1. Start worker<br>2. Wait for heartbeat | worker:heartbeat emitted |
| E-PW-S02-T05 | Error event | 1. Start worker<br>2. Inject error | worker:error emitted |

---

## Story 8.3: Worker Dashboard UI

**Story ID**: E-PW-S03
**Title**: As a user, I want to see and control workers from the dashboard

**Acceptance Criteria**:
- [ ] Workers section in dashboard (or as a tab)
- [ ] Show worker cards with status, commits, last activity
- [ ] Start/Stop/Pause/Resume buttons per worker
- [ ] Delete worker with confirmation
- [ ] Create new worker button opens wizard

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S03-T01 | Workers section visible | 1. Open dashboard | Workers section shown |
| E-PW-S03-T02 | Worker card display | 1. Create worker<br>2. Open dashboard | Worker card with details |
| E-PW-S03-T03 | Start button | 1. Click Start on stopped worker | Worker starts, button changes to Stop |
| E-PW-S03-T04 | Stop button | 1. Click Stop on running worker | Worker stops, confirmation shown |
| E-PW-S03-T05 | Pause button | 1. Click Pause on running worker | Worker pauses, Resume button shown |
| E-PW-S03-T06 | Delete button | 1. Click Delete | Confirmation dialog, then deleted |
| E-PW-S03-T07 | Create button | 1. Click "+ New Worker" | Wizard opens |
| E-PW-S03-T08 | Real-time updates | 1. Start worker from another source | Dashboard updates automatically |

---

## Story 8.4: Worker Logs View

**Story ID**: E-PW-S04
**Title**: As a user, I want to see logs for each worker

**Acceptance Criteria**:
- [ ] Logs button on worker card opens log viewer
- [ ] Show timestamped log entries
- [ ] Support filtering by log level
- [ ] Auto-scroll to latest
- [ ] Clear logs button

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S04-T01 | Open logs | 1. Click Logs button | Log viewer opens |
| E-PW-S04-T02 | Show entries | 1. Start worker<br>2. Open logs | Log entries displayed |
| E-PW-S04-T03 | Filter by level | 1. Select "Error" filter | Only error logs shown |
| E-PW-S04-T04 | Auto-scroll | 1. Open logs<br>2. Wait for new entries | View scrolls to latest |
| E-PW-S04-T05 | Clear logs | 1. Click Clear | Logs cleared with confirmation |

---

## Story 8.5: Worker Auto-Start Configuration

**Story ID**: E-PW-S05
**Title**: As a user, I want workers to optionally auto-start when Kanvas opens

**Acceptance Criteria**:
- [ ] Auto-start toggle per worker
- [ ] Global auto-start setting in preferences
- [ ] Workers start in order of creation
- [ ] Handle startup errors gracefully

**Story Points**: 3

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S05-T01 | Enable auto-start | 1. Create worker with autoStart=true<br>2. Restart Kanvas | Worker starts automatically |
| E-PW-S05-T02 | Disable auto-start | 1. Create worker with autoStart=false<br>2. Restart Kanvas | Worker remains stopped |
| E-PW-S05-T03 | Global setting | 1. Disable global auto-start<br>2. Restart Kanvas | No workers auto-start |
| E-PW-S05-T04 | Startup error | 1. Configure invalid worker<br>2. Restart Kanvas | Error shown, others continue |

---

## Story 8.6: Worker Heartbeat Monitoring

**Story ID**: E-PW-S06
**Title**: As a user, I want workers to be monitored for health

**Acceptance Criteria**:
- [ ] Workers send heartbeat every 30 seconds
- [ ] Manager detects missed heartbeats (3 consecutive = dead)
- [ ] Dead workers marked as error state
- [ ] Option to auto-restart dead workers
- [ ] Visual indicator of last heartbeat in UI

**Story Points**: 5

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S06-T01 | Send heartbeat | 1. Start worker<br>2. Wait 30s | Heartbeat received |
| E-PW-S06-T02 | Detect dead worker | 1. Start worker<br>2. Kill process | Worker marked as error after 90s |
| E-PW-S06-T03 | Auto-restart | 1. Enable auto-restart<br>2. Kill worker | Worker automatically restarts |
| E-PW-S06-T04 | UI indicator | 1. Open dashboard | Last heartbeat time shown |

---

## Story 8.7: Worker Task Queue

**Story ID**: E-PW-S07
**Title**: As a user, I want to queue multiple tasks for a worker

**Acceptance Criteria**:
- [ ] Queue tasks while worker is busy
- [ ] Show queue length in UI
- [ ] Process tasks in FIFO order
- [ ] Allow reordering queue
- [ ] Allow removing tasks from queue

**Story Points**: 8

### Test Cases

| TC ID | Description | Steps | Expected Result |
|-------|-------------|-------|-----------------|
| E-PW-S07-T01 | Queue task | 1. Worker running task<br>2. Add new task | Task added to queue |
| E-PW-S07-T02 | Show queue | 1. Add 3 tasks to queue<br>2. Check UI | Queue shows 3 pending |
| E-PW-S07-T03 | FIFO processing | 1. Queue A, B, C<br>2. Complete A | B starts next |
| E-PW-S07-T04 | Reorder queue | 1. Queue A, B<br>2. Move B before A | B processes before A |
| E-PW-S07-T05 | Remove from queue | 1. Queue task<br>2. Click remove | Task removed |

---

# Summary

## Epic Overview

| Epic | Stories | Total Points | Priority |
|------|---------|--------------|----------|
| E-TC: Test Contract Detection | 4 | 21 | P0 |
| E-CR: Contract JSON Registry | 3 | 15 | P0 |
| E-HR: House Rules & First-Run | 4 | 13 | P1 |
| E-MG: Migration System | 6 | 44 | P1 |
| E-AI: AI Worker Integration | 3 | 18 | P2 |
| E-UI: Enhanced UI | 4 | 26 | P1 |
| E-DP: Dynamic Port Allocation | 2 | 5 | P0 |
| E-PW: Persistent Agent Workers | 7 | 47 | P0 |

**Total**: 33 stories, 189 story points

## Recommended Sprint Plan

| Sprint | Epics | Points | Goal |
|--------|-------|--------|------|
| Sprint 1 | E-DP (all), E-TC (all), E-CR (S01-S02) | 36 | Port fix + Test detection + basic registry |
| Sprint 2 | E-CR (S03), E-HR (all), E-UI (S01-S02) | 28 | First-run UX + contracts UI |
| Sprint 3 | E-MG (S01-S03) | 21 | Migration analysis + preview |
| Sprint 4 | E-MG (S04-S06) | 23 | Migration execution + rollback |
| Sprint 5 | E-AI (all), E-UI (S03-S04) | 34 | AI integration + dashboard |
| Sprint 6 | E-PW (S01-S03) | 26 | Worker service + IPC + basic UI |
| Sprint 7 | E-PW (S04-S07) | 21 | Worker logs, auto-start, health, queue |

---

## Test Case Summary

| Epic | Test Cases |
|------|------------|
| E-TC | 19 |
| E-CR | 15 |
| E-HR | 14 |
| E-MG | 25 |
| E-AI | 15 |
| E-UI | 20 |
| E-DP | 7 |
| E-PW | 34 |
| **Total** | **149** |
