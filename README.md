# Kanvas - AI Agent Dashboard

**Desktop app for managing AI coding agents across your repositories**

Kanvas monitors Claude, Cursor, Copilot, and other AI agents working on your codebase. It handles git operations, prevents conflicts, and tracks changes automatically.

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/SeKondBrainAILabs/CS_DevOpsAgent.git
cd CS_DevOpsAgent

# Run the setup script (handles everything)
./setup.sh
```

That's it! The setup script will:
- Check Node.js v18+ and Python requirements
- Initialize git submodules (requires GitHub access)
- Install dependencies
- Rebuild native modules for Electron
- Offer to start the app

### Manual Setup

If you prefer to do it manually:

```bash
# Switch to Electron branch
git checkout dev_sdd_claude_rebuildUX

# Initialize submodule (requires GitHub repo access)
git submodule update --init --recursive

# Install setuptools (required for Python 3.12+)
pip3 install setuptools

# Install dependencies
npm install --legacy-peer-deps

# Rebuild native modules
npx electron-rebuild

# Start the app
npm run dev
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent Dashboard** | Monitor multiple AI agents across repos |
| **Session Management** | Create isolated worktrees for each task |
| **Auto-Commit** | Automatic commits as agents make changes |
| **Contract Detection** | Track API/schema changes |
| **Activity Logging** | Real-time feed with persistence |
| **Merge Workflow** | Safe merging with conflict detection |

---

## Usage

### 1. Create a Session

1. Click **"+ New Session"** in the sidebar
2. Select your repository
3. Choose agent type (Claude, Cursor, Copilot, etc.)
4. Enter a branch name and task description
5. Click **Create**

### 2. Get Agent Instructions

1. Click on your session
2. Go to **Prompt** tab
3. Click **"Copy Full Instructions"**
4. Paste into your AI agent

### 3. Monitor Progress

- **Activity Tab** - See commits, file changes, and logs
- **Files Tab** - View files changed in the session
- **Contracts Tab** - Track API/schema modifications

---

## Troubleshooting

### "Authentication failed" for submodule

You need access to the private `Core_Ai_Backend` repo.

**Quickest fix - Use GitHub CLI:**
```bash
brew install gh   # or: sudo apt install gh
gh auth login
./setup.sh
```

**Alternative - Personal Access Token:**
```bash
# 1. Create token at https://github.com/settings/tokens (with 'repo' scope)
# 2. Store credentials
git config --global credential.helper store
# 3. Clone any private repo to trigger auth
git clone https://github.com/SeKondBrainAILabs/Core_Ai_Backend.git /tmp/test
# Enter: username + paste token as password
rm -rf /tmp/test
# 4. Run setup again
./setup.sh
```

### "ModuleNotFoundError: No module named 'distutils'"

Python 3.12+ removed distutils. Install setuptools:
```bash
pip3 install setuptools
```

### Native module errors

Rebuild for Electron:
```bash
npx electron-rebuild
```

---

## Requirements

- **Node.js** 18+
- **Python** 3.x with setuptools
- **Git** 2.x
- **GitHub access** to SeKondBrainAILabs repos

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests |
| `npm run cli` | Run legacy CLI version |

---

## Architecture

```
├── electron/           # Main process
│   ├── services/       # Git, Session, AI services
│   ├── ipc/            # IPC handlers
│   └── preload.ts      # Renderer bridge
├── renderer/           # React frontend
│   ├── components/     # UI components
│   └── store/          # Zustand state
├── shared/             # Shared types
├── ai-backend/         # AI config submodule
└── setup.sh            # Setup script
```

---

## License

MIT - SeKondBrain AI Labs

## Support

- [GitHub Issues](https://github.com/SeKondBrainAILabs/CS_DevOpsAgent/issues)
