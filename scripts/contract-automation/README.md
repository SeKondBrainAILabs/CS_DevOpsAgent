# Contract Automation Scripts

**Created:** 2024-12-02  
**Purpose:** Automate contract generation, validation, and compliance checking

---

## Overview

This directory contains scripts that enable the **DevOps Agent** to automatically generate, validate, and maintain contract files. These scripts prevent duplicate work and conflicts when multiple coding agents work on the same codebase.

---

## Scripts

### 1. `generate-contracts.js`

**Purpose:** Scan codebase and generate populated contract files using local file system analysis.

**Features:**
- Scans for features, API endpoints, database tables, SQL queries, third-party integrations, and environment variables
- Uses regex and file parsing (no LLM required)
- Fast and deterministic
- Generates JSON output with all discovered information

**Usage:**

```bash
# Generate all contracts
node scripts/contract-automation/generate-contracts.js

# Generate specific contract
node scripts/contract-automation/generate-contracts.js --contract=features
node scripts/contract-automation/generate-contracts.js --contract=api

# Verbose output
node scripts/contract-automation/generate-contracts.js --verbose
```

**Options:**
- `--contract=<name>` - Generate specific contract (features, api, database, sql, integrations, infra)
- `--validate-only` - Only validate, don't generate
- `--output=<path>` - Output directory (default: House_Rules_Contracts/)
- `--verbose` - Detailed logging

**Output:**
- `House_Rules_Contracts/contract-scan-results.json` - All discovered information

---

### 2. `analyze-with-llm.js`

**Purpose:** Use Groq LLM to perform intelligent analysis and generate human-readable documentation.

**Features:**
- Analyzes scan results from `generate-contracts.js`
- Generates descriptions, user stories, acceptance criteria
- Infers API request/response formats
- Provides security and performance recommendations
- Validates contract completeness

**Usage:**

```bash
# Analyze scan results
node scripts/contract-automation/analyze-with-llm.js --scan-results=House_Rules_Contracts/contract-scan-results.json

# Analyze specific file
node scripts/contract-automation/analyze-with-llm.js --analyze-file=src/features/auth/index.js

# Validate existing contracts
node scripts/contract-automation/analyze-with-llm.js --validate-contracts

# Use different model
node scripts/contract-automation/analyze-with-llm.js --model=mixtral-8x7b-32768 --scan-results=...
```

**Options:**
- `--scan-results=<path>` - Use scan results from generate-contracts.js
- `--analyze-file=<path>` - Analyze specific file
- `--validate-contracts` - Validate existing contracts for completeness
- `--model=<name>` - Groq model to use (default: llama-3.1-70b-versatile)
- `--verbose` - Detailed logging

**Environment Variables:**
- `OPENAI_API_KEY` - Required (Groq API key via OpenAI-compatible endpoint)

**Output:**
- `House_Rules_Contracts/llm-analysis-results.json` - Enhanced documentation

**Available Models:**
- `llama-3.1-70b-versatile` (default) - Best for complex analysis
- `llama-3.1-8b-instant` - Faster, good for simple tasks
- `mixtral-8x7b-32768` - Alternative with large context window
- `gemini-2.5-flash` - Fast and efficient

---

### 3. `validate-commit.js`

**Purpose:** Validate commit messages and check if contract files were updated when claimed.

**Features:**
- Parses commit message for contract flags
- Checks if claimed contract files were actually modified
- Detects false positives (claimed T but not modified)
- Detects false negatives (modified but not claimed)
- Auto-fix mode generates corrected commit message

**Commit Format:**

```
feat(api): add user profile endpoint

Contracts: [SQL:T, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]

[WHY section explaining motivation...]

[WHAT section listing file changes...]
```

**Contract Flags:**
- `SQL:T/F` - SQL_CONTRACT.json modified
- `API:T/F` - API_CONTRACT.md modified
- `DB:T/F` - DATABASE_SCHEMA_CONTRACT.md modified
- `3RD:T/F` - THIRD_PARTY_INTEGRATIONS.md modified
- `FEAT:T/F` - FEATURES_CONTRACT.md modified
- `INFRA:T/F` - INFRA_CONTRACT.md modified

**Usage:**

```bash
# Validate commit message
node scripts/contract-automation/validate-commit.js

# Validate with staged files check
node scripts/contract-automation/validate-commit.js --check-staged

# Auto-fix incorrect flags
node scripts/contract-automation/validate-commit.js --check-staged --auto-fix

# Strict mode (warnings = errors)
node scripts/contract-automation/validate-commit.js --check-staged --strict
```

