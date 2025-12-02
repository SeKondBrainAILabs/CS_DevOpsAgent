# API Contract Schema

**Last Updated:** 2024-12-02  
**Version:** 1.0.0  
**Status:** Initial Template

---

## Purpose

This contract documents **all API endpoints** in the project. Coding agents **MUST check this file before creating new endpoints** to:
- Reuse existing endpoints
- Maintain consistent API design
- Avoid duplicate functionality
- Ensure backward compatibility

---

## Change Log

| Date | Version | Agent/Author | Changes | Impact |
|------|---------|--------------|---------|--------|
| 2024-12-02 | 1.0.0 | DevOps Agent | Initial template creation | N/A - Template only |

---

## API Overview

### Base Configuration

| Property | Value | Notes |
|----------|-------|-------|
| **Base URL** | `https://api.example.com` | Production environment |
| **API Version** | `v1` | Current stable version |
| **Protocol** | HTTPS | TLS 1.2+ required |
| **Authentication** | Bearer Token / JWT | OAuth 2.0 compatible |
| **Rate Limiting** | 1000 req/hour per user | Configurable per endpoint |
| **Default Format** | JSON | Accept: application/json |

### Versioning Strategy

- **URL Versioning:** `/api/v1/`, `/api/v2/`
- **Breaking Changes:** Require new version
- **Deprecation Period:** 6 months minimum
- **Sunset Headers:** `Sunset: <date>` for deprecated endpoints

---

## Authentication & Authorization

### Authentication Methods

#### 1. JWT Bearer Token
```http
Authorization: Bearer <jwt_token>
```

**Token Structure:**
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "admin|user|guest",
  "iat": 1234567890,
  "exp": 1234571490
}
```

#### 2. API Key (For Service-to-Service)
```http
X-API-Key: <api_key>
```

### Authorization Roles

| Role | Permissions | Description |
|------|-------------|-------------|
| `guest` | Read public data | Unauthenticated users |
| `user` | Read/Write own data | Authenticated users |
| `admin` | Full access | System administrators |
| `service` | Backend operations | Service accounts |

---

## Endpoints

### Endpoint Template

#### `[METHOD] /api/v1/resource/{id}`

**Added:** [YYYY-MM-DD]  
**Last Modified:** [YYYY-MM-DD]  
**Status:** `active` | `deprecated` | `beta`  
**Deprecation Date:** [YYYY-MM-DD] *(if applicable)*

**Description:**  
[What this endpoint does]

**Authentication Required:** YES/NO  
**Required Roles:** `[role1, role2]`  
**Rate Limit:** [e.g., 100 req/min]

**Request:**

```http
[METHOD] /api/v1/resource/{id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "field": "value"
}
```

**Path Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id` | integer | YES | Resource identifier | `123` |

**Query Parameters:**

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `filter` | string | NO | `null` | Filter criteria | `active` |
| `limit` | integer | NO | `20` | Results per page | `50` |
| `offset` | integer | NO | `0` | Pagination offset | `100` |

**Request Body Schema:**

```json
{
  "field1": "string (required, max 255 chars)",
  "field2": "integer (optional, min 0)",
  "nested": {
    "subfield": "boolean (required)"
  }
}
```

**Response:**

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "field1": "value",
    "created_at": "2024-12-02T10:00:00Z"
  }
}
```

**Error Responses:**

| Status Code | Description | Response Body |
|-------------|-------------|---------------|
| 400 | Bad Request - Invalid input | `{"success": false, "error": "Validation failed", "details": [...]}` |
| 401 | Unauthorized - Missing/invalid token | `{"success": false, "error": "Authentication required"}` |
| 403 | Forbidden - Insufficient permissions | `{"success": false, "error": "Access denied"}` |
| 404 | Not Found - Resource doesn't exist | `{"success": false, "error": "Resource not found"}` |
| 429 | Too Many Requests - Rate limit exceeded | `{"success": false, "error": "Rate limit exceeded", "retry_after": 60}` |
| 500 | Internal Server Error | `{"success": false, "error": "Internal server error"}` |

**Implementation Details:**

- **Controller:** `src/api/controllers/ResourceController.js`
- **Service:** `src/services/ResourceService.js`
- **Database Tables:** `resources`, `resource_metadata`
- **SQL Queries Used:** `get_resource_by_id`, `update_resource`
- **3rd Party Integrations:** None / `[service_name]`

**Dependencies:**

- **Requires:** `[other_endpoints_this_calls]`
- **Called By:** `[endpoints_that_call_this]`

**Performance Notes:**

- Average response time: 50ms
- Database queries: 2 (with indexes)
- Caching: Redis, 5min TTL

**Security Notes:**

- Input validation: Joi schema
- SQL injection: Parameterized queries
- XSS protection: Output sanitization
- CSRF: Not applicable (stateless API)

**Examples:**

**Example 1: Get user by ID**
```bash
curl -X GET "https://api.example.com/api/v1/users/123" \
  -H "Authorization: Bearer eyJhbGc..."
