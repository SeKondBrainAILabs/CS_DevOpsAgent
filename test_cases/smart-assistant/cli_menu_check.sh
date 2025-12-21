#!/bin/bash

# Test to verify Kora integration in start-devops-session.sh

SCRIPT="start-devops-session.sh"

echo "Checking $SCRIPT for Kora menu option..."

if grep -q "0).*Kora (Smart Assistant)" "$SCRIPT"; then
  echo "✅ PASS: Menu option found"
else
  echo "❌ FAIL: Menu option missing"
  exit 1
fi

if grep -q "node \"\$SRC_DIR/agent-chat.js\"" "$SCRIPT"; then
  echo "✅ PASS: Launch command found"
else
  echo "❌ FAIL: Launch command missing"
  exit 1
fi

# Also verify the agent-chat.js file exists and is executable
if [ -x "src/agent-chat.js" ]; then
  echo "✅ PASS: src/agent-chat.js exists and is executable"
else
  echo "❌ FAIL: src/agent-chat.js missing or not executable"
  exit 1
fi

echo "All CLI integration checks passed."
exit 0
