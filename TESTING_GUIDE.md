# Testing Guide for DevOps Agent & Kora

This guide explains how to test the DevOps Agent and the new Kora Smart Assistant locally before publishing.

## 1. Quick Unit Tests

Run the unit test suite to verify Kora's logic (mocked):

```bash
npm test test_cases/smart-assistant/kora.test.js
```

## 2. Full System E2E Test (Automated)

We have a comprehensive E2E test script that simulates a user workflow in a temporary repository. It tests:
- Repo initialization
- House Rules setup (Structured/Flexible)
- Contract folder creation
- Session creation (Core functionality)
- Kora integration

Run it with:

```bash
./test_cases/integration/full_system_e2e.sh
```

**Note:** To test Kora's actual LLM responses, you need to export your API key first:
```bash
export GROQ_API_KEY="your-key"
./test_cases/integration/full_system_e2e.sh
```

## 3. Manual Testing in Another Repository

To test the agent in a "real" project on your machine without publishing to npm, use the local install helper.

### Step 1: Install Locally

```bash
# From DevOpsAgent root
./scripts/local-install.sh /path/to/your/target/repo
```

This will:
1. Pack the current source into a `.tgz` file
2. Install it globally (or linked) in the target repo context
3. You can then run `s9n-devops-agent` or `devops` in that repo.

### Step 2: Verify Kora

In your target repo:

```bash
# Start Kora
devops chat
# or
s9n-devops-agent chat
```

Try asking:
- "What are the house rules?"
- "List all contracts"
- "Start a session for fixing the login bug"

### Step 3: Verify Session Flow

```bash
# Start the interactive menu
devops
```
Select "0) 🤖 Kora" or "N) Create new session".

## 4. Debugging

- **Logs:** Check `local_deploy/logs/` in your target repo.
- **Session Data:** Check `local_deploy/session-locks/` and `local_deploy/sessions/`.
- **Kora Errors:** Kora prints errors to stdout. If it crashes, check for `GROQ_API_KEY`.

## 5. Clean Up

To remove the locally installed version and revert to the npm version:

```bash
npm uninstall -g s9n-devops-agent
npm install -g s9n-devops-agent@latest
```