```

**Example 2: Update user profile**
```bash
curl -X PUT "https://api.example.com/api/v1/users/123" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{"username": "new_name", "email": "new@example.com"}'
```

**Testing:**

- Unit tests: `test_cases/api/users.test.js`
- Integration tests: `test_cases/integration/user_api.test.js`
- Coverage: 95%

**Changelog:**

| Date | Version | Changes | Breaking |
|------|---------|---------|----------|
| 2024-01-15 | 1.0.0 | Initial creation | N/A |
| 2024-02-10 | 1.1.0 | Added `filter` query param | NO |

---

## Example Endpoints

### User Management

#### `GET /api/v1/users/{id}`

**Added:** 2024-01-15  
**Last Modified:** 2024-01-15  
**Status:** `active`

**Description:**  
Retrieves a single user by ID. Returns public profile information.

**Authentication Required:** YES  
**Required Roles:** `user`, `admin`  
**Rate Limit:** 100 req/min

**Path Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `id` | integer | YES | User ID | `123` |

**Response:**

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "username": "john_doe",
    "email": "john@example.com",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Implementation:**
- **Controller:** `src/api/controllers/UserController.js::getUser()`
- **Service:** `src/services/UserService.js::getUserById()`
- **SQL Query:** `get_user_by_id` (from SQL_CONTRACT.json)
- **Database Tables:** `users`

**Performance:** Avg 20ms, uses `idx_users_id` index

---

#### `POST /api/v1/users`

**Added:** 2024-01-15  
**Last Modified:** 2024-01-15  
**Status:** `active`

**Description:**  
Creates a new user account. Sends verification email.

**Authentication Required:** NO (public registration)  
**Required Roles:** N/A  
**Rate Limit:** 10 req/hour per IP

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "username": "new_user"
}
```

**Validation Rules:**
- `email`: Valid email format, unique
- `password`: Min 8 chars, 1 uppercase, 1 number, 1 special char
- `username`: 3-30 chars, alphanumeric + underscore, unique

**Response:**

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "username": "new_user",
    "email": "newuser@example.com",
    "created_at": "2024-12-02T10:00:00Z"
  },
  "message": "Verification email sent"
}
```

**Implementation:**
- **Controller:** `src/api/controllers/UserController.js::createUser()`
- **Service:** `src/services/UserService.js::registerUser()`
- **SQL Query:** `insert_user` (from SQL_CONTRACT.json)
- **Database Tables:** `users`
- **3rd Party:** SendGrid (email verification)

**Security:**
- Password hashed with bcrypt (cost factor 10)
- Email verification required before activation
- Rate limiting prevents spam registrations

---

### Authentication

#### `POST /api/v1/auth/login`

**Added:** 2024-01-15  
**Last Modified:** 2024-01-15  
**Status:** `active`

**Description:**  
Authenticates user and returns JWT token.

**Authentication Required:** NO  
**Rate Limit:** 5 req/min per IP

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

**Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-12-03T10:00:00Z",
    "user": {
      "id": 123,
      "username": "john_doe",
      "email": "user@example.com"
    }
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Implementation:**
- **Controller:** `src/api/controllers/AuthController.js::login()`
- **Service:** `src/services/AuthService.js::authenticate()`
- **SQL Query:** `get_user_by_email` (from SQL_CONTRACT.json)
- **Database Tables:** `users`

**Security:**
- Password comparison using bcrypt
- Failed login attempts logged
- Account lockout after 5 failed attempts (15min)
- JWT signed with HS256, 24h expiration

---

## API Design Patterns

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message",
  "meta": {
    "timestamp": "2024-12-02T10:00:00Z",
    "request_id": "uuid"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ],
  "meta": {
    "timestamp": "2024-12-02T10:00:00Z",
    "request_id": "uuid"
  }
}
```

### Pagination

**Request:**
```http
GET /api/v1/resources?limit=20&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

### Filtering & Sorting

**Request:**
```http
GET /api/v1/resources?filter[status]=active&sort=-created_at
```

**Supported Operators:**
- `filter[field]=value` - Exact match
- `filter[field][gt]=value` - Greater than
- `filter[field][lt]=value` - Less than
- `filter[field][in]=val1,val2` - In array
- `sort=field` - Ascending
- `sort=-field` - Descending

---

## Endpoint Categories

### User Management
- `GET /api/v1/users/{id}` - Get user by ID
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user
- `GET /api/v1/users` - List users (admin only)

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/reset-password` - Reset password

