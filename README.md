# DevOps Agent - AI-Powered Git Workflow Automation

> Let AI assistants work safely on your codebase with automatic commits, branch management, and multi-agent conflict prevention.

[![npm version](https://badge.fury.io/js/s9n-devops-agent.svg)](https://www.npmjs.com/package/s9n-devops-agent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What It Does

🤖 **Works with Any AI Assistant** - Claude, Cursor, GitHub Copilot, Cline  
🔄 **Automatic Git Operations** - Watches changes, commits with proper messages, pushes automatically  
🛡️ **Multi-Agent Coordination** - Prevents multiple AIs from editing the same files simultaneously  
🌲 **Smart Branch Management** - Hierarchical structure: session → daily → weekly → main  
📋 **House Rules System** - Teaches AI agents your project conventions and testing requirements

## Quick Start (2 Minutes)

```bash
# Install
npm install -g s9n-devops-agent

# Learn (recommended for first-time users)
s9n-devops-agent tutorial

# Setup
s9n-devops-agent setup

# Start working
s9n-devops-agent start
```

## How It Works

**The Concept:** Give each AI assistant its own private workspace (called a "session")

1. **You start a session** → Creates isolated workspace (git worktree)
2. **AI assistant works there** → Following house rules you define
3. **DevOps Agent watches** → Auto-commits and pushes changes
4. **Session closes** → Merges to daily branch, then to main

### What's a Session?

Think of it like giving each AI assistant their own office:
- **Separate directory** with full git history
- **Own branch** auto-named based on task
- **File locks** prevent conflicts with other agents
- **Auto-monitoring** commits and pushes automatically

## Core Features

### 🔄 Auto-Commit System
**What:** Watches your workspace and commits changes automatically  
**Why:** AI can't run git commands, so we do it for them  
**How:** AI writes commit message to special file, agent reads and commits

### 🛡️ File Coordination
**What:** Prevents multiple AI agents from editing same files  
**Why:** Avoids merge conflicts when working with multiple agents  
**How:** Agents "declare" files before editing, system checks for conflicts

### 🌲 Branch Hierarchy
**What:** Organized structure: session/* → daily/* → weekly/* → main  
**Why:** Easy rollbacks, clear progress tracking, organized history  
**How:** Auto-merges happen at session close and nightly rollover

### 📋 House Rules
**What:** Instructions for AI assistants in `docs/houserules.md`  
**Why:** Consistent behavior across agents, follows your conventions  
**How:** Markdown file that AI reads first, auto-updated by agent

## Commands

```bash
# New User Commands
s9n-devops-agent tutorial          # Interactive learning (start here!)
s9n-devops-agent setup              # First-time configuration
s9n-devops-agent help-topics        # Browse comprehensive help

# Session Management
s9n-devops-agent start              # Create/resume session
s9n-devops-agent list               # Show all sessions
s9n-devops-agent close              # Close active session

# Advanced
s9n-devops-agent create --task api --agent claude  # Create specific session
s9n-devops-agent cleanup                           # Clean up stale sessions
```

## Common Workflows

### Single AI Agent
```bash
s9n-devops-agent start        # Create session
# Copy instructions to Claude/Cursor
# AI works, agent commits automatically
s9n-devops-agent close        # Merge and cleanup
```

### Multiple AI Agents (Parallel Work)
```bash
# Terminal 1: Claude on backend
s9n-devops-agent create --task api --agent claude

# Terminal 2: Cursor on frontend  
s9n-devops-agent create --task ui --agent cursor

# They work independently, no conflicts!
```

## What Makes It Special?

✅ **Zero Manual Git Commands** - AI can't run git, we handle it all  
✅ **Conflict-Free Multi-Agent** - File coordination prevents chaos  
✅ **Production-Ready** - Used in real projects with multiple developers  
✅ **Framework Agnostic** - Works with any codebase, any language  
✅ **Git Platform Agnostic** - GitHub, GitLab, Bitbucket, self-hosted

## Requirements

- Node.js 16.0.0 or higher
- Git repository
- Any AI assistant (Claude, Cursor, Copilot, Cline, etc.)

## Working with Husky and git hooks

DevOps Agent **never** bypasses your local git hooks:

- `git commit` is invoked without `--no-verify`, so Husky, commitlint, and lint-staged all run as usual.
- If a hook fails (lint, type-checks, Prisma rules, etc.), fix the reported issues (for example with `npm run validate` or your project’s documented commands) and then let DevOps Agent commit again.
- Do not disable hooks (e.g., `HUSKY=0`, `--no-verify`) for work that is intended to be merged; the design assumes hooks are part of your safety net, for both humans and AI agents.

## Documentation

📖 **Getting Started**
- [Interactive Tutorial](docs/V2_IMPLEMENTATION_GUIDE.md) - Learn by doing
- [Installation Guide](docs/INSTALLATION_GUIDE.md) - Detailed setup

📚 **Feature Guides**
- [Version Strategies](docs/version-strategies.md) - Daily version incrementing
- [File Coordination](docs/file-coordination-guide.md) - Multi-agent prevention
- [Multi-Agent Setup](docs/multi-agent-guide.md) - Working with multiple AIs
- [House Rules](docs/houserules-guide.md) - Teaching AI your conventions

🔧 **Advanced Topics**
- [Branch Management](docs/branch-management.md) - Hierarchical structure
- [Docker Integration](docs/V2_IMPLEMENTATION_GUIDE.md) - Auto-restart containers
- [Session Management](docs/SESSION_MANAGEMENT.md) - Advanced workflows

## Troubleshooting

**Session not found?**
```bash
s9n-devops-agent list --all    # Check closed sessions
```

**Agent not detecting changes?**
```bash
# Check commit message file exists and has content
ls -la .devops-commit-*.msg
# Enable debug mode
AC_DEBUG=true s9n-devops-agent start
```

**Need help?**
```bash
s9n-devops-agent help-topics   # Browse all help topics
s9n-devops-agent tutorial      # Re-run tutorial
```

## Configuration

Configure via environment variables or project settings:

```bash
# Branch naming
export AC_BRANCH_PREFIX="dev_initials_"

# Auto-push (default: true)
export AC_PUSH=true

# Debug logging
export AC_DEBUG=true

# Timezone for daily rollover
export AC_TZ="America/New_York"
```

See [Configuration Guide](docs/INSTALLATION_GUIDE.md#configuration-files) for details.

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- 💬 [Discussions](https://github.com/SecondBrainAICo/CS_DevOpsAgent/discussions)
- 📦 [npm Package](https://www.npmjs.com/package/s9n-devops-agent)
- 📖 [Documentation](https://github.com/SecondBrainAICo/CS_DevOpsAgent/wiki)

---

**Built with ❤️ by [SecondBrain Labs](https://secondbrain.ai)**

*Making AI-powered development safe, efficient, and conflict-free.*
