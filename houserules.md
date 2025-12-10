# House Rules for DevOps Agent

## 🚨 CRITICAL: File Coordination Protocol (MUST FOLLOW)

**To prevent conflicts with other agents editing the same files, you MUST follow this protocol:**

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
     - **STOP IMMEDIATELY** - DO NOT proceed with any edits
     - **ASK THE USER** for explicit permission before editing those files
     - Inform the user which agent has declared the files and for what purpose
     - WAIT for the other agent to finish, OR
     - Choose different files to edit
   - **CRITICAL**: Never edit files another agent has declared without explicit user confirmation

3. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

4. **HOLD LOCKS FOR ENTIRE SESSION**
   - Keep your declaration active for the ENTIRE session
   - DO NOT release locks after committing - keep them until session closes
   - Locks protect files from other agents until your changes are merged
   
5. **RELEASE ONLY WHEN SESSION CLOSES**
   - Delete your declaration file ONLY when:
     - Session is being closed/merged, OR
     - Worktree is being removed
   - Move it to `.file-coordination/completed-edits/` during session closure
   - **CRITICAL**: Never release locks while session is still active!

### If You Detect a Conflict:
- **STOP IMMEDIATELY** - DO NOT proceed with any edits
- **ASK THE USER** for explicit permission before editing conflicting files
- Report the conflict to the user with details:
  - Which files are in conflict
  - Which agent has declared them
  - What that agent is working on (from their declaration)
- Wait for user decision: override, wait, or choose alternative files
- **NEVER edit conflicting files without explicit user approval**

### Example Workflow:
```bash
# 1. Check if files are available (no other agent editing them)
# 2. Create your declaration in .file-coordination/active-edits/
# 3. Make your edits
# 4. Write commit message to the session-specific file
# 5. Continue working (locks stay active!)
# 6. When session closes: merge changes THEN remove declaration
```

### Why Locks Must Stay Active:
- **Problem**: If you release locks after committing, another agent can declare and edit the same files
- **Result**: Both sessions will conflict when merging
- **Solution**: Hold locks until session is merged and worktree removed
- **Benefit**: Prevents duplicate work and merge conflicts

**This coordination prevents wasted work and merge conflicts!**

---

## Architecture Decision Records (ADRs)

**We treat architectural decisions as code.** 
Any "Architecturally Significant" change MUST be documented in an ADR.

**What is Architecturally Significant?**
- Adding a new persistence layer (e.g., adding Redis)
- Changing the multi-agent coordination protocol
- Adding a new major component or service
- Changing the testing strategy
- Introducing the Contract System itself

**Workflow:**
1.  **Create:** Create a new file in `adr/` named `XXXX-title-of-decision.md` (e.g., `0002-switch-to-postgres.md`).
2.  **Format:** Use the standard ADR template (Context, Decision, Consequences).
3.  **Review:** Submit as part of your PR.

## 🚨 CRITICAL: Contract System (MUST FOLLOW)

**ADDED: 2024-12-02**

**To prevent duplicate features, conflicting changes, and wasted work, ALL coding agents MUST follow the Contract System.**

### What is the Contract System?

The Contract System is a **single source of truth** for all project components. Before making ANY changes to:
- Database schema
- SQL queries
- API endpoints
- Third-party integrations
- Features
- Infrastructure/environment variables

**You MUST check the relevant contract file first.**

### Contract Files Location

**All contract files are stored in:** `House_Rules_Contracts/`

| Contract File | Purpose | Check Before... |
|---------------|---------|----------------|
| `DATABASE_SCHEMA_CONTRACT.md` | Database tables, columns, indexes, migrations | Creating/modifying database schema |
| `SQL_CONTRACT.json` | Reusable SQL queries with parameters | Writing any SQL query |
| `API_CONTRACT.md` | All API endpoints and specifications | Creating/modifying API endpoints |
| `THIRD_PARTY_INTEGRATIONS.md` | External service integrations | Integrating third-party services |
| `FEATURES_CONTRACT.md` | All features and specifications | Implementing any feature |
| `INFRA_CONTRACT.md` | Environment variables and infrastructure | Adding configuration/env vars |

### 🚨 MANDATORY Workflow for ALL Coding Agents

**BEFORE making ANY changes, you MUST:**

```
1. IDENTIFY what you're about to change:
   - Database? → Read DATABASE_SCHEMA_CONTRACT.md
   - SQL query? → Read SQL_CONTRACT.json
   - API endpoint? → Read API_CONTRACT.md
   - Third-party service? → Read THIRD_PARTY_INTEGRATIONS.md
   - Feature? → Read FEATURES_CONTRACT.md
   - Config/env var? → Read INFRA_CONTRACT.md

2. SEARCH the contract for existing implementation:
   - Does this table/query/endpoint/feature already exist?
   - Can I reuse existing code instead of creating new?
   - Will my change conflict with existing code?

3. DECIDE based on what you found:
   
   IF existing implementation found:
   ✅ REUSE it - Add your module to "Used By" section
   ✅ EXTEND it - If it needs enhancement
   ❌ DO NOT duplicate it
   ❌ DO NOT create a new version
   
   IF no existing implementation:
   ✅ CREATE new following contract template
   ✅ DOCUMENT thoroughly in contract
   ✅ CROSS-REFERENCE other contracts
   ✅ UPDATE version number and changelog

4. AFTER making changes:
   ✅ UPDATE the relevant contract file immediately
   ✅ ADD changelog entry with date
   ✅ INCREMENT version number
   ✅ CROSS-REFERENCE related contracts
```

### Why This Prevents Chaos

**Without contracts, multiple agents will:**
❌ Create duplicate features with different names  
❌ Create duplicate API endpoints for same functionality  
❌ Create duplicate SQL queries doing the same thing  
❌ Integrate the same third-party service multiple times  
❌ Create conflicting database schema changes  
❌ Create duplicate environment variables  
❌ Overwrite each other's code  
❌ Break existing functionality unknowingly  

**With contracts, agents will:**
✅ Discover existing functionality before building  
✅ Reuse existing code instead of duplicating  
✅ Know exactly what exists and how to use it  
✅ Avoid conflicts and breaking changes  
✅ Coordinate changes across the codebase  
✅ Maintain consistency and quality  
✅ Save time by not rebuilding what exists  

### Contract Update Requirements

**Every contract update MUST include:**

1. **Date stamp:** When the change was made (YYYY-MM-DD)
2. **Version increment:** Following semver (1.0.0 → 1.0.1 or 1.1.0)
3. **Changelog entry:** What changed and why
4. **Impact assessment:** Breaking change? Which modules affected?
5. **Cross-references:** Links to related contracts

**Example changelog entry:**
```markdown
| Date | Version | Agent/Author | Changes | Impact |
|------|---------|--------------|---------|--------|
| 2024-12-02 | 1.1.0 | Coding Agent Alpha | Added user_preferences table | Non-breaking, new feature |
```

### Cross-Referencing Contracts

**Contracts are interconnected. Always check related contracts:**

- **DATABASE_SCHEMA_CONTRACT.md** ↔️ **SQL_CONTRACT.json**  
  (Tables ↔️ Queries that use them)

- **SQL_CONTRACT.json** ↔️ **API_CONTRACT.md**  
  (Queries ↔️ Endpoints that call them)

- **API_CONTRACT.md** ↔️ **FEATURES_CONTRACT.md**  
  (Endpoints ↔️ Features that use them)

- **THIRD_PARTY_INTEGRATIONS.md** ↔️ **INFRA_CONTRACT.md**  
  (Services ↔️ API keys/config)

- **FEATURES_CONTRACT.md** ↔️ **ALL CONTRACTS**  
  (Features use everything)

**When updating one contract, check if related contracts need updates too.**

### Initial Contract Population

**If contracts are empty/incomplete, the DevOps Agent can generate them:**

See the "Initial Population Instructions" section in each contract file for:
- Search patterns to find existing code
- File locations to check
- How to extract and document information
- Automated script approaches

**DevOps Agent can execute coding agent scripts to:**
1. Scan the entire codebase
2. Identify all features, APIs, database tables, etc.
3. Generate contract files automatically
4. Iteratively improve contracts