### Resources (Example)
- `GET /api/v1/resources` - List resources
- `GET /api/v1/resources/{id}` - Get resource
- `POST /api/v1/resources` - Create resource
- `PUT /api/v1/resources/{id}` - Update resource
- `DELETE /api/v1/resources/{id}` - Delete resource

---

## Breaking Change Protocol

### Before Creating/Modifying Endpoints:

1. **Check existing endpoints** - Search this contract for similar functionality
2. **Reuse if possible** - Use existing endpoints instead of creating new ones
3. **Combine endpoints** - Consider using existing endpoints together
4. **Plan backward compatibility** - Add optional parameters, don't remove required ones
5. **Version if breaking** - Create new version if changes are breaking
6. **Update this contract** - Document all changes with date and impact
7. **Update SQL_CONTRACT.json** - If endpoint uses new/modified queries
8. **Update DATABASE_SCHEMA_CONTRACT.md** - If endpoint uses new tables

### Breaking vs Non-Breaking Changes

**Breaking Changes (require new version):**
- Removing endpoints
- Removing required parameters
- Changing parameter types
- Changing response structure
- Changing authentication requirements
- Removing response fields

**Non-Breaking Changes (safe to add):**
- Adding new endpoints
- Adding optional parameters
- Adding new response fields
- Adding new error codes
- Improving performance

---

## Notes for Coding Agents

### CRITICAL RULES:

1. **ALWAYS read this contract before creating new endpoints**
2. **SEARCH for existing endpoints** that might serve the same purpose
3. **REUSE existing endpoints** by combining them if possible
4. **NEVER duplicate functionality** - extend existing endpoints instead
5. **UPDATE this contract immediately** after creating/modifying endpoints
6. **INCREMENT version number** for any API changes
7. **ADD changelog entry** with date, version, changes, and breaking status
8. **CROSS-REFERENCE SQL_CONTRACT.json** for queries used
9. **VERIFY DATABASE_SCHEMA_CONTRACT.md** for table structures
10. **DOCUMENT all parameters, responses, and errors** thoroughly

### Workflow:

```
1. Read API_CONTRACT.md
2. Search for existing endpoints by category and functionality
3. If exact match found, use it (document usage in your module)
4. If similar endpoint found, consider:
   - Adding optional parameters to existing endpoint
   - Combining multiple existing endpoints
   - Creating new endpoint only if truly different
5. If creating new endpoint:
   - Follow the template structure
   - Document all details (auth, params, responses, errors)
   - Add implementation details (controller, service, SQL)
   - Cross-reference SQL_CONTRACT.json and DATABASE_SCHEMA_CONTRACT.md
   - Add examples and test cases
6. Update changelog and version number
7. Commit with proper documentation
```

### Search Tips:

- Search by HTTP method (GET, POST, PUT, DELETE)
- Search by resource name (users, products, orders)
- Search by category (User Management, Authentication)
- Search by functionality (login, create, update, list)
- Check "Called By" and "Requires" to understand endpoint relationships

---

## Initial Population Instructions

**For DevOps Agent / Coding Agents:**

When populating this template for the first time:

1. **Scan codebase for route definitions:**
   - Express: `app.get()`, `router.post()`, etc.
   - FastAPI: `@app.get()`, `@router.post()`, etc.
   - Flask: `@app.route()`, `@blueprint.route()`, etc.
   - Django: `path()`, `url()` in urls.py

2. **Extract endpoint information:**
   - HTTP method and path
   - Controller/handler function
   - Request parameters and body schema
   - Response format
   - Authentication/authorization requirements

3. **Document implementation details:**
   - Which services/functions are called
   - Which SQL queries are used (reference SQL_CONTRACT.json)
   - Which database tables are accessed
   - Which 3rd party services are integrated

4. **Add metadata:**
   - Creation date
   - Rate limits
   - Performance characteristics
   - Security considerations

5. **Categorize endpoints:**
   - Group by resource type
   - Tag by functionality
   - Link related endpoints

**Search Patterns:**
- `app.get(`, `app.post(`, `app.put(`, `app.delete(`
- `router.get(`, `router.post(`, etc.
- `@app.route(`, `@router.route(`
- `@app.get(`, `@app.post(` (FastAPI)
- Route files: `**/routes/**`, `**/api/**`, `**/controllers/**`

---

*This contract is a living document. Update it with every API change.*
