# SeKondBrain Kanvas - Full Migration Execution

## Mission
Convert DevOps Agent CLI to Electron desktop app. Execute ALL 6 epics in sequence without stopping.

## Source & Target
- **Source:** This repo (DevOpsAgent)
- **Target:** Create `../sekondbrain-kanvas/` as sibling directory

## Resources to Read First
1. `/Users/sachmans/.claude/skills/electron-app/SKILL.md` - Project scaffolding patterns
2. `/Users/sachmans/.claude/skills/service-migration/SKILL.md` - Node→Electron migration
3. `/Users/sachmans/.claude/skills/ipc-layer/SKILL.md` - IPC communication
4. `/Users/sachmans/.claude/skills/react-ui/SKILL.md` - React component patterns
5. `.claude/prd/devops-agent-electron.md` - Product requirements
6. `.claude/backlog/devops-agent-electron.json` - All epics and stories
7. `.claude/analysis.json` - Source code analysis

---

## EXECUTE ALL EPICS

### EPIC-1: Project Scaffold (Stories 1.1-1.2)
Create the Electron + React + TypeScript project foundation.

**Tasks:**
1. Create `../sekondbrain-kanvas/` directory
2. Initialize with electron-vite: `npm create electron-vite@latest . -- --template react-ts`
3. Add dependencies: electron-store, chokidar, execa, groq-sdk, openai, zustand
4. Configure Tailwind CSS with dark theme
5. Create directory structure: src/main/services/, src/main/ipc/, src/preload/, src/renderer/
6. Create src/shared/types.ts with Session, GitStatus, ActivityLogEntry interfaces
7. Create src/shared/ipc-channels.ts with channel constants
8. Verify: `npm run dev` launches window

**Completion Criteria:** App launches with basic React content.

---

### EPIC-2: Core Services Migration (Stories 2.1-2.6)
Migrate all Node.js modules to TypeScript services.

**Tasks:**
1. **SessionService.ts** ← session-coordinator.js + close-session.js
   - Methods: createSession, listSessions, getSession, closeSession, claimSession
   - Emit IPC events: session:created, session:updated, session:closed

2. **GitService.ts** ← worktree-manager.js
   - Methods: createWorktree, removeWorktree, getStatus, commit, push, merge, listBranches
   - Use execa for async git operations

3. **WatcherService.ts** ← cs-devops-agent-worker.js
   - Methods: startWatching, stopWatching, isWatching
   - Use chokidar, emit: file:changed, commit:triggered, commit:completed

4. **LockService.ts** ← file-coordinator.cjs
   - Methods: declareFiles, releaseFiles, checkConflicts, listDeclarations
   - Emit: conflict:detected

5. **ConfigService.ts** ← branch-config-manager.js + credentials-manager.js
   - Use electron-store for persistence
   - Methods: getSettings, setSettings, getCredential, setCredential

6. **AIService.ts** ← agent-chat.js
   - Methods: sendMessage, streamChat
   - Support Groq SDK streaming

7. Wire all services in src/main/index.ts

**Completion Criteria:** All services compile, instantiate in main process.

---

### EPIC-3: IPC Layer (Stories 3.1-3.2)
Create type-safe communication between main and renderer.

**Tasks:**
1. **src/preload/index.ts** - contextBridge API exposing:
   - window.api.session.{create, list, get, close, claim, onUpdated}
   - window.api.git.{status, commit, push, merge, branches}
   - window.api.watcher.{start, stop, onFileChanged, onCommitTriggered}
   - window.api.config.{get, set}
   - window.api.ai.{chat, stream, onStreamChunk, onStreamEnd}
   - window.api.activity.{onLog}

2. **src/main/ipc/index.ts** - Register all handlers with ipcMain.handle()

3. **src/renderer/types/electron.d.ts** - Declare window.api types

**Completion Criteria:** TypeScript compiles, IPC calls work end-to-end.

---

### EPIC-4: Core UI Components (Stories 4.1-4.4)
Build the React layout structure.

**Tasks:**
1. **Zustand Stores:**
   - sessionStore.ts: sessions Map, activeSessionId, CRUD actions
   - activityStore.ts: logs Map per session
   - uiStore.ts: modals, sidebar state

2. **Layout Components:**
   - TabBar.tsx: Multi-session tabs with +/x buttons
   - Sidebar.tsx: Sessions list, branch tree, file locks, action buttons
   - StatusBar.tsx: Session info, commit count, status indicator
   - MainLayout.tsx: Flexbox layout combining all

3. **Session Components:**
   - SessionCanvas.tsx: Main work area with split pane
   - SplitPane.tsx: Draggable resizable panels

4. **App.tsx:** Wire TabBar + MainLayout

**Completion Criteria:** UI renders with tabs, sidebar, main canvas area.

---

### EPIC-5: Feature Components (Stories 5.1-5.5)
Build interactive feature components.

**Tasks:**
1. **ChatPanel.tsx** + ChatMessage.tsx + ChatInput.tsx
   - Message list with user/assistant styling
   - Streaming responses with typing indicator
   - Auto-scroll, Enter to send

2. **ActivityLog.tsx**
   - Color-coded entries (success, error, warning, info, commit)
   - Timestamps, auto-scroll

3. **NewSessionWizard.tsx**
   - Modal form: repo path, task name, agent type dropdown
   - Creates session and opens in new tab

4. **CloseSessionDialog.tsx**
   - Confirmation with merge options
   - Shows uncommitted changes warning

5. **SettingsModal.tsx** + CredentialsForm.tsx + BranchConfigForm.tsx
   - API key entry (masked)
   - Branch settings

6. **BranchTree.tsx** - Hierarchical branch visualization
7. **FileLockList.tsx** - Active file locks display

**Completion Criteria:** All features functional in UI.

---

### EPIC-6: Polish & Packaging (Stories 6.1-6.2)
Final touches and cross-platform builds.

**Tasks:**
1. **Keyboard Shortcuts:**
   - Ctrl/Cmd+N: New session
   - Ctrl/Cmd+W: Close session
   - Ctrl+Tab: Next tab
   - Ctrl/Cmd+,: Settings

2. **electron-builder.yml** configuration for Mac/Win/Linux

3. **App icons** in resources/ folder

4. **Test full flow:**
   - Create session → worktree created
   - Start watching → file changes logged
   - Write commit message → auto-commit triggered
   - Close session → merge completed

**Completion Criteria:** `npm run package:mac` produces working .dmg

---

## Execution Rules

1. **Read skills BEFORE coding** - They contain critical patterns
2. **Complete each epic fully** before moving to next
3. **Test after each epic** - Run `npm run dev`, fix errors
4. **No placeholders** - Implement real functionality
5. **TypeScript strict** - No `any` types, proper interfaces

## Progress Output

After EACH epic, output:
```
═══════════════════════════════════════════
EPIC-{N} COMPLETE: {Name}
═══════════════════════════════════════════
Stories: {completed}/{total}
Files Created: {count}
Status: ✓ Compiles | ✓ Runs | ✓ Features Work
Next: EPIC-{N+1}
═══════════════════════════════════════════
```

## Final Output

After EPIC-6, output:
```
═══════════════════════════════════════════
MIGRATION COMPLETE
═══════════════════════════════════════════
Project: sekondbrain-kanvas
Location: ../sekondbrain-kanvas/

To run:
  cd ../sekondbrain-kanvas
  npm run dev

To package:
  npm run package:mac
  npm run package:win
  npm run package:linux

All 6 epics completed successfully.
═══════════════════════════════════════════
```

---

## BEGIN NOW

Start with EPIC-1. Read the electron-app skill first. Create the project scaffold. Then continue through all remaining epics without stopping.
