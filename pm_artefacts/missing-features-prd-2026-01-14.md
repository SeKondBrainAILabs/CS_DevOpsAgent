# PRD: Missing Features Analysis - SeKondBrain Kanvas

## Document Info

**Date**: 2026-01-14
**Version**: 1.0.0
**Author**: DevOps Agent
**Branch**: dev_sdd_claude_rebuildUX

---

## Executive Summary

This document identifies features specified in the original PRDs (Worktree Manager PRD, Agent Instance Creation PRD) that have not yet been implemented in the current development branch. It also includes user-requested features discovered during development sessions.

---

## Current Implementation Status

### Implemented Features (Complete)

| Feature | Status | Location |
|---------|--------|----------|
| Agent Instance Creation Wizard | ✅ | `renderer/components/features/CreateAgentWizard.tsx` |
| Repository Selection & Validation | ✅ | `electron/services/AgentInstanceService.ts` |
| Agent Type Selection (7 types) | ✅ | `shared/types.ts` |
| Task Description & Branch Naming | ✅ | Create wizard |
| Session Management (CRUD) | ✅ | `AgentInstanceService` |
| File Watching (Chokidar) | ✅ | `electron/services/WatcherService.ts` |
| Activity Logging | ✅ | `electron/services/ActivityService.ts` |
| Worktree Creation (basic) | ✅ | `AgentInstanceService.createWorktreeIfNeeded()` |
| Session Detail View (tabs) | ✅ | `SessionDetailView.tsx` |
| Activity-based Status Indicators | ✅ | `Sidebar.tsx` |
| Per-session Delete/Restart | ✅ | IPC handlers |
| Contract Detection Service | ✅ | `ContractDetectionService.ts` |

### Partially Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Verbose Activity Mode | ⚠️ | Shows file changes but missing git commands |
| Contract Change Detection | ⚠️ | Service exists, UI shows placeholder data |
| Instructions Generator | ⚠️ | Basic prompt, missing agent-specific setup |

---

## Missing Features Analysis

### Epic 1: Terminal/Console View

**Source**: User request during development session
**Priority**: High
**Complexity**: Medium

#### Problem
Users cannot see system-level activity including:
- Git commands being executed
- Service initialization logs
- File coordination conflicts
- Agent communication messages
- Error stack traces

#### Solution
Add a "Terminal" or "Console" tab to the Session Detail View that shows:
1. Real-time system logs
2. Git command execution with output
3. File coordination messages
4. IPC communication logs (debug mode)

#### User Stories

**US-1.1: View Terminal Output**
> As a developer, I want to see a terminal-style view of all system activity so that I can debug issues and understand what the agent is doing.

**US-1.2: Filter Log Levels**
> As a developer, I want to filter logs by level (debug, info, warn, error) so that I can focus on relevant information.

**US-1.3: Copy Log Output**
> As a developer, I want to copy terminal output to clipboard so that I can share it for troubleshooting.

**US-1.4: Clear Terminal**
> As a developer, I want to clear the terminal view so that I can start fresh when debugging.

#### Acceptance Criteria
- [ ] New "Terminal" tab in SessionDetailView
- [ ] Shows timestamped log entries with level indicators
- [ ] Supports log level filtering (debug/info/warn/error)
- [ ] Auto-scrolls to latest entry (toggle)
- [ ] Copy all / copy selection functionality
- [ ] Git commands shown with `$` prefix and output
- [ ] Maximum 1000 lines with circular buffer

---

### Epic 2: File Coordination Conflict UI

**Source**: Worktree Manager PRD, Agent Instance Creation PRD
**Priority**: High
**Complexity**: Medium

#### Problem
When multiple agents edit the same files, users have no visibility into:
- Active file locks from other agents
- Potential conflicts before they occur
- Which agent has claimed which files

#### Solution
Implement a File Coordination panel that shows:
1. Active file locks across all sessions
2. Conflict warnings before edit attempts
3. Lock history and release timestamps

#### User Stories

**US-2.1: View Active File Locks**
> As a developer, I want to see all files currently locked by agents so that I know which files are safe to edit.

**US-2.2: Receive Conflict Warnings**
> As a developer, I want to be warned when I'm about to edit a file locked by another agent so that I can avoid conflicts.

**US-2.3: View Lock History**
> As a developer, I want to see the history of file locks so that I can understand patterns and resolve disputes.

**US-2.4: Force Release Lock**
> As a developer, I want to force-release a stale lock so that I can continue working when an agent crashes.

