# PRD: On-Demand Rebase for SeKondBrain Kanvas

## Overview

**Product**: SeKondBrain Kanvas for KIT
**Feature**: On-Demand Rebase & Branch Synchronization
**Version**: 1.0.0
**Date**: January 2025
**Author**: DevOps Agent

## Executive Summary

Enable users to keep agent branches synchronized with the base branch (e.g., `main`) through configurable rebase strategies. This prevents merge conflicts from accumulating over time and ensures agents work with the latest codebase.

---

## Problem Statement

When multiple agents work on feature branches for extended periods:
1. The base branch (`main`) continues to receive updates
2. Agent branches diverge further from the base branch
3. Merge conflicts become larger and more complex over time
4. Final integration requires significant manual conflict resolution

---

## Goals & Success Metrics

### Goals
1. Prevent conflict accumulation through regular rebasing
2. Provide flexible rebase scheduling (on-demand, daily, weekly)
3. Handle uncommitted changes gracefully during rebase
4. Minimize agent disruption during rebase operations
5. Surface rebase conflicts early for human intervention

### Success Metrics
- 90% reduction in merge conflicts at PR time
- Zero data loss during rebase operations (via stash/unstash)
- <10 second rebase operation for typical branches

---

## User Stories

### US-1: Auto-Rebase on Remote Changes (On-Demand Mode)
**As a** developer using Kanvas with multiple agents
**I want** my agent's branch to automatically rebase when the base branch receives new commits
**So that** my agent always works with the latest code without manual intervention

#### Acceptance Criteria
1. When `rebaseFrequency` is set to `on-demand`, Kanvas monitors the remote base branch
2. Polling occurs every 60 seconds (configurable) to check for new commits
3. When new commits are detected on `origin/<baseBranch>`:
   - If agent is idle: Automatically trigger rebase
   - If agent is active: Queue rebase for next idle period
4. User receives notification when auto-rebase completes or fails
5. Rebase conflicts pause auto-rebasing until resolved
6. Polling can be started/stopped per session

### US-2: Manual Rebase Trigger
**As a** developer
**I want to** manually trigger a rebase at any time
**So that** I can sync my branch immediately when needed

### US-3: Rebase Status Visibility
**As a** developer
**I want to** see the current sync status of my agent's branch
**So that** I know how far behind the base branch I am

### US-4: Conflict Notification
**As a** developer
**I want to** be notified immediately when a rebase fails due to conflicts
**So that** I can resolve them before they compound

---

## Feature Requirements

### FR-1: Rebase Frequency Configuration

#### FR-1.1: Frequency Options
| Option | Behavior |
|--------|----------|
| `never` | Never automatically rebase; branch stays as-is |
| `on-demand` | Rebase only when user triggers it from Kanvas UI |
| `daily` | Automatic rebase once per day (configurable time) |
| `weekly` | Automatic rebase once per week (configurable day/time) |

#### FR-1.2: Configuration Storage
```typescript
interface AgentInstanceConfig {
  // ... other fields
  rebaseFrequency: 'never' | 'daily' | 'weekly' | 'on-demand';
  baseBranch: string;  // Branch to rebase onto (e.g., 'main')
}
```

### FR-2: Rebase Operation Flow

#### FR-2.1: Full Rebase Workflow
```
┌─────────────────────────────────────────────────────────────┐
│                    REBASE OPERATION FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. FETCH REMOTE                                             │
│     └─ git fetch origin <baseBranch>                        │
│                                                              │
│  2. CHECK FOR UNCOMMITTED CHANGES                            │
│     └─ git status --porcelain                               │
│                                                              │
│  3. STASH CHANGES (if any)                                   │
│     └─ git stash push -u -m "Auto-stash before rebase"      │
│                                                              │
│  4. PERFORM REBASE                                           │
│     └─ git pull --rebase origin <baseBranch>                │
│                                                              │
│  5. HANDLE RESULT                                            │
│     ├─ Success: Pop stashed changes                         │
│     └─ Conflict: Abort rebase, pop stash, notify user       │
│                                                              │
│  6. REPORT STATUS                                            │
│     └─ Return success/failure with details                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### FR-2.2: Conflict Handling
When conflicts are detected during rebase:
1. **Abort** the rebase operation (`git rebase --abort`)
2. **Restore** any stashed changes
3. **Notify** the user with conflict details
4. **Mark** the session as needing manual intervention
5. **Provide** instructions for manual resolution

### FR-3: Remote Change Detection

#### FR-3.1: Behind/Ahead Status
```typescript
interface RemoteStatus {
  behind: number;  // Commits behind origin/baseBranch
  ahead: number;   // Commits ahead of origin/baseBranch
}
```

#### FR-3.2: Visual Indicators
- **Green**: Up-to-date (behind: 0)
- **Yellow**: 1-5 commits behind (minor drift)
- **Orange**: 6-20 commits behind (moderate drift)
- **Red**: 20+ commits behind (significant drift)

---

## Technical Implementation

### TR-1: IPC Channels

```typescript
// shared/ipc-channels.ts
export const IPC = {
  // Git Rebase Channels
  GIT_FETCH: 'git:fetch',
  GIT_CHECK_REMOTE: 'git:check-remote',
  GIT_REBASE: 'git:rebase',
  GIT_PERFORM_REBASE: 'git:perform-rebase',
  GIT_LIST_WORKTREES: 'git:list-worktrees',
  GIT_PRUNE_WORKTREES: 'git:prune-worktrees',
  GIT_DELETE_BRANCH: 'git:delete-branch',
  GIT_MERGED_BRANCHES: 'git:merged-branches',
} as const;
```

### TR-2: GitService Methods

```typescript
// electron/services/GitService.ts

