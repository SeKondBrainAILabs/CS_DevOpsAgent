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

# App name - will be detected from build output
APP_NAME=""

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

# Check for any Kanvas-related apps in /Applications
INSTALLED_APPS=()
if [[ "$OS" == "macos" ]]; then
    while IFS= read -r -d '' app; do
        INSTALLED_APPS+=("$app")
    done < <(find /Applications -maxdepth 1 -name "*Kanvas*.app" -print0 2>/dev/null)
elif [[ "$OS" == "linux" ]]; then
    if [ -f "/usr/local/bin/kanvas" ] || [ -f "$HOME/.local/bin/kanvas" ]; then
        INSTALLED_APPS+=("kanvas")
    fi
fi

if [ ${#INSTALLED_APPS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  Found existing installation(s):${NC}"
    for app in "${INSTALLED_APPS[@]}"; do
        echo -e "    - $app"
    done
    read -p "  Remove existing installation(s)? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for app in "${INSTALLED_APPS[@]}"; do
            rm -rf "$app"
        done
        echo -e "${GREEN}✓${NC} Removed existing app(s)"
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
        elif [[ "$line" == *"Building"* ]] || [[ "$line" == *"packaging"* ]] || [[ "$line" == *"downloading"* ]]; then
            echo -e "  $line"
        fi
    done

    # Find the built .app dynamically (handles different productName configs)
    BUILT_APP=""
    for search_dir in "release/mac-$(uname -m)" "release/mac" "release"; do
        if [ -d "$search_dir" ]; then
            FOUND_APP=$(find "$search_dir" -maxdepth 1 -name "*.app" -type d | head -1)
            if [ -n "$FOUND_APP" ]; then
                BUILT_APP="$FOUND_APP"
                APP_NAME=$(basename "$BUILT_APP" .app)
                break
            fi
        fi
    done

    if [ -z "$BUILT_APP" ] || [ ! -d "$BUILT_APP" ]; then
        echo -e "${RED}✗ Build failed - app not found${NC}"
        echo "  Searched in: release/mac-$(uname -m), release/mac, release"
        ls -laR release/ 2>/dev/null | head -20 || true
        exit 1
    fi

    echo -e "${GREEN}✓${NC} Package complete: $BUILT_APP (App: $APP_NAME)"

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

    DEST_APP="/Applications/$APP_NAME.app"

    if cp -R "$BUILT_APP" "$DEST_APP"; then
        echo -e "${GREEN}✓${NC} Installed to: $DEST_APP"

        # Remove quarantine attribute (for unsigned apps)
        xattr -dr com.apple.quarantine "$DEST_APP" 2>/dev/null || true

        # Create command-line launcher
        LAUNCHER="/usr/local/bin/kanvas"
        echo -e "  Creating command-line launcher..."

        cat > /tmp/kanvas-launcher << EOF
#!/bin/bash
open -a "$APP_NAME" "\$@"
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
    echo -e "To launch the app:"
    echo ""
    echo -e "    ${BOLD}• Spotlight:${NC} Press ⌘+Space, type '$APP_NAME'"
    echo -e "    ${BOLD}• Terminal:${NC}  kanvas"
    echo -e "    ${BOLD}• Finder:${NC}    $DEST_APP"
    echo ""
    echo -e "${YELLOW}Note:${NC} On first launch, macOS may show a security warning."
    echo -e "Go to System Settings → Privacy & Security → click 'Open Anyway'"
    echo ""

    read -p "Launch the app now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open -a "$APP_NAME" || open "$DEST_APP"
    fi
fi