**Options:**
- `--commit-msg=<path>` - Path to commit message file (default: .claude-commit-msg)
- `--check-staged` - Check staged files in git
- `--strict` - Fail on warnings
- `--auto-fix` - Suggest correct contract flags

**Output:**
- Validation report with errors/warnings
- Exit code 0 (pass) or 1 (fail)
- `.claude-commit-msg.corrected` (if --auto-fix used)

---

### 4. `check-compliance.js`

**Purpose:** Check if codebase is in sync with contract files.

**Features:**
- Detects items in code but missing from contracts
- Detects items in contracts but missing from code
- Comprehensive scanning of all contract types
- JSON and text report formats
- Strict mode for CI/CD integration

**Usage:**

```bash
# Check compliance
node scripts/contract-automation/check-compliance.js

# Generate JSON report
node scripts/contract-automation/check-compliance.js --report=json

# Strict mode (exit with error if issues found)
node scripts/contract-automation/check-compliance.js --strict
```

**Options:**
- `--fix` - Generate missing contract entries (future feature)
- `--report=<format>` - Output format (text|json|html)
- `--strict` - Exit with error if any discrepancies found

**Output:**
- Compliance report showing missing/extra items
- Exit code 0 (compliant) or 1 (non-compliant in strict mode)

**What It Checks:**
- ✅ Features in code vs FEATURES_CONTRACT.md
- ✅ API endpoints in code vs API_CONTRACT.md
- ✅ Database tables in migrations vs DATABASE_SCHEMA_CONTRACT.md
- ✅ Third-party services in package.json vs THIRD_PARTY_INTEGRATIONS.md
- ✅ Environment variables in code vs INFRA_CONTRACT.md

---

## Workflow

### Initial Contract Population

```bash
# Step 1: Scan codebase
node scripts/contract-automation/generate-contracts.js --verbose

# Step 2: Analyze with LLM for rich documentation
node scripts/contract-automation/analyze-with-llm.js \
  --scan-results=House_Rules_Contracts/contract-scan-results.json

# Step 3: Review results
cat House_Rules_Contracts/llm-analysis-results.json

# Step 4: Manually populate contract files using the results
# (Future: automated population script)
```

### Pre-Commit Validation

```bash
# Before committing, validate commit message and contract updates
node scripts/contract-automation/validate-commit.js --check-staged --auto-fix

# If validation fails, review and fix
cat .claude-commit-msg.corrected
```

### Periodic Compliance Check

```bash
# Check if contracts are up-to-date
node scripts/contract-automation/check-compliance.js

# If issues found, update contracts or remove stale entries
```

### CI/CD Integration

```yaml
# .github/workflows/contract-validation.yml
name: Contract Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      
      - name: Check Contract Compliance
        run: node scripts/contract-automation/check-compliance.js --strict --report=json
      
      - name: Validate Commit Message
        run: |
          git log -1 --pretty=%B > commit-msg.txt
          node scripts/contract-automation/validate-commit.js --commit-msg=commit-msg.txt
```

---

## Dependencies

### Node.js Packages

```bash
# Install dependencies
npm install openai
```

### Environment Variables

```bash
# For LLM analysis (analyze-with-llm.js)
export OPENAI_API_KEY="your-groq-api-key"
```

---

## Architecture

### Local Scanning (generate-contracts.js)

**Approach:** File system operations + regex + AST parsing

**Pros:**
- ✅ Fast and deterministic
- ✅ No API costs
- ✅ Works offline
- ✅ Reliable for structured data

**Cons:**
- ❌ Cannot infer intent or relationships
- ❌ Limited to pattern matching
- ❌ No natural language descriptions

**Best For:**
- Initial discovery
- Structured data extraction
- Fast iteration

### LLM Analysis (analyze-with-llm.js)

**Approach:** Groq LLM via OpenAI-compatible API

**Pros:**
- ✅ Understands code intent
- ✅ Generates human-readable docs
- ✅ Infers relationships and dependencies
- ✅ Provides recommendations

**Cons:**
- ❌ Requires API key
- ❌ Slower than local scanning
- ❌ Non-deterministic output
- ❌ API costs (minimal with Groq)

**Best For:**
- Rich documentation
- Gap analysis
- Validation
- Recommendations

### Hybrid Approach (Recommended)

1. **Use local scanning** for initial discovery
2. **Use LLM analysis** for enhancement and validation
3. **Combine results** for comprehensive documentation

---

## Examples

### Example 1: Full Contract Generation

