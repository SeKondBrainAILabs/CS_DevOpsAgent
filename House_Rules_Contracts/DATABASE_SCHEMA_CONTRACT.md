# Database Schema Contract

**Last Updated:** 2024-12-02  
**Version:** 1.0.0  
**Status:** Initial Template

---

## Purpose

This contract defines the complete database schema for the project. **All coding agents MUST check this file before making any database changes** to ensure no breaking changes are introduced.

---

## Change Log

| Date | Version | Agent/Author | Changes | Impact |
|------|---------|--------------|---------|--------|
| 2024-12-02 | 1.0.0 | DevOps Agent | Initial template creation | N/A - Template only |

---

## Schema Overview

### Database Technology
- **Type:** [e.g., PostgreSQL, MySQL, MongoDB, etc.]
- **Version:** [e.g., PostgreSQL 15.x]
- **Connection Pool:** [e.g., Max 20 connections]

### Database List
| Database Name | Purpose | Owner | Created Date |
|--------------|---------|-------|--------------|
| [db_name] | [Purpose description] | [Team/Service] | [YYYY-MM-DD] |

---

## Tables

### Table: [table_name]

**Created:** [YYYY-MM-DD]  
**Last Modified:** [YYYY-MM-DD]  
**Purpose:** [Brief description of what this table stores]

#### Schema Definition

```sql
CREATE TABLE [table_name] (
    id SERIAL PRIMARY KEY,
    column_name TYPE CONSTRAINTS,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Columns

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|-------------|-----------|----------|---------|-------------|-------------|
| id | SERIAL | NO | AUTO | PRIMARY KEY | Unique identifier |
| column_name | TYPE | YES/NO | value | CONSTRAINT | Description |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | | Record creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | | Last update time |

#### Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| idx_[name] | [column1, column2] | BTREE/HASH | [Performance optimization for...] |

#### Foreign Keys

| FK Name | Column | References | On Delete | On Update |
|---------|--------|------------|-----------|-----------|
| fk_[name] | [column] | [table(column)] | CASCADE/RESTRICT | CASCADE/RESTRICT |

#### Dependencies

**Used By (Modules):**
- [Module Name] - [How it uses this table]
- [Service Name] - [Read/Write operations]

**Depends On (Tables):**
- [Related Table] - [Relationship description]

---

## Views

### View: [view_name]

**Created:** [YYYY-MM-DD]  
**Purpose:** [What this view provides]

```sql
CREATE VIEW [view_name] AS
SELECT ...
FROM ...
WHERE ...;
```

**Used By:**
- [Module/Service] - [Purpose]

---

## Stored Procedures & Functions

### Procedure: [procedure_name]

**Created:** [YYYY-MM-DD]  
**Purpose:** [What this procedure does]

```sql
CREATE PROCEDURE [procedure_name](params)
BEGIN
    -- Logic
