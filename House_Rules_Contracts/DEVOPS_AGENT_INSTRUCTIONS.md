# DevOps Agent Instructions for Contract Generation

**Created:** 2024-12-02  
**Version:** 1.0.0  
**Purpose:** Instructions for DevOps Agent to generate and maintain contract files

---

## Overview

This document provides step-by-step instructions for the **DevOps Agent** to:

1. **Generate initial contract files** from existing codebase
2. **Populate contracts** with discovered information
3. **Maintain and update contracts** as code changes
4. **Execute coding agent scripts** to automate contract generation
5. **Validate contract completeness** and accuracy

---

## Phase 1: Initial Contract Generation

### Objective

Scan the entire codebase and generate populated contract files for:
- Database schema
- SQL queries
- API endpoints
- Third-party integrations
- Features
- Infrastructure/environment variables

### Prerequisites

- Repository cloned and accessible
- Read access to all source files
- Write access to `House_Rules_Contracts/` folder

---

## Step 1: Identify All Features

**Goal:** Create a comprehensive list of all features in the codebase.

### Process:

1. **Scan directory structure:**
   ```bash
   find src/ -type d -name "features" -o -name "modules"
   ls -la src/features/ src/modules/
   ```

2. **Identify feature folders:**
   - Look for: `src/features/*/`, `src/modules/*/`
   - Each folder typically represents a feature

3. **Analyze API routes:**
   ```bash
   # Find route definitions
   grep -r "app.get\|app.post\|app.put\|app.delete\|router\." src/ --include="*.js"
   grep -r "@app.route\|@router\." src/ --include="*.py"
   ```

4. **Group endpoints by feature:**
   - `/api/v1/users/*` → User Management feature
   - `/api/v1/auth/*` → Authentication feature
   - `/api/v1/products/*` → Product Management feature

5. **Check documentation:**
   ```bash
   find docs/ -name "*feature*" -o -name "*spec*" -o -name "*requirement*"
   ```

6. **Create feature list:**
   - Assign Feature IDs: F-001, F-002, F-003, etc.
   - Write feature names and brief descriptions
   - Categorize by priority (Critical, High, Medium, Low)

### Output:

Create initial `FEATURES_CONTRACT.md` with feature list:

```markdown
## Feature Overview

| Feature ID | Feature Name | Status | Owner Module | Priority | Completion |
|------------|--------------|--------|--------------|----------|------------|
| F-001 | User Authentication | Active | src/features/auth | Critical | 100% |
| F-002 | User Profile Management | Active | src/features/profile | High | 100% |
| F-003 | Product Catalog | Active | src/features/products | High | 80% |
```

---

## Step 2: Document Database Schema

**Goal:** Extract all database tables, columns, indexes, and relationships.

### Process:

1. **Find database migration files:**
   ```bash
   find . -path "*/migrations/*" -name "*.sql" -o -name "*.js" -o -name "*.py"
   find . -path "*/alembic/*" -name "*.py"
   ```

2. **Find ORM model definitions:**
   ```bash
   # Sequelize (Node.js)
   grep -r "sequelize.define\|class.*Model" src/ --include="*.js"
   
   # SQLAlchemy (Python)
   grep -r "class.*Base\|Column\|Table" src/ --include="*.py"
   
   # Prisma
   find . -name "schema.prisma"
   ```

3. **Extract CREATE TABLE statements:**
   ```bash
   grep -r "CREATE TABLE" . --include="*.sql"
   ```

4. **For each table, document:**
   - Table name
   - All columns (name, type, nullable, default, constraints)
   - Primary keys
   - Foreign keys
   - Indexes
   - Which modules/features use it

5. **Identify relationships:**
   - One-to-many
   - Many-to-many
   - Foreign key references

### Output:

Populate `DATABASE_SCHEMA_CONTRACT.md` with all tables:

```markdown
### Table: users

**Created:** 2024-01-15  
**Last Modified:** 2024-01-15  
**Purpose:** Stores user account information

#### Schema Definition

\```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\```

**Used By (Modules):**
- `auth-service` - User authentication
- `profile-service` - Profile management
```

