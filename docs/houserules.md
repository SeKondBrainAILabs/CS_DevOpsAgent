# Claude House Rules for CS_DevOpsAgent

> **NOTE:** The canonical houserules are now in the project root: `houserules.md` (v2.0.0, 2026-02-14).
> This file is kept for backwards compatibility but the root `houserules.md` is the authoritative source.

## 🚨 CRITICAL: File Coordination Protocol (MUST FOLLOW)

**IMPORTANT: Always check the house rules at the beginning of each session!**

To prevent conflicts with other agents editing the same files, you MUST follow this protocol:

### Before Editing ANY Files:

1. **DECLARE YOUR INTENT FIRST**
   Create a file at `.file-coordination/active-edits/<your-name>-<session>.json` with:
   ```json
   {
     "agent": "<your-name>",
     "session": "<session-id>",
     "files": ["list", "of", "files", "you", "will", "edit"],
     "operation": "edit",
     "reason": "Brief description of what you're doing",
     "declaredAt": "<current-ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   ```

2. **CHECK FOR CONFLICTS**
   - Read ALL files in `.file-coordination/active-edits/`
   - If ANY other agent has declared the same files, you must:
     - WAIT for them to finish, OR
     - Choose different files to edit

3. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

4. **RELEASE WHEN DONE**
   - Delete your declaration file after completing edits
   - Or move it to `.file-coordination/completed-edits/`

### If You Detect a Conflict:
- DO NOT proceed with edits
- Report the conflict to the user
- Wait or choose alternative files

### Helper Scripts Available:
- `./scripts/coordination/check-file-availability.sh <files>` - Check if files are available
- `./scripts/coordination/declare-file-edits.sh <agent> <session> <files>` - Declare your intent
- `./scripts/coordination/release-file-edits.sh <agent> <session>` - Release files after editing

**This coordination prevents wasted work and merge conflicts!**

---


## Testing Policy (Required)

### Test-Driven Development (TDD) Requirements

**CRITICAL: For ALL new features and copied code (except infrastructure):**
1. **WRITE THE TEST FIRST** - Before implementing any new functionality
2. **RED-GREEN-REFACTOR** cycle:
   - RED: Write a failing test that defines expected behavior
   - GREEN: Write minimal code to make the test pass
   - REFACTOR: Improve the code while keeping tests green

### When Tests Are MANDATORY:
- **New Features**: Test MUST be written BEFORE implementation code
- **Copied/Adapted Code**: Test MUST verify the adaptation works correctly
- **Bug Fixes**: Test MUST reproduce the bug first (fail), then pass after fix
- **API Changes**: Test MUST cover new endpoints/methods
- **Business Logic**: Test MUST validate all logic paths

### When Tests Are OPTIONAL:
- **Pure Infrastructure Code**: Build scripts, deployment configs
- **Configuration Files**: Unless they contain logic
- **Documentation**: README files, comments
- **Generated Code**: Auto-generated files (but test the generator!)

Goal: Every bug fix and feature ships with an executable test.

Location: test_cases/<area>/<component>/.

DoD: (1) failing test defines behavior (red), (2) implementation makes it pass (green), (3) tests wired into CI and local runner.

Naming: YYYYMMDD_<short-slug>_spec.(py|ts|js|go|rb|java)

Non-duplication: Extend existing tests for the same functionality.

Determinism: No flaky/random tests; use seeds and fake timers.

## Test Generation Rules (for Claude / code assistants)

**ALWAYS write the test BEFORE the implementation code.**

Infer <area>/<component> from changed paths.

Stub external services; avoid real I/O unless explicitly needed.

Use native runners per language (pytest, vitest/jest, go test, rspec, JUnit).

Add short "why it failed before the fix" note in the test.

## TDD Workflow for New Features

### Step 1: Write the Test First
Before writing ANY implementation code:
1. Create test file in `test_cases/<area>/<component>/`
2. Define expected behavior through test assertions
3. Run test to ensure it FAILS (Red phase)
4. Commit the failing test with message: `test: add failing test for <feature>`

### Step 2: Implement Minimal Code
1. Write ONLY enough code to make the test pass
2. Don't add extra features or optimizations yet
3. Run test to ensure it PASSES (Green phase)
4. Commit implementation with message: `feat: implement <feature> to pass test`

