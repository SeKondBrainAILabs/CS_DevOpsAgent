#!/bin/bash

# ============================================================================
# Local Installation Helper
# ============================================================================
# Installs the current version of DevOps Agent into a target repository
# for testing purposes without publishing to npm.
# ============================================================================

if [ -z "$1" ]; then
  echo "Usage: $0 /path/to/target/repo"
  echo "Example: $0 ../my-other-project"
  exit 1
fi

TARGET_REPO=$(realpath "$1")
CURRENT_DIR=$(pwd)

echo "📦 Packaging DevOps Agent..."
npm pack

PACKAGE_FILE=$(ls s9n-devops-agent-*.tgz)

if [ -z "$PACKAGE_FILE" ]; then
  echo "❌ Error: Package file not found"
  exit 1
fi

echo "🚀 Installing into $TARGET_REPO..."

cd "$TARGET_REPO" || exit 1

# Install the tarball
npm install -g "$CURRENT_DIR/$PACKAGE_FILE"

# Clean up
cd "$CURRENT_DIR"
rm "$PACKAGE_FILE"

echo "✅ Installation complete!"
echo "You can now run 's9n-devops-agent' or 'devops' in the target repository."
echo "To test Kora, run: s9n-devops-agent chat"
