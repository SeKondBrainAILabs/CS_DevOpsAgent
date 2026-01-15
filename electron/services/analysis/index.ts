/**
 * Analysis Services Index
 * Exports all analysis services and provides initialization
 */

import { ASTParserService } from './ASTParserService';
import { RepositoryAnalysisService } from './RepositoryAnalysisService';
import { APIExtractorService } from './APIExtractorService';
import { SchemaExtractorService } from './SchemaExtractorService';
import { EventTrackerService } from './EventTrackerService';
import { DependencyGraphService } from './DependencyGraphService';
import { InfraParserService } from './InfraParserService';

// Service instances
let astParserService: ASTParserService | null = null;
let repositoryAnalysisService: RepositoryAnalysisService | null = null;
let apiExtractorService: APIExtractorService | null = null;
let schemaExtractorService: SchemaExtractorService | null = null;
let eventTrackerService: EventTrackerService | null = null;
let dependencyGraphService: DependencyGraphService | null = null;
let infraParserService: InfraParserService | null = null;

/**
 * Initialize all analysis services
 */
export async function initializeAnalysisServices(): Promise<{
  astParser: ASTParserService;
  repositoryAnalysis: RepositoryAnalysisService;
  apiExtractor: APIExtractorService;
  schemaExtractor: SchemaExtractorService;
  eventTracker: EventTrackerService;
  dependencyGraph: DependencyGraphService;
  infraParser: InfraParserService;
}> {
  // Create service instances
  astParserService = new ASTParserService();
  apiExtractorService = new APIExtractorService();
  schemaExtractorService = new SchemaExtractorService();
  eventTrackerService = new EventTrackerService();
  dependencyGraphService = new DependencyGraphService();
  infraParserService = new InfraParserService();

  // Repository Analysis Service depends on all extractors
  repositoryAnalysisService = new RepositoryAnalysisService(
    astParserService,
    apiExtractorService,
    schemaExtractorService,
    eventTrackerService,
    dependencyGraphService
  );

  // Initialize services that need initialization
  await astParserService.initialize();
  await repositoryAnalysisService.initialize();

  console.log('[AnalysisServices] All analysis services initialized (Phase 1 + Phase 2 + Phase 3)');

  return {
    astParser: astParserService,
    repositoryAnalysis: repositoryAnalysisService,
    apiExtractor: apiExtractorService,
    schemaExtractor: schemaExtractorService,
    eventTracker: eventTrackerService,
    dependencyGraph: dependencyGraphService,
    infraParser: infraParserService,
  };
}

/**
 * Get initialized service instances
 */
export function getAnalysisServices(): {
  astParser: ASTParserService | null;
  repositoryAnalysis: RepositoryAnalysisService | null;
  apiExtractor: APIExtractorService | null;
  schemaExtractor: SchemaExtractorService | null;
  eventTracker: EventTrackerService | null;
  dependencyGraph: DependencyGraphService | null;
  infraParser: InfraParserService | null;
} {
  return {
    astParser: astParserService,
    repositoryAnalysis: repositoryAnalysisService,
    apiExtractor: apiExtractorService,
    schemaExtractor: schemaExtractorService,
    eventTracker: eventTrackerService,
    dependencyGraph: dependencyGraphService,
    infraParser: infraParserService,
  };
}

/**
 * Dispose all analysis services
 */
export async function disposeAnalysisServices(): Promise<void> {
  if (repositoryAnalysisService) {
    await repositoryAnalysisService.dispose();
    repositoryAnalysisService = null;
  }
  if (astParserService) {
    await astParserService.dispose();
    astParserService = null;
  }
  // These services don't need special cleanup
  apiExtractorService = null;
  schemaExtractorService = null;
  eventTrackerService = null;
  dependencyGraphService = null;
  infraParserService = null;

  console.log('[AnalysisServices] All analysis services disposed');
}

// Export service classes
export { ASTParserService } from './ASTParserService';
export { RepositoryAnalysisService } from './RepositoryAnalysisService';
export { APIExtractorService } from './APIExtractorService';
export { SchemaExtractorService } from './SchemaExtractorService';
export { EventTrackerService } from './EventTrackerService';
export { DependencyGraphService } from './DependencyGraphService';
export { InfraParserService } from './InfraParserService';
