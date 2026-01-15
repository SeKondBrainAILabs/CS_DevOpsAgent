#!/bin/bash
# Kanvas Electron App Setup Script
# Run this script to set up the Electron app for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Kanvas Electron App Setup                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"
echo -e "${BLUE}[1/6]${NC} Working directory: $PROJECT_ROOT"

# Check Node.js version
echo -e "${BLUE}[2/6]${NC} Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js v18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js v18+ required (found v$NODE_VERSION)${NC}"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} npm $(npm -v) detected"

# Check Python and setuptools (needed for native modules)
echo -e "${BLUE}[2.5/6]${NC} Checking Python setuptools..."
if command -v python3 &> /dev/null; then
    # Check if setuptools is installed (required for Python 3.12+)
    if ! python3 -c "import setuptools" 2>/dev/null; then
        echo -e "${YELLOW}Installing Python setuptools (required for native modules)...${NC}"
        pip3 install setuptools --quiet 2>/dev/null || pip install setuptools --quiet 2>/dev/null || true
    fi
    echo -e "${GREEN}✓${NC} Python setuptools available"
else
    echo -e "${YELLOW}Warning: Python3 not found - native module compilation may fail${NC}"
fi

# Check if we're on the right branch
echo -e "${BLUE}[3/6]${NC} Checking git branch..."
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "dev_sdd_claude_rebuildUX" ]; then
    echo -e "${YELLOW}Warning: You are on branch '$CURRENT_BRANCH'${NC}"
    echo -e "${YELLOW}The Electron app is on 'dev_sdd_claude_rebuildUX' branch${NC}"
    read -p "Switch to dev_sdd_claude_rebuildUX? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git fetch origin
        git checkout dev_sdd_claude_rebuildUX
        echo -e "${GREEN}✓${NC} Switched to dev_sdd_claude_rebuildUX"
    else
        echo -e "${YELLOW}Continuing on current branch...${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} On correct branch: dev_sdd_claude_rebuildUX"
fi

# Clean install dependencies
echo -e "${BLUE}[4/6]${NC} Installing dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}Removing existing node_modules...${NC}"
    rm -rf node_modules
fi

npm install
echo -e "${GREEN}✓${NC} Dependencies installed"

# Rebuild native modules for Electron
echo -e "${BLUE}[5/6]${NC} Rebuilding native modules for Electron..."
echo -e "${YELLOW}This may take a minute...${NC}"
npx electron-rebuild
echo -e "${GREEN}✓${NC} Native modules rebuilt"

# Initialize submodules if needed
echo -e "${BLUE}[6/6]${NC} Checking submodules..."
if [ -f ".gitmodules" ]; then
    git submodule update --init --recursive
    echo -e "${GREEN}✓${NC} Submodules initialized"
else
    echo -e "${GREEN}✓${NC} No submodules to initialize"
fi

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Setup Complete!                                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To start the Electron app, run:"
echo -e "${BLUE}  npm run dev${NC}"
echo ""
echo -e "If you see native module errors, try:"
echo -e "${BLUE}  npx electron-rebuild${NC}"
echo ""
echo -e "For production build:"
echo -e "${BLUE}  npm run build${NC}"
echo ""
