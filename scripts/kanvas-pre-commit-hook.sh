#!/bin/bash
# Kanvas Pre-Commit Hook
# Analyzes staged files and updates contracts before commit
# Part of the Repository Analysis Engine - Phase 4

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
KANVAS_DIR=".S9N_KIT_DevOpsAgent"
ANALYSIS_CACHE_DIR="$KANVAS_DIR/analysis/cache"
CONTRACTS_DIR="$KANVAS_DIR/contracts"
BLOCK_ON_BREAKING=${KANVAS_BLOCK_ON_BREAKING:-false}

echo -e "${BLUE}[Kanvas]${NC} Running pre-commit analysis..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}[Kanvas]${NC} No staged files to analyze"
    exit 0
fi

# Count staged files
FILE_COUNT=$(echo "$STAGED_FILES" | wc -l | tr -d ' ')
echo -e "${BLUE}[Kanvas]${NC} Analyzing $FILE_COUNT staged files..."

# Check for contract-related files
CONTRACT_FILES=""
API_FILES=""
SCHEMA_FILES=""
TEST_FILES=""

for file in $STAGED_FILES; do
    # API files
    if [[ "$file" =~ (routes|api|controllers|endpoints|handlers).*\.(ts|js|tsx|jsx)$ ]] || \
       [[ "$file" =~ \.(graphql|proto)$ ]] || \
       [[ "$file" =~ (openapi|swagger)\.(yaml|json)$ ]]; then
        API_FILES="$API_FILES$file\n"
        CONTRACT_FILES="$CONTRACT_FILES$file\n"
    fi

    # Schema files
    if [[ "$file" =~ (types|interfaces|models|entities|schemas).*\.(ts|js)$ ]] || \
       [[ "$file" =~ \.d\.ts$ ]] || \
       [[ "$file" =~ schema\.(prisma|sql|json)$ ]] || \
       [[ "$file" =~ \.sql$ ]]; then
        SCHEMA_FILES="$SCHEMA_FILES$file\n"
        CONTRACT_FILES="$CONTRACT_FILES$file\n"
    fi

    # Test files
    if [[ "$file" =~ \.(test|spec|e2e)\.(ts|tsx|js|jsx)$ ]]; then
        TEST_FILES="$TEST_FILES$file\n"
    fi
done

# Report findings
if [ -n "$API_FILES" ]; then
    API_COUNT=$(echo -e "$API_FILES" | grep -c . || true)
    echo -e "${YELLOW}[Kanvas]${NC} Found $API_COUNT API file(s) modified"
fi

if [ -n "$SCHEMA_FILES" ]; then
    SCHEMA_COUNT=$(echo -e "$SCHEMA_FILES" | grep -c . || true)
    echo -e "${YELLOW}[Kanvas]${NC} Found $SCHEMA_COUNT schema file(s) modified"
fi

if [ -n "$TEST_FILES" ]; then
    TEST_COUNT=$(echo -e "$TEST_FILES" | grep -c . || true)
    echo -e "${GREEN}[Kanvas]${NC} Found $TEST_COUNT test file(s) modified"
fi

# Check for potential breaking changes
BREAKING_CHANGES=false
BREAKING_FILES=""

if [ -n "$CONTRACT_FILES" ]; then
    echo -e "${BLUE}[Kanvas]${NC} Checking for breaking changes..."

    for file in $(echo -e "$CONTRACT_FILES" | sort -u); do
        if [ -z "$file" ]; then continue; fi

        # Check if file exists in HEAD (modified vs new)
        if git show HEAD:"$file" &>/dev/null 2>&1; then
            # Get diff stats
            DELETIONS=$(git diff --cached --numstat "$file" 2>/dev/null | awk '{print $2}' || echo "0")

            # Significant deletions might indicate breaking changes
            if [ "$DELETIONS" -gt "10" ]; then
                BREAKING_CHANGES=true
                BREAKING_FILES="$BREAKING_FILES  - $file (removed $DELETIONS lines)\n"
            fi

            # Check for removed exports in TypeScript files
            if [[ "$file" =~ \.(ts|tsx)$ ]]; then
                OLD_EXPORTS=$(git show HEAD:"$file" 2>/dev/null | grep -c "^export " || echo "0")
                NEW_EXPORTS=$(git diff --cached --no-prefix "$file" 2>/dev/null | grep "^+" | grep -c "export " || echo "0")
                REMOVED_EXPORTS=$(git diff --cached --no-prefix "$file" 2>/dev/null | grep "^-" | grep -c "export " || echo "0")

                if [ "$REMOVED_EXPORTS" -gt "0" ]; then
                    BREAKING_CHANGES=true
                    BREAKING_FILES="$BREAKING_FILES  - $file (removed $REMOVED_EXPORTS export(s))\n"
                fi
            fi
        fi
    done
fi

# Report breaking changes
if [ "$BREAKING_CHANGES" = true ]; then
    echo -e "${RED}[Kanvas]${NC} Potential breaking changes detected:"
    echo -e "$BREAKING_FILES"

    if [ "$BLOCK_ON_BREAKING" = true ]; then
        echo -e "${RED}[Kanvas]${NC} Commit blocked due to breaking changes."
        echo -e "${YELLOW}[Kanvas]${NC} Set KANVAS_BLOCK_ON_BREAKING=false to override"
        exit 1
    else
        echo -e "${YELLOW}[Kanvas]${NC} Warning: Proceeding with potential breaking changes"
    fi
fi

# Update analysis cache timestamps
if [ -d "$ANALYSIS_CACHE_DIR" ]; then
    echo -e "${BLUE}[Kanvas]${NC} Marking changed files for re-analysis..."
    for file in $STAGED_FILES; do
        CACHE_KEY=$(echo -n "$file" | md5sum | cut -d' ' -f1)
        CACHE_FILE="$ANALYSIS_CACHE_DIR/$CACHE_KEY.json"
        if [ -f "$CACHE_FILE" ]; then
            rm -f "$CACHE_FILE"
        fi
    done
fi

# Stage any updated contract files
if [ -d "$CONTRACTS_DIR" ]; then
    UPDATED_CONTRACTS=$(git status --porcelain "$CONTRACTS_DIR" 2>/dev/null | grep "^.M\|^??" | awk '{print $2}' || true)
    if [ -n "$UPDATED_CONTRACTS" ]; then
        echo -e "${BLUE}[Kanvas]${NC} Staging updated contract files..."
        for contract in $UPDATED_CONTRACTS; do
            git add "$contract"
            echo -e "${GREEN}[Kanvas]${NC}   Added: $contract"
        done
    fi
fi

echo -e "${GREEN}[Kanvas]${NC} Pre-commit analysis complete"
exit 0