---

## Step 3: Extract SQL Queries

**Goal:** Find all SQL queries and document them in reusable format.

### Process:

1. **Search for SQL queries:**
   ```bash
   # Raw SQL strings
   grep -r "SELECT\|INSERT\|UPDATE\|DELETE" src/ --include="*.js" --include="*.py"
   
   # Database query calls
   grep -r "db.query\|pool.query\|connection.execute" src/ --include="*.js"
   grep -r "session.query\|db.session" src/ --include="*.py"
   ```

2. **Find SQL files:**
   ```bash
   find . -name "*.sql" -not -path "*/migrations/*"
   find . -path "*/queries/*" -name "*.sql"
   ```

3. **For each unique query, extract:**
   - SQL statement
   - Parameters (?, $1, :param)
   - Return type (single row, multiple rows, affected count)
   - Which files/functions use it

4. **Identify query patterns:**
   - User lookup by email: `SELECT * FROM users WHERE email = $1`
   - Product search: `SELECT * FROM products WHERE name LIKE $1`
   - Order creation: `INSERT INTO orders (...) VALUES (...)`

5. **Group similar queries:**
   - Can they be parameterized into one reusable query?
   - Example: `get_user_by_email` and `get_user_by_id` → `get_user_by_field`

### Output:

Populate `SQL_CONTRACT.json` with all queries:

```json
{
  "queries": {
    "get_user_by_email": {
      "id": "get_user_by_email",
      "name": "Get User By Email",
      "sql": "SELECT id, email, username FROM users WHERE email = $1",
      "parameters": [
        {
          "name": "email",
          "type": "string",
          "required": true
        }
      ],
      "used_by_modules": [
        {
          "module": "auth-service",
          "file": "src/auth/login.js",
          "function": "authenticateUser"
        }
      ]
    }
  }
}
```

---

## Step 4: Document API Endpoints

**Goal:** Extract all API endpoints with full specifications.

### Process:

1. **Find route definitions:**
   ```bash
   # Express (Node.js)
   grep -r "app.get\|app.post\|app.put\|app.delete\|router\." src/ --include="*.js"
   
   # FastAPI (Python)
   grep -r "@app.get\|@app.post\|@router\." src/ --include="*.py"
   
   # Flask (Python)
   grep -r "@app.route\|@blueprint.route" src/ --include="*.py"
   ```

2. **For each endpoint, extract:**
   - HTTP method (GET, POST, PUT, DELETE)
   - Path (`/api/v1/users/{id}`)
   - Controller/handler function
   - Request parameters (path, query, body)
   - Response format
   - Authentication requirements
   - Which feature it belongs to

3. **Trace endpoint implementation:**
   - Find controller function
   - Find service layer calls
   - Find database queries used
   - Find third-party integrations called

4. **Document request/response schemas:**
   - Look for validation schemas (Joi, Pydantic, etc.)
   - Check request body parsing
   - Check response formatting

### Output:

Populate `API_CONTRACT.md` with all endpoints:

```markdown
#### `GET /api/v1/users/{id}`

**Description:** Retrieves a single user by ID

**Authentication Required:** YES  
**Required Roles:** `user`, `admin`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | integer | YES | User ID |

**Response (200 OK):**
\```json
{
  "success": true,
  "data": {
    "id": 123,
    "username": "john_doe",
    "email": "john@example.com"
  }
}
\```

**Implementation:**
- Controller: `src/api/controllers/UserController.js::getUser()`
- Service: `src/services/UserService.js::getUserById()`
- SQL Query: `get_user_by_id` (from SQL_CONTRACT.json)
```

---

## Step 5: Document Third-Party Integrations

**Goal:** Find all external service integrations and document them.

### Process:

1. **Search for third-party SDKs:**
   ```bash
   # Check package.json
   cat package.json | grep -E "stripe|sendgrid|aws-sdk|twilio|mailgun"
   
   # Check requirements.txt (Python)
   cat requirements.txt | grep -E "stripe|sendgrid|boto3|twilio"
   ```

