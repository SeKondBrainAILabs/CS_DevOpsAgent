# GitHub Actions Workflows for Contract Automation

This folder contains GitHub Actions workflow files for the contract automation system.

---

## 📋 Available Workflows

### contract-tests.yml

**Purpose:** Automated testing and validation for the contract automation system

**Triggers:**
- Push to development branches (`DEV_*`, `development`, `dev/**`)
- Pull requests to `main` or `development`

**What it does:**
1. ✅ Runs unit and integration tests (Node.js 18.x, 20.x)
2. ✅ Validates contract compliance
3. ✅ Validates commit messages
4. ✅ Runs security scans (npm audit, Trivy)
5. ✅ Uploads coverage to Codecov
6. ✅ Comments on PRs with compliance status
7. ✅ Generates test summary

---

## 🚀 How to Use These Workflows

### Option 1: Copy to .github/workflows (Recommended)

```bash
# Create .github/workflows directory if it doesn't exist
mkdir -p .github/workflows

# Copy the workflow file
cp tests/workflows/contract-tests.yml .github/workflows/

# Commit and push
git add .github/workflows/contract-tests.yml
git commit -m "ci: add contract automation workflow"
git push origin YOUR_BRANCH
```

### Option 2: Use with Warp or Other Tools

Point your CI/CD tool to use the workflow files from this directory:

```bash
# Example: Using with Warp
warp workflow add tests/workflows/contract-tests.yml
```

### Option 3: Create via GitHub UI

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **New workflow**
4. Click **set up a workflow yourself**
5. Copy the content from `contract-tests.yml`
6. Commit directly to your branch

---

## ⚠️ Why Are Workflows Here?

GitHub Apps (like the one used by Manus) don't have permission to create or modify workflow files in `.github/workflows/` for security reasons. 

By placing them in `tests/workflows/`, we can:
- ✅ Push them to GitHub without permission issues
- ✅ Version control the workflow definitions
- ✅ Let developers copy them to `.github/workflows/` when ready
- ✅ Use them with external CI/CD tools

---

## 📝 Workflow File Details

### contract-tests.yml

**Jobs:**

1. **test-contracts**
   - Matrix: Node.js 18.x, 20.x
   - Runs: `npm run test:contracts:unit` and `npm run test:contracts:integration`
   - Uploads: Coverage to Codecov, test results as artifacts

2. **validate-contracts**
   - Runs: `npm run validate-contracts`
   - Generates: Compliance report (JSON)
   - Comments: PR with compliance status

3. **validate-commit-messages**
   - Validates: All commit messages in PR
   - Checks: Contract flags format and accuracy

4. **security-scan**
   - Runs: `npm audit` and Trivy vulnerability scanner
   - Uploads: Results to GitHub Security

5. **summary**
   - Generates: Overall test summary
   - Displays: In GitHub Actions summary

**Required Secrets:**
- None (uses default `GITHUB_TOKEN`)

**Optional Secrets:**
- `CODECOV_TOKEN` - For uploading coverage reports to Codecov

---

## 🔧 Customization

### Changing Node.js Versions

Edit the `matrix.node-version` in `contract-tests.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add or remove versions
```

### Changing Trigger Branches

Edit the `on.push.branches` section:

```yaml
on:
  push:
    branches:
      - 'DEV_*'
      - 'development'
      - 'feature/**'  # Add custom patterns
```

### Adding More Jobs

Add new jobs after the existing ones:

```yaml
jobs:
  # ... existing jobs ...
  
  custom-job:
    name: Custom Job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "Custom step"
```

---

## 📊 Expected Results

When the workflow runs successfully, you'll see:

**In GitHub Actions:**
- ✅ All jobs pass (green checkmarks)
- 📊 Test coverage report
- 🔒 Security scan results
- 📋 Compliance report

**In Pull Requests:**
- ✅ Status checks show pass/fail
- 💬 Bot comment with compliance details
- 📈 Coverage comparison (if Codecov configured)

---

## 🐛 Troubleshooting

### Workflow doesn't run

**Check:**
1. Is the file in `.github/workflows/`? (Not in `tests/workflows/`)
2. Is the branch name matching the trigger patterns?
3. Are there any YAML syntax errors?

**Fix:**
```bash
# Validate YAML syntax
cat .github/workflows/contract-tests.yml | grep -v "^#" | grep -v "^$"
```

### Tests fail in CI but pass locally

**Check:**
1. Node.js version matches (18.x or 20.x)
2. Dependencies are installed (`npm ci` in CI)
3. Environment variables are set

**Fix:**
```bash
# Test with CI environment locally
npm ci
npm run test:contracts:ci
```

### Permission errors

**Check:**
1. `GITHUB_TOKEN` has required permissions
2. Workflow file is in `.github/workflows/`

**Fix:**
Add permissions to workflow file:
```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write
```

---

## 📚 Related Documentation

- [Test Suite Documentation](../README.md)
- [Contract Automation Scripts](../../scripts/contract-automation/README.md)
- [House Rules Contracts](../../House_Rules_Contracts/README.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

**Last Updated:** 2024-12-16  
**Maintainer:** sachmans  
**Status:** ✅ Ready to use
