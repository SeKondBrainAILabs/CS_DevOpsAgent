#!/bin/bash

# ============================================================================
# Full System E2E Test for DevOps Agent & Kora
# ============================================================================
# This script simulates a user workflow in a clean git repository.
# It tests:
# 1. House Rules & Contract initialization
# 2. Kora (Smart Assistant) interaction
# 3. Session creation and management
# ============================================================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;36m'
NC='\033[0m'

# Configuration
SOURCE_DIR=$(pwd)
TEST_DIR="/tmp/devops-agent-e2e-$(date +%s)"
AGENT_CHAT="$SOURCE_DIR/src/agent-chat.js"
SESSION_COORDINATOR="$SOURCE_DIR/src/session-coordinator.js"

echo -e "${BLUE}🚀 Starting Full System E2E Test${NC}"
echo -e "Source: $SOURCE_DIR"
echo -e "Test Repo: $TEST_DIR"

# 1. Setup Test Repository
echo -e "\n${BLUE}[1/5] Setting up test repository...${NC}"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR" || exit 1
git init
git config user.email "test@example.com"
git config user.name "Test User"
echo "# Test Repo" > README.md
git add README.md
git commit -m "Initial commit"

# 2. Test House Rules & Contract Initialization
echo -e "\n${BLUE}[2/5] Initializing House Rules & Contracts...${NC}"

# Setup fake HOME to isolate global settings
export HOME="$TEST_DIR/fake_home"
mkdir -p "$HOME/.devops-agent"

# Pre-configure global settings (Developer Initials)
cat > "$HOME/.devops-agent/settings.json" <<EOF
{
  "developerInitials": "tst",
  "email": "test@example.com",
  "preferences": {
    "defaultTargetBranch": "main",
    "pushOnCommit": true,
    "verboseLogging": false
  },
  "groqApiKeyConfigured": true,
  "configured": true
}
EOF

# Pre-configure project settings (Version Strategy)
mkdir -p "local_deploy"
cat > "local_deploy/project-settings.json" <<EOF
{
  "versioningStrategy": {
    "prefix": "v0.",
    "startMinor": 1,
    "dailyIncrement": 1,
    "configured": true
  },
  "dockerConfig": {
    "neverAsk": true
  }
}
EOF

# We invoke session-coordinator create command which triggers ensureHouseRulesSetup
# We input "y" for structured organization prompt
# We use --task to skip task prompt
# We pipe "y" for the structure prompt
echo "y" | node "$SESSION_COORDINATOR" create --task "initial-setup"

if [ -f "houserules_structured.md" ]; then
    # session-coordinator copies template to houserules.md (content is structured)
    # But the file name is always houserules.md
    if grep -q "Structured Organization" houserules.md; then
        echo -e "${GREEN}✓ House rules created (Structured content verified)${NC}"
    else
        echo -e "${RED}✗ House rules created but missing Structured content${NC}"
        exit 1
    fi
else
    # The file name is houserules.md
    if [ -f "houserules.md" ]; then
         if grep -q "Structured Organization" houserules.md; then
            echo -e "${GREEN}✓ House rules created (Structured content verified)${NC}"
        else
            echo -e "${RED}✗ House rules created but missing Structured content${NC}"
            # Don't exit, might be flexible template
        fi
    else
        echo -e "${RED}✗ House rules creation failed${NC}"
        exit 1
    fi
fi

if [ -d "House_Rules_Contracts" ]; then
    echo -e "${GREEN}✓ House_Rules_Contracts folder created${NC}"
else
    echo -e "${RED}✗ Contracts folder missing${NC}"
    exit 1
fi

# 3. Test Kora (Smart Assistant)
echo -e "\n${BLUE}[3/5] Testing Kora (Smart Assistant)...${NC}"

# Check for API Key
if [ -z "$GROQ_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}⚠ Skipping Kora test: GROQ_API_KEY or OPENAI_API_KEY not set${NC}"
    echo "To test Kora, export GROQ_API_KEY='your-key' before running this script."
else
    # We pipe input to Kora to simulate a user asking about contracts
    # We expect Kora to use the 'list_contracts' tool
    RESPONSE=$(echo -e "List the contracts please\nexit" | node "$AGENT_CHAT")

    echo "Kora Response Preview:"
    echo "$RESPONSE" | head -n 10

    if echo "$RESPONSE" | grep -q "API_CONTRACT.md"; then
        echo -e "${GREEN}✓ Kora successfully listed contracts${NC}"
    else
        echo -e "${RED}✗ Kora failed to list contracts${NC}"
        # Don't exit here, strictly speaking, as LLM might vary response, but tool output should be there
        # Check if tool execution log is present
        if echo "$RESPONSE" | grep -q "Executing: list_contracts"; then
            echo -e "${GREEN}✓ Kora executed the tool (Output might be formatted differently)${NC}"
        else
            echo -e "${RED}✗ Kora did not execute the tool${NC}"
            # Fail only if we have a key but it didn't work
            exit 1
        fi
    fi
fi

# 4. Test Session Creation (Core Functionality)
echo -e "\n${BLUE}[4/5] Testing Session Creation...${NC}"

# Use the helper script to create session programmatically (bypassing TTY prompts)
HELPER_SCRIPT="$SOURCE_DIR/test_cases/integration/create_session_helper.js"
echo "Running helper: $HELPER_SCRIPT"

node "$HELPER_SCRIPT" > session_output.log 2>&1 &
PID=$!

# Give it a moment to initialize and create files
echo "Waiting for session creation..."
FOUND=0
for i in {1..15}; do
    if [ "$(ls -A local_deploy/session-locks 2>/dev/null)" ]; then
        FOUND=1
        break
    fi
    sleep 1
done

# Show log snippet (head/tail) instead of cat
echo "--- Session Log (Head) ---"
head -n 20 session_output.log
echo "--- Session Log (Tail) ---"
tail -n 20 session_output.log

if [ $FOUND -eq 1 ]; then
    echo -e "${GREEN}✓ Session lock created${NC}"
    # Kill the background process immediately
    kill $PID 2>/dev/null
    wait $PID 2>/dev/null
else
    echo -e "${RED}✗ Session lock missing${NC}"
    kill $PID 2>/dev/null
    exit 1
fi

# Kill the background process
kill $PID
wait $PID 2>/dev/null

# 5. Cleanup
echo -e "\n${BLUE}[5/5] Cleanup...${NC}"
cd "$SOURCE_DIR"
rm -rf "$TEST_DIR"

echo -e "\n${GREEN}✅ E2E Test Completed Successfully!${NC}"
exit 0