2. **Find API client initialization:**
   ```bash
   # Stripe
   grep -r "require('stripe')\|import stripe" src/ --include="*.js" --include="*.py"
   
   # SendGrid
   grep -r "require('@sendgrid/mail')\|import sendgrid" src/ --include="*.js" --include="*.py"
   
   # AWS
   grep -r "require('aws-sdk')\|import boto3" src/ --include="*.js" --include="*.py"
   ```

3. **Find API calls:**
   ```bash
   # Look for external API URLs
   grep -r "https://api\." src/ --include="*.js" --include="*.py"
   ```

4. **For each integration, document:**
   - Service name and purpose
   - SDK/library used
   - API key environment variable
   - Binding module location
   - Which modules use it
   - API endpoints called
   - Error handling strategy

5. **Check for binding modules:**
   ```bash
   find src/integrations/ -type d
   ls -la src/integrations/*/
   ```

### Output:

Populate `THIRD_PARTY_INTEGRATIONS.md`:

```markdown
### SendGrid (Email Service)

**Purpose:** Transactional email delivery

**Authentication:**
- Method: API Key
- Key Location: `SENDGRID_API_KEY`

**Binding Module:**
- Location: `src/integrations/sendgrid/`
- Main File: `src/integrations/sendgrid/client.js`

**Used By Modules:**
| Module | File | Usage |
|--------|------|-------|
| auth-service | `src/auth/register.js` | Email verification |
| auth-service | `src/auth/password-reset.js` | Password reset emails |
```

---

## Step 6: Document Infrastructure

**Goal:** Extract all environment variables and configuration.

### Process:

1. **Find all environment variable usage:**
   ```bash
   # Node.js
   grep -r "process.env\." src/ --include="*.js" | sort | uniq
   
   # Python
   grep -r "os.getenv\|os.environ" src/ --include="*.py" | sort | uniq
   ```

2. **Check configuration files:**
   ```bash
   cat .env.example
   cat config/*.js
   cat config/*.py
   ```

3. **Check Docker/deployment configs:**
   ```bash
   cat docker-compose.yml | grep -A 5 "environment:"
   cat .github/workflows/*.yml | grep "env:"
   ```

4. **For each environment variable, document:**
   - Name
   - Type (string, integer, boolean)
   - Required or optional
   - Default value
   - Description
   - Example value
   - Which modules use it

5. **Categorize variables:**
   - `DATABASE_*` - Database config
   - `REDIS_*` - Cache config
   - `JWT_*` - Authentication config
   - `[SERVICE]_*` - Third-party services
   - `FEATURE_*` - Feature flags

### Output:

Populate `INFRA_CONTRACT.md`:

```markdown
### Database Configuration

| Variable | Type | Required | Default | Description | Example |
|----------|------|----------|---------|-------------|---------|
| `DATABASE_URL` | string | YES | - | Database connection string | `postgresql://...` |
| `DATABASE_POOL_MAX` | integer | NO | `20` | Max connection pool size | `20` |
```

---

## Step 7: Cross-Reference All Contracts

**Goal:** Link related information across contracts.

### Process:

1. **For each feature in FEATURES_CONTRACT.md:**
   - List API endpoints (link to API_CONTRACT.md)
   - List database tables (link to DATABASE_SCHEMA_CONTRACT.md)
   - List SQL queries (link to SQL_CONTRACT.json)
   - List third-party services (link to THIRD_PARTY_INTEGRATIONS.md)
   - List environment variables (link to INFRA_CONTRACT.md)

2. **For each API endpoint in API_CONTRACT.md:**
   - Link to feature that owns it
   - Link to SQL queries it uses
   - Link to database tables it accesses
   - Link to third-party services it calls

3. **For each database table in DATABASE_SCHEMA_CONTRACT.md:**
   - Link to features that use it
   - Link to SQL queries that access it
   - Link to API endpoints that modify it

4. **Verify consistency:**
   - Every SQL query references existing tables
   - Every API endpoint references existing queries
   - Every feature references existing endpoints
   - Every third-party integration has env vars documented

---

## Phase 2: Automated Contract Generation & Validation Script

### Task: Create `validate-contracts` Automation

**Objective:** Create a script that strictly validates that the code matches the contracts. This script will eventually be part of the CI/CD pipeline and pre-commit hooks.

**Script Name:** `scripts/validate-contracts.js`

**Requirements:**
1.  **Drift Detection:**
    *   Fail if an API endpoint exists in code but not in `API_CONTRACT.md`.
    *   Fail if a database table exists in migrations but not in `DATABASE_SCHEMA_CONTRACT.md`.
    *   Fail if a Feature ID is referenced in code but missing from `FEATURES_CONTRACT.md`.
2.  **Schema Validation:**
    *   Verify JSON contracts (`SQL_CONTRACT.json`) are valid JSON.
3.  **Cross-Reference Validation:**
    *   Verify that links between contracts point to existing items.

**Execution:**
`npm run validate-contracts`

### Task: Create `generate-contracts` Script

The DevOps Agent can invoke a Coding Agent to automate contract generation:

**Script Name:** `generate-contracts.js` or `generate-contracts.py`

**Script Responsibilities:**

1. **Scan codebase** using the patterns above
2. **Extract information** for each contract
3. **Generate contract files** from templates
4. **Populate with discovered data**
5. **Cross-reference** all contracts
6. **Validate completeness**
7. **Report missing information** for manual review

**Execution:**

```bash
# DevOps Agent executes:
node scripts/generate-contracts.js

# Or for Python:
python scripts/generate_contracts.py
```

**Output:**

- Populated contract files in `House_Rules_Contracts/`
- Report of discovered items
- List of items needing manual review
- Validation errors or warnings

---

## Phase 3: Iterative Contract Improvement

### Process:

1. **Initial generation** (automated script)
2. **Manual review** (DevOps Agent or human)
3. **Fill gaps** (add missing information)
4. **Validate cross-references** (ensure links are correct)
5. **Test completeness** (can coding agents use contracts?)
6. **Iterate** (improve as codebase evolves)

### Validation Checklist:

- [ ] All features documented in FEATURES_CONTRACT.md
- [ ] All database tables documented in DATABASE_SCHEMA_CONTRACT.md
- [ ] All SQL queries documented in SQL_CONTRACT.json
- [ ] All API endpoints documented in API_CONTRACT.md
- [ ] All third-party services documented in THIRD_PARTY_INTEGRATIONS.md
- [ ] All environment variables documented in INFRA_CONTRACT.md
- [ ] All cross-references are correct
- [ ] All "Used By" sections are complete
- [ ] All examples are accurate
- [ ] All dates and versions are set

---

## Phase 5: Test Coverage Tracking

**Goal:** Explicitly track which Contracts are validated by tests.

### Create `TEST_COVERAGE.md`
Create a file to map contracts to their test suites.

**Template:**
```markdown
# Test Coverage Matrix

| Contract Item | Test File | Test Status | Last Verified |
|---------------|-----------|-------------|---------------|
| **Features** | | | |
| F-001 | `test_cases/features/auth.test.js` | ✅ Passing | 2024-12-10 |
| **API** | | | |
| GET /api/v1/users | `test_cases/api/users.test.js` | ✅ Passing | 2024-12-10 |
```

### Repo Hygiene
- Ensure `House_Rules_Contracts/` only contains active contracts.
- Move deprecated or superseded contracts to `House_Rules_Contracts/archive/`.

### When Code Changes:

**Coding agents MUST update contracts when they:**

1. **Add a new feature** → Update FEATURES_CONTRACT.md
2. **Create a database table** → Update DATABASE_SCHEMA_CONTRACT.md
3. **Write a SQL query** → Update SQL_CONTRACT.json
4. **Create an API endpoint** → Update API_CONTRACT.md
5. **Integrate a service** → Update THIRD_PARTY_INTEGRATIONS.md
6. **Add an env variable** → Update INFRA_CONTRACT.md

### DevOps Agent Responsibilities:

1. **Monitor contract updates** in commits
2. **Validate contract changes** are correct
3. **Enforce contract usage** by coding agents
4. **Regenerate contracts** periodically to catch missed updates
5. **Report discrepancies** between code and contracts

### Periodic Validation:

**Run automated validation script:**

```bash
# Check if contracts match codebase
node scripts/validate-contracts.js