### Step 3: Refactor (if needed)
1. Improve code quality, performance, or structure
2. Ensure tests still pass after each change
3. Commit refactoring with message: `refactor: improve <aspect> of <feature>`

### Example TDD Flow for Agents:
```bash
# 1. First, declare your intent to edit test and implementation files
echo '{"files": ["test_cases/session/coordinator/test_new_feature.js", "src/new_feature.js"]}' > .file-coordination/active-edits/claude-session.json

# 2. Write the test FIRST
# Create: test_cases/session/coordinator/20241003_new_feature_spec.js

# 3. Run test to verify it fails
npm test test_cases/session/coordinator/20241003_new_feature_spec.js

# 4. NOW write the implementation
# Create/modify: src/new_feature.js

# 5. Run test to verify it passes
npm test test_cases/session/coordinator/20241003_new_feature_spec.js

# 6. Release your file locks
rm .file-coordination/active-edits/claude-session.json
```

## Test Case Template
```
# Test Case: <human title>
- Area: <e.g., worktree>
- Component: <e.g., manager>
- Related Issue/PR: <#id or link>
- Repro Summary: <steps/inputs>
- Expected Behavior: <should happen>
- Regression Guard: <what breaks if it fails again>
```

<code block with the actual test file content>

## Partial Test Execution (Targeted Runs)

By default, local runs and CI only execute tests for changed areas (files in the PR/branch).

Areas are inferred from changed file paths and mapped to test_cases/<area>/<component> directories.

If we can't infer a mapping, we fallback to full suite.

You can override the scope:

scripts/run-tests --all → full suite

scripts/run-tests --changed → only changed areas (default)

scripts/run-tests test_cases/<area>/<component> → specific folder

## Logging Policy

All test scripts log with UTC timestamps, levels (INFO/WARN/ERROR/DEBUG), and grouping for CI.

Set LOG_LEVEL to debug|info|warn|error (default info).

Enable deep tracing with TRACE=1 (verbose commands, environment, and selection decisions).

## Auto-Run on Bugfix Workflow

If the current branch name or latest commit message contains fix: or bug:, targeted tests for the affected areas run first; if they pass, we run the rest of that language's suite.

CI blocks merge if: tests fail or a bugfix PR lacks an associated test.

## Code Style Guidelines for CS_DevOpsAgent

### Comment Style
- Use descriptive header comments for major sections
- Include purpose and key features at the top of files
- Document complex logic inline
- Keep comments concise but informative

### Module Structure
- Group related functionality together
- Use clear section separators
- Export modules properly for reuse
- Maintain consistent naming conventions

### Error Handling
- Always handle errors gracefully
- Log errors with appropriate levels
- Provide useful error messages
- Clean up resources on failure

### Worktree Management Specifics
- Always check if running in CS_DevOpsAgent repo itself
- Detect agent from environment variables
- Create isolated worktrees per agent
- Maintain agent configuration files
- Handle branch naming consistently

## Usage Examples

Run only changed areas (default):
```bash
scripts/run-tests --changed
```

Force full suite:
```bash
scripts/run-tests --all
```

Force a folder (e.g., during triage):
```bash
scripts/run-tests test_cases/worktree/manager
```

Increase logs:
```bash
LOG_LEVEL=debug scripts/run-tests --changed
TRACE=1 scripts/run-tests --changed
```

## Infrastructure Documentation Policy (NEW)

### Purpose
Track all infrastructure changes in a centralized location for team visibility and compliance.

### Location
`/Documentation/infrastructure.md` - Created automatically if it doesn't exist.

### What to Document
- **Configuration Changes**: Environment variables, settings files, config updates
- **Dependency Updates**: New packages, version changes, removals
- **Build System Changes**: Scripts, build configs, CI/CD updates
- **Architecture Changes**: New services, components, integrations
- **Database Changes**: Schema updates, migrations, indexes
- **API Changes**: Endpoints, authentication, rate limits
- **Security Changes**: Auth updates, certificates, permissions

### Format
```markdown
## [Date] - [Agent/Developer Name]
### Category: [Config|Dependencies|Build|Architecture|Database|API|Security]
**Change Type**: [Added|Modified|Removed|Fixed]
**Component**: [Affected component/service]
**Description**: Brief description of the change
**Reason**: Why this change was necessary
**Impact**: Potential impacts or considerations
**Files Changed**: 
- file1.js
- config/settings.json
```

