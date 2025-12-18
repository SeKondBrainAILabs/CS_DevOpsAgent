const { describe, test, expect } = require('@jest/globals');

describe('check-compliance.js', () => {
  describe('Compliance Checking', () => {
    test('should detect features in code but missing from contract', () => {
      const codeFeatures = [
        { id: 'F-001', name: 'user-auth' },
        { id: 'F-002', name: 'payment-processing' },
        { id: 'F-003', name: 'notifications' }
      ];

      const contractFeatures = [
        { id: 'F-001', name: 'user-auth' },
        { id: 'F-002', name: 'payment-processing' }
      ];

      const result = checkFeatureCompliance(codeFeatures, contractFeatures);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(expect.objectContaining({
        name: 'notifications'
      }));
    });

    test('should detect features in contract but missing from code', () => {
      const codeFeatures = [
        { id: 'F-001', name: 'user-auth' }
      ];

      const contractFeatures = [
        { id: 'F-001', name: 'user-auth' },
        { id: 'F-002', name: 'payment-processing' }
      ];

      const result = checkFeatureCompliance(codeFeatures, contractFeatures);

      expect(result.extra).toHaveLength(1);
      expect(result.extra[0]).toEqual(expect.objectContaining({
        name: 'payment-processing'
      }));
    });

    test('should pass when features are in sync', () => {
      const codeFeatures = [
        { id: 'F-001', name: 'user-auth' },
        { id: 'F-002', name: 'payment-processing' }
      ];

      const contractFeatures = [
        { id: 'F-001', name: 'user-auth' },
        { id: 'F-002', name: 'payment-processing' }
      ];

      const result = checkFeatureCompliance(codeFeatures, contractFeatures);

      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
      expect(result.compliant).toBe(true);
    });
  });

  describe('API Endpoint Compliance', () => {
    test('should detect undocumented API endpoints', () => {
      const codeEndpoints = [
        { method: 'GET', path: '/api/v1/users' },
        { method: 'POST', path: '/api/v1/users' },
        { method: 'GET', path: '/api/v1/posts' }
      ];

      const contractEndpoints = [
        { method: 'GET', path: '/api/v1/users' },
        { method: 'POST', path: '/api/v1/users' }
      ];

      const result = checkAPICompliance(codeEndpoints, contractEndpoints);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(expect.objectContaining({
        method: 'GET',
        path: '/api/v1/posts'
      }));
    });

    test('should detect documented but non-existent endpoints', () => {
      const codeEndpoints = [
        { method: 'GET', path: '/api/v1/users' }
      ];

      const contractEndpoints = [
        { method: 'GET', path: '/api/v1/users' },
        { method: 'DELETE', path: '/api/v1/users/:id' }
      ];

      const result = checkAPICompliance(codeEndpoints, contractEndpoints);

      expect(result.extra).toHaveLength(1);
      expect(result.extra[0]).toEqual(expect.objectContaining({
        method: 'DELETE',
        path: '/api/v1/users/:id'
      }));
    });
  });

  describe('Database Schema Compliance', () => {
    test('should detect undocumented database tables', () => {
      const codeTables = [
        { name: 'users' },
        { name: 'posts' },
        { name: 'comments' }
      ];

      const contractTables = [
        { name: 'users' },
        { name: 'posts' }
      ];

      const result = checkDatabaseCompliance(codeTables, contractTables);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(expect.objectContaining({
        name: 'comments'
      }));
    });

    test('should detect deprecated tables still in contract', () => {
      const codeTables = [
        { name: 'users' }
      ];

      const contractTables = [
        { name: 'users' },
        { name: 'old_sessions' }
      ];

      const result = checkDatabaseCompliance(codeTables, contractTables);

      expect(result.extra).toHaveLength(1);
      expect(result.extra[0]).toEqual(expect.objectContaining({
        name: 'old_sessions'
      }));
    });
  });

  describe('SQL Query Compliance', () => {
    test('should detect undocumented SQL queries', () => {
      const codeQueries = {
        'get_user_by_id': { sql: 'SELECT * FROM users WHERE id = $1' },
        'get_user_by_email': { sql: 'SELECT * FROM users WHERE email = $1' },
        'update_user': { sql: 'UPDATE users SET name = $1 WHERE id = $2' }
      };

      const contractQueries = {
        'get_user_by_id': { sql: 'SELECT * FROM users WHERE id = $1' },
        'get_user_by_email': { sql: 'SELECT * FROM users WHERE email = $1' }
      };

      const result = checkSQLCompliance(codeQueries, contractQueries);

      expect(result.missing).toContain('update_user');
    });

    test('should detect documented but unused queries', () => {
      const codeQueries = {
        'get_user_by_id': { sql: 'SELECT * FROM users WHERE id = $1' }
      };

      const contractQueries = {
        'get_user_by_id': { sql: 'SELECT * FROM users WHERE id = $1' },
        'delete_user': { sql: 'DELETE FROM users WHERE id = $1' }
      };

      const result = checkSQLCompliance(codeQueries, contractQueries);

      expect(result.extra).toContain('delete_user');
    });
  });

  describe('Third-Party Integration Compliance', () => {
    test('should detect undocumented integrations', () => {
      const codeIntegrations = [
        { service: 'Stripe', package: 'stripe' },
        { service: 'SendGrid', package: '@sendgrid/mail' },
        { service: 'Twilio', package: 'twilio' }
      ];

      const contractIntegrations = [
        { service: 'Stripe', package: 'stripe' },
        { service: 'SendGrid', package: '@sendgrid/mail' }
      ];

      const result = checkIntegrationCompliance(codeIntegrations, contractIntegrations);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(expect.objectContaining({
        service: 'Twilio'
      }));
    });
  });

  describe('Environment Variable Compliance', () => {
    test('should detect undocumented environment variables', () => {
      const codeEnvVars = [
        { name: 'DATABASE_URL' },
        { name: 'REDIS_URL' },
        { name: 'STRIPE_API_KEY' }
      ];

      const contractEnvVars = [
        { name: 'DATABASE_URL' },
        { name: 'REDIS_URL' }
      ];

      const result = checkEnvVarCompliance(codeEnvVars, contractEnvVars);

      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toEqual(expect.objectContaining({
        name: 'STRIPE_API_KEY'
      }));
    });

    test('should detect documented but unused env variables', () => {
      const codeEnvVars = [
        { name: 'DATABASE_URL' }
      ];

      const contractEnvVars = [
        { name: 'DATABASE_URL' },
        { name: 'OLD_API_KEY' }
      ];

      const result = checkEnvVarCompliance(codeEnvVars, contractEnvVars);

      expect(result.extra).toHaveLength(1);
      expect(result.extra[0]).toEqual(expect.objectContaining({
        name: 'OLD_API_KEY'
      }));
    });
  });

  describe('Report Generation', () => {
    test('should generate text report', () => {
      const complianceResults = {
        features: { missing: [{ name: 'notifications' }], extra: [], compliant: false },
        api: { missing: [], extra: [], compliant: true },
        database: { missing: [{ name: 'logs' }], extra: [], compliant: false },
        sql: { missing: ['get_logs'], extra: [], compliant: false },
        integrations: { missing: [], extra: [], compliant: true },
        envVars: { missing: [{ name: 'LOG_LEVEL' }], extra: [], compliant: false }
      };

      const report = generateTextReport(complianceResults);

      expect(report).toContain('FEATURES');
      expect(report).toContain('notifications');
      expect(report).toContain('DATABASE');
      expect(report).toContain('logs');
      expect(report).toContain('SQL');
      expect(report).toContain('get_logs');
      expect(report).toContain('ENVIRONMENT VARIABLES');
      expect(report).toContain('LOG_LEVEL');
    });

    test('should generate JSON report', () => {
      const complianceResults = {
        features: { missing: [{ name: 'notifications' }], extra: [], compliant: false },
        api: { missing: [], extra: [], compliant: true },
        database: { missing: [], extra: [], compliant: true },
        sql: { missing: [], extra: [], compliant: true },
        integrations: { missing: [], extra: [], compliant: true },
        envVars: { missing: [], extra: [], compliant: true }
      };

      const report = generateJSONReport(complianceResults);
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('results');
      expect(parsed.results.features.compliant).toBe(false);
      expect(parsed.results.api.compliant).toBe(true);
    });

    test('should calculate overall compliance status', () => {
      const allCompliant = {
        features: { compliant: true },
        api: { compliant: true },
        database: { compliant: true },
        sql: { compliant: true },
        integrations: { compliant: true },
        envVars: { compliant: true }
      };

      expect(calculateOverallCompliance(allCompliant)).toBe(true);

      const someNonCompliant = {
        features: { compliant: true },
        api: { compliant: false },
        database: { compliant: true },
        sql: { compliant: true },
        integrations: { compliant: true },
        envVars: { compliant: true }
      };

      expect(calculateOverallCompliance(someNonCompliant)).toBe(false);
    });
  });

  describe('Strict Mode', () => {
    test('should exit with error code in strict mode when non-compliant', () => {
      const complianceResults = {
        features: { missing: [{ name: 'test' }], extra: [], compliant: false },
        api: { missing: [], extra: [], compliant: true },
        database: { missing: [], extra: [], compliant: true },
        sql: { missing: [], extra: [], compliant: true },
        integrations: { missing: [], extra: [], compliant: true },
        envVars: { missing: [], extra: [], compliant: true }
      };

      const exitCode = getExitCode(complianceResults, true);

      expect(exitCode).toBe(1);
    });

    test('should exit with success code in strict mode when compliant', () => {
      const complianceResults = {
        features: { missing: [], extra: [], compliant: true },
        api: { missing: [], extra: [], compliant: true },
        database: { missing: [], extra: [], compliant: true },
        sql: { missing: [], extra: [], compliant: true },
        integrations: { missing: [], extra: [], compliant: true },
        envVars: { missing: [], extra: [], compliant: true }
      };

      const exitCode = getExitCode(complianceResults, true);

      expect(exitCode).toBe(0);
    });

    test('should exit with success code in non-strict mode even when non-compliant', () => {
      const complianceResults = {
        features: { missing: [{ name: 'test' }], extra: [], compliant: false },
        api: { missing: [], extra: [], compliant: true },
        database: { missing: [], extra: [], compliant: true },
        sql: { missing: [], extra: [], compliant: true },
        integrations: { missing: [], extra: [], compliant: true },
        envVars: { missing: [], extra: [], compliant: true }
      };

      const exitCode = getExitCode(complianceResults, false);

      expect(exitCode).toBe(0);
    });
  });
});