# Report:
# - Features in code but not in FEATURES_CONTRACT.md
# - Endpoints in code but not in API_CONTRACT.md
# - Tables in migrations but not in DATABASE_SCHEMA_CONTRACT.md
# - Queries in code but not in SQL_CONTRACT.json
# - Services in package.json but not in THIRD_PARTY_INTEGRATIONS.md
# - Env vars in code but not in INFRA_CONTRACT.md
```

---

## Example: Automated Contract Generation Script

### Pseudocode:

```javascript
// generate-contracts.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

async function generateContracts() {
  console.log('Starting contract generation...');
  
  // Step 1: Scan for features
  const features = await scanFeatures();
  console.log(`Found ${features.length} features`);
  
  // Step 2: Scan database schema
  const tables = await scanDatabaseSchema();
  console.log(`Found ${tables.length} tables`);
  
  // Step 3: Extract SQL queries
  const queries = await extractSQLQueries();
  console.log(`Found ${queries.length} unique queries`);
  
  // Step 4: Extract API endpoints
  const endpoints = await extractAPIEndpoints();
  console.log(`Found ${endpoints.length} endpoints`);
  
  // Step 5: Find third-party integrations
  const integrations = await findThirdPartyIntegrations();
  console.log(`Found ${integrations.length} integrations`);
  
  // Step 6: Extract environment variables
  const envVars = await extractEnvVariables();
  console.log(`Found ${envVars.length} environment variables`);
  
  // Step 7: Generate contract files
  await generateFeaturesContract(features);
  await generateDatabaseContract(tables);
  await generateSQLContract(queries);
  await generateAPIContract(endpoints);
  await generateIntegrationsContract(integrations);
  await generateInfraContract(envVars);
  
  // Step 8: Cross-reference
  await crossReferenceContracts();
  
  console.log('Contract generation complete!');
}

async function scanFeatures() {
  // Find all feature folders
  const featureDirs = glob.sync('src/features/*/');
  
  const features = [];
  for (const dir of featureDirs) {
    const featureName = path.basename(dir);
    const files = glob.sync(`${dir}**/*.js`);
    
    features.push({
      id: `F-${String(features.length + 1).padStart(3, '0')}`,
      name: featureName,
      files: files,
      // Extract more details...
    });
  }
  
  return features;
}

async function scanDatabaseSchema() {
  // Find migration files
  const migrations = glob.sync('migrations/**/*.sql');
  
  const tables = [];
  for (const file of migrations) {
    const content = fs.readFileSync(file, 'utf8');
    const tableMatches = content.match(/CREATE TABLE (\w+)/g);
    
    if (tableMatches) {
      for (const match of tableMatches) {
        const tableName = match.replace('CREATE TABLE ', '');
        // Extract columns, indexes, etc.
        tables.push({
          name: tableName,
          // ... more details
        });
      }
    }
  }
  
  return tables;
}

// ... more functions

generateContracts().catch(console.error);
```

---

## Summary

**DevOps Agent should:**

1. ✅ Execute automated contract generation script
2. ✅ Review and validate generated contracts
3. ✅ Fill in missing information manually
4. ✅ Ensure cross-references are correct
5. ✅ Commit populated contracts to repository
6. ✅ Monitor ongoing contract updates by coding agents
7. ✅ Periodically re-run validation to catch drift
8. ✅ Enforce contract usage in code reviews

**This ensures:**
- Contracts stay up-to-date
- Coding agents have accurate information
- Duplication is prevented
- Conflicts are avoided
- Codebase remains organized and maintainable

---

*This document is a living guide. Update as processes improve.*
