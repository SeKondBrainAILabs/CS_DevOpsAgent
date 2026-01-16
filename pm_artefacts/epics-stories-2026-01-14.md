# Epics & Stories - SeKondBrain Kanvas Missing Features

**Date**: 2026-01-14
**Sprint Planning Document**
**Related PRD**: `missing-features-prd-2026-01-14.md`

---

## Sprint 1 - High Priority Features

### EPIC-001: Terminal/Console View

**Epic Summary**: Add a terminal-style view to show system logs, git commands, and debug information.

**Business Value**: Users can debug issues without checking external logs. Reduces support burden.

**Definition of Done**:
- Terminal tab renders in SessionDetailView
- Shows real-time log entries with timestamps
- Supports filtering and copying

#### Stories

---

**STORY-001-1: Create TerminalTab Component**

**Type**: Feature
**Points**: 5
**Priority**: P1

**Description**:
Create a new React component `TerminalTab.tsx` that displays log entries in a terminal-style interface.

**Acceptance Criteria**:
- [ ] Component renders a scrollable log view with dark theme
- [ ] Each log entry shows: timestamp, level icon, message
- [ ] Auto-scrolls to bottom when new entries arrive
- [ ] Toggle to disable auto-scroll
- [ ] Monospace font for log content

**Technical Notes**:
- Use `useAgentStore` to subscribe to log entries
- Add new activity type 'terminal' for system logs
- Max 1000 entries with circular buffer

---

**STORY-001-2: Add Log Level Filtering**

**Type**: Feature
**Points**: 3
**Priority**: P2

**Description**:
Add filter controls to show/hide log entries by level.

**Acceptance Criteria**:
- [ ] Filter buttons for: All, Debug, Info, Warn, Error
- [ ] Active filter highlighted
- [ ] Filter persists within session
- [ ] Entry count shown per filter

**Technical Notes**:
- Filter state in component local state
- Use `useMemo` for filtered list

---

**STORY-001-3: Implement Git Command Logging**

**Type**: Feature
**Points**: 5
**Priority**: P1

**Description**:
Log all git commands executed by services with their output.

**Acceptance Criteria**:
- [ ] Git commands logged with `$` prefix
- [ ] Command output shown indented
- [ ] Exit code shown (0 = green, non-zero = red)
- [ ] Long output truncated with "show more" option

**Technical Notes**:
- Modify `GitService` to emit 'git' type log entries
- Include command, args, cwd, exitCode, stdout, stderr

---

**STORY-001-4: Add Copy Functionality**

**Type**: Feature
**Points**: 2
**Priority**: P3

**Description**:
Allow users to copy terminal output to clipboard.

**Acceptance Criteria**:
- [ ] "Copy All" button copies entire log
- [ ] Text selection works normally
- [ ] Copied format includes timestamps
- [ ] Success toast on copy

---

### EPIC-002: File Coordination Conflict UI

**Epic Summary**: Display file locks and warn about conflicts between agents.

**Business Value**: Prevents file conflicts and lost work when multiple agents edit simultaneously.

**Definition of Done**:
- Users can see all active file locks
- Conflict warnings appear before problematic edits
- Stale locks can be force-released

#### Stories

---

**STORY-002-1: Create FileLocksPanel Component**

**Type**: Feature
**Points**: 5
**Priority**: P1

**Description**:
Create a panel showing all active file locks across sessions.

**Acceptance Criteria**:
- [ ] Panel accessible from sidebar or modal
- [ ] Shows: file path, session name, lock time, operation
- [ ] Grouped by session
- [ ] Empty state when no locks

**Technical Notes**:
- Subscribe to LockService events via IPC
- Add `LOCK_CHANGE` IPC channel

---

**STORY-002-2: Add Lock Status to Files Tab**

**Type**: Feature
**Points**: 3
**Priority**: P2

**Description**:
Show lock indicators on files in the Files tab.

