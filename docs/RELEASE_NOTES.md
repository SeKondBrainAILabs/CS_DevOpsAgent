# Release Notes - s9n-devops-agent v2.0.18-dev.3

## 🚀 Enhancements
- **Base Branch Selection**: You can now select a base branch (e.g., main, develop) when starting a session, allowing for cleaner feature branching from stable points.
- **Enhanced Setup Wizard**: 
  - Finds and merges contract files from subdirectories.
  - Ensures versioning strategy is configured.
  - Persists credentials in user home directory to survive package updates.

## 🐛 Fixes
- **Update Logic**: Fixed update checker to respect dev versions.
- **Credentials**: Fixed issue where API keys were lost during updates.

---

# Release Notes - s9n-devops-agent v2.0.11-dev.0

## 🐛 Fixed
- **Bin Path**: Fixed incorrect `bin` path in `package.json` to ensure the executable works correctly.

---

# Release Notes - CS_DevOpsAgent v2.0.0

## 🚀 Major Release: Multi-Agent Worktree Support & Infrastructure Tracking

### Release Date: January 28, 2025

---

## ✨ New Features

### 1. 🤖 Multi-Agent Worktree Management
CS_DevOpsAgent now supports multiple AI agents working on the same codebase simultaneously without conflicts!

#### Key Capabilities:
- **Automatic Agent Detection**: Identifies AI agents from environment variables
  - Supported: Claude, GitHub Copilot, Cursor, Aider, Warp
  - Auto-generates unique IDs for unknown agents
- **Isolated Workspaces**: Each agent gets its own Git worktree
- **Smart Branch Naming**: `agent/{name}/{task}` convention
- **Zero Configuration**: Works out-of-the-box with auto-detection

#### Usage:
```bash
# Run with specific agent
node run-with-agent.js --agent claude --repo /path/to/repo --task feature-auth

# Auto-detect agent
node run-with-agent.js --detect --repo /path/to/repo

# Manage worktrees
node worktree-manager.js create --agent claude --task auth
node worktree-manager.js list
node worktree-manager.js merge --agent claude
```

### 2. 📁 Infrastructure Change Tracking
Automatically documents all infrastructure changes in `/Documentation/infrastructure.md`

#### What's Tracked:
- Package dependencies (package.json)
- Environment variables (.env files)
- Configuration files (*config.js, *config.json)
- Build system (Docker, CI/CD)
- Database migrations
- API route changes

#### Automatic Features:
- Detects infrastructure changes during commits
- Updates documentation automatically
- Enhances commit messages with `infra:` prefix
- Maintains complete change history

### 3. 🧪 Advanced Testing Infrastructure

#### Targeted Test Execution:
- Only runs tests for changed code areas
- Intelligent area detection from file paths
- Fallback to full suite when needed

#### Features:
- Pre-push hooks ensure test success
- Configurable log levels (DEBUG/INFO/WARN/ERROR)
- CI/CD compatible output formatting
- Performance-optimized test runs

#### Usage:
```bash
# Run tests for changed areas
scripts/run-tests --changed

# Run full test suite
scripts/run-tests --all

# Debug mode
LOG_LEVEL=debug scripts/run-tests --changed
```

---

## 📝 Enhanced Documentation

### New Files:
- `claude.md` - Comprehensive house rules including:
  - Testing policies
  - Infrastructure documentation guidelines
  - Worktree management rules
  - Code style guidelines
  
- `Documentation/infrastructure.md` - Auto-generated infrastructure change log
- `test_cases/` - Organized test structure by area/component
- `RELEASE_NOTES.md` - This file!

### Updated Files:
- `README.md` - Complete documentation of new features
- `product_requirement_docs/worktree-manager-prd.md` - Detailed specifications

---

## 🛠️ Technical Improvements

### Code Organization:
- Modular architecture with clear separation of concerns
- Reusable components (worktree-manager, run-with-agent)
- Comprehensive error handling and logging

### Performance:
- Efficient worktree creation and management
- Optimized test execution with area detection
- Minimal overhead for infrastructure tracking

### Developer Experience:
- Zero-configuration for common scenarios
- Environment variable controls for customization
- Clear console output with color coding
- Detailed logging for debugging

---

## 🔧 Configuration Options

### New Environment Variables:
```bash
# Agent Management
AGENT_NAME=claude           # Specify agent name
AGENT_TASK=authentication   # Current task/feature
AC_USE_WORKTREE=true        # Enable/disable worktrees

# Infrastructure Tracking
AC_TRACK_INFRA=true         # Enable infrastructure tracking
AC_INFRA_DOC_PATH=Documentation/infrastructure.md

# Testing
LOG_LEVEL=info              # Logging verbosity
TRACE=0                     # Deep tracing (0 or 1)
```

---

## 🚀 Migration Guide

### For Existing Users:
1. Pull the latest changes
2. Run `node setup-cs-devops-agent.js` to update configuration
3. Infrastructure documentation will be created automatically
4. Existing workflows remain unchanged

### For New Users:
1. Clone the repository
2. Run `./quick-start.sh` or `node setup-cs-devops-agent.js`
3. Start using with `npm run cs-devops-agent`

---

## 📊 Impact Summary

### Benefits:
- **Collaboration**: Multiple agents work without conflicts
- **Visibility**: All infrastructure changes documented
- **Quality**: Comprehensive testing with smart execution
- **Productivity**: Zero-configuration setup
- **Maintainability**: Clear documentation and structure

### Use Cases:
- Teams using multiple AI coding assistants
- Projects requiring infrastructure change tracking
- Continuous integration/deployment pipelines
- Large codebases with complex testing needs

---

## 🙏 Acknowledgments

This release represents a major evolution of CS_DevOpsAgent, transforming it from a simple cs-devops-agent tool into a comprehensive multi-agent development platform. Special thanks to all contributors and users who provided feedback.

---

## 📚 Additional Resources

- [README.md](README.md) - Complete documentation
- [claude.md](claude.md) - House rules and guidelines
- [Documentation/infrastructure.md](Documentation/infrastructure.md) - Infrastructure changes
- [product_requirement_docs/](product_requirement_docs/) - Detailed specifications

---

**Version**: 2.0.0  
**Release Date**: January 28, 2025  
**Status**: Stable  
**Breaking Changes**: None (backward compatible)