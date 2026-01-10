# Claude Code Execution: DevOps Agent → Electron Migration

## Project Context

**Product:** SeKondBrain Kanvas  
**Source:** DevOps Agent CLI (`s9n-devops-agent`)  
**Goal:** Convert CLI to Electron desktop app with multi-tab session management

**Source Repo:** `/Volumes/Simba User Data/Development/SecondBrain_Code_Studio/DevOpsAgent`  
**Target:** Create `sekondbrain-kanvas/` as sibling directory

---

## Resources

### Generic Skills (User-Level: ~/.claude/skills/)
| Skill | Path | Use For |
|-------|------|---------|
| Electron App | `~/.claude/skills/electron-app/SKILL.md` | Project scaffold, config |
| Service Migration | `~/.claude/skills/service-migration/SKILL.md` | Node.js → Electron services |
| IPC Layer | `~/.claude/skills/ipc-layer/SKILL.md` | Main ↔ Renderer communication |
| React UI | `~/.claude/skills/react-ui/SKILL.md` | Component patterns |

### Project-Specific (This Repo: .claude/)
| Document | Path | Contains |
|----------|------|----------|
| PRD | `.claude/prd/devops-agent-electron.md` | Requirements, architecture |
| Backlog | `.claude/backlog/devops-agent-electron.json` | Epics, stories, ACs |
| Analysis | `.claude/analysis.json` | Source code analysis |

---

## Execution Flow

### Phase 1: Preparation
```
1. Read PRD: .claude/prd/devops-agent-electron.md
2. Read Backlog: .claude/backlog/devops-agent-electron.json
3. Verify source analysis in .claude/analysis.json
4. Confirm plan before coding
```

### Phase 2: Execute Epics (in order)

| Epic | Name | Stories | Est. Days |
|------|------|---------|-----------|
| EPIC-1 | Project Scaffold | 2 | 2 |
| EPIC-2 | Core Services Migration | 6 | 5 |
| EPIC-3 | IPC Layer | 2 | 2 |
| EPIC-4 | Core UI Components | 4 | 5 |
| EPIC-5 | Feature Components | 5 | 5 |
| EPIC-6 | Polish & Packaging | 2 | 3 |

### Phase 3: Integration & Testing
```
1. npm run dev - verify app launches
2. Test each feature
3. npm run typecheck - no TS errors
4. npm run package:mac - verify packaging
```

---

## Story Execution Template

For each story, follow this pattern:

```markdown
## STORY-{ID}: {Title}

### Reading:
- Skill: ~/.claude/skills/{relevant-skill}/SKILL.md
- Source: {source files from story}

### Acceptance Criteria:
- [ ] AC-X.X.1: {criterion}
- [ ] AC-X.X.2: {criterion}

### Implementation:
{approach}

### Files Created:
- {path}: {description}

### Verification:
- [ ] AC-X.X.1: {how verified}
- [ ] AC-X.X.2: {how verified}

### Status: DONE ✓
```

---

## Service Migration Reference

| Source (src/) | Target (sekondbrain-kanvas/src/main/services/) |
|---------------|------------------------------------------------|
| session-coordinator.js | SessionService.ts |
| worktree-manager.js | GitService.ts |
| cs-devops-agent-worker.js | WatcherService.ts |
| file-coordinator.cjs | LockService.ts |
| file-monitor-enhanced.cjs | ConflictService.ts |
| branch-config-manager.js | ConfigService.ts |
| credentials-manager.js | ConfigService.ts |
| agent-chat.js | AIService.ts |
| instruction-formatter.js | InstructionService.ts |

---

## Commands

```bash
# Development
cd sekondbrain-kanvas
npm run dev          # Launch dev mode
npm run typecheck    # Check TypeScript

# Build & Package
npm run build        # Production build
npm run package:mac  # macOS .dmg
npm run package:win  # Windows installer
npm run package:linux # Linux AppImage
```

---

## Progress Reporting

After each epic, report:

```markdown
## EPIC-{N} Complete: {Name}

### Stories: {X}/{X} ✓
- STORY-X.1: {title} ✓
- STORY-X.2: {title} ✓

### Key Files:
- src/main/services/XService.ts
- src/renderer/components/X.tsx

### Status:
- [x] TypeScript compiles
- [x] App launches
- [x] Features work

### Next: EPIC-{N+1}
```

---

## Quick Start Commands

### Full Migration
```bash
claude "Execute .claude/EXECUTE.md - full migration starting with EPIC-1"
```

### Single Epic
```bash
claude "Execute EPIC-2 from .claude/backlog/devops-agent-electron.json"
```

### Single Story
```bash
claude "Execute STORY-2.1 (SessionService) from backlog. Read ~/.claude/skills/service-migration/SKILL.md first."
```

---

## Begin

Start with **EPIC-1: Project Scaffold**

1. Read `~/.claude/skills/electron-app/SKILL.md`
2. Execute STORY-1.1: Create Electron + React + TypeScript project
3. Execute STORY-1.2: Define shared types
4. Verify with `npm run dev`

Report plan before writing code.