class GitService {
  /**
   * Fetch latest changes from remote
   */
  async fetchRemote(repoPath: string, remote = 'origin'): Promise<IpcResult<void>>

  /**
   * Check if there are remote changes to pull
   * Returns behind/ahead commit counts
   */
  async checkRemoteChanges(repoPath: string, branch: string): Promise<IpcResult<{
    behind: number;
    ahead: number;
  }>>

  /**
   * Stash uncommitted changes
   * Returns true if changes were stashed, false if nothing to stash
   */
  async stash(repoPath: string, message?: string): Promise<IpcResult<boolean>>

  /**
   * Pop stashed changes
   */
  async stashPop(repoPath: string): Promise<IpcResult<void>>

  /**
   * Simple rebase - git pull --rebase origin <targetBranch>
   * Returns success status and message
   */
  async rebase(repoPath: string, targetBranch: string): Promise<IpcResult<{
    success: boolean;
    message: string;
  }>>

  /**
   * Full rebase operation with automatic stash handling
   * 1. Fetch latest
   * 2. Stash uncommitted changes
   * 3. Perform rebase
   * 4. Pop stash (if we stashed)
   */
  async performRebase(repoPath: string, baseBranch: string): Promise<IpcResult<{
    success: boolean;
    message: string;
    hadChanges: boolean;
  }>>
}
```

### TR-3: Preload API

```typescript
// electron/preload.ts - git API section

git: {
  // Existing methods...

  // Rebase operations
  fetch: (repoPath: string, remote?: string): Promise<IpcResult<void>> =>
    ipcRenderer.invoke(IPC.GIT_FETCH, repoPath, remote),

  checkRemote: (repoPath: string, branch: string): Promise<IpcResult<{
    behind: number;
    ahead: number;
  }>> =>
    ipcRenderer.invoke(IPC.GIT_CHECK_REMOTE, repoPath, branch),

  rebase: (repoPath: string, targetBranch: string): Promise<IpcResult<{
    success: boolean;
    message: string;
  }>> =>
    ipcRenderer.invoke(IPC.GIT_REBASE, repoPath, targetBranch),

  performRebase: (repoPath: string, baseBranch: string): Promise<IpcResult<{
    success: boolean;
    message: string;
    hadChanges: boolean;
  }>> =>
    ipcRenderer.invoke(IPC.GIT_PERFORM_REBASE, repoPath, baseBranch),
}
```

---

## UI/UX Design

### Wizard Configuration (Step 3: Workflow Settings)

```
┌─────────────────────────────────────────────────────────────┐
│  Rebase Frequency                                            │
│  How often should the branch be rebased from the base branch?│
│                                                              │
│  ┌────────┐  ┌───────────┐  ┌────────┐  ┌────────┐         │
│  │ Never  │  │ On-demand │  │ Daily  │  │ Weekly │         │
│  └────────┘  └───────────┘  └────────┘  └────────┘         │
│              ▲ Selected                                      │
└─────────────────────────────────────────────────────────────┘
```

### Session Detail View - Rebase Status

```
┌─────────────────────────────────────────────────────────────┐
│  Branch Sync Status                                          │
│  ─────────────────                                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔴 12 commits behind main                           │   │
│  │                                                       │   │
│  │  Last rebased: 3 days ago                            │   │
│  │  Rebase frequency: On-demand                         │   │
│  │                                                       │   │
│  │  [Rebase Now]  [Check for Updates]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Rebase In Progress Modal

