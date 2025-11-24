# DevOps Agent v2.0 - Developer Quick Reference

**Last Updated:** October 31, 2025

---

## 🚀 Quick Start Commands

```bash
# Interactive tutorial (new users)
s9n-devops-agent tutorial

# Browse help topics
s9n-devops-agent help-topics

# Start a session
s9n-devops-agent start

# List active sessions
s9n-devops-agent list

# Close a session
s9n-devops-agent close <session-id>
```

---

## 📦 v2.0 Module Architecture

### Core Modules

```
src/
├── ui-utils.js              (509 lines) - Terminal UI foundation
├── help-system.js           (475 lines) - Interactive help
├── tutorial-mode.js         (550 lines) - Learning system
└── instruction-formatter.js (346 lines) - AI instructions
```

### Module Dependencies

```
tutorial-mode.js
  ├── ui-utils.js
  └── help-system.js

instruction-formatter.js
  └── ui-utils.js

help-system.js
  └── ui-utils.js
```

---

## 🎨 Using UI Utilities

### Import

```javascript
import {
  colors,
  status,
  box,
  showWelcome,
  sectionTitle,
  explain,
  tip,
  warn,
  info,
  success,
  error,
  confirm,
  choose,
  prompt,
  progressStep,
  drawSection
} from './ui-utils.js';
```

### Common Patterns

```javascript
// Section headers
sectionTitle('My Feature');

// Explanations
explain('This is how it works...');

// Tips and warnings
tip('Pro tip: Use shortcuts!');
warn('Be careful with this');

// User interaction
const answer = await confirm('Continue?', true);
const choice = await choose('Pick one:', ['Option 1', 'Option 2']);
const input = await prompt('Enter name:');

// Status messages
success('Operation completed!');
error('Something went wrong!');
info('FYI: Here is some info');

// Progress indicators
progressStep(1, 5, 'Starting...');

// Visual sections
drawSection('Title', [
  'Line 1',
  'Line 2',
  'Line 3'
]);

// Colors and icons
console.log(`${status.checkmark} ${colors.green}Success!${colors.reset}`);
console.log(`${status.error} ${colors.red}Failed!${colors.reset}`);
```

---

## 📚 Help System API

### Import

```javascript
import { showTopicHelp, helpBrowser } from './help-system.js';
```

### Usage

```javascript
// Show specific help topic
await showTopicHelp('sessions');
await showTopicHelp('file-coordination');

// Launch interactive help browser
await helpBrowser();
```

### Available Topics

1. `sessions` - Understanding Sessions
2. `file-coordination` - File Coordination
3. `agents` - Working with AI Agents
4. `house-rules` - House Rules
5. `commit-messages` - Commit Messages
6. `worktrees` - Git Worktrees
7. `troubleshooting` - Troubleshooting
8. `workflows` - Workflows
9. `advanced` - Advanced Features

---

## 📖 Tutorial Mode API

### Import

```javascript
import { runTutorial } from './tutorial-mode.js';
```

### Usage

```javascript
// Full tutorial
await runTutorial({ quick: false });

// Quick tutorial
await runTutorial({ quick: true });
```

### Modules

1. Understanding Sessions
2. Creating Your First Session
3. Working with AI Assistants
4. Multi-Agent Workflow
5. Advanced Features

---

## 📝 Instruction Formatter API

### Import

```javascript
import {
  formatInstructions,
  formatCondensedInstructions,
  formatResumeInstructions,
  formatClosingInstructions
} from './instruction-formatter.js';
```

### Usage

```javascript
// Full instructions for new session
const instructions = formatInstructions({
  id: 'abc1-23d4',
  task: 'implement-auth',
  agent: 'claude',
  worktreePath: '/path/to/worktree',
  houseRulesPath: '/path/to/houserules.md'
}, {
  testCommand: 'npm test',
  dockerEnabled: true
});

// Condensed version
const condensed = formatCondensedInstructions(session);

// Resume instructions
const resume = formatResumeInstructions(session);

// Closing instructions
const closing = formatClosingInstructions(session);
```

---

## 🎯 Design Principles

### 1. Progressive Disclosure
Start simple, reveal complexity as needed. Don't overwhelm users.

### 2. Visual Hierarchy
Use colors, icons, and formatting to guide attention.

### 3. Contextual Help
Provide help where users need it, when they need it.

### 4. Interactive Learning
Let users learn by doing, not just reading.

### 5. Clear Language
No jargon without explanation. Use plain English.

### 6. Quick Wins
Users should succeed in <2 minutes.

### 7. Power Preserved
All advanced features remain accessible.

---

## 🔧 Code Standards

### Terminal Output

```javascript
// ✅ Good: Use UI utilities
import { success, colors } from './ui-utils.js';
success('Operation completed!');

// ❌ Bad: Plain console.log for user messages
console.log('Operation completed!');
```