### Enforcement & Quality Gates

**1. Automated Validation (Coming Soon)**
We are moving towards "Executable Specifications". Soon, build scripts will validate that contracts match the codebase.
*   **Drift Check:** `npm run validate-contracts` will fail if code and contracts diverge.
*   **Pre-commit Hook:** Will prevent commits that violate contracts.

**2. TDD is Paramount**
**Contracts do NOT replace Test-Driven Development (TDD).**
*   **Tests** are the executable specification of *behavior*.
*   **Contracts** are the executable specification of *architecture/schema*.
*   **Rule:** You must write tests AND update contracts. One does not substitute for the other.

**3. Manual Rejection (Temporary)**
Until automation is fully in place, the user should reject your changes if you:
- Create a feature without checking FEATURES_CONTRACT.md first
- Write SQL without checking SQL_CONTRACT.json first
- Create an API endpoint without checking API_CONTRACT.md first
- Integrate a service without checking THIRD_PARTY_INTEGRATIONS.md first
- Modify database without checking DATABASE_SCHEMA_CONTRACT.md first
- Add env vars without checking INFRA_CONTRACT.md first

**You are violating house rules and creating technical debt.**

**The user should reject your changes and require you to:**
1. Read the relevant contract(s)
2. Check for existing implementation
3. Reuse or properly document your changes
4. Update contracts appropriately

### Quick Reference

**Before you code, ask yourself:**

- 📋 "Does this feature already exist?" → Check `FEATURES_CONTRACT.md`
- 🔌 "Does this API endpoint already exist?" → Check `API_CONTRACT.md`
- 🗄️ "Does this database table already exist?" → Check `DATABASE_SCHEMA_CONTRACT.md`
- 📝 "Does this SQL query already exist?" → Check `SQL_CONTRACT.json`
- 🌐 "Is this service already integrated?" → Check `THIRD_PARTY_INTEGRATIONS.md`
- ⚙️ "Does this env variable already exist?" → Check `INFRA_CONTRACT.md`

**If the answer is YES → REUSE IT**  
**If the answer is NO → CREATE IT and DOCUMENT IT**

---

## Project Structure
**Current Directory Layout:**
```
DevOpsAgent/
├── src/                    # All source code
├── test_cases/            # All test files
├── test_scripts/          # Test execution scripts
├── docs/                  # Documentation
├── deploy_test/           # Deployment test scripts
├── local_deploy/          # Local-only files (gitignored) - ALL DEBUG/TEMP FILES GO HERE
└── product_requirement_docs/  # PRDs
```

### Important: Local-Only Files Policy

**ALL temporary, debug, and local-only files MUST be placed in `local_deploy/` folder**

This folder is gitignored and will never be uploaded to the repository. Use it for:
- Debug logs and output files
- Temporary test data
- Local configuration overrides
- Session logs and traces
- Performance profiling results
- Any files containing sensitive data
- Migration scripts for local use only
- Backup files before major changes
- **WORKTREES FOR DEVOPS AGENT'S OWN DEVELOPMENT**
- **SESSION DATA WHEN DOGFOODING THE AGENT**
- **ALL LOCKS AND COORDINATION FILES**

### Development vs Production Usage

**When developing DevOpsAgent itself (dogfooding):**
- All worktrees go in: `local_deploy/worktrees/`
- All session locks go in: `local_deploy/session-locks/`
- All instructions go in: `local_deploy/instructions/`
- All session data go in: `local_deploy/sessions/`
- This keeps the main repo clean while we develop

**When DevOpsAgent is used on OTHER projects (production):**
- It will create `.worktrees/` in the target project
- It will create `.session-locks/` in the target project
- Those folders should be added to the target project's .gitignore

**Examples:**
```bash
# Good - files in local_deploy/ won't be committed
local_deploy/debug.log
local_deploy/session-traces/
local_deploy/temp-test-data.json
local_deploy/performance-profile.txt
local_deploy/migration-backup/

# Bad - these would be tracked by git
./debug.log
./temp-data.json
./test-output.txt
```

## Commit Policy