**Acceptance Criteria**:
- [ ] Lock icon on locked files
- [ ] Tooltip shows: owner session, lock time
- [ ] Different icon for own-session vs other-session locks
- [ ] Click icon to view lock details

---

**STORY-002-3: Implement Conflict Warning Toast**

**Type**: Feature
**Points**: 3
**Priority**: P1

**Description**:
Show warning when attempting to edit a locked file.

**Acceptance Criteria**:
- [ ] Toast appears when file edit conflicts
- [ ] Shows: file path, owning session
- [ ] "Force Edit" option (with confirmation)
- [ ] "Cancel" option

**Technical Notes**:
- Hook into file watcher's change detection
- Check locks before emitting file change event

---

**STORY-002-4: Force Release Stale Locks**

**Type**: Feature
**Points**: 3
**Priority**: P2

**Description**:
Allow users to release locks that are stale (no recent activity).

**Acceptance Criteria**:
- [ ] "Release Lock" button on lock entries older than 30 min
- [ ] Confirmation dialog with warning
- [ ] Lock removed from all views
- [ ] Activity log entry created

---

### EPIC-003: Quick Actions

**Epic Summary**: Add quick action buttons for common operations.

**Business Value**: Reduces friction in workflow, users can launch tools directly from Kanvas.

**Definition of Done**:
- Quick action buttons in session detail view
- All actions work on macOS

#### Stories

---

**STORY-003-1: Add Open Terminal Action**

**Type**: Feature
**Points**: 2
**Priority**: P1

**Description**:
Button to open system terminal at worktree path.

**Acceptance Criteria**:
- [ ] Button in session header
- [ ] Opens Terminal.app on macOS
- [ ] Opens at worktree path (or repo path if no worktree)
- [ ] Works with iTerm2 if default

**Technical Notes**:
- Use `shell.openPath` or spawn terminal app
- macOS: `open -a Terminal /path/to/dir`

---

**STORY-003-2: Add Open VS Code Action**

**Type**: Feature
**Points**: 2
**Priority**: P1

**Description**:
Button to open VS Code at worktree path.

**Acceptance Criteria**:
- [ ] Button with VS Code icon
- [ ] Executes `code /path/to/worktree`
- [ ] Shows error if `code` CLI not installed
- [ ] Works with VS Code Insiders

**Technical Notes**:
- Check for `code` in PATH
- Spawn child process

---

**STORY-003-3: Add Open Finder Action**

**Type**: Feature
**Points**: 1
**Priority**: P2

**Description**:
Button to reveal worktree in Finder.

**Acceptance Criteria**:
- [ ] Button with folder icon
- [ ] Opens Finder at path
- [ ] Selects the directory

**Technical Notes**:
- Use `shell.showItemInFolder(path)`

---

**STORY-003-4: Add Copy Path Action**

**Type**: Feature
**Points**: 1
**Priority**: P2

**Description**:
Button to copy worktree path to clipboard.

**Acceptance Criteria**:
- [ ] Button with copy icon
- [ ] Copies full path
- [ ] Success toast "Path copied"

---

---

## Sprint 2 - Medium Priority Features

### EPIC-004: Agent Heartbeat Monitoring

**Epic Summary**: Monitor agent connection status via heartbeat files.

#### Stories

**STORY-004-1: Implement Heartbeat File Watching**
- Points: 5
- Watch `.kanvas/heartbeats/{sessionId}.json`
- Parse heartbeat timestamps
- Emit events on heartbeat received

**STORY-004-2: Add Connection Status Badge**
- Points: 3
- Badge on session card: connected/disconnected/unknown
- Green pulse when active heartbeat
- Gray when no heartbeat received

**STORY-004-3: Implement Timeout Warning**
- Points: 3
- Toast after 5 min without heartbeat
- Link to troubleshooting docs
- Option to dismiss or retry instructions

**STORY-004-4: Show Last Heartbeat Time**
- Points: 2
- Display in session detail view
- Format as "X minutes ago"
- Tooltip with exact timestamp

---

