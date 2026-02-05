/**
 * Feature Discovery Utilities
 * Pure functions for computing feature statistics shown in the discovered features table
 */

import type { DiscoveredFeature } from './types';

export interface FeatureFileStats {
  api: number;
  schema: number;
  config: number;
  unitTests: number;
  integrationTests: number;
  e2eTests: number;
  fixtures: number;
  css: number;
  prompts: number;
  other: number;
  total: number;
}

/**
 * Compute file statistics for a discovered feature.
 * Used by the feature discovery table to show counts per category.
 */
export function computeFeatureFileStats(feature: DiscoveredFeature): FeatureFileStats {
  const api = feature.files.api.length;
  const schema = feature.files.schema.length;
  const config = feature.files.config.length;
  const unitTests = feature.files.tests.unit.length;
  const integrationTests = feature.files.tests.integration.length;
  const e2eTests = feature.files.tests.e2e.length;
  const fixtures = feature.files.fixtures.length;
  const css = feature.files.css?.length || 0;
  const prompts = feature.files.prompts?.length || 0;
  const other = feature.files.other.length;
  const total = api + schema + config + unitTests + integrationTests + e2eTests + fixtures + css + prompts + other;

  return { api, schema, config, unitTests, integrationTests, e2eTests, fixtures, css, prompts, other, total };
}

/**
 * Get a short relative path for display (last 2 segments of the basePath).
 */
export function getFeatureRelativePath(basePath: string): string {
  return basePath.split('/').slice(-2).join('/');
}

/**
 * Get tooltip text listing filenames for a file array.
 * Extracts just the filename (last path segment) from each path.
 */
export function getFileTooltip(filePaths: string[]): string {
  return filePaths.map(p => p.split('/').pop() || p).join(', ');
}

/**
 * Check if a feature has any contract-relevant files.
 * A feature with zero total files is essentially empty/placeholder.
 */
export function featureHasFiles(feature: DiscoveredFeature): boolean {
  const stats = computeFeatureFileStats(feature);
  return stats.total > 0;
}

/**
 * Compute aggregate stats across all discovered features.
 */
export function computeAggregateStats(features: DiscoveredFeature[]): {
  totalFeatures: number;
  featuresWithApi: number;
  featuresWithTests: number;
  totalFiles: number;
} {
  let featuresWithApi = 0;
  let featuresWithTests = 0;
  let totalFiles = 0;

  for (const f of features) {
    const stats = computeFeatureFileStats(f);
    totalFiles += stats.total;
    if (stats.api > 0) featuresWithApi++;
    if (stats.unitTests > 0 || stats.integrationTests > 0 || stats.e2eTests > 0) featuresWithTests++;
  }

  return {
    totalFeatures: features.length,
    featuresWithApi,
    featuresWithTests,
    totalFiles,
  };
}
