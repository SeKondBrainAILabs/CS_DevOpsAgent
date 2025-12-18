# Features Contract

**Last Updated:** 2024-12-02  
**Version:** 1.0.0  
**Status:** Initial Template

---

## Purpose

This contract documents **all features and specifications** in the project. Coding agents **MUST check this file before implementing new features** to:
- **Prevent duplicate feature development**
- **Reuse existing functionality** instead of rebuilding
- **Maintain feature consistency** across the application
- **Avoid conflicting implementations** by multiple agents
- **Ensure all agents know what features exist** and how to use them

---

## Change Log

| Date | Version | Agent/Author | Changes | Impact |
|------|---------|--------------|---------|--------|
| 2024-12-02 | 1.0.0 | DevOps Agent | Initial template creation | N/A - Template only |

---

## Feature Overview

| Feature ID | Feature Name | Status | Owner Module | Priority | Completion |
|------------|--------------|--------|--------------|----------|------------|
| [F-001] | [Feature Name] | Active/Beta/Deprecated | [Module] | High/Medium/Low | 100% |

---

## Features

### Feature Template

#### Feature ID: [F-XXX] - [Feature Name]

**Added:** [YYYY-MM-DD]  
**Last Modified:** [YYYY-MM-DD]  
**Status:** `active` | `beta` | `deprecated` | `planned`  
**Priority:** `critical` | `high` | `medium` | `low`  
**Completion:** [0-100]%

**Description:**  
[Detailed description of what this feature does and why it exists]

**User Story:**  
As a [user type], I want to [action] so that [benefit].

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Implementation Details:**

**Modules/Files:**
| File Path | Purpose | Lines of Code |
|-----------|---------|---------------|
| `src/features/[name]/index.js` | Main entry point | ~200 |
| `src/features/[name]/service.js` | Business logic | ~150 |
| `src/features/[name]/controller.js` | API controller | ~100 |

**API Endpoints:**
- `GET /api/v1/[resource]` - [Description] (see API_CONTRACT.md)
- `POST /api/v1/[resource]` - [Description] (see API_CONTRACT.md)

**Database Tables:**
- `[table_name]` - [Purpose] (see DATABASE_SCHEMA_CONTRACT.md)

**SQL Queries:**
- `get_[resource]_by_id` - [Purpose] (see SQL_CONTRACT.json)
- `create_[resource]` - [Purpose] (see SQL_CONTRACT.json)