#### Acceptance Criteria
- [ ] FileLocks panel in sidebar or modal
- [ ] Shows: file path, owning session, lock time, operation type
- [ ] Visual indicator on locked files in Files tab
- [ ] Toast notification on conflict attempt
- [ ] Force-release with confirmation dialog
- [ ] Stale lock detection (>30 min without heartbeat)

---

### Epic 3: Agent Heartbeat & Connection Monitoring

**Source**: Agent Instance Creation PRD (FR-4.2)
**Priority**: Medium
**Complexity**: Medium

#### Problem
After creating a session, users have no way to know if the external agent (Claude, Cursor, etc.) has connected and is actively working. Sessions show "waiting" indefinitely.

#### Solution
Implement heartbeat monitoring:
1. Agents write heartbeat files to `.kanvas/heartbeats/`
2. Kanvas watches for heartbeat updates
3. UI shows connection status and last activity time
4. Timeout warnings after 5 minutes of inactivity

#### User Stories

**US-3.1: See Agent Connection Status**
> As a developer, I want to see if the agent has connected to my session so that I know the setup was successful.

**US-3.2: Receive Timeout Warnings**
> As a developer, I want to be warned if my agent hasn't connected within 5 minutes so that I can troubleshoot the setup.

**US-3.3: View Last Heartbeat Time**
> As a developer, I want to see when the agent last checked in so that I know if it's still active.

#### Acceptance Criteria
- [ ] Heartbeat watcher in AgentListenerService
- [ ] Session card shows connection badge (connected/disconnected/unknown)
- [ ] Timeout toast after 5 minutes with troubleshooting link
- [ ] Last heartbeat timestamp in session detail view
- [ ] Heartbeat protocol documented for external agents

---

### Epic 4: Merge Coordination Workflow

**Source**: Worktree Manager PRD (Section 4)
**Priority**: Medium
**Complexity**: High

#### Problem
Users must manually merge agent branches back to main, handle conflicts, and clean up worktrees. This is error-prone and time-consuming.

#### Solution
Implement guided merge workflow:
1. "Merge to Main" action on session card
2. Conflict preview before merge
3. Merge execution with progress indicator
4. Automatic worktree cleanup option
5. Branch deletion confirmation

#### User Stories

**US-4.1: Initiate Merge from UI**
> As a developer, I want to merge an agent's branch back to main from the UI so that I don't need to use CLI commands.

**US-4.2: Preview Merge Conflicts**
> As a developer, I want to see potential merge conflicts before merging so that I can prepare for resolution.

**US-4.3: Auto-cleanup After Merge**
> As a developer, I want the worktree automatically cleaned up after a successful merge so that I don't accumulate orphan directories.

**US-4.4: Delete Remote Branches**
> As a developer, I want the option to delete remote branches after merge so that I keep my repository clean.

#### Acceptance Criteria
- [ ] "Merge" button on session card (when status allows)
- [ ] Merge preview modal showing files changed, conflicts
- [ ] Merge execution with real-time progress
- [ ] Success/failure toast with details
- [ ] "Delete worktree" checkbox (default: true for successful merge)
- [ ] "Delete remote branch" checkbox (default: false)
- [ ] Merge history in session activity log

---

### Epic 5: Quick Actions & External Tool Integration

**Source**: Agent Instance Creation PRD (FR-4.3)
**Priority**: Medium
**Complexity**: Low

#### Problem
After creating a session, users must manually navigate to directories, open terminals, and launch editors. This adds friction to the workflow.

#### Solution
Add quick action buttons:
1. "Open in Terminal" - Opens terminal at worktree path
2. "Open in VS Code" - Launches VS Code workspace
3. "Open in Finder/Explorer" - Opens file manager
4. "Copy Path" - Copies worktree path to clipboard

#### User Stories

**US-5.1: Open Terminal at Worktree**
> As a developer, I want to quickly open a terminal at the worktree path so that I can run commands.

**US-5.2: Open VS Code Workspace**
> As a developer, I want to open VS Code at the worktree so that I can start coding immediately.

**US-5.3: Copy Worktree Path**
> As a developer, I want to copy the worktree path so that I can use it in other tools.

#### Acceptance Criteria
- [ ] Quick action buttons in session detail header
- [ ] "Open Terminal" uses system default terminal
- [ ] "Open VS Code" uses `code` CLI command
- [ ] "Open Finder" uses Electron's shell.showItemInFolder
- [ ] "Copy Path" with success toast
- [ ] Keyboard shortcuts (Cmd+T for terminal, etc.)

---