### 1. Single Commit Message File (`.claude-commit-msg`)

**Location**: Project root `.claude-commit-msg`  
**Action**: WRITE to this file (the DevOps agent will process it)  
**Format**:
```
type(scope): subject line describing the change (max 72 characters)

[WHY - 2 lines explaining the motivation/reason for these changes]
This change was needed because [specific problem or requirement].
[Additional context about why this approach was chosen].

[WHAT - Each item identifies files changed and what was done]
- File(s): path/to/file1.js, file2.js - Specific change made to these files
- File(s): src/module.js - Behavioral change or feature added
- File(s): docs/README.md, config.json - Related updates or side effects
```

**Commit Types (REQUIRED - MUST use one of these)**:
- `feat:` - New feature or capability added
- `fix:` - Bug fix or error correction
- `refactor:` - Code restructuring without changing functionality
- `docs:` - Documentation updates (README, comments, PRDs)
- `test:` - Adding or modifying tests
- `chore:` - Maintenance tasks (configs, dependencies, cleanup)
- `style:` - Code formatting, no functional changes

**CRITICAL**: All commit messages MUST start with one of these prefixes followed by a colon.
The DevOps agent will reject commits that don't follow this format.

**Rules**:
- Always start with WHY (2 lines): Explain the problem/need that motivated these changes
- For each WHAT item: List the specific files changed, then describe what was done
- Format: "File(s): path/to/file.ext, other.ext - Description of changes"
- Group related file changes together in one bullet point
- Be specific about WHAT changed and WHERE (exact file paths)
- Describe the IMPACT of the change, not just what was done
- Never include bash commands or command-line syntax
- Never attempt to run git commands directly
- Keep the subject line under 72 characters
- Use present tense ("add" not "added", "fix" not "fixed")

**Example Commit Message**:
```
fix(worktree): resolve push-behind error in multi-agent scenarios

The DevOps agent was failing when multiple agents pushed to the same branch simultaneously.
This fix adds retry logic with pull-merge to handle the common "behind remote" scenario.

- File(s): src/cs-devops-agent-worker.js - Add retry logic with git pull --no-rebase on push failures
- File(s): src/utils.js, src/git-helpers.js - Extract common git operations into reusable helper functions  
- File(s): test_cases/worktree/20250929_push_behind_spec.js - Add test case for push-behind scenario
- File(s): docs/README.md - Document the new retry behavior and configuration options
```

### 2. Product Requirement Docs Updates

**When making code changes**: Also update relevant files in the `product_requirement_docs/` folder
- Keep PRDs in sync with implementation
- Document new features and their rationale
- Update affected system components

## Session Recovery and Context Persistence

### Crash Recovery System (temp_todo.md)

**Purpose**: Maintain session continuity across potential crashes or disconnections.

**Location**: `/temp_todo.md` (project root)

**When to Use**:
- Starting any multi-step task
- Before executing complex operations
- When debugging issues that may cause crashes
- Whenever working on tasks that modify multiple files

**Format**:
```markdown
# Current Session Context
Last Updated: YYYY-MM-DDTHH:MM:SSZ

## Task Overview
[Brief description of what the user asked for]

## Current Status
[What step we're on, what's completed, what's pending]

## Execution Plan
- [ ] Step 1: Description
- [x] Step 2: Description (completed)
- [ ] Step 3: Description (in progress)

## Relevant Context
- Key files being modified:
  - file1.js: [what changes]
  - file2.sh: [what changes]
- Important findings:
  - [Any discovered issues or insights]
- Dependencies/Requirements:
  - [Libraries, services needed]

## Current Working State
[Any variables, partial results, or important data to preserve]

## Next Steps
[What should happen next if session resumes]

## Error Log (if any)
[Any errors encountered and their resolution status]
```

**Recovery Process**:
When starting a new session:
1. Always check `temp_todo.md` first
2. If it contains data, ask user: "I found a previous session context. Should I continue where we left off?"
3. If continuing, resume from "Next Steps"
4. If not continuing, clear the file and start fresh

## Code Quality & Documentation Standards