**3rd Party Integrations:**
- `[Service Name]` - [How it's used] (see THIRD_PARTY_INTEGRATIONS.md)

**Dependencies:**

**Required Features:**
- [F-XXX] - [Feature Name] - [Why it's needed]

**Optional Features:**
- [F-XXX] - [Feature Name] - [Enhanced functionality if available]

**Used By Features:**
- [F-XXX] - [Feature Name] - [How it uses this feature]

**Configuration:**

**Environment Variables:**
- `FEATURE_[NAME]_ENABLED` - Enable/disable feature flag
- `FEATURE_[NAME]_[CONFIG]` - Feature-specific config

(See INFRA_CONTRACT.md for details)

**Feature Flags:**
```javascript
{
  "feature_[name]_enabled": true,
  "feature_[name]_beta_users": ["user_id_1", "user_id_2"],
  "feature_[name]_rollout_percentage": 100
}
```

**User Interface:**

**Pages/Views:**
- `/[route]` - [Page description]
- `/[route]/[subroute]` - [Page description]

**Components:**
- `[ComponentName]` - `src/components/[name].jsx` - [Purpose]

**User Permissions:**
| Role | Access Level | Actions Allowed |
|------|--------------|-----------------|
| admin | Full | Create, Read, Update, Delete |
| user | Limited | Read, Update own |
| guest | Read-only | Read public only |

**Business Logic:**

**Key Workflows:**
1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]

**Validation Rules:**
- [Field]: [Validation rule]
- [Field]: [Validation rule]

**Error Handling:**
| Error Scenario | Error Code | User Message | Handling |
|----------------|------------|--------------|----------|
| [Scenario] | [Code] | [Message] | [Action] |

**Testing:**

**Test Coverage:** [X]%

**Test Files:**
- `test_cases/features/[name].test.js` - Unit tests
- `test_cases/integration/[name].integration.test.js` - Integration tests
- `test_cases/e2e/[name].e2e.test.js` - End-to-end tests

**Test Scenarios:**
- [ ] Happy path: [Description]
- [ ] Edge case: [Description]
- [ ] Error handling: [Description]
- [ ] Performance: [Description]

**Performance:**

**Metrics:**
- Average response time: [X]ms
- Peak load capacity: [X] requests/second
- Database queries: [X] per request
- Memory usage: [X]MB

**Optimization Notes:**
- [Optimization applied]
- [Caching strategy]
- [Index usage]

**Security:**

**Security Measures:**
- Authentication required: YES/NO
- Authorization checks: [Description]
- Input validation: [Method]
- Output sanitization: [Method]
- Rate limiting: [X] requests/[timeframe]

**Sensitive Data:**
- [Data type]: [Encryption/Protection method]

**Monitoring & Analytics:**

**Metrics Tracked:**
- Feature usage count
- User engagement rate
- Error rate
- Performance metrics

**Alerts:**
- Error rate > [X]%
- Response time > [X]ms
- Usage spike/drop > [X]%

**Documentation:**

**User Documentation:**
- User guide: `docs/user-guide/[feature].md`
- FAQ: `docs/faq/[feature].md`

**Developer Documentation:**
- Technical spec: `docs/technical/[feature].md`
- API docs: `docs/api/[feature].md`

**Known Issues:**

| Issue ID | Description | Severity | Workaround | Status |
|----------|-------------|----------|------------|--------|
| [I-XXX] | [Description] | High/Medium/Low | [Workaround] | Open/In Progress/Resolved |

**Future Enhancements:**

| Enhancement ID | Description | Priority | Estimated Effort |
|----------------|-------------|----------|------------------|
| [E-XXX] | [Description] | High/Medium/Low | [X] days |

**Changelog:**

| Date | Version | Changes | Breaking |
|------|---------|---------|----------|
| 2024-01-15 | 1.0.0 | Initial implementation | N/A |

---

## Example Features

<!-- ======================================================================= -->
<!-- NOTE: The following is an EXAMPLE ONLY. Do not treat as real features.  -->
<!-- ======================================================================= -->

### Feature ID: F-001 - User Authentication

**Added:** 2024-01-15  
**Last Modified:** 2024-02-10  
**Status:** `active`  
**Priority:** `critical`  
**Completion:** 100%

**Description:**  
Secure user authentication system supporting email/password login, JWT token management, password reset, and session handling.

**User Story:**  
As a user, I want to securely log in to my account so that I can access protected features and my personal data.

**Acceptance Criteria:**
- [x] Users can register with email and password
- [x] Users can log in with valid credentials
- [x] Users receive JWT token upon successful login
- [x] Users can reset forgotten passwords via email
- [x] Sessions expire after 24 hours
- [x] Failed login attempts are rate-limited

**Implementation Details:**

**Modules/Files:**
| File Path | Purpose | Lines of Code |
|-----------|---------|---------------|
| `src/features/auth/index.js` | Main auth module | 50 |
| `src/features/auth/service.js` | Auth business logic | 250 |
| `src/features/auth/controller.js` | API endpoints | 180 |
| `src/features/auth/middleware.js` | JWT verification | 80 |
| `src/features/auth/validators.js` | Input validation | 120 |

**API Endpoints:**
- `POST /api/v1/auth/register` - User registration (see API_CONTRACT.md)
- `POST /api/v1/auth/login` - User login (see API_CONTRACT.md)
- `POST /api/v1/auth/logout` - User logout (see API_CONTRACT.md)
- `POST /api/v1/auth/refresh` - Refresh JWT token (see API_CONTRACT.md)
- `POST /api/v1/auth/forgot-password` - Request password reset (see API_CONTRACT.md)
- `POST /api/v1/auth/reset-password` - Reset password (see API_CONTRACT.md)

**Database Tables:**
- `users` - User accounts and credentials (see DATABASE_SCHEMA_CONTRACT.md)
- `password_resets` - Password reset tokens (see DATABASE_SCHEMA_CONTRACT.md)
- `sessions` - Active user sessions (see DATABASE_SCHEMA_CONTRACT.md)

**SQL Queries:**
- `get_user_by_email` - User lookup (see SQL_CONTRACT.json)
- `insert_user` - Create new user (see SQL_CONTRACT.json)
- `update_user_password` - Update password (see SQL_CONTRACT.json)
- `create_password_reset_token` - Generate reset token (see SQL_CONTRACT.json)

**3rd Party Integrations:**
- `SendGrid` - Password reset emails (see THIRD_PARTY_INTEGRATIONS.md)

**Dependencies:**

**Required Features:**
- None (core feature)

**Used By Features:**
- [F-002] - User Profile Management
- [F-003] - User Dashboard
- [F-010] - Admin Panel

**Configuration:**

**Environment Variables:**
- `JWT_SECRET` - Secret key for JWT signing
- `JWT_EXPIRATION` - Token expiration time (default: 24h)
- `PASSWORD_RESET_EXPIRATION` - Reset token expiration (default: 1h)
- `MAX_LOGIN_ATTEMPTS` - Max failed attempts before lockout (default: 5)
- `LOCKOUT_DURATION` - Account lockout duration (default: 15min)

**Feature Flags:**
```javascript
{
  "auth_email_verification_required": true,
  "auth_2fa_enabled": false,
  "auth_social_login_enabled": false
}
```

**Security:**

**Security Measures:**
- Passwords hashed with bcrypt (cost factor 10)
- JWT tokens signed with HS256
- Rate limiting: 5 login attempts per 15 minutes
- Password reset tokens expire in 1 hour
- HTTPS required for all auth endpoints
- Input validation on all fields
- SQL injection prevention via parameterized queries

**Testing:**

**Test Coverage:** 98%

**Test Files:**
- `test_cases/features/auth.test.js` - Unit tests (45 tests)
- `test_cases/integration/auth.integration.test.js` - Integration tests (20 tests)
- `test_cases/e2e/auth.e2e.test.js` - E2E tests (15 tests)

**Performance:**
- Login response time: 120ms average
- Registration response time: 180ms average
- Password reset email sent in <5s

**Monitoring:**
- Failed login attempts tracked
- Account lockouts logged
- Password reset requests monitored
- JWT token generation rate tracked

---

### Feature ID: F-002 - User Profile Management

**Added:** 2024-01-20  
**Last Modified:** 2024-01-20  
**Status:** `active`  
**Priority:** `high`  
**Completion:** 100%

**Description:**  
Allows users to view and update their profile information including username, email, avatar, and preferences.

**User Story:**  
As a user, I want to manage my profile information so that I can keep my account details up to date.

**Acceptance Criteria:**
- [x] Users can view their profile
- [x] Users can update username and email
- [x] Users can upload profile avatar
- [x] Users can update preferences
- [x] Email changes require verification

**Implementation Details:**

**Modules/Files:**
| File Path | Purpose | Lines of Code |
|-----------|---------|---------------|
| `src/features/profile/index.js` | Main profile module | 40 |
| `src/features/profile/service.js` | Profile business logic | 200 |
| `src/features/profile/controller.js` | API endpoints | 150 |

**API Endpoints:**
- `GET /api/v1/users/{id}` - Get user profile (see API_CONTRACT.md)
- `PUT /api/v1/users/{id}` - Update user profile (see API_CONTRACT.md)
- `POST /api/v1/users/{id}/avatar` - Upload avatar (see API_CONTRACT.md)

**Database Tables:**
- `users` - User profile data (see DATABASE_SCHEMA_CONTRACT.md)
- `user_preferences` - User settings (see DATABASE_SCHEMA_CONTRACT.md)

**3rd Party Integrations:**
- `AWS S3` - Avatar image storage (see THIRD_PARTY_INTEGRATIONS.md)
- `SendGrid` - Email change verification (see THIRD_PARTY_INTEGRATIONS.md)

**Dependencies:**

**Required Features:**
- [F-001] - User Authentication (for auth middleware)

**Used By Features:**
- [F-003] - User Dashboard

---

## Feature Categories

### Core Features (Critical)
- [F-001] - User Authentication
- [F-002] - User Profile Management
- [F-003] - User Dashboard

### User Features (High Priority)
- [F-010] - Feature X
- [F-011] - Feature Y

### Admin Features (Medium Priority)
- [F-020] - Admin Panel
- [F-021] - User Management

### Integration Features (Low Priority)
- [F-030] - Third-party Integration X
- [F-031] - Third-party Integration Y

---

## Feature Dependency Graph

```
[F-001] User Authentication
    ├── [F-002] User Profile Management
    │       └── [F-003] User Dashboard
    ├── [F-010] Feature X
    └── [F-020] Admin Panel
            └── [F-021] User Management
```

---

## Feature Status Summary

| Status | Count | Features |
|--------|-------|----------|
| Active | X | [List] |
| Beta | X | [List] |
| Planned | X | [List] |
| Deprecated | X | [List] |

---

## Notes for Coding Agents

### 🚨 CRITICAL RULES:

1. **ALWAYS read this contract BEFORE implementing any feature**
2. **SEARCH this contract** to check if the feature already exists
3. **REUSE existing features** instead of rebuilding from scratch
4. **NEVER duplicate functionality** - extend existing features instead
5. **UPDATE this contract immediately** after implementing new features
6. **DOCUMENT all dependencies** - features, APIs, database, 3rd parties
7. **CROSS-REFERENCE all contracts:**
   - API_CONTRACT.md for endpoints
   - DATABASE_SCHEMA_CONTRACT.md for tables
   - SQL_CONTRACT.json for queries
   - THIRD_PARTY_INTEGRATIONS.md for external services
   - INFRA_CONTRACT.md for environment variables
8. **INCREMENT version number** for any feature changes
9. **ADD changelog entry** with date, version, and changes
10. **PREVENT DUPLICATION** - This is the primary purpose of this contract!

### Workflow to Prevent Duplicate Features:

```
BEFORE IMPLEMENTING ANY FEATURE:

1. Read FEATURES_CONTRACT.md completely
2. Search for similar functionality by:
   - Feature name/description
   - User story
   - API endpoints
   - Database tables
   - Business logic

3. If similar feature exists:
   ❌ DO NOT create duplicate feature
   ✅ USE the existing feature
   ✅ EXTEND the existing feature if needed
   ✅ ADD your use case to "Used By Features"
   ✅ DOCUMENT your usage in your module

4. If feature doesn't exist:
   ✅ CREATE new feature following template
   ✅ ASSIGN unique Feature ID (next available F-XXX)
   ✅ DOCUMENT all implementation details
   ✅ CROSS-REFERENCE all contracts
   ✅ ADD to appropriate category
   ✅ UPDATE dependency graph
   ✅ INCREMENT version number
   ✅ ADD changelog entry

5. If unsure:
   ⚠️ ASK the user before proceeding
   ⚠️ Document why you think it might be duplicate
   ⚠️ Suggest reusing existing feature if possible
```

### How to Search for Existing Features:

**By Functionality:**
- Search for keywords in feature descriptions
- Check user stories for similar use cases
- Look at acceptance criteria

**By Implementation:**
- Search for API endpoints in API_CONTRACT.md
- Search for database tables in DATABASE_SCHEMA_CONTRACT.md
- Search for SQL queries in SQL_CONTRACT.json
- Search for 3rd party services in THIRD_PARTY_INTEGRATIONS.md

**By Category:**
- Check feature categories for related features
- Review dependency graph for connected features

### Benefits of This Contract:

✅ **Prevents Duplicate Work** - Agents don't rebuild existing features  
✅ **Prevents Code Conflicts** - Agents don't overwrite each other's code  
✅ **Prevents Schema Conflicts** - Agents don't create duplicate tables  
✅ **Prevents API Conflicts** - Agents don't create duplicate endpoints  
✅ **Promotes Code Reuse** - Agents discover and use existing functionality  
✅ **Maintains Consistency** - All agents follow same patterns  
✅ **Enables Collaboration** - Agents know what others have built  
✅ **Speeds Development** - Agents reuse instead of rebuild  

---

## Initial Population Instructions

**For DevOps Agent / Coding Agents:**

When populating this template for the first time, follow this process:

### Phase 1: Identify All Features

1. **Scan codebase structure:**
   - Look for feature folders: `src/features/`, `src/modules/`
   - Identify distinct functional areas
   - Group related files by feature

2. **Analyze API endpoints:**
   - Review API_CONTRACT.md
   - Group endpoints by feature
   - Identify feature boundaries

3. **Analyze database schema:**
   - Review DATABASE_SCHEMA_CONTRACT.md
   - Group tables by feature domain
   - Identify feature data models

4. **Review user-facing functionality:**
   - Check frontend routes and pages
   - Identify user workflows
   - Map UI to backend features

5. **Create feature list:**
   - Assign unique Feature IDs (F-001, F-002, etc.)
   - Write feature names and descriptions
   - Categorize by priority and status

### Phase 2: Document Each Feature

For each identified feature:

1. **Extract implementation details:**
   - List all files/modules
   - Document API endpoints (link to API_CONTRACT.md)
   - Document database tables (link to DATABASE_SCHEMA_CONTRACT.md)
   - Document SQL queries (link to SQL_CONTRACT.json)
   - Document 3rd party integrations (link to THIRD_PARTY_INTEGRATIONS.md)

2. **Identify dependencies:**
   - Which features does this depend on?
   - Which features depend on this?
   - Create dependency graph

3. **Document configuration:**
   - Environment variables
   - Feature flags
   - Configuration files

4. **Add testing information:**
   - Test files
   - Test coverage
   - Test scenarios

5. **Document user interface:**
   - Pages/routes
   - Components
   - User permissions

### Phase 3: Cross-Reference All Contracts

1. **Link to API_CONTRACT.md:**
   - List all endpoints used by feature
   - Ensure endpoints are documented in API_CONTRACT.md

2. **Link to DATABASE_SCHEMA_CONTRACT.md:**
   - List all tables used by feature
   - Ensure tables are documented in DATABASE_SCHEMA_CONTRACT.md

3. **Link to SQL_CONTRACT.json:**
   - List all queries used by feature
   - Ensure queries are documented in SQL_CONTRACT.json

4. **Link to THIRD_PARTY_INTEGRATIONS.md:**
   - List all integrations used by feature
   - Ensure integrations are documented

5. **Link to INFRA_CONTRACT.md:**
   - List all environment variables
   - Ensure variables are documented

### Automated Script Approach:

Create a script that:
1. Scans `src/` directory for feature folders
2. Analyzes imports and dependencies
3. Extracts API routes from controllers
4. Identifies database models and queries
5. Generates initial feature list
6. Creates feature documentation templates
7. Prompts for manual review and completion

**Search Patterns:**
- Feature folders: `src/features/*`, `src/modules/*`
- Route definitions: `app.get(`, `router.post(`, `@app.route(`
- Database models: `class.*Model`, `Schema.define`, `CREATE TABLE`
- Feature flags: `feature_flags`, `isEnabled(`, `featureEnabled(`
- User stories: `docs/user-stories/`, `docs/requirements/`

---

## Feature Naming Convention

**Feature ID Format:** `F-XXX` (e.g., F-001, F-002, F-010)

**Numbering Scheme:**
- F-001 to F-009: Core/Critical features
- F-010 to F-019: User-facing features
- F-020 to F-029: Admin features
- F-030 to F-039: Integration features
- F-040 to F-049: Utility features
- F-050+: Custom/Future features

**Feature Name Format:** `[Noun] [Action/Type]`
- Good: "User Authentication", "Profile Management", "Payment Processing"
- Bad: "Auth", "Profiles", "Payments"

---

*This contract is a living document. Update it with every new feature implementation.*