### Epic 6: Recent Repositories & Persistence

**Source**: Agent Instance Creation PRD (TR-5)
**Priority**: Low
**Complexity**: Low

#### Problem
Users must re-select repositories each time. There's no memory of previously used repos or settings.

#### Solution
Persist recent repositories using electron-store:
1. Save last 10 repositories with metadata
2. Show recent repos in create wizard
3. Remember last-used settings per repo
4. Sort by last used date

#### User Stories

**US-6.1: See Recent Repositories**
> As a developer, I want to see my recently used repositories so that I can quickly select them.

**US-6.2: Remember Repo Settings**
> As a developer, I want my settings remembered per repository so that I don't reconfigure each time.

#### Acceptance Criteria
- [ ] electron-store integration for persistence
- [ ] Recent repos list in step 1 of wizard
- [ ] Click to select recent repo
- [ ] Per-repo settings memory (default branch, agent type)
- [ ] Clear recent repos option

---

### Epic 7: Agent Environment & VS Code Workspace Setup

**Source**: Worktree Manager PRD (Section 1, 5)
**Priority**: Low
**Complexity**: Medium

#### Problem
Worktrees are created but lack agent-specific configuration:
- No `.agent-config` file for agent identification
- No VS Code workspace settings for window title
- No environment variables set for the agent

#### Solution
Enhance worktree initialization:
1. Create `.agent-config` JSON file
2. Generate `.vscode/settings.json` with agent info
3. Set `KANVAS_SESSION_ID` and `KANVAS_AGENT_ID` environment vars
4. Include agent-specific commit message prefix

#### User Stories

**US-7.1: Agent Config in Worktree**
> As a developer, I want each worktree to have an `.agent-config` file so that tools can identify the agent context.

**US-7.2: VS Code Window Title**
> As a developer, I want VS Code to show the agent name in the window title so that I can identify workspaces.

#### Acceptance Criteria
- [ ] `.agent-config` created in worktree root
- [ ] `.vscode/settings.json` with `window.title` including agent name
- [ ] Environment variables documented in instructions
- [ ] Commit message prefix configured per agent

---

## Implementation Priority Matrix

| Epic | Priority | Effort | Dependencies | Recommended Sprint |
|------|----------|--------|--------------|-------------------|
| 1. Terminal View | High | Medium | ActivityService | Sprint 1 |
| 2. File Coordination UI | High | Medium | LockService | Sprint 1 |
| 3. Heartbeat Monitoring | Medium | Medium | AgentListenerService | Sprint 2 |
| 4. Merge Workflow | Medium | High | GitService | Sprint 2 |
| 5. Quick Actions | Medium | Low | None | Sprint 1 |
| 6. Recent Repos | Low | Low | electron-store | Sprint 3 |
| 7. Agent Environment | Low | Medium | AgentInstanceService | Sprint 3 |

---

## Technical Dependencies

### New Dependencies Required
- `electron-store` - For persistent settings storage (Epic 6)

### Existing Services to Extend
- `ActivityService` - Add log levels, git command logging (Epic 1)
- `LockService` - Add conflict detection events (Epic 2)
- `AgentListenerService` - Add heartbeat watching (Epic 3)
- `GitService` - Add merge operations (Epic 4)
- `AgentInstanceService` - Add quick actions, environment setup (Epic 5, 7)

### New Components Required
- `TerminalTab.tsx` - Terminal/console view component
- `FileCoordinationPanel.tsx` - File locks display
- `MergeWorkflowModal.tsx` - Guided merge wizard
- `QuickActions.tsx` - Action buttons component

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to debug issues | <2 min | Terminal view usage |
| File conflict rate | 0% | Coordination UI warnings |
| Agent connection rate | >95% | Heartbeat monitoring |
| Manual merge operations | -80% | Merge workflow usage |
| Repository re-selection | -90% | Recent repos feature |

---

## Appendix: User Feedback Summary

During development sessions, users requested:

1. **"Terminal view tab that shows all the things being found"** - Addressed in Epic 1
2. **"Messages from agent"** - Addressed in Epic 3 (heartbeat) and Epic 1 (terminal)
3. **"File coordination issues"** - Addressed in Epic 2
4. **"What does the agent check for"** - Documented in PRD analysis

---

## Next Steps

1. Review and approve this PRD
2. Create Jira/Linear tickets for each epic
3. Prioritize Sprint 1 items (Terminal View, File Coordination, Quick Actions)
4. Assign developers to epics
5. Begin implementation with Terminal View as first deliverable