// Mock functions
function checkFeatureCompliance(codeFeatures, contractFeatures) {
  const codeFeaturesSet = new Set(codeFeatures.map(f => f.name));
  const contractFeaturesSet = new Set(contractFeatures.map(f => f.name));

  const missing = codeFeatures.filter(f => !contractFeaturesSet.has(f.name));
  const extra = contractFeatures.filter(f => !codeFeaturesSet.has(f.name));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function checkAPICompliance(codeEndpoints, contractEndpoints) {
  const codeSet = new Set(codeEndpoints.map(e => `${e.method} ${e.path}`));
  const contractSet = new Set(contractEndpoints.map(e => `${e.method} ${e.path}`));

  const missing = codeEndpoints.filter(e => !contractSet.has(`${e.method} ${e.path}`));
  const extra = contractEndpoints.filter(e => !codeSet.has(`${e.method} ${e.path}`));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function checkDatabaseCompliance(codeTables, contractTables) {
  const codeSet = new Set(codeTables.map(t => t.name));
  const contractSet = new Set(contractTables.map(t => t.name));

  const missing = codeTables.filter(t => !contractSet.has(t.name));
  const extra = contractTables.filter(t => !codeSet.has(t.name));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function checkSQLCompliance(codeQueries, contractQueries) {
  const codeKeys = new Set(Object.keys(codeQueries));
  const contractKeys = new Set(Object.keys(contractQueries));

  const missing = [...codeKeys].filter(k => !contractKeys.has(k));
  const extra = [...contractKeys].filter(k => !codeKeys.has(k));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function checkIntegrationCompliance(codeIntegrations, contractIntegrations) {
  const codeSet = new Set(codeIntegrations.map(i => i.service));
  const contractSet = new Set(contractIntegrations.map(i => i.service));

  const missing = codeIntegrations.filter(i => !contractSet.has(i.service));
  const extra = contractIntegrations.filter(i => !codeSet.has(i.service));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function checkEnvVarCompliance(codeEnvVars, contractEnvVars) {
  const codeSet = new Set(codeEnvVars.map(v => v.name));
  const contractSet = new Set(contractEnvVars.map(v => v.name));

  const missing = codeEnvVars.filter(v => !contractSet.has(v.name));
  const extra = contractEnvVars.filter(v => !codeSet.has(v.name));

  return {
    missing,
    extra,
    compliant: missing.length === 0 && extra.length === 0
  };
}

function generateTextReport(results) {
  let report = 'CONTRACT COMPLIANCE REPORT\n\n';

  for (const [category, result] of Object.entries(results)) {
    report += `${category.toUpperCase()}:\n`;

    if (result.missing.length > 0) {
      report += `  Missing in contract (${result.missing.length}):\n`;
      for (const item of result.missing) {
        const name = item.name || item;
        report += `    - ${name}\n`;
      }
    }

    if (result.extra.length > 0) {
      report += `  Extra in contract (${result.extra.length}):\n`;
      for (const item of result.extra) {
        const name = item.name || item;
        report += `    - ${name}\n`;
      }
    }

    if (result.compliant) {
      report += `  ✅ Compliant\n`;
    }

    report += '\n';
  }

  return report;
}

function generateJSONReport(results) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    results
  }, null, 2);
}

function calculateOverallCompliance(results) {
  return Object.values(results).every(r => r.compliant);
}

function getExitCode(results, strictMode) {
  const compliant = calculateOverallCompliance(results);

  if (strictMode && !compliant) {
    return 1;
  }

  return 0;
}
