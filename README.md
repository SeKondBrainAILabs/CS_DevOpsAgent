# DevOps Agent - AI-Powered Git Workflow Automation

> **Now with Kora 🤖 - Your Smart DevOps Assistant**

DevOps Agent acts as a bridge between human developers and AI coding assistants. It manages git operations, prevents multi-agent conflicts, ensures architectural compliance, and now talks to you to streamline your workflow.

[![npm version](https://badge.fury.io/js/s9n-devops-agent.svg)](https://www.npmjs.com/package/s9n-devops-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 New in v2.0: Smart Features

### 🤖 Meet Kora
Kora is a conversational AI assistant built into the DevOps Agent. She knows your project's **House Rules**, understands your **Architecture Contracts**, and can manage your development sessions.

- **Ask Questions:** "What are the rules for API endpoints?"
- **Start Work:** "Start a new session to fix the login bug."
- **Check Status:** "Are there any open sessions?"

### 📜 Contract Automation
Ensure your code matches your architecture. The agent now includes tools to:
- **Validate Compliance:** Checks if your code implements the defined contracts (API, DB, Features).
- **Auto-Generate Contracts:** Reverse-engineer documentation from existing code.
- **Test:** Run `npm run test:contracts` to verify compliance in CI/CD.

### 🧠 AI-Powered Commits
The agent analyzes your staged changes and generates semantic, conventional commit messages that adhere to your specific House Rules.

---

## 📦 Installation

### Stable Version
```bash
npm install -g s9n-devops-agent
```

### Development Version (Latest Features)
To access Kora and the latest smart features:
```bash
npm install -g s9n-devops-agent@dev
```

---

## ⚡ Quick Start

### 1. Setup
Run the setup wizard to configure your environment and API keys.
```bash
s9n-devops-agent setup
```
> **Note:** You will be prompted for a `GROQ_API_KEY` to enable Kora and AI features.

### 2. Talk to Kora
Start the conversational interface to manage your work.
```bash
s9n-devops-agent chat
```

### 3. Start a Session (Classic Mode)
If you prefer the CLI menu:
```bash
s9n-devops-agent start
```

---

## 🛠️ Core Features

### 🔄 Auto-Commit System
- **Watches** your workspace in real-time.
- **Commits** changes automatically when your AI assistant saves files.
- **Pushes** to the remote repository.

### 🛡️ Multi-Agent Coordination
- **File Locking:** Prevents multiple agents (or humans) from editing the same files simultaneously.
- **Worktrees:** Each session gets an isolated git worktree, keeping your main branch clean.

### 🌲 Smart Branch Management
- **Hierarchy:** `session/task` → `daily/date` → `main`.
- **Auto-Merge:** Sessions automatically merge into daily branches, which roll over to main.

### 📋 House Rules System
- **Context Injection:** AI agents read `docs/houserules.md` to understand your coding conventions.
- **Enforcement:** The agent checks commits against these rules.

---

## 📖 Usage Guide

### Using Kora (Chat)
```bash
$ s9n-devops-agent chat

🤖 Kora - Smart DevOps Assistant
Powered by Groq (llama-3.3-70b-versatile)
============================================================

Kora > Hi! I'm Kora. How can I help you today?

You > Start a session for user auth

Kora > Starting new session for: user-auth...
```

### Managing Sessions
```bash
# List all active sessions
s9n-devops-agent list

# Close the current session (merge and cleanup)
s9n-devops-agent close
```

### Contract Testing
Run these tests to ensure your code complies with `House_Rules_Contracts/`:
```bash
npm run test:contracts
```

---

## ⚙️ Configuration

The setup wizard (`s9n-devops-agent setup`) creates a `.env` file in your project root.

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | **Required** for Kora and AI commits. Get one at [console.groq.com](https://console.groq.com). |
| `AC_BRANCH_PREFIX` | Prefix for branch names (e.g., `dev_abc_`). |
| `AC_PUSH` | `true` to auto-push commits, `false` for local only. |
| `AC_DEBUG` | `true` for verbose logging. |

---

## 📚 Documentation
- [Installation Guide](docs/INSTALLATION_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)
- [House Rules Guide](docs/houserules-guide.md)
- [Contract Automation](scripts/contract-automation/README.md)

---

## Support
- 🐛 [Report Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- 📦 [npm Package](https://www.npmjs.com/package/s9n-devops-agent)

---
**Built with ❤️ by [SecondBrain Labs](https://secondbrain.ai)**