### Module/File Headers
Every JavaScript file should start with a comprehensive header:
```javascript
/**
 * ============================================================================
 * MODULE NAME - Brief Description
 * ============================================================================
 * 
 * This module handles [main purpose]. It provides [key functionality].
 * 
 * Key Components:
 * - ComponentA: Does X
 * - ComponentB: Handles Y
 * 
 * Dependencies:
 * - External: library1, library2
 * - Internal: module.submodule
 * 
 * Usage Example:
 *   const { MainClass } = require('./this_module');
 *   const instance = new MainClass();
 *   const result = instance.process();
 * ============================================================================
 */
```

### Function/Method Comments
```javascript
/**
 * Execute a named operation with the provided input.
 * 
 * @param {string} operationName - Name of the operation to execute
 * @param {Object} input - Input data for the operation
 * @param {Object} [context={}] - Optional context for execution
 * @returns {Promise<Object>} Result object with status and output
 * @throws {Error} If operation fails or times out
 * 
 * @example
 * const result = await execute('process', { data: 'test' });
 * if (result.success) {
 *   console.log(result.output);
 * }
 */
```

### Inline Comments
```javascript
// Good inline comments explain WHY, not WHAT
const DEBOUNCE_MS = 3000;  // Longer delay for commit messages to ensure complete writes

// Document complex logic
if (retries > 0) {
  // Pull failed due to behind remote, retry with merge
  // This handles the common case where another agent pushed first
  execSync('git pull --no-rebase origin main');
}

// TODO/FIXME format
// TODO(username, 2025-09-29): Implement parallel worktree creation
// FIXME(username, 2025-09-29): Handle edge case when worktree already exists
```

## Testing Policy

### Core Testing Principles

**Location**: Put tests under `test_cases/<area>/<component>/`
- Example: `test_cases/cs-devops-agent/worker/`
- Example: `test_cases/worktree/manager/`

**Naming Convention**:
- Files: `YYYYMMDD_<short-slug>_spec.js`
- Example: `20250929_push_behind_spec.js`

**Test Structure**:
```javascript
/**
 * Test Case: <human title>
 * - Area: <domain area>
 * - Component: <component/module>
 * - Related Issue/PR: <#id or link>
 * - Repro Summary: <1-3 lines on steps/inputs>
 * - Expected Behavior: <what should happen>
 * - Regression Guard: <what would break if this fails again>
 */

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle specific scenario', () => {
    // Arrange - set up test data
    const testData = { /* ... */ };
    
    // Act - perform the action
    const result = performAction(testData);
    
    // Assert - verify the result
    expect(result).toBe(expected);
  });
});
```

### Test Execution Strategy

**Run specific area tests**:
```bash
# Working on cs-devops-agent-worker.js?
npm test test_cases/cs-devops-agent/worker/

# Working on worktree management?
npm test test_cases/worktree/

# Just fixed a specific bug?
npm test test_cases/worktree/manager/20250929_detection_spec.js
```

### Bug Fix Test Process (MANDATORY)

1. **Create failing test FIRST (Red phase)**
2. **Fix the bug (Green phase)**
3. **Run area tests (Verification)**
4. **Run full suite only before commit**

## Multi-Agent Coordination

### Session Management

**Starting a new session**:
```bash
# Interactive session starter (recommended)
npm start
# or
./start-devops-session.sh
```

This will:
1. Ask if you want to use an existing session or create new
2. Generate instructions for your coding agent
3. Start the DevOps agent monitoring the appropriate worktree

### Worktree Organization

**Branch Naming**:
- Agent branches: `agent/<agent-name>/<task-name>`
- Daily branches: `dev_sdd_YYYY-MM-DD`
- Session branches: `<agent>/<session-id>/<task>`

**Session Files**:
- `.devops-session.json` - Session configuration
- `.devops-commit-<session-id>.msg` - Session-specific commit message file
- `SESSION_README.md` - Session documentation

### Multiple Coding Agent Sessions

**Each session gets**:
- Unique session ID
- Dedicated worktree
- Own commit message file
- Isolated branch

**Coordination Files**:
- `.session-locks/` - Active session locks
- `.agent-sessions.json` - Session registry
- `.worktrees/` - Agent worktrees