### User Input

```javascript
// ✅ Good: Use confirm/choose/prompt
const answer = await confirm('Continue?', true);

// ❌ Bad: Raw readline
const rl = readline.createInterface({ ... });
```

### Help Text

```javascript
// ✅ Good: What/Why/How structure
explain(`
What: Sessions isolate AI agent work
Why: Prevents conflicts between agents
How: Creates worktree + branch + locks
`);

// ❌ Bad: Just facts
console.log('Sessions use worktrees');
```

---

## 📏 Success Metrics

### Code Quality
- ✅ No console.log for user-facing output (use UI utilities)
- ✅ All user prompts use confirm/choose/prompt
- ✅ Consistent color/icon usage
- ✅ Clear error messages with guidance

### User Experience
- ✅ Setup time <2 minutes
- ✅ Help available contextually
- ✅ Visual hierarchy clear
- ✅ Examples included

### Documentation
- ✅ What/Why/How structure
- ✅ Code examples included
- ✅ Screenshots/visuals where helpful
- ✅ Troubleshooting section

---

## 🧪 Testing & Hooks Guidelines

### Manual Testing

```bash
# Test tutorial
s9n-devops-agent tutorial
s9n-devops-agent tutorial quick

# Test help
s9n-devops-agent help-topics
# Navigate through all topics
# Verify examples render correctly

# Test session workflow
s9n-devops-agent start
# Create session
# Verify instructions are beautiful
# Verify file coordination works
# Close session successfully
```

### Working with Husky / commit hooks

- DevOps Agent commits *always* go through your local hooks (Husky, commitlint, lint-staged); the worker does not add `--no-verify`.
- If a hook fails, rerun the same commands locally (for example `npm run validate`, `npm run type-check`, or project-specific scripts) and fix the issues before retrying.
- In multi-agent setups, projects can optionally enforce declared edits in pre-commit by wiring a helper like `scripts/git-hooks/check-file-coordination.sh` into `.husky/pre-commit` in the target repo.

### Visual Testing

- [ ] Colors render correctly
- [ ] Box drawing characters work
- [ ] Icons display properly
- [ ] Alignment is consistent
- [ ] No text overflow
- [ ] Prompts are clear

### Compatibility Testing

- [ ] macOS Terminal
- [ ] iTerm2
- [ ] Linux terminal
- [ ] Windows Terminal
- [ ] WSL
- [ ] VS Code terminal

---

## 🚨 Common Pitfalls

### 1. Forgetting to import UI utilities
```javascript
// ❌ Wrong
console.log('Success!');

// ✅ Right
import { success } from './ui-utils.js';
success('Success!');
```

### 2. Not using colors.reset
```javascript
// ❌ Wrong - color bleeds
console.log(`${colors.green}Success!`);

// ✅ Right - color contained
console.log(`${colors.green}Success!${colors.reset}`);
```

### 3. Hardcoding file paths
```javascript
// ❌ Wrong
const path = '/Users/me/project/file.js';

// ✅ Right
import path from 'path';
const filePath = path.join(worktreePath, 'file.js');
```

### 4. Unclear help text
```javascript
// ❌ Wrong - just facts
explain('Sessions use worktrees');

// ✅ Right - What/Why/How
explain(`
What: A session is an isolated workspace
Why: Prevents conflicts between AI agents
How: Creates a git worktree with dedicated branch
`);
```

---

## 📋 Pre-Commit Checklist

Before committing v2.0 code:

- [ ] Used UI utilities for all output
- [ ] Followed color/icon conventions
- [ ] Clear What/Why/How structure
- [ ] Examples included where appropriate
- [ ] Tested in terminal
- [ ] No console.log in production code
- [ ] Error messages include guidance
- [ ] Commit message follows convention

---

## 🔗 Related Documentation

- **Full Status Report:** `docs/V2_STATUS_REPORT.md`
- **Implementation Guide:** `docs/V2_IMPLEMENTATION_GUIDE.md`
- **Progress Tracker:** `docs/V2_IMPLEMENTATION_PROGRESS.md`
- **README:** `README.md`
- **Old README:** `README.v1.md`

---

## 💡 Tips for Contributors

### Starting Point
1. Read `V2_STATUS_REPORT.md` first
2. Review `ui-utils.js` API
3. Look at `tutorial-mode.js` as example
4. Follow existing patterns

### Adding New Features
1. Import UI utilities
2. Use consistent color scheme
3. Add help topic if needed
4. Update this reference
5. Test in terminal

### Writing Help Content
1. Start with "What is this?"
2. Explain "Why does it matter?"
3. Show "How do I use it?"
4. Include concrete examples
5. Add troubleshooting tips

---

**Questions?** Check `docs/V2_STATUS_REPORT.md` or existing modules for examples.

**Ready to contribute?** Follow the patterns, use the utilities, keep it visual! 🎨
