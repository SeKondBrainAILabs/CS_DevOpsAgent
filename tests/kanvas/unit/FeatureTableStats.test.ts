import { describe, it, expect } from '@jest/globals';
import {
  computeFeatureFileStats,
  getFeatureRelativePath,
  getFileTooltip,
  featureHasFiles,
  computeAggregateStats,
} from '../../../shared/feature-utils';
import type { DiscoveredFeature } from '../../../shared/types';

// Helper to create a DiscoveredFeature with the given file counts
function makeFeature(
  name: string,
  overrides: Partial<{
    basePath: string;
    api: string[];
    schema: string[];
    config: string[];
    unitTests: string[];
    integrationTests: string[];
    e2eTests: string[];
    fixtures: string[];
    css: string[];
    prompts: string[];
    other: string[];
  }> = {}
): DiscoveredFeature {
  return {
    name,
    basePath: overrides.basePath || `/repo/src/features/${name}`,
    files: {
      api: overrides.api || [],
      schema: overrides.schema || [],
      config: overrides.config || [],
      tests: {
        unit: overrides.unitTests || [],
        integration: overrides.integrationTests || [],
        e2e: overrides.e2eTests || [],
      },
      fixtures: overrides.fixtures || [],
      css: overrides.css || [],
      prompts: overrides.prompts || [],
      other: overrides.other || [],
    },
    contractPatternMatches: 0,
  };
}

describe('computeFeatureFileStats', () => {
  it('should return zero counts for a feature with no files', () => {
    const feature = makeFeature('empty-feature');
    const stats = computeFeatureFileStats(feature);

    expect(stats.api).toBe(0);
    expect(stats.schema).toBe(0);
    expect(stats.config).toBe(0);
    expect(stats.unitTests).toBe(0);
    expect(stats.integrationTests).toBe(0);
    expect(stats.e2eTests).toBe(0);
    expect(stats.fixtures).toBe(0);
    expect(stats.css).toBe(0);
    expect(stats.prompts).toBe(0);
    expect(stats.other).toBe(0);
    expect(stats.total).toBe(0);
  });

  it('should count files in each category accurately', () => {
    const feature = makeFeature('auth', {
      api: ['routes/auth.ts', 'routes/login.ts', 'controllers/authController.ts'],
      schema: ['types/auth.ts'],
      config: ['.env.example'],
      unitTests: ['tests/auth.test.ts', 'tests/login.test.ts'],
      integrationTests: ['tests/integration/auth.integration.test.ts'],
      e2eTests: [],
      fixtures: ['tests/fixtures/auth-data.json'],
      other: ['utils/hash.ts'],
    });
    const stats = computeFeatureFileStats(feature);

    expect(stats.api).toBe(3);
    expect(stats.schema).toBe(1);
    expect(stats.config).toBe(1);
    expect(stats.unitTests).toBe(2);
    expect(stats.integrationTests).toBe(1);
    expect(stats.e2eTests).toBe(0);
    expect(stats.fixtures).toBe(1);
    expect(stats.other).toBe(1);
    expect(stats.total).toBe(10);
  });

  it('should compute total as sum of all categories', () => {
    const feature = makeFeature('payments', {
      api: ['a.ts', 'b.ts'],
      schema: ['c.ts'],
      config: [],
      unitTests: ['d.test.ts'],
      integrationTests: [],
      e2eTests: ['e.e2e.ts', 'f.e2e.ts'],
      fixtures: [],
      other: ['g.ts', 'h.ts', 'i.ts'],
    });
    const stats = computeFeatureFileStats(feature);

    // 2 + 1 + 0 + 1 + 0 + 2 + 0 + 0 + 0 + 3 = 9
    expect(stats.total).toBe(9);
    expect(stats.total).toBe(
      stats.api + stats.schema + stats.config +
      stats.unitTests + stats.integrationTests + stats.e2eTests +
      stats.fixtures + stats.css + stats.prompts + stats.other
    );
  });
});

describe('getFeatureRelativePath', () => {
  it('should return last 2 path segments', () => {
    expect(getFeatureRelativePath('/repo/src/features/auth')).toBe('features/auth');
    expect(getFeatureRelativePath('/a/b/c/d/e')).toBe('d/e');
  });

  it('should handle short paths', () => {
    // '/root' splits to ['', 'root'], slice(-2) gives '/root'
    expect(getFeatureRelativePath('/root')).toBe('/root');
    expect(getFeatureRelativePath('single')).toBe('single');
  });

  it('should handle paths with trailing slashes', () => {
    // split('/') on trailing slash gives empty last element
    expect(getFeatureRelativePath('/repo/src/')).toBe('src/');
  });
});

describe('getFileTooltip', () => {
  it('should extract filenames from full paths', () => {
    const result = getFileTooltip([
      'backend/src/routes/auth.ts',
      'backend/src/routes/users.ts',
    ]);
    expect(result).toBe('auth.ts, users.ts');
  });

  it('should return empty string for empty array', () => {
    expect(getFileTooltip([])).toBe('');
  });

  it('should handle bare filenames', () => {
    expect(getFileTooltip(['auth.ts', 'users.ts'])).toBe('auth.ts, users.ts');
  });
});

describe('featureHasFiles', () => {
  it('should return false for feature with no files', () => {
    const feature = makeFeature('empty');
    expect(featureHasFiles(feature)).toBe(false);
  });

  it('should return true if feature has any files', () => {
    const feature = makeFeature('has-api', { api: ['route.ts'] });
    expect(featureHasFiles(feature)).toBe(true);
  });

  it('should return true if feature has only test files', () => {
    const feature = makeFeature('tests-only', { unitTests: ['test.ts'] });
    expect(featureHasFiles(feature)).toBe(true);
  });

  it('should return true if feature has only other files', () => {
    const feature = makeFeature('other-only', { other: ['util.ts'] });
    expect(featureHasFiles(feature)).toBe(true);
  });
});

describe('computeAggregateStats', () => {
  it('should return zeros for empty feature list', () => {
    const stats = computeAggregateStats([]);
    expect(stats.totalFeatures).toBe(0);
    expect(stats.featuresWithApi).toBe(0);
    expect(stats.featuresWithTests).toBe(0);
    expect(stats.totalFiles).toBe(0);
  });

  it('should correctly aggregate across multiple features', () => {
    const features = [
      makeFeature('auth', {
        api: ['auth.ts', 'login.ts'],
        unitTests: ['auth.test.ts'],
        other: ['hash.ts'],
      }),
      makeFeature('payments', {
        api: ['pay.ts'],
        schema: ['pay-types.ts'],
        e2eTests: ['pay.e2e.ts'],
      }),
      makeFeature('config', {
        config: ['app.config.ts'],
        // No api, no tests
      }),
    ];

    const stats = computeAggregateStats(features);

    expect(stats.totalFeatures).toBe(3);
    expect(stats.featuresWithApi).toBe(2); // auth, payments
    expect(stats.featuresWithTests).toBe(2); // auth (unit), payments (e2e)
    expect(stats.totalFiles).toBe(8); // 2+1+1 + 1+1+1 + 1
  });

  it('should count features with any test type', () => {
    const features = [
      makeFeature('a', { unitTests: ['t.ts'] }),
      makeFeature('b', { integrationTests: ['t.ts'] }),
      makeFeature('c', { e2eTests: ['t.ts'] }),
      makeFeature('d', { other: ['no-tests.ts'] }),
    ];

    const stats = computeAggregateStats(features);
    expect(stats.featuresWithTests).toBe(3); // a, b, c - not d
  });
});