```bash
# Scan codebase
node scripts/contract-automation/generate-contracts.js --verbose

# Output: House_Rules_Contracts/contract-scan-results.json
# {
#   "results": {
#     "features": [
#       { "id": "F-001", "name": "User Authentication", "path": "src/features/auth" }
#     ],
#     "api": [
#       { "method": "POST", "path": "/api/v1/auth/login", "source": "src/api/auth.js" }
#     ],
#     ...
#   }
# }

# Analyze with LLM
node scripts/contract-automation/analyze-with-llm.js \
  --scan-results=House_Rules_Contracts/contract-scan-results.json

# Output: House_Rules_Contracts/llm-analysis-results.json
# {
#   "results": {
#     "features": [
#       {
#         "id": "F-001",
#         "name": "User Authentication",
#         "description": "Provides secure user authentication with JWT tokens...",
#         "userStory": "As a user, I want to log in securely so that...",
#         "acceptanceCriteria": [...]
#       }
#     ]
#   }
# }
```

### Example 2: Commit Validation

```bash
# Create commit message
cat > .claude-commit-msg << 'EOF'
feat(api): add user profile endpoint

Contracts: [SQL:T, API:T, DB:F, 3RD:F, FEAT:T, INFRA:F]

[WHY] Users need to view and update their profile information.

[WHAT]
- File(s): src/api/profile.js - Added GET /api/v1/profile endpoint
- File(s): House_Rules_Contracts/API_CONTRACT.md - Documented new endpoint
- File(s): House_Rules_Contracts/SQL_CONTRACT.json - Added get_user_profile query
EOF

# Validate
node scripts/contract-automation/validate-commit.js --check-staged

# Output:
# [SUCCESS] VALIDATION PASSED ✅
```

### Example 3: Compliance Check

```bash
# Check compliance
node scripts/contract-automation/check-compliance.js

# Output:
# ============================================================
# CONTRACT COMPLIANCE REPORT
# ============================================================
# 
# FEATURES:
#   Missing in contract (2):
#     - payment-processing
#     - notification-service
# 
# API ENDPOINTS:
#   Missing in contract (5):
#     - POST /api/v1/payments/charge
#     - GET /api/v1/notifications
#     ...
# 
# ============================================================
# COMPLIANCE CHECK FAILED ❌
# Found 7 items missing from contracts.
# Run with --fix to generate missing entries.
# ============================================================
```

---

## Future Enhancements

### Planned Features

1. **Auto-fix for compliance** - Automatically generate missing contract entries
2. **Contract diff tool** - Show changes between contract versions
3. **Visual reports** - HTML reports with charts and graphs
4. **Git hooks** - Pre-commit and pre-push hooks for validation
5. **IDE integration** - VSCode extension for real-time validation
6. **Contract versioning** - Track contract changes over time
7. **Dependency graph** - Visualize relationships between contracts

### Integration Ideas

1. **GitHub Actions** - Automated validation on PRs
2. **Pre-commit hooks** - Validate before allowing commits
3. **Slack notifications** - Alert team of compliance issues
4. **Dashboard** - Web UI for contract status
5. **API** - RESTful API for contract queries

---

## Troubleshooting

### Issue: "Contract directory not found"

**Solution:** Merge the contract system branch first or create the directory:

```bash
mkdir -p House_Rules_Contracts
```

### Issue: "OPENAI_API_KEY not set"

**Solution:** Set the environment variable:

```bash
export OPENAI_API_KEY="your-groq-api-key"
```

### Issue: "No files found"

**Solution:** Ensure you're running from the repository root:

```bash
cd /path/to/CS_DevOpsAgent
node scripts/contract-automation/generate-contracts.js
```

### Issue: "Permission denied"

**Solution:** Make scripts executable:

```bash
chmod +x scripts/contract-automation/*.js
```

---

## Best Practices

1. **Run generate-contracts.js first** - Get raw data before LLM analysis
2. **Use LLM analysis sparingly** - API costs add up, use for validation
3. **Validate commits before pushing** - Catch issues early
4. **Run compliance checks weekly** - Keep contracts up-to-date
5. **Review auto-generated content** - Don't blindly trust automation
6. **Version control contracts** - Track changes over time
7. **Document exceptions** - If something can't be automated, document why

---

## Contributing

When adding new scripts:

1. Follow the existing structure and naming conventions
2. Add comprehensive help text and usage examples
3. Support `--verbose` flag for debugging
4. Handle errors gracefully with clear messages
5. Update this README with new script documentation

---

**Status:** ✅ Ready for use  
**Last Updated:** 2024-12-02