## Environment Variables

### Core CS_DevOpsAgent Settings
```bash
AC_MSG_FILE=".claude-commit-msg"       # Commit message file
AC_BRANCH_PREFIX="dev_sdd_"           # Branch naming prefix
AC_PUSH=true                           # Auto-push after commit
AC_CLEAR_MSG_WHEN="push"              # When to clear message file
AC_MSG_DEBOUNCE_MS=3000               # Wait time after message change
```

### Session-Specific Variables
```bash
DEVOPS_SESSION_ID="abc-123"           # Current session ID
AGENT_NAME="claude"                    # Agent identifier
AGENT_WORKTREE="claude-abc-123-task"  # Worktree name
```

## File Paths and References

### Path Formatting Rules
- Use relative paths for files in same/sub/parent directories
- Use absolute paths for system files or files outside working tree
- Examples:
  - Same directory: `main.js`, `config.yaml`
  - Subdirectory: `src/worker.js`, `test_cases/unit/test.js`
  - Parent directory: `../package.json`, `../../Makefile`
  - Absolute: `/etc/hosts`, `/usr/local/bin/node`

### Code Block Formatting
```javascript path=/absolute/path/to/file.js start=10
// Real code from actual file
```

```javascript path=null start=null
// Example or hypothetical code
```

## Logging Policy

### Log File Location
**IMPORTANT: All log files MUST be written to `local_deploy/logs/` directory**

```javascript
const LOG_DIR = './local_deploy/logs';
const LOG_FILE = `${LOG_DIR}/devops-agent-${new Date().toISOString().split('T')[0]}.log`;

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
```

### Log Levels
```javascript
const log = (...args) => {
  const message = `[cs-devops-agent] ${args.join(' ')}`;
  console.log(message);
  // Also write to file in local_deploy
  appendToLogFile(message);
};

const dlog = (...args) => {
  if (DEBUG) {
    const message = `[debug] ${args.join(' ')}`;
    console.log(message);
    appendToLogFile(message);
  }
};

function appendToLogFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `${timestamp} ${message}\n`);
}
```

### What to Log
- Session creation/destruction
- Worktree operations
- Git operations (commits, pushes, pulls)
- Error conditions and recovery attempts
- Agent coordination events

### Log Rotation
- Keep logs in `local_deploy/logs/` organized by date
- Format: `devops-agent-YYYY-MM-DD.log`
- Never commit log files to git

### Security
**NEVER log**:
- API keys or tokens
- Full file contents (use hashes or excerpts)
- User credentials
- Sensitive configuration

## Common Workflows

### 1. Starting a New Development Session
```bash
npm start
# Select "N" for new session
# Enter task name
# Copy instructions to your coding agent
```

### 2. Handling Push-Behind Scenarios
The agent automatically:
1. Detects push failures
2. Pulls with --no-rebase to merge
3. Retries the push
4. Alerts on conflicts

### 3. Multiple Agent Coordination
```bash
# Terminal 1: Start agent for feature-auth
./start-devops-session.sh
# Creates session abc-123

# Terminal 2: Start agent for api-endpoints  
./start-devops-session.sh
# Creates session def-456

# Each coding agent works in their respective worktree
```

## Review Cadence

- Review this file quarterly
- Update when adding major features
- Keep in sync with actual implementation
- Document lessons learned from production issues

## Additional Development Guidelines

### Error Handling

**Always provide meaningful error messages:**
```javascript
// Bad
if (!file) throw new Error('Error');

// Good
if (!file) {
  throw new Error(`File not found: ${filePath}. Ensure the file exists and you have read permissions.`);
}
```

**Use try-catch appropriately:**
```javascript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Log the error with context
  console.error(`Failed to perform operation: ${error.message}`, {
    operation: 'riskyOperation',
    context: relevantContext
  });
  
  // Decide whether to recover or propagate
  if (canRecover(error)) {
    return fallbackValue;
  }
  throw error; // Re-throw if unrecoverable
}
```

### Code Organization

**Single Responsibility Principle:**
- Each function should do one thing well
- Each module should have a clear, focused purpose
- If a function is > 50 lines, consider breaking it down

**DRY (Don't Repeat Yourself):**
- Extract common logic into utility functions
- Use configuration objects for repeated patterns
- Create abstractions for repeated workflows

### Performance Considerations

**File System Operations:**
```javascript
// Use async operations for better performance
const fs = require('fs').promises;

// Good - non-blocking
const data = await fs.readFile(path, 'utf8');

// Avoid - blocking
const data = fs.readFileSync(path, 'utf8');
```

**Git Operations:**
- Batch operations when possible
- Use `--no-pager` for git commands to avoid hanging
- Implement retry logic for network-dependent operations

### Security Best Practices

**Input Validation:**
```javascript
// Always validate and sanitize inputs
function processPath(userPath) {
  // Prevent directory traversal
  if (userPath.includes('../') || userPath.includes('..\\')) {
    throw new Error('Invalid path: directory traversal detected');
  }
  
  // Ensure path is within allowed directory
  const resolvedPath = path.resolve(userPath);
  if (!resolvedPath.startsWith(ALLOWED_BASE_PATH)) {
    throw new Error('Path outside allowed directory');
  }
  
  return resolvedPath;
}
```

**Command Injection Prevention:**
```javascript
// Never concatenate user input into shell commands
// Bad
execSync(`git checkout ${userBranch}`);

// Good - use array arguments
execSync('git', ['checkout', userBranch]);
```

### Git Workflow Best Practices

**Commit Guidelines:**
- Make atomic commits (one logical change per commit)
- Write clear, descriptive commit messages
- Reference issues/PRs when applicable
- Avoid committing commented-out code

**Branch Management:**
- Keep branches focused on single features/fixes
- Regularly sync with main branch
- Clean up merged branches
- Use meaningful branch names

### Documentation Requirements

**README Updates:**
- Update README when adding new features
- Include usage examples for new functionality
- Document breaking changes prominently
- Keep installation instructions current

**API Documentation:**
- Document all public functions/methods
- Include parameter types and return values
- Provide usage examples
- Note any side effects or prerequisites

### Debugging Helpers

**Debug Mode:**
```javascript
// Use environment variable for debug output
const DEBUG = process.env.DEBUG === 'true';
const DEBUG_FILE = process.env.DEBUG_FILE || './local_deploy/debug.log';

function debugLog(...args) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const message = `[DEBUG] ${timestamp} ${args.join(' ')}`;
    console.log(message);
    
    // Also write to debug file in local_deploy
    if (DEBUG_FILE) {
      fs.appendFileSync(DEBUG_FILE, message + '\n');
    }
  }
}
```

**Debug Output Location:**
- All debug files MUST be written to `local_deploy/` directory
- Never write debug output to the project root or src directories
- Example: `local_deploy/debug-${Date.now()}.log`

**Performance Timing:**
```javascript
function timeOperation(name, fn) {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  console.log(`[PERF] ${name} took ${duration}ms`);
  return result;
}
```

### Dependency Management

**Package.json Best Practices:**
- Use exact versions for critical dependencies
- Document why each dependency is needed
- Regularly audit for security vulnerabilities
- Keep dependencies up to date

**Import Organization:**
```javascript
// Group imports logically
// 1. Node built-ins
import fs from 'fs';
import path from 'path';

// 2. External dependencies
import express from 'express';
import lodash from 'lodash';

// 3. Internal modules
import { config } from './config';
import { utils } from './utils';
```

### Code Review Checklist

Before committing, verify:
- [ ] Tests pass
- [ ] No console.log() left in production code
- [ ] Error handling is comprehensive
- [ ] Documentation is updated
- [ ] Code follows project style guide
- [ ] No sensitive data in code or comments
- [ ] Performance impact considered
- [ ] Security implications reviewed

### Communication with Users

**Progress Updates:**
- Provide clear status updates for long-running operations
- Use spinners or progress bars where appropriate
- Estimate completion time when possible

**Error Communication:**
- Explain what went wrong in user-friendly terms
- Suggest potential fixes or workarounds
- Provide links to documentation when relevant
- Include error codes for support reference
