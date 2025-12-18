# Contract Automation Test Suite

Comprehensive test suite for the Contract Automation System, ensuring reliability, correctness, and compliance across all contract workflows.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [CI/CD Integration](#cicd-integration)
- [Writing Tests](#writing-tests)
- [Troubleshooting](#troubleshooting)

---

## Overview

The test suite validates the contract automation system through multiple layers of testing, ensuring that all components work correctly both individually and together.

### Test Categories

**Unit Tests** (`tests/unit/`)
- Test individual functions and modules in isolation
- Mock external dependencies
- Fast execution
- High coverage of edge cases

**Integration Tests** (`tests/integration/`)
- Test complete workflows end-to-end
- Use real file system operations
- Validate multi-step processes
- Ensure components work together

**Fixtures** (`tests/fixtures/`)
- Sample contract data
- Mock commit messages
- Test repository structures
- Reusable test data

---

## Test Structure

```
tests/
├── unit/
│   ├── generate-contracts.test.js    # Contract generation tests
│   ├── validate-commit.test.js       # Commit validation tests
│   └── check-compliance.test.js      # Compliance checking tests
├── integration/
│   └── contract-workflow.test.js     # End-to-end workflow tests
├── fixtures/
│   ├── sample-contracts.json         # Mock contract data
│   ├── sample-commits.json           # Test commit messages
│   └── test-repo/                    # Mock repository structure
└── README.md                         # This file
```

---

## Running Tests

### All Tests

```bash
# Run all contract tests with coverage
npm run test:contracts

# Run in watch mode for development
npm test -- --watch
```

### Unit Tests Only

```bash
# Run all unit tests
npm run test:contracts:unit

# Run specific test file
npm test tests/unit/validate-commit.test.js

# Run tests matching pattern
npm test -- --testNamePattern="Commit Message"
```

### Integration Tests Only

```bash
# Run all integration tests
npm run test:contracts:integration

# Run with verbose output
npm run test:contracts:integration -- --verbose
```

### CI Mode

```bash
# Run tests in CI environment (no watch, coverage, limited workers)
npm run test:contracts:ci
```

---

## Test Coverage

### Coverage Reports

Coverage reports are generated automatically when running tests:

```bash
# Generate coverage report
npm run test:contracts

# View HTML coverage report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

The test suite enforces minimum coverage thresholds:

- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

Tests will fail if coverage drops below these thresholds.

### What's Covered

**Contract Generation** (`generate-contracts.test.js`)
- ✅ Feature scanning from `src/features/`
- ✅ API endpoint discovery (Express.js, FastAPI)
- ✅ Database schema scanning (SQL, Prisma)
- ✅ SQL query extraction
- ✅ Third-party integration detection
- ✅ Environment variable discovery
- ✅ JSON output generation

**Commit Validation** (`validate-commit.test.js`)
- ✅ Commit message parsing
- ✅ Contract flag extraction
- ✅ File change detection
- ✅ False positive detection (claimed T but not modified)
- ✅ False negative detection (modified but claimed F)
- ✅ Auto-fix generation
- ✅ Edge cases (whitespace, missing sections)

**Compliance Checking** (`check-compliance.test.js`)
- ✅ Feature compliance (code vs. contract)
- ✅ API endpoint compliance
- ✅ Database schema compliance
- ✅ SQL query compliance
- ✅ Integration compliance
- ✅ Environment variable compliance
- ✅ Report generation (text, JSON)
- ✅ Strict mode exit codes

**End-to-End Workflows** (`contract-workflow.test.js`)
- ✅ Complete contract generation workflow
- ✅ Commit validation workflow
- ✅ Compliance checking workflow
- ✅ Multi-agent coordination
- ✅ Contract versioning
- ✅ Changelog management

---

## CI/CD Integration

### GitHub Actions Workflow

The test suite runs automatically on:

- **Push to development branches** (`DEV_*`, `development`, `dev/**`)
- **Pull requests** to `main` or `development`

### Workflow Jobs

**1. test-contracts**
- Runs on Node.js 18.x and 20.x
- Executes unit and integration tests
- Uploads coverage reports to Codecov
- Archives test results

**2. validate-contracts**
- Checks contract compliance
- Generates compliance report
- Comments on PR with status
- Uploads compliance report artifact

**3. validate-commit-messages**
- Validates all commit messages in PR
- Checks contract flags
- Ensures proper format

**4. security-scan**
- Runs npm audit
- Scans for vulnerabilities with Trivy
- Uploads results to GitHub Security

**5. summary**
- Generates test summary
- Reports overall status
- Displays in GitHub Actions summary

### Viewing Results

**In GitHub Actions:**
1. Go to the "Actions" tab in the repository
2. Click on the workflow run
3. View job results and logs
4. Download artifacts (coverage, compliance reports)

**In Pull Requests:**
- Compliance status is commented automatically
- Check status is shown in PR checks
- Click "Details" to see full logs

---

## Writing Tests

### Test File Template

```javascript
const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Specific Functionality', () => {
    test('should do something specific', () => {
      // Arrange
      const input = 'test data';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected output');
    });

    test('should handle edge case', () => {
      expect(() => functionUnderTest(null)).toThrow();
    });
  });
});
```

### Best Practices

**1. Test Naming**
- Use descriptive names: `should detect false positives in contract flags`
- Follow pattern: `should [expected behavior] when [condition]`

**2. Test Organization**
- Group related tests with `describe` blocks
- One assertion per test when possible
- Test happy path and edge cases

**3. Test Data**
- Use fixtures for complex data
- Keep test data minimal and focused
- Avoid hardcoding paths

**4. Mocking**
- Mock external dependencies (file system, network)
- Don't mock the code under test
- Use Jest's built-in mocking

**5. Assertions**
- Use specific matchers (`toBe`, `toEqual`, `toContain`)
- Test both positive and negative cases
- Verify error messages

### Example: Testing Contract Validation

```javascript
test('should detect when SQL contract is modified but claimed F', () => {
  const commitMsg = `feat(api): add endpoint

Contracts: [SQL:F, API:T, DB:F, 3RD:F, FEAT:F, INFRA:F]

[WHAT]
- File(s): src/api/test.js - Added endpoint`;

  const stagedFiles = [
    'src/api/test.js',
    'House_Rules_Contracts/SQL_CONTRACT.json', // Modified but claimed F
    'House_Rules_Contracts/API_CONTRACT.md'
  ];

  const result = validateCommit(commitMsg, stagedFiles);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({
      type: 'false_negative',
      contract: 'SQL'
    })
  );
});
```

---

## Troubleshooting

### Common Issues

**Issue: Tests fail with "Cannot find module"**

**Solution:**
```bash
# Install dependencies
npm install

# Clear Jest cache
npm test -- --clearCache
```

**Issue: Coverage threshold not met**

**Solution:**
- Add tests for uncovered code
- Check coverage report: `open coverage/lcov-report/index.html`
- Focus on branches and edge cases

**Issue: Integration tests timeout**

**Solution:**
```bash
# Increase timeout in test file
jest.setTimeout(30000); // 30 seconds

# Or run with longer timeout
npm test -- --testTimeout=30000
```

**Issue: File system tests fail**

**Solution:**
- Ensure cleanup in `afterEach` hooks
- Check file permissions
- Use absolute paths in tests

**Issue: GitHub Actions workflow fails**

**Solution:**
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Review workflow logs in Actions tab

### Debug Mode

```bash
# Run tests with debug output
DEBUG=* npm test

# Run single test with verbose output
npm test tests/unit/validate-commit.test.js -- --verbose

# Run tests without coverage for faster debugging
npm test -- --coverage=false
```

### Getting Help

- Check test logs for error messages
- Review fixture data in `tests/fixtures/`
- Consult Jest documentation: https://jestjs.io/
- Open an issue in the repository

---

## Test Metrics

### Current Status

| Metric | Target | Current |
|--------|--------|---------|
| Unit Test Coverage | 70% | TBD |
| Integration Test Coverage | 70% | TBD |
| Total Tests | - | 50+ |
| Test Execution Time | <30s | TBD |

### Performance

- **Unit tests:** ~5-10 seconds
- **Integration tests:** ~15-20 seconds
- **Total suite:** ~25-30 seconds

---

## Contributing

When adding new features to the contract automation system:

1. **Write tests first** (TDD approach)
2. **Ensure tests pass** locally before pushing
3. **Maintain coverage** above 70%
4. **Update fixtures** if needed
5. **Document new test cases** in this README

---

## Related Documentation

- [Contract Automation README](../scripts/contract-automation/README.md)
- [House Rules Contracts](../House_Rules_Contracts/README.md)
- [GitHub Actions Workflow](../.github/workflows/contract-tests.yml)

---

**Last Updated:** 2024-12-16  
**Maintainer:** sachmans  
**Status:** ✅ Active
