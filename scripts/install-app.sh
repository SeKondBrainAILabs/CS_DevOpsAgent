#!/bin/bash
# =============================================================================
# Kanvas App - Build & Install Script
# Builds the Electron app and installs it to the Applications folder
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

APP_NAME="SeKondBrain Kanvas for KIT (DevOps)"

echo ""
echo -e "${BLUE}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║           KANVAS BUILD & INSTALL                                ║${NC}"
echo -e "${BLUE}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# =============================================================================
# Detect OS
# =============================================================================
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi
echo -e "${BLUE}[1/6]${NC} Detected OS: ${BOLD}$OS${NC}"

# =============================================================================
# Check if dependencies are installed
# =============================================================================
echo -e "${BLUE}[2/6]${NC} Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  node_modules not found. Running npm install...${NC}"
    npm install --legacy-peer-deps
fi

if [ ! -d "node_modules/electron" ]; then
    echo -e "${RED}✗ Electron not installed. Run './setup.sh' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Dependencies OK"

# =============================================================================
# Check for existing installation and offer to remove
# =============================================================================
echo -e "${BLUE}[3/6]${NC} Checking for existing installation..."

INSTALLED_APP=""
if [[ "$OS" == "macos" ]]; then
    if [ -d "/Applications/$APP_NAME.app" ]; then
        INSTALLED_APP="/Applications/$APP_NAME.app"
    fi
elif [[ "$OS" == "linux" ]]; then
    if [ -f "/usr/local/bin/kanvas" ] || [ -f "$HOME/.local/bin/kanvas" ]; then
        INSTALLED_APP="kanvas"
    fi
fi

if [ -n "$INSTALLED_APP" ]; then
    echo -e "${YELLOW}  Found existing installation: $INSTALLED_APP${NC}"
    read -p "  Remove existing installation? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [[ "$OS" == "macos" ]]; then
            rm -rf "/Applications/$APP_NAME.app"
            echo -e "${GREEN}✓${NC} Removed existing app"
        fi
    fi
else
    echo -e "${GREEN}✓${NC} No existing installation found"
fi

# =============================================================================
# Build the app
# =============================================================================
echo -e "${BLUE}[4/6]${NC} Building production app..."

# Clean previous builds
rm -rf dist release

# Build with electron-vite
echo -e "  Building with electron-vite..."
npm run build

echo -e "${GREEN}✓${NC} Build complete"

# =============================================================================
# Package the app
# =============================================================================
echo -e "${BLUE}[5/6]${NC} Packaging for distribution..."

if [[ "$OS" == "macos" ]]; then
    # Build macOS app (without signing for local use)
    npx electron-builder --mac --dir 2>&1 | while read line; do
        if [[ "$line" == *"error"* ]] || [[ "$line" == *"Error"* ]]; then
            echo -e "${RED}  $line${NC}"
        elif [[ "$line" == *"Building"* ]] || [[ "$line" == *"writing"* ]]; then
            echo -e "  $line"
        fi
    done

    BUILT_APP="release/mac-$(uname -m)/$APP_NAME.app"
    if [ ! -d "$BUILT_APP" ]; then
        # Try alternate path
        BUILT_APP="release/mac/$APP_NAME.app"
    fi

    if [ ! -d "$BUILT_APP" ]; then
        echo -e "${RED}✗ Build failed - app not found${NC}"
        echo "  Expected at: release/mac-$(uname -m)/$APP_NAME.app"
        ls -la release/ 2>/dev/null || true
        exit 1
    fi

    echo -e "${GREEN}✓${NC} Package complete: $BUILT_APP"

elif [[ "$OS" == "linux" ]]; then
    npx electron-builder --linux --dir 2>&1 | tail -5
    echo -e "${GREEN}✓${NC} Package complete"

elif [[ "$OS" == "windows" ]]; then
    npx electron-builder --win --dir 2>&1 | tail -5
    echo -e "${GREEN}✓${NC} Package complete"
fi

# =============================================================================
# Install to Applications folder
# =============================================================================
echo -e "${BLUE}[6/6]${NC} Installing to system..."

if [[ "$OS" == "macos" ]]; then
    # Copy to /Applications
    echo -e "  Copying to /Applications..."

    if cp -R "$BUILT_APP" "/Applications/"; then
        echo -e "${GREEN}✓${NC} Installed to: /Applications/$APP_NAME.app"

        # Remove quarantine attribute (for unsigned apps)
        xattr -dr com.apple.quarantine "/Applications/$APP_NAME.app" 2>/dev/null || true

        # Create command-line launcher
        LAUNCHER="/usr/local/bin/kanvas"
        echo -e "  Creating command-line launcher..."

        cat > /tmp/kanvas-launcher << 'EOF'
#!/bin/bash
open -a "SeKondBrain Kanvas for KIT (DevOps)" "$@"
EOF

        if sudo mv /tmp/kanvas-launcher "$LAUNCHER" 2>/dev/null && sudo chmod +x "$LAUNCHER" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} CLI launcher installed: $LAUNCHER"
        else
            echo -e "${YELLOW}  Could not create CLI launcher (needs sudo)${NC}"
            echo -e "  To create manually:"
            echo -e "  sudo bash -c 'echo \"open -a \\\"$APP_NAME\\\"\" > $LAUNCHER && chmod +x $LAUNCHER'"
        fi
    else
        echo -e "${RED}✗ Failed to copy to /Applications${NC}"
        echo -e "  The app was built at: $BUILT_APP"
        echo -e "  You can manually copy it with:"
        echo -e "  cp -R \"$BUILT_APP\" /Applications/"
        exit 1
    fi

elif [[ "$OS" == "linux" ]]; then
    # Install AppImage or create desktop entry
    APPIMAGE=$(find release -name "*.AppImage" | head -1)
    if [ -n "$APPIMAGE" ]; then
        mkdir -p "$HOME/.local/bin"
        cp "$APPIMAGE" "$HOME/.local/bin/kanvas"
        chmod +x "$HOME/.local/bin/kanvas"
        echo -e "${GREEN}✓${NC} Installed to: $HOME/.local/bin/kanvas"
    else
        echo -e "${YELLOW}  No AppImage found - manual installation needed${NC}"
    fi

elif [[ "$OS" == "windows" ]]; then
    echo -e "${YELLOW}  On Windows, run the installer from: release/${NC}"
    explorer.exe release 2>/dev/null || true
fi

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           INSTALLATION COMPLETE!                                ║${NC}"
echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ "$OS" == "macos" ]]; then
    echo -e "To launch Kanvas:"
    echo ""
    echo -e "    ${BOLD}• Spotlight:${NC} Press ⌘+Space, type 'Kanvas'"
    echo -e "    ${BOLD}• Terminal:${NC}  kanvas"
    echo -e "    ${BOLD}• Finder:${NC}    /Applications/$APP_NAME.app"
    echo ""
    echo -e "${YELLOW}Note:${NC} On first launch, macOS may show a security warning."
    echo -e "Go to System Settings → Privacy & Security → click 'Open Anyway'"
    echo ""

    read -p "Launch Kanvas now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open -a "$APP_NAME"
    fi
fi
