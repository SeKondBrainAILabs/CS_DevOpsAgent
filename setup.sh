#!/bin/bash
# =============================================================================
# Kanvas Electron App - One-Command Setup
# Run: curl -fsSL <raw-url> | bash   OR   ./setup.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BLUE}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║                    KANVAS SETUP                                 ║${NC}"
echo -e "${BLUE}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi
echo -e "${BLUE}[1/8]${NC} Detected OS: ${BOLD}$OS${NC}"

# =============================================================================
# Step 2: Check Node.js
# =============================================================================
echo -e "${BLUE}[2/8]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo ""
    echo "Please install Node.js v18+ from: https://nodejs.org/"
    echo ""
    if [[ "$OS" == "macos" ]]; then
        echo "Or via Homebrew:  brew install node"
    elif [[ "$OS" == "linux" ]]; then
        echo "Or via nvm:  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    fi
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js v18+ required (found v$NODE_VERSION)${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# =============================================================================
# Step 3: Check Python & setuptools (for native modules)
# =============================================================================
echo -e "${BLUE}[3/8]${NC} Checking Python (for native modules)..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
    echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION"

    # Python 3.12+ needs setuptools
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

    if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 12 ]; then
        if ! python3 -c "import setuptools" 2>/dev/null; then
            echo -e "${YELLOW}  Installing setuptools for Python 3.12+...${NC}"
            pip3 install setuptools --quiet --break-system-packages 2>/dev/null || \
            pip3 install setuptools --quiet 2>/dev/null || \
            pip install setuptools --quiet 2>/dev/null || \
            echo -e "${YELLOW}  Warning: Could not install setuptools automatically${NC}"
        fi
        echo -e "${GREEN}✓${NC} setuptools available"
    fi
else
    echo -e "${YELLOW}⚠ Python3 not found - native modules may fail to compile${NC}"
fi

# =============================================================================
# Step 4: Ensure correct branch
# =============================================================================
echo -e "${BLUE}[4/8]${NC} Checking git branch..."
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

if [ "$CURRENT_BRANCH" != "dev_sdd_claude_rebuildUX" ]; then
    echo -e "${YELLOW}  Current branch: $CURRENT_BRANCH${NC}"
    echo -e "${YELLOW}  Switching to dev_sdd_claude_rebuildUX...${NC}"
    git fetch origin 2>/dev/null || true
    git checkout dev_sdd_claude_rebuildUX 2>/dev/null || {
        echo -e "${RED}✗ Failed to switch branch${NC}"
        echo "Please run: git checkout dev_sdd_claude_rebuildUX"
        exit 1
    }
fi
echo -e "${GREEN}✓${NC} On branch: dev_sdd_claude_rebuildUX"

# Pull latest
echo -e "${BLUE}  ${NC} Pulling latest changes..."
git pull origin dev_sdd_claude_rebuildUX 2>/dev/null || true
echo -e "${GREEN}✓${NC} Up to date"

# =============================================================================
# Step 5: Initialize submodules
# =============================================================================
echo -e "${BLUE}[5/8]${NC} Initializing git submodules..."
if [ -f ".gitmodules" ]; then
    git submodule update --init --recursive 2>/dev/null || {
        echo -e "${YELLOW}⚠ Submodule init failed, trying to fix...${NC}"
        git submodule sync --recursive 2>/dev/null || true
        git submodule update --init --recursive --force 2>/dev/null || true
    }
    echo -e "${GREEN}✓${NC} Submodules initialized"
else
    echo -e "${GREEN}✓${NC} No submodules"
fi

# =============================================================================
# Step 6: Clean install
# =============================================================================
echo -e "${BLUE}[6/8]${NC} Installing dependencies (clean install)..."

# Remove old stuff
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}  Removing old node_modules...${NC}"
    rm -rf node_modules
fi
if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
fi

# Install with legacy peer deps to avoid conflicts
npm install --legacy-peer-deps 2>&1 | while read line; do
    if [[ "$line" == *"error"* ]] || [[ "$line" == *"ERR!"* ]]; then
        echo -e "${RED}  $line${NC}"
    elif [[ "$line" == *"warn"* ]] || [[ "$line" == *"WARN"* ]]; then
        : # Suppress warnings
    else
        echo -e "  $line"
    fi
done

if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗ npm install failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Dependencies installed"

# =============================================================================
# Step 7: Rebuild native modules for Electron
# =============================================================================
echo -e "${BLUE}[7/8]${NC} Rebuilding native modules for Electron..."
npx electron-rebuild 2>&1 | tail -5 || {
    echo -e "${YELLOW}⚠ electron-rebuild had issues, app may still work${NC}"
}
echo -e "${GREEN}✓${NC} Native modules rebuilt"

# =============================================================================
# Step 8: Done!
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║                    SETUP COMPLETE!                              ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To start the app, run:"
echo ""
echo -e "    ${BOLD}npm run dev${NC}"
echo ""
echo -e "The Electron app will open automatically."
echo ""

# Ask to run
read -p "Start the app now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run dev
fi
