# PRD: SeKondBrain Kanvas (DevOps Agent Desktop App)

## Overview

**Product Name:** SeKondBrain Kanvas  
**Source Project:** DevOps Agent (`s9n-devops-agent`)  
**Target Platform:** Electron + React + TypeScript  
**Goal:** Convert the CLI-based DevOps Agent into a rich desktop application with multi-tab support for managing multiple AI agent sessions simultaneously.

## Problem Statement

The current DevOps Agent is a powerful CLI tool that enables AI assistants to work safely on codebases with automatic commits, branch management, and multi-agent conflict prevention. However, the CLI interface creates UX friction:

1. **No visual feedback** during long-running Git operations
2. **Session state is invisible** — users can't see what's happening
3. **Multiple terminal windows** needed for parallel agents
4. **Configuration requires environment variables** — not user-friendly
5. **Debugging requires flags** (`AC_DEBUG=true`)
6. **No unified view** of all sessions, branches, and file locks

## Solution

A desktop application that wraps the DevOps Agent functionality in a visual interface with:

- **Multi-tab interface** for managing multiple sessions
- **Real-time activity log** showing commits, pushes, file changes
- **Visual branch tree** showing session → daily → weekly → main hierarchy
- **File lock visualization** showing which files each agent owns
- **Chat panel** for Kora AI assistant integration
- **Settings UI** replacing environment variables

## Technical Context

### Source Architecture (from analysis.json)

```
bin/cs-devops-agent (Shell router)
    │
    ├── agent-chat.js          → Kora AI (Groq LLM)
    ├── cs-devops-agent-worker.js → File watcher + auto-commit
    ├── session-coordinator.js → Session CRUD
    ├── close-session.js       → Session closure
    ├── worktree-manager.js    → Git worktree operations
    ├── file-coordinator.cjs   → Multi-agent file locks
    ├── file-monitor-enhanced.cjs → Conflict detection
    ├── credentials-manager.js → API key storage
    ├── branch-config-manager.js → Settings
    └── instruction-formatter.js → AI instructions
```

### Target Architecture

```
sekondbrain-kanvas/
├── src/main/
│   ├── services/           # Migrated from source
│   │   ├── SessionService.ts    ← session-coordinator.js
│   │   ├── GitService.ts        ← worktree-manager.js
│   │   ├── WatcherService.ts    ← cs-devops-agent-worker.js
│   │   ├── LockService.ts       ← file-coordinator.cjs
│   │   ├── ConflictService.ts   ← file-monitor-enhanced.cjs
│   │   ├── ConfigService.ts     ← branch-config-manager.js + credentials-manager.js
│   │   ├── AIService.ts         ← agent-chat.js
│   │   └── InstructionService.ts ← instruction-formatter.js
│   └── ipc/                # IPC handlers
├── src/preload/            # Context bridge
└── src/renderer/           # React UI
```

## User Personas

### Primary: AI-Assisted Developer
- Uses Claude, Cursor, or Copilot for coding
- Wants multiple AI agents working in parallel
- Needs to see what agents are doing in real-time
- Wants easy session management without CLI

### Secondary: Team Lead
- Oversees multiple developers using AI agents
- Needs visibility into branch hierarchy
- Wants to ensure code quality before merges

## Core Features

### F1: Multi-Tab Session Management
- Create new sessions in tabs
- Each tab is an independent agent workspace
- Switch between tabs to see different session states
- Close tabs to merge and cleanup sessions

### F2: Real-Time Activity Dashboard
- Live feed of file changes, commits, pushes
- Color-coded by type (success, warning, error)
- Timestamps and commit hashes
- Clickable links to view diffs

### F3: Visual Branch Tree
- Hierarchical view: session → daily → weekly → main
- Current session highlighted
- Merge status indicators
- One-click merge actions

### F4: File Coordination Panel
- List of file locks per session
- Conflict warnings with resolution options
- File declaration interface

### F5: Kora AI Chat Integration
- Chat panel in each session tab
- Streaming responses from Groq
- Context-aware of current session

### F6: Settings & Configuration
- Visual settings panel (no env vars)
- API key management
- Branch naming conventions
- Merge target configuration

## Non-Functional Requirements

- **Cross-platform:** macOS, Windows, Linux
- **Performance:** <100ms response time for UI actions
- **Memory:** <500MB per session tab
- **Startup:** <3 seconds to launch
- **Offline:** Core features work without internet (except AI chat)

## Migration Mapping

| Source Module | Target Service | Key Changes |
|--------------|----------------|-------------|
| session-coordinator.js | SessionService.ts | Remove readline, add IPC events |
| worktree-manager.js | GitService.ts | Add async operations, status tracking |
| cs-devops-agent-worker.js | WatcherService.ts | Emit IPC events on changes |
| file-coordinator.cjs | LockService.ts | Convert to TypeScript class |
| file-monitor-enhanced.cjs | ConflictService.ts | Emit IPC conflict events |
| credentials-manager.js | ConfigService.ts | Use electron-store |
| branch-config-manager.js | ConfigService.ts | Use electron-store |
| agent-chat.js | AIService.ts | Add streaming support |
| instruction-formatter.js | InstructionService.ts | Minor cleanup |
| display-utils.cjs | (removed) | Replaced by React components |
| ui-utils.js | (removed) | Replaced by React components |
| tutorial-mode.js | (removed) | Replaced by onboarding wizard |

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SeKondBrain Kanvas                                         [_][□][X]  │
├─────────────────────────────────────────────────────────────────────────┤
│ [Session: auth-api] [Session: user-ui] [Session: tests] [+]            │
├───────────────┬─────────────────────────────────────────────────────────┤
│               │                                                         │
│   SESSIONS    │    SESSION: auth-api                                    │
│   ──────────  │    Status: 🟢 Watching    Branch: session/auth-abc123   │
│   • auth-api  │    ─────────────────────────────────────────────────── │
│   • user-ui   │                                                         │
│   • tests     │    ┌─────────────────────┬────────────────────────────┐│
│               │    │    KORA AI CHAT     │     ACTIVITY LOG           ││
│   BRANCHES    │    │                     │                            ││
│   ──────────  │    │ > How can I help?   │ ✓ 14:32 Committed: "Add   ││
│   ├─ main     │    │                     │         auth middleware"   ││
│   ├─ daily/   │    │ User: Add JWT       │ ✓ 14:32 Pushed to origin  ││
│   │  01-10    │    │ validation          │ ⚠ 14:35 File changed:     ││
│   └─ session/ │    │                     │         src/auth.ts        ││
│      auth-... │    │ Kora: I'll add...   │                            ││
│               │    │ [streaming...]      │                            ││
│   FILE LOCKS  │    │                     │                            ││
│   ──────────  │    └─────────────────────┴────────────────────────────┘│
│   🔒 auth.ts  │                                                         │
│   🔒 jwt.ts   │    ┌────────────────────────────────────────────────────┤
│               │    │ TERMINAL                                          │
│   [▶ Start]   │    │ $ git status                                      │
│   [⏹ Stop]    │    │ On branch session/auth-abc123                     │
│   [🔀 Merge]  │    │ Changes staged for commit:                        │
│   [⚙ Settings]│    │   modified: src/auth.ts                           │
│               │    └────────────────────────────────────────────────────┤
├───────────────┴─────────────────────────────────────────────────────────┤
│  Session: auth-abc123 | Commits: 5 | Files: 3 | Agent: Claude | 🟢     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Success Metrics

1. **Adoption:** 50% of CLI users migrate to desktop within 3 months
2. **Efficiency:** 30% reduction in session management time
3. **Reliability:** <1% crash rate
4. **Satisfaction:** >4.0 star rating in user feedback

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Scaffold | 2 days | Electron project with basic window |
| 2. Services | 5 days | All services migrated and working |
| 3. IPC Layer | 2 days | Full IPC communication |
| 4. Core UI | 5 days | Tabs, sidebar, session canvas |
| 5. Features | 5 days | Chat, activity log, branch tree |
| 6. Polish | 3 days | Settings, onboarding, packaging |

**Total: ~4 weeks**

## Appendix: Source File Analysis

See `analysis.json` for complete source code analysis including:
- All module exports and functions
- Dependency graph
- Session management flow
- Git operation patterns
- File watching implementation
- Multi-agent coordination system
