# Third Party Integrations Contract

**Last Updated:** 2024-12-02  
**Version:** 1.0.0  
**Status:** Initial Template

---

## Purpose

This contract documents **all third-party service integrations** in the project. Coding agents **MUST check this file before integrating external services** to:
- Reuse existing integrations and binding modules
- Avoid duplicate API clients
- Maintain consistent error handling
- Centralize API key management
- Prevent vendor lock-in through abstraction layers

---

## Change Log

| Date | Version | Agent/Author | Changes | Impact |
|------|---------|--------------|---------|--------|
| 2024-12-02 | 1.0.0 | DevOps Agent | Initial template creation | N/A - Template only |

---

## Integration Overview

| Service | Purpose | Status | Binding Module | Monthly Cost | Critical |
|---------|---------|--------|----------------|--------------|----------|
| [Service Name] | [What it does] | Active/Deprecated | [Module path] | $X | YES/NO |

---

## Integrations

### Integration Template

#### [Service Name]

**Added:** [YYYY-MM-DD]  
**Last Modified:** [YYYY-MM-DD]  
**Status:** `active` | `deprecated` | `testing`  
**Deprecation Date:** [YYYY-MM-DD] *(if applicable)*

**Purpose:**  
[Why we use this service and what problem it solves]

**Provider Information:**
- **Website:** [https://service.com](https://service.com)
- **Documentation:** [https://docs.service.com](https://docs.service.com)
- **Support:** [support email/link]
- **Status Page:** [https://status.service.com](https://status.service.com)

**Plan & Pricing:**
- **Plan:** [Free/Starter/Pro/Enterprise]
- **Monthly Cost:** $[amount]
- **Rate Limits:** [e.g., 1000 requests/hour]
- **Quotas:** [e.g., 10GB storage, 1M API calls]
- **Overage Charges:** $[amount] per [unit]

**Authentication:**
- **Method:** API Key / OAuth 2.0 / Basic Auth / JWT
- **Key Location:** Environment variable `[VAR_NAME]`
- **Key Rotation:** [Frequency and process]
- **Scopes/Permissions:** [Required permissions]

**Binding Module:**
- **Location:** `src/integrations/[service-name]/`
- **Main File:** `src/integrations/[service-name]/client.js`
- **Configuration:** `src/integrations/[service-name]/config.js`
- **Types/Interfaces:** `src/integrations/[service-name]/types.js`

**Module Structure:**
```
src/integrations/[service-name]/
├── client.js          # Main client class
├── config.js          # Configuration and env vars
├── types.js           # Type definitions
├── errors.js          # Custom error classes
├── utils.js           # Helper functions
└── README.md          # Integration-specific docs
```

**API Client Class:**

```javascript
/**
 * [Service Name] API Client
 * 
 * Provides abstraction layer for [Service] API.
 * All modules MUST use this client instead of direct API calls.
 */
class ServiceNameClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://api.service.com/v1';
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
  }

  /**
   * Example method
   */
  async methodName(params) {
    // Implementation with error handling, retries, logging
  }
}

module.exports = ServiceNameClient;
```

**Environment Variables:**

| Variable | Required | Default | Description | Example |
|----------|----------|---------|-------------|---------|
| `SERVICE_API_KEY` | YES | - | API authentication key | `sk_live_...` |
| `SERVICE_BASE_URL` | NO | `https://api...` | API base URL | `https://api.service.com` |
| `SERVICE_TIMEOUT` | NO | `30000` | Request timeout (ms) | `60000` |
| `SERVICE_RETRY_ATTEMPTS` | NO | `3` | Max retry attempts | `5` |

**Used By Modules:**

| Module | File | Function | Usage |
|--------|------|----------|-------|
| [module-name] | `src/path/to/file.js` | `functionName()` | [How it uses the service] |

**API Endpoints Used:**

| Endpoint | Method | Purpose | Rate Limit | Cost |
|----------|--------|---------|------------|------|
| `/endpoint` | POST | [What it does] | 100/min | $0.01/call |

**Data Flow:**

```
[Your Module] 
    ↓
[Binding Module: ServiceNameClient]
    ↓
[Service API]
    ↓
[Response Processing]
    ↓
[Return to Your Module]
```

**Error Handling:**

| Error Type | HTTP Code | Handling Strategy | Retry |
|------------|-----------|-------------------|-------|
| Rate Limit | 429 | Exponential backoff | YES |
| Auth Error | 401 | Log and alert | NO |
| Server Error | 500 | Retry with backoff | YES |
| Validation | 400 | Return to caller | NO |

**Custom Error Classes:**

```javascript
class ServiceNameError extends Error {
  constructor(message, code, originalError) {
    super(message);
    this.name = 'ServiceNameError';
    this.code = code;
    this.originalError = originalError;
  }
}

class ServiceNameRateLimitError extends ServiceNameError { ... }
class ServiceNameAuthError extends ServiceNameError { ... }
```

**Retry Logic:**

```javascript
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }
      await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }
}
```

**Logging:**

- **Success:** Log at `debug` level with request/response summary
- **Errors:** Log at `error` level with full context
- **Rate Limits:** Log at `warn` level with retry info
- **Sensitive Data:** Never log API keys, tokens, or PII

**Testing:**

- **Unit Tests:** `test_cases/integrations/[service-name].test.js`
- **Integration Tests:** `test_cases/integration/[service-name].integration.test.js`
- **Mocks:** `test_cases/mocks/[service-name].mock.js`
- **Coverage:** [X]%

**Mocking for Tests:**

```javascript
// Mock client for testing
class MockServiceNameClient {
  async methodName(params) {
    // Return mock data
    return { success: true, data: mockData };
  }
}
```

**Monitoring:**

- **Metrics Tracked:**
  - Request count
  - Error rate
  - Response time (p50, p95, p99)
  - Rate limit hits
  - Cost per day/month

- **Alerts:**
  - Error rate > 5%
  - Response time > 5s
  - Rate limit exceeded
  - Daily cost > $X

**Fallback Strategy:**

- **Primary:** [Service Name]
- **Fallback:** [Alternative service or manual process]
- **Degraded Mode:** [What happens if service is down]

**Migration Notes:**

If replacing this service:
1. [Steps to migrate to alternative]
2. [Data export process]
3. [Code changes required]
4. [Testing checklist]

**Security Considerations:**

- API keys stored in environment variables (never in code)
- Keys rotated every [frequency]
- Minimum required permissions/scopes
- Data encryption in transit (TLS 1.2+)
- Data encryption at rest (if applicable)
- Compliance: [GDPR, SOC2, HIPAA, etc.]

**Performance Notes:**

- Average response time: [X]ms
- Timeout configured: [X]ms
- Connection pooling: [YES/NO]
- Caching strategy: [Description]
- Batch operations: [Supported/Not supported]

**Dependencies:**

**NPM Packages:**
- `[package-name]@[version]` - [Purpose]

**Internal Dependencies:**
- `src/utils/http-client.js` - HTTP wrapper
- `src/utils/logger.js` - Logging
- `src/config/env.js` - Environment config

**Changelog:**

| Date | Version | Changes | Breaking |
|------|---------|---------|----------|
| 2024-01-15 | 1.0.0 | Initial integration | N/A |

---

## Example Integrations

### SendGrid (Email Service)

**Added:** 2024-01-15  
**Last Modified:** 2024-01-15  
**Status:** `active`

**Purpose:**  
Transactional email delivery for user notifications, password resets, and system alerts.

**Provider Information:**
- **Website:** [https://sendgrid.com](https://sendgrid.com)
- **Documentation:** [https://docs.sendgrid.com](https://docs.sendgrid.com)
- **Support:** support@sendgrid.com
- **Status Page:** [https://status.sendgrid.com](https://status.sendgrid.com)

**Plan & Pricing:**
- **Plan:** Pro
- **Monthly Cost:** $89.95
- **Rate Limits:** 100,000 emails/month
- **Quotas:** 1M API calls/month
- **Overage Charges:** $0.00085 per email

**Authentication:**
- **Method:** API Key
- **Key Location:** `SENDGRID_API_KEY`
- **Key Rotation:** Quarterly
- **Scopes:** `mail.send`, `mail.batch.send`

**Binding Module:**
- **Location:** `src/integrations/sendgrid/`
- **Main File:** `src/integrations/sendgrid/client.js`

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENDGRID_API_KEY` | YES | - | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | YES | - | Default sender email |
| `SENDGRID_FROM_NAME` | NO | `App Name` | Default sender name |

**Used By Modules:**

| Module | File | Function | Usage |
|--------|------|----------|-------|
| auth-service | `src/auth/register.js` | `sendVerificationEmail()` | User email verification |
| auth-service | `src/auth/password-reset.js` | `sendPasswordResetEmail()` | Password reset emails |
| notification-service | `src/notifications/email.js` | `sendNotification()` | User notifications |

**API Endpoints Used:**

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/v3/mail/send` | POST | Send single email | 600/min |
| `/v3/mail/batch` | POST | Send batch emails | 100/min |

**Error Handling:**

| Error Type | HTTP Code | Handling Strategy | Retry |
|------------|-----------|-------------------|-------|
| Rate Limit | 429 | Wait and retry | YES |
| Auth Error | 401 | Alert admin | NO |
| Invalid Email | 400 | Log and skip | NO |
| Server Error | 500 | Retry 3x | YES |

**Monitoring:**
- Daily email count
- Delivery rate (target: >99%)
- Bounce rate (alert if >2%)
- Spam complaints (alert if >0.1%)

---

### Stripe (Payment Processing)

**Added:** 2024-01-20  
**Last Modified:** 2024-01-20  
**Status:** `active`

**Purpose:**  
Payment processing, subscription management, and invoice generation.

**Provider Information:**
- **Website:** [https://stripe.com](https://stripe.com)
- **Documentation:** [https://stripe.com/docs](https://stripe.com/docs)
- **Support:** Stripe Dashboard
- **Status Page:** [https://status.stripe.com](https://status.stripe.com)

**Plan & Pricing:**
- **Plan:** Standard
- **Monthly Cost:** $0 base + transaction fees
- **Transaction Fee:** 2.9% + $0.30 per charge
- **Rate Limits:** 100 requests/second

**Authentication:**
- **Method:** API Key (Secret Key)
- **Key Location:** `STRIPE_SECRET_KEY`
- **Publishable Key:** `STRIPE_PUBLISHABLE_KEY` (for frontend)
- **Webhook Secret:** `STRIPE_WEBHOOK_SECRET`

**Binding Module:**
- **Location:** `src/integrations/stripe/`
- **Main File:** `src/integrations/stripe/client.js`

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | YES | - | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | YES | - | Stripe publishable key (frontend) |
| `STRIPE_WEBHOOK_SECRET` | YES | - | Webhook signature verification |

**Used By Modules:**

| Module | File | Function | Usage |
|--------|------|----------|-------|
| payment-service | `src/payments/checkout.js` | `createPaymentIntent()` | Process payments |
| subscription-service | `src/subscriptions/manage.js` | `createSubscription()` | Manage subscriptions |
| webhook-handler | `src/webhooks/stripe.js` | `handleWebhook()` | Process Stripe events |

**Webhook Events Handled:**

| Event | Handler | Purpose |
|-------|---------|---------|
| `payment_intent.succeeded` | `handlePaymentSuccess()` | Confirm payment |
| `payment_intent.failed` | `handlePaymentFailure()` | Handle failed payment |
| `customer.subscription.created` | `handleSubscriptionCreated()` | New subscription |
| `customer.subscription.deleted` | `handleSubscriptionCancelled()` | Cancelled subscription |

**Security:**
- PCI DSS compliance via Stripe
- No credit card data stored locally
- Webhook signature verification required
- API keys never exposed to frontend

---

### AWS S3 (File Storage)

**Added:** 2024-01-10  
**Last Modified:** 2024-01-10  
**Status:** `active`

**Purpose:**  
Object storage for user uploads, backups, and static assets.

**Provider Information:**
- **Website:** [https://aws.amazon.com/s3](https://aws.amazon.com/s3)
- **Documentation:** [https://docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)
- **Support:** AWS Support Console

**Plan & Pricing:**
- **Storage:** $0.023 per GB/month
- **Requests:** $0.0004 per 1000 GET requests
- **Data Transfer:** $0.09 per GB (out)
- **Estimated Monthly:** $50

**Authentication:**
- **Method:** IAM Access Keys
- **Access Key ID:** `AWS_ACCESS_KEY_ID`
- **Secret Access Key:** `AWS_SECRET_ACCESS_KEY`
- **Region:** `AWS_REGION`

**Binding Module:**
- **Location:** `src/integrations/aws-s3/`
- **Main File:** `src/integrations/aws-s3/client.js`

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | YES | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | YES | - | AWS secret key |
| `AWS_REGION` | YES | - | AWS region (e.g., us-east-1) |
| `AWS_S3_BUCKET` | YES | - | S3 bucket name |

**Used By Modules:**

| Module | File | Function | Usage |
|--------|------|----------|-------|
| upload-service | `src/uploads/handler.js` | `uploadFile()` | User file uploads |
| backup-service | `src/backups/database.js` | `backupDatabase()` | Database backups |
| asset-service | `src/assets/manager.js` | `storeAsset()` | Static asset storage |

**Bucket Configuration:**
- **Bucket Name:** `[your-app]-[environment]`
- **Versioning:** Enabled
- **Encryption:** AES-256
- **Public Access:** Blocked (use signed URLs)
- **Lifecycle Policy:** Delete after 90 days (for temp files)

**Security:**
- IAM role with minimum required permissions
- Bucket policy restricts access
- Signed URLs for temporary access (expire in 1 hour)
- Server-side encryption enabled

---

## Integration Categories

### Communication
- **SendGrid** - Email delivery
- **Twilio** - SMS notifications
- **Slack** - Team notifications

### Payments
- **Stripe** - Payment processing
- **PayPal** - Alternative payment method

### Storage
- **AWS S3** - Object storage
- **Cloudinary** - Image/video hosting

### Analytics
- **Google Analytics** - Web analytics
- **Mixpanel** - Product analytics
- **Sentry** - Error tracking

### Authentication
- **Auth0** - Identity management
- **Google OAuth** - Social login
- **GitHub OAuth** - Developer login

### Infrastructure
- **AWS** - Cloud infrastructure
- **Vercel** - Frontend hosting
- **MongoDB Atlas** - Database hosting

---

## Notes for Coding Agents

### CRITICAL RULES:

1. **ALWAYS check this contract before integrating external services**
2. **REUSE existing binding modules** - never create duplicate clients
3. **NEVER hardcode API keys** - always use environment variables
4. **USE the binding module** - never call third-party APIs directly
5. **UPDATE this contract** when adding new integrations
6. **DOCUMENT all environment variables** in INFRA_CONTRACT.md
7. **ADD proper error handling** using the binding module's error classes
8. **IMPLEMENT retry logic** for transient failures
9. **ADD monitoring and alerts** for critical integrations
10. **WRITE tests with mocks** - don't call real APIs in tests

### Workflow:

```
1. Read THIRD_PARTY_INTEGRATIONS.md
2. Search for existing integration for the service you need
3. If integration exists:
   - Import the binding module
   - Use the provided client class
   - Add your module to "Used By Modules" section
   - Follow the documented error handling
4. If integration doesn't exist:
   - Check if similar service already integrated (avoid duplication)
   - Create new binding module following the template structure
   - Implement client class with error handling and retries
   - Add environment variables to INFRA_CONTRACT.md
   - Document everything in this contract
   - Create tests with mocks
5. Update changelog and version number
6. Never call third-party APIs directly - always use binding module
```

### Benefits of Binding Modules:

- **Abstraction:** Easy to swap providers without changing application code
- **Consistency:** Standardized error handling and logging
- **Testing:** Mockable interfaces for unit tests
- **Monitoring:** Centralized metrics and alerts
- **Security:** Single place to manage API keys and rotation
- **Maintenance:** Update integration logic in one place

---

## Initial Population Instructions

**For DevOps Agent / Coding Agents:**

When populating this template for the first time:

1. **Scan codebase for third-party API calls:**
   - Search for API client imports
   - Look for HTTP requests to external domains
   - Check package.json for SDK dependencies
   - Review environment variables for API keys

2. **Identify all integrations:**
   - Payment processors (Stripe, PayPal)
   - Email services (SendGrid, Mailgun)
   - Cloud storage (AWS S3, Google Cloud Storage)
   - Authentication (Auth0, OAuth providers)
   - Analytics (Google Analytics, Mixpanel)
   - Monitoring (Sentry, DataDog)

3. **Document each integration:**
   - Purpose and use cases
   - Binding module location
   - Environment variables
   - Modules that use it
   - Error handling strategy
   - Cost and rate limits

4. **Create binding modules if missing:**
   - Wrap direct API calls in abstraction layer
   - Implement error handling and retries
   - Add logging and monitoring
   - Create mock clients for testing

**Search Patterns:**
- `require('stripe')`, `import stripe from`
- `require('@sendgrid/mail')`
- `require('aws-sdk')`, `require('@aws-sdk')`
- `axios.post('https://api.external.com')`
- Environment variables: `process.env.API_KEY`
- Config files: `config/*.js`, `.env.example`

---

*This contract is a living document. Update it with every new integration.*