### EPIC-005: Merge Coordination Workflow

**Epic Summary**: Guided merge workflow for bringing agent branches back to main.

#### Stories

**STORY-005-1: Create MergeWorkflowModal Component**
- Points: 8
- Multi-step wizard
- Step 1: Select target branch
- Step 2: Preview changes/conflicts
- Step 3: Execute merge
- Step 4: Cleanup options

**STORY-005-2: Implement Merge Preview**
- Points: 5
- Run `git merge --no-commit --no-ff`
- Show files that will change
- Highlight potential conflicts
- Allow abort

**STORY-005-3: Execute Merge with Progress**
- Points: 5
- Run actual merge
- Stream progress to UI
- Handle conflicts gracefully
- Show success/failure result

**STORY-005-4: Post-Merge Cleanup**
- Points: 3
- Option to delete worktree
- Option to delete local branch
- Option to delete remote branch
- Confirmation for each

---

---

## Sprint 3 - Low Priority Features

### EPIC-006: Recent Repositories Persistence

#### Stories

**STORY-006-1: Integrate electron-store**
- Points: 3
- Add dependency
- Create store schema
- Initialize on app start

**STORY-006-2: Save Recent Repos**
- Points: 2
- Save on repo selection
- Store: path, name, lastUsed, agentCount
- Max 10 entries

**STORY-006-3: Display Recent Repos in Wizard**
- Points: 3
- List in step 1
- Click to select
- Show name and last used date

**STORY-006-4: Per-Repo Settings Memory**
- Points: 3
- Remember default agent type
- Remember default base branch
- Apply on repo selection

---

### EPIC-007: Agent Environment Setup

#### Stories

**STORY-007-1: Create .agent-config File**
- Points: 2
- JSON file in worktree root
- Include: agent type, session ID, task
- Created during worktree setup

**STORY-007-2: Generate VS Code Settings**
- Points: 3
- `.vscode/settings.json` per worktree
- Custom window title with agent name
- Optional: recommended extensions

**STORY-007-3: Document Environment Variables**
- Points**: 2
- Update instructions with env vars
- `KANVAS_SESSION_ID`
- `KANVAS_AGENT_ID`
- `KANVAS_WORKTREE_PATH`

---

## Story Point Summary

| Sprint | Points | Stories |
|--------|--------|---------|
| Sprint 1 | 35 | 12 |
| Sprint 2 | 34 | 8 |
| Sprint 3 | 18 | 7 |
| **Total** | **87** | **27** |

---

## Dependencies Graph

```
STORY-001-3 (Git Command Logging)
    └── STORY-001-1 (TerminalTab Component)

STORY-002-2 (Lock Status in Files)
    └── STORY-002-1 (FileLocksPanel)

STORY-004-2 (Connection Badge)
    └── STORY-004-1 (Heartbeat Watching)

STORY-005-2 (Merge Preview)
    └── STORY-005-1 (MergeWorkflowModal)

STORY-005-3 (Execute Merge)
    └── STORY-005-2 (Merge Preview)

STORY-005-4 (Post-Merge Cleanup)
    └── STORY-005-3 (Execute Merge)

STORY-006-2 (Save Recent Repos)
    └── STORY-006-1 (electron-store)
```

---

## Risk Assessment

| Story | Risk | Mitigation |
|-------|------|------------|
| STORY-005-2 (Merge Preview) | Git conflicts hard to preview | Use `--dry-run` flags, clear messaging |
| STORY-004-1 (Heartbeat) | External agents may not implement | Provide heartbeat library/example |
| STORY-003-1 (Open Terminal) | Cross-platform differences | Start with macOS, add Windows/Linux later |

---

## Notes for Implementation

1. **Start with Terminal View** - Most requested, provides immediate debugging value
2. **Quick Actions are easy wins** - Low effort, high user satisfaction
3. **Heartbeat protocol needs documentation** - External agents need clear spec
4. **Merge workflow is complex** - Consider MVP first (manual conflict resolution)