```
┌─────────────────────────────────────────────────────────────┐
│  Rebasing Branch                                       [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⏳ Rebasing feature/add-dark-mode onto main...             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ Fetching latest from origin/main                   │   │
│  │ ✓ Stashing uncommitted changes                       │   │
│  │ ⏳ Performing rebase...                              │   │
│  │ ○ Restoring stashed changes                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Do not close Kanvas while rebase is in progress.           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Rebase Conflict Modal

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Rebase Conflict Detected                           [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  The rebase was aborted due to merge conflicts.              │
│                                                              │
│  Conflicting files:                                          │
│  • src/components/Header.tsx                                 │
│  • src/utils/api.ts                                          │
│                                                              │
│  Your uncommitted changes have been restored.                │
│                                                              │
│  Options:                                                    │
│  1. Resolve conflicts manually and try again                 │
│  2. Continue working and merge later                         │
│  3. Ask the agent to resolve conflicts                       │
│                                                              │
│  [Resolve Manually]  [Continue Working]  [Agent Resolve]    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## User Workflows

### Workflow 1: On-Demand Rebase from Session Detail

1. User opens Session Detail view for an agent
2. User sees "12 commits behind main" status indicator
3. User clicks **[Rebase Now]** button
4. Modal shows rebase progress:
   - Fetching latest...
   - Stashing changes...
   - Rebasing...
   - Restoring changes...
5. Success: "Branch successfully rebased onto main"
6. Session continues with updated codebase

### Workflow 2: Automatic Daily Rebase

1. Agent session configured with `rebaseFrequency: 'daily'`
2. At configured time (e.g., 3:00 AM), Kanvas scheduler triggers rebase
3. If agent is idle:
   - Perform full rebase
   - Log activity to session history
4. If agent is active:
   - Queue rebase for next idle period
   - Notify user of pending rebase
5. If conflicts occur:
   - Abort rebase
   - Mark session as "needs attention"
   - Send notification to user

### Workflow 3: Pre-PR Sync Check

1. User prepares to create PR from agent branch
2. Kanvas shows: "Branch is 5 commits behind main"
3. User clicks **[Sync Before PR]**
4. Rebase completes successfully
5. User proceeds with PR creation from up-to-date branch

---

## Error Handling

### Error States

| Error | Cause | Resolution |
|-------|-------|------------|
| `GIT_FETCH_FAILED` | Network issue, auth failure | Retry, check credentials |
| `GIT_STASH_FAILED` | Stash conflict | Commit or discard changes first |
| `GIT_REBASE_FAILED` | Merge conflicts | Manual resolution required |
| `GIT_STASH_POP_FAILED` | Stash conflicts with rebased code | Manual conflict resolution |

### Recovery Procedures

1. **Failed Fetch**: Retry with exponential backoff, check network
2. **Rebase Conflict**:
   - Abort rebase automatically
   - Restore working state
   - Surface conflicts to user
3. **Stash Pop Conflict**:
   - Rebase was successful
   - Stashed changes conflict with new base
   - User must manually merge their changes

---

## Implementation Status

### Completed ✅

1. **GitService Methods**
   - `fetchRemote()` - Fetch from origin
   - `checkRemoteChanges()` - Behind/ahead detection
   - `stash()` / `stashPop()` - Uncommitted change handling
   - `rebase()` - Simple rebase operation
   - `performRebase()` - Full rebase with stash handling

2. **IPC Channels**
   - All rebase channels registered in `ipc-channels.ts`
   - Handlers implemented in `electron/ipc/index.ts`

3. **Preload API**
   - All git rebase methods exposed to renderer

4. **Configuration**
   - `RebaseFrequency` type defined
   - `AgentInstanceConfig` includes `rebaseFrequency` field
   - CreateAgentWizard UI for selecting frequency

### Pending 🔲

1. **UI Components**
   - Session Detail view with sync status indicator
   - Rebase progress modal
   - Conflict resolution modal

2. **Scheduling**
   - Daily/weekly automatic rebase scheduler
   - Idle detection for safe rebase timing

3. **Notifications**
   - Push notifications for rebase conflicts
   - Email/Slack integration for remote notifications

---

## API Reference

### Perform On-Demand Rebase

```typescript
// From renderer
const result = await window.api.git.performRebase(
  '/path/to/repo',
  'main'
);

if (result.success && result.data?.success) {
  console.log('Rebase successful');
  console.log(`Had uncommitted changes: ${result.data.hadChanges}`);
} else {
  console.error('Rebase failed:', result.data?.message || result.error);
}
```

### Check Remote Status

```typescript
// Check if branch needs rebasing
const status = await window.api.git.checkRemote(
  '/path/to/repo',
  'main'
);

if (status.success) {
  console.log(`Behind: ${status.data.behind}, Ahead: ${status.data.ahead}`);

  if (status.data.behind > 0) {
    // Suggest rebase
  }
}
```

---

## Security Considerations

1. **Credential Handling**: Git credentials are managed by system keychain, not stored in Kanvas
2. **Force Push Prevention**: Rebase does not force push; user must push manually
3. **Branch Protection**: Respects remote branch protection rules
4. **Audit Trail**: All rebase operations logged to session activity

---

## Future Enhancements

1. **Smart Conflict Resolution**: AI-assisted conflict resolution using agent
2. **Rebase Preview**: Show files that will be affected before rebasing
3. **Partial Rebase**: Interactive rebase with commit selection
4. **Cross-Branch Sync**: Sync changes between parallel agent branches
5. **Merge Strategy Options**: Support for merge commit vs rebase vs squash