END;
```

**Parameters:**
| Name | Type | Direction | Description |
|------|------|-----------|-------------|
| param1 | TYPE | IN/OUT | Description |

**Called By:**
- [Module/Service] - [When/Why]

---

## Migration History

### Migration: [migration_id]

**Date:** [YYYY-MM-DD]  
**Type:** [Schema Change / Data Migration]  
**Status:** [Applied / Pending / Rolled Back]

**Changes:**
- [Description of changes made]

**Rollback Plan:**
```sql
-- Rollback SQL if needed
```

**Impact Assessment:**
- **Breaking Change:** YES/NO
- **Affected Modules:** [List]
- **Downtime Required:** YES/NO

---

## Migration Policy

**All database changes must strictly adhere to these Continuous Delivery principles:**

### 1. Idempotency
*   **Requirement:** All migration scripts MUST be idempotent (runnable multiple times without error or side effects).
*   **Implementation:**
    *   Use `IF NOT EXISTS` for creating tables/columns/indexes.
    *   Use `IF EXISTS` for dropping (though dropping is discouraged).
    *   Check for existing data before inserting.

### 2. Separation of Concerns (DDL vs DML)
*   **Requirement:** Schema changes (DDL) and Data changes (DML) MUST be in separate migration files.
*   **Reasoning:** Mixing them causes locking issues and makes rollbacks complex.
*   **DDL:** `CREATE`, `ALTER`, `DROP` (Schema definitions).
*   **DML:** `INSERT`, `UPDATE`, `DELETE` (Data manipulation).

### 3. Non-Destructive Changes
*   **Requirement:** **NEVER drop columns or tables in a live environment.**
*   **Deprecation Workflow:**
    1.  Mark column as deprecated in this contract.
    2.  Stop writing to it in the application.
    3.  Stop reading from it.
    4.  (Optional) Backfill/migrate data to new structure.
    5.  Drop column only after N+1 releases when it is confirmed unused.

### 4. Online-Safe Patterns
*   **Avoid:** Long-running locks on busy tables.
*   **Strategy:** For large tables, use techniques like:
    *   Add column nullable first, then backfill, then add NOT NULL constraint.
    *   Create index concurrently (`CREATE INDEX CONCURRENTLY`).

## Breaking Change Protocol

### Before Making Schema Changes:

1. **Check Dependencies:** Review "Used By" sections for all affected tables
2. **Impact Analysis:** Document all modules/services that will be affected
3. **Migration Plan:** Create backward-compatible migration if possible
4. **Communication:** Update this contract BEFORE applying changes
5. **Version Bump:** Increment version number following semver
6. **Testing:** Ensure all dependent modules pass tests after migration

### Breaking Change Checklist:

- [ ] All dependent modules identified
- [ ] Migration script created and tested
- [ ] Rollback script prepared
- [ ] This contract updated with new schema
- [ ] SQL Contract updated with affected queries
- [ ] API Contract reviewed for endpoint impacts
- [ ] Team notified of breaking changes
- [ ] Documentation updated

---

## Data Retention Policies

| Table | Retention Period | Archive Strategy | Compliance Notes |
|-------|------------------|------------------|------------------|
| [table_name] | [e.g., 7 years] | [Archive to S3 after 1 year] | [GDPR, SOC2, etc.] |

---

## Security & Access Control

### Role-Based Access

| Role | Tables | Permissions | Purpose |
|------|--------|-------------|---------|
| app_user | [tables] | SELECT, INSERT, UPDATE | Application runtime access |
| admin | ALL | ALL | Administrative tasks |
| readonly | ALL | SELECT | Reporting and analytics |

### Sensitive Data

| Table | Column | Encryption | PII | Notes |
|-------|--------|------------|-----|-------|
| [table] | [column] | AES-256 | YES | [Handling requirements] |

---

## Performance Considerations

### Query Optimization Guidelines

- **Indexes:** Always check existing indexes before adding new ones
- **N+1 Queries:** Use JOINs or batch loading where possible
- **Large Tables:** Tables with >1M rows require special consideration
- **Pagination:** Always use LIMIT/OFFSET or cursor-based pagination

### Monitoring

- **Slow Query Threshold:** [e.g., 500ms]
- **Connection Pool Alerts:** [e.g., >80% utilization]
- **Table Size Alerts:** [e.g., >10GB requires review]

---

## Backup & Recovery

- **Backup Frequency:** [e.g., Daily at 2 AM UTC]
- **Backup Retention:** [e.g., 30 days]
- **Recovery Time Objective (RTO):** [e.g., 4 hours]
- **Recovery Point Objective (RPO):** [e.g., 24 hours]

---

## Notes for Coding Agents

### CRITICAL RULES:

1. **ALWAYS read this contract before creating or modifying database tables**
2. **NEVER drop columns** - mark as deprecated and create migration plan
3. **ALWAYS add new columns as nullable** or provide default values
4. **UPDATE this contract immediately** after any schema change
5. **INCREMENT version number** for any schema modification
6. **CHECK SQL_CONTRACT.json** for queries that may be affected
7. **VERIFY API_CONTRACT.md** for endpoints using affected tables
8. **RUN all tests** after schema changes

### Workflow:

```
1. Read DATABASE_SCHEMA_CONTRACT.md
2. Identify affected tables and dependencies
3. Check SQL_CONTRACT.json for related queries
4. Plan backward-compatible changes
5. Update this contract with new schema
6. Create migration script
7. Update SQL_CONTRACT.json if queries change
8. Update API_CONTRACT.md if endpoints affected
9. Run tests
10. Commit with proper documentation
```

---

## Template Instructions

**For DevOps Agent / Coding Agents:**

When populating this template for the first time:

1. **Scan all source code** for database connection strings and ORM models
2. **Identify all tables** by searching for CREATE TABLE, model definitions, or migration files
3. **Extract schema information** from:
   - Migration files (e.g., Alembic, Flyway, Liquibase)
   - ORM models (e.g., SQLAlchemy, Sequelize, Prisma)
   - Raw SQL files in the repository
4. **Document dependencies** by tracing module imports and SQL query usage
5. **List all modules** that interact with each table
6. **Create this contract** before any new database changes are made

**Search Patterns:**
- `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`
- `@Entity`, `class.*Model`, `Schema.define`
- `db.query`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- Migration file patterns: `**/migrations/**`, `**/alembic/**`

---

## Example Entry

<!-- ======================================================================= -->
<!-- NOTE: The following is an EXAMPLE ONLY. Do not treat as real schema.    -->
<!-- ======================================================================= -->

### Table: users

**Created:** 2024-01-15  
**Last Modified:** 2024-11-20  
**Purpose:** Stores user account information and authentication data

#### Schema Definition

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Columns

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|-------------|-----------|----------|---------|-------------|-------------|
| id | SERIAL | NO | AUTO | PRIMARY KEY | Unique user identifier |
| email | VARCHAR(255) | NO | - | UNIQUE, NOT NULL | User email address |
| password_hash | VARCHAR(255) | NO | - | NOT NULL | Bcrypt hashed password |
| username | VARCHAR(100) | NO | - | UNIQUE, NOT NULL | Display name |
| is_active | BOOLEAN | NO | true | - | Account active status |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | - | Account creation time |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | - | Last profile update |

#### Indexes

| Index Name | Columns | Type | Purpose |
|------------|---------|------|---------|
| idx_users_email | email | BTREE | Fast email lookup for authentication |
| idx_users_username | username | BTREE | Fast username search |

#### Dependencies

**Used By (Modules):**
- `auth-service` - User authentication and session management
- `user-profile-api` - Profile CRUD operations
- `admin-dashboard` - User management interface

**Depends On (Tables):**
- None (root table)

---

*This contract is a living document. Update it with every schema change.*