### Auto-Detection Rules
1. Monitor for changes in:
   - `package.json`, `package-lock.json`
   - `.env`, `.env.*` files
   - `*config*.js`, `*config*.json`
   - `Dockerfile`, `docker-compose.yml`
   - `.github/workflows/*`
   - Database migration files
   - API route definitions

2. Auto-generate entry when detected
3. Include in commit message: `infra:` prefix when infrastructure changes detected

### Commit Message Enhancement
When infrastructure changes are detected:
```
infra(category): description

- Updated /Documentation/infrastructure.md
- [List of infrastructure changes]
```

Example:
```
infra(deps): add worktree management dependencies

- Updated /Documentation/infrastructure.md
- Added chokidar@3.5.3 for file watching
- Added execa@6.1.0 for process management
- Modified package.json scripts
```

## Environment Variables for Worktree Management

- `AGENT_NAME` or `AI_AGENT`: Identifies the AI agent
- `AGENT_TASK` or `AI_TASK`: Task or feature being worked on
- `AC_USE_WORKTREE`: Enable/disable worktree creation (true/false/auto)
- `AC_MSG_FILE`: Path to agent-specific commit message file
- `AC_BRANCH_PREFIX`: Prefix for agent branches
- `AC_TRACK_INFRA`: Enable infrastructure tracking (default: true)
- `AC_INFRA_DOC_PATH`: Path to infrastructure doc (default: /Documentation/infrastructure.md)

---

## Prep TODO & Coordination (Multi-Agent Handshake)

**Purpose:** Prevent agents from stepping on each other by publishing an _edit plan_ before changing files. The commit agent reads these plans, reserves shards (coarse path buckets), and either **acknowledges** or **blocks** the work.

### Agent Workflow

**Agents MUST write** a single JSON at `.ac-prep/<agent>.json` **before** edits and wait for `.ac/ack/<agent>.json`.

### Prep JSON Format
```json
{
  "agent": "<agent-id>",
  "task": "<short-slug>",
  "branch": "<target-branch>",
  "paths": ["<glob1>", "<glob2>"],
  "shards": ["<shard1>", "<shard2>"],
  "reason": "<why>",
  "priority": 1-10,
  "createdAt": "<ISO-8601>",
  "ttlMs": 600000
}
```

### Flow

1. **Write prep file** → `.ac-prep/<agent>.json`
2. **Wait for acknowledgment** → `.ac/ack/<agent>.json`
3. **Check status**:
   - `status:"ok"` → proceed only within acknowledged paths/shards
   - `status:"blocked"` → do not edit; narrow scope or wait; re-publish
   - `status:"queued"` → wait for turn based on priority
4. **After edits** → write `.claude-commit-msg` (Conventional Commit + 1–3 bullets)
5. **If alert appears** → `.git/.ac/alerts/<agent>.md` → re-run with narrower scope

### Shard System

Shards live in `.ac-shards.json`. The commit agent:
- **Reserves shards** on prep, acks or blocks
- **At commit**, claims shards and stages only owned files
- **Overlapping work** is blocked/queued/branched per config
- **Writes human alerts** to `.git/.ac/alerts/<agent>.md` when overlap occurs

### Priority Levels
- `10`: Critical hotfix
- `7-9`: High priority features
- `4-6`: Normal development
- `1-3`: Low priority/cleanup

### Conflict Resolution Strategy
```
AC_SHARD_STRATEGY options:
- "block": Prevent overlapping edits (default)
- "branch": Create agent-specific branches
- "queue": Queue based on priority and timestamp
```

### Agent Identification
Agents are identified by:
- Environment variable: `AGENT_NAME` or `AI_AGENT`
- Auto-detection from API keys (Claude, Copilot, Cursor, etc.)
- Session-based: `session-${USER}@${HOSTNAME}`

### Monitoring
Check coordination status:
```bash
ls -la .ac-prep/      # Pending prep requests
ls -la .ac/ack/       # Acknowledgments
ls -la .git/.ac/alerts/  # Conflict alerts
cat .git/.ac/claims/*.json  # Active claims
```

