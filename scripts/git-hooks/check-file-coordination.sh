#!/usr/bin/env bash
set -euo pipefail

# Optional pre-commit helper for downstream repos using DevOps Agent
#
# This script is intended to be copied into a target repository and wired
# into its Husky pre-commit hook. It delegates to the DevOps Agent
# FileCoordinator CLI to detect:
#   - Undeclared edits (files changed without being listed in
#     .file-coordination/active-edits/*.json)
#   - Conflicts with other agents' active declarations
#
# Usage in .husky/pre-commit (example):
#   scripts/git-hooks/check-file-coordination.sh
#
# Requirements in the target repo:
#   - git
#   - node
#   - DevOps Agent installed as a devDependency:
#       npm install --save-dev s9n-devops-agent
#   - Optional: DEVOPS_SESSION_ID set when running in a DevOps Agent session

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
COORDINATOR_PATH="$ROOT/node_modules/s9n-devops-agent/src/file-coordinator.cjs"

if [ ! -f "$COORDINATOR_PATH" ]; then
  echo "ℹ️  Skipping file-coordination check: s9n-devops-agent not found in node_modules."
  echo "    To enable this check, add s9n-devops-agent as a devDependency in this project."
  exit 0
fi

# Ensure we have a session identifier for reporting. When running inside a
# DevOps Agent worktree, DEVOPS_SESSION_ID should normally be set; otherwise
# we fall back to a generic label.
export DEVOPS_SESSION_ID="${DEVOPS_SESSION_ID:-manual-check}"

echo "🔒 Checking file coordination (declared vs. changed files)..."

# Delegate to the FileCoordinator CLI. It will:
#   - Inspect git diffs for changed/staged files
#   - Compare against .file-coordination/active-edits/*.json
#   - Emit a detailed conflict report under local_deploy/.file-coordination
#   - Exit with 1 if conflicts/undeclared edits are found
node "$COORDINATOR_PATH"