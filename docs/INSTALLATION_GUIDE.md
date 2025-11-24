# Installation & Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
3. [Quick Start (One Command!)](#quick-start-one-command)
4. [House Rules System](#house-rules-system)
5. [Configuration Options](#configuration-options)
6. [CI/CD Setup](#cicd-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **Git**: Version 2.20.0 or higher (for worktree support)
- **Operating System**: macOS, Linux, or Windows with WSL
- **Terminal**: Any modern terminal (zsh, bash, fish)

## Installation Methods

### Method 1: NPM Package (Recommended)

```bash
# Global installation (recommended)
npm install -g s9n-devops-agent

# Or local installation
npm install --save-dev s9n-devops-agent
```

### Method 2: From Source

```bash
# Clone the repository
git clone https://github.com/SecondBrainAICo/CS_DevOpsAgent.git
cd CS_DevOpsAgent

# Install dependencies
npm install

# Link globally for CLI access
npm link
```

## Quick Start (One Command!)

### 🚀 The Simplest Setup Ever

```bash
# Just run this - it handles EVERYTHING!
npm start
```

**That's it!** On first run, `npm start` will:

1. ✅ **Check for house rules** - Create if missing, update if needed
2. ✅ **Set up file coordination** - Prevent AI agents from conflicting
3. ✅ **Configure your identity** - Set developer initials
4. ✅ **Set version strategy** - Configure how versions increment
5. ✅ **Start session manager** - Ready to create AI coding sessions

### What Happens on First Run?

```
$ npm start

═══════════════════════════════════════════════════════════
First-time Setup: House Rules & File Coordination
═══════════════════════════════════════════════════════════

House rules help AI agents understand your project conventions and
prevent conflicts when multiple agents work on the same codebase.

Would you like to:
  1) Create comprehensive house rules (recommended)
  2) Specify path to existing house rules
  3) Skip for now

Your choice [1]: 1
✓ Will create comprehensive house rules at: houserules.md

Setting up file coordination system...
✓ File coordination directories created
✓ Setup complete! AI agents will now follow house rules and coordinate file edits.
```

## House Rules System

### What Are House Rules?

House rules are project conventions that teach AI agents:
- How to write code in your style
- How to coordinate with other agents
- How to format commits
- How to handle documentation

### Automatic Management

The DevOps Agent uses an intelligent versioning system:

```markdown
<!-- DEVOPS_AGENT_SECTION:file-coordination:1.3.0:a5f2c891 -->
## 🚨 CRITICAL: File Coordination Protocol
[content managed by DevOps Agent]
<!-- END_DEVOPS_AGENT_SECTION:file-coordination -->

## Your Custom Rules
[your content is never touched]
```

### House Rules Commands

```bash
# Check if updates are available
npm run house-rules:status

# Update or create house rules
npm run house-rules:update

# Health check and repair if deleted
npm run house-rules:repair
```

### Updates Preserve Your Content

When you update the DevOps Agent:
1. Post-install checks for house rules updates
2. Only updates DevOps-managed sections
3. Your custom rules are NEVER modified
4. Backups are created before any changes

## Configuration Options

### Environment Variables

```bash
# Auto-setup without prompts (useful for CI)
export DEVOPS_AUTO_SETUP=true

# Developer initials (used in branch names)
export AC_BRANCH_PREFIX="dev_abc_"

# Daily branch rollover is now automatic (no prompting)
# Version increments daily: v0.20 → v0.21 → v0.22

# Timezone for daily rollover
export AC_TZ="America/New_York"

# Debug mode
export AC_DEBUG=true
```

### Configuration Files

**Global Settings** (`~/.devops-agent/settings.json`):
```json
{
  "developerInitials": "abc",
  "email": "developer@example.com",
  "configured": true
}
```

**Project Settings** (`local_deploy/project-settings.json`):
```json
{
  "versioningStrategy": {
    "prefix": "v1.",
    "startMinor": 30,
    "dailyIncrement": 1,
    "configured": true
  },
  "autoMergeConfig": {
    "enabled": true,
    "targetBranch": "main",
    "strategy": "pull-request"
  }
}
```

## CI/CD Setup

### Using DevOps Agent in repositories with Husky/commit hooks

Many teams already enforce quality via Husky, commitlint, and lint-staged. DevOps Agent is designed to work *with* those hooks, not around them:

- Commits created by the worker run through your existing hooks because `git commit` is invoked without `--no-verify`.
- When a hook fails, fix the underlying issue using your project’s commands (for example `npm run validate`, `npm run type-check`, Prisma migration scripts, etc.) and then let the worker retry.
- For repositories that also use file-coordination, you can optionally add a pre-commit step that enforces declared edits by calling the FileCoordinator CLI via a helper script (see `scripts/git-hooks/check-file-coordination.sh` for a template that downstream repos can copy and wire into `.husky/pre-commit`).

### Automatic Setup in CI

The DevOps Agent detects CI environments and auto-configures:

```yaml
# GitHub Actions Example
- name: Install DevOps Agent
  run: npm install -g s9n-devops-agent

# House rules are auto-created in CI
# No prompts, fully automated
```

### Supported CI Environments

Automatically detected:
- GitHub Actions (`GITHUB_ACTIONS`)
- GitLab CI (`GITLAB_CI`)
- Jenkins (`JENKINS_URL`)
- Travis CI (`TRAVIS`)
- CircleCI (`CI`)

### Force Automation

```bash
# Force automatic setup (no prompts)
DEVOPS_AUTO_SETUP=true npm start
```

## Typical Workflow

### 1. Start Your Day

```bash
npm start
# Creates new daily branch automatically
# No rollover prompts - it's automatic!
```

### 2. Create a Session

```
Select an Option:
N) Create a new session

Enter task/feature name: implement-api
Agent type [claude]: claude

Creating session...
✓ Worktree created
✓ House rules applied
```

### 3. Copy Instructions to AI

The tool provides exact instructions for your AI:

```
CRITICAL FIRST STEP:
1. Read and follow the house rules: cat "/path/to/worktree/houserules.md"
2. Switch to the working directory: cd "/path/to/worktree"

FILE COORDINATION PROTOCOL (from house rules):
Before editing ANY files, you MUST:
- Declare your intent in .file-coordination/active-edits/
- Check for conflicts with other agents
- Only edit files you've declared
```

### 4. AI Works in Isolation

- AI writes code in its worktree
- Commits are automatic
- Pushes happen seamlessly
- No conflicts with other agents

### 5. End of Day

```bash
# Sessions auto-merge if configured
# Daily branches roll over at midnight
# Everything is automated!
```

## Troubleshooting

### House Rules Issues

**House rules deleted accidentally?**
```bash
npm run house-rules:repair
# Auto-detects and recreates
```

**House rules out of date?**
```bash
npm start
# Prompts to update on startup
```

**Want to force update?**
```bash
npm run house-rules:update
```

### Session Issues

**Session not starting?**
```bash
# Check prerequisites
node --version  # Should be 16+
git --version   # Should be 2.20+

# Clean up and retry
npm run devops:cleanup
npm start
```

**AI not following house rules?**
- Ensure AI reads: `cat houserules.md` first
- Check coordination: `ls .file-coordination/active-edits/`
- View alerts: `ls .coordination-alert-*.md`

### Permission Issues

```bash
# Fix script permissions
chmod +x scripts/*.sh
chmod +x start-devops-session.sh

# Fix npm permissions (if needed)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## Advanced Features

### Multi-Agent Setup

```bash
# Terminal 1: Claude on backend
npm start
# Create session for "backend-api"

# Terminal 2: Copilot on frontend  
npm start
# Create session for "ui-components"

# Both work without conflicts!
```

### Docker Integration

```bash
# If docker-compose.yml exists:
npm start
# -> Auto-restart Docker containers? Y
# -> Rebuild on restart? N
# -> Service to restart: app

# Now Docker restarts after each push!
```

### Custom Configurations

```bash
# Skip all prompts with environment
export DEVOPS_AUTO_SETUP=true
export AC_BRANCH_PREFIX="team_"
export AC_VERSION_PREFIX="v2."
export AC_TZ="Europe/London"

npm start  # Uses all environment settings
```

## Getting Help

- **Documentation**: [GitHub Wiki](https://github.com/SecondBrainAICo/CS_DevOpsAgent/wiki)
- **Issues**: [GitHub Issues](https://github.com/SecondBrainAICo/CS_DevOpsAgent/issues)
- **NPM Package**: [npmjs.com/package/s9n-devops-agent](https://www.npmjs.com/package/s9n-devops-agent)

---

**Remember**: The beauty of v1.3.0 is that `npm start` handles everything. No complex setup, no multiple commands - just run and go! 🚀