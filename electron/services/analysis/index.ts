/**
 * Analysis Services Index
 * Exports all analysis services and provides initialization
 */

import { ASTParserService } from './ASTParserService';
import { RepositoryAnalysisService } from './RepositoryAnalysisService';
import { APIExtractorService } from './APIExtractorService';

// Service instances
let astParserService: ASTParserService | null = null;
let repositoryAnalysisService: RepositoryAnalysisService | null = null;
let apiExtractorService: APIExtractorService | null = null;

/**
 * Initialize all analysis services
 */
export async function initializeAnalysisServices(): Promise<{
  astParser: ASTParserService;
  repositoryAnalysis: RepositoryAnalysisService;
  apiExtractor: APIExtractorService;
}> {
  // Create service instances
  astParserService = new ASTParserService();
  repositoryAnalysisService = new RepositoryAnalysisService(astParserService);
  apiExtractorService = new APIExtractorService();

  // Initialize services
  await astParserService.initialize();
  await repositoryAnalysisService.initialize();

  console.log('[AnalysisServices] All analysis services initialized');

  return {
    astParser: astParserService,
    repositoryAnalysis: repositoryAnalysisService,
    apiExtractor: apiExtractorService,
  };
}

/**
 * Get initialized service instances
 */
export function getAnalysisServices(): {
  astParser: ASTParserService | null;
  repositoryAnalysis: RepositoryAnalysisService | null;
  apiExtractor: APIExtractorService | null;
} {
  return {
    astParser: astParserService,
    repositoryAnalysis: repositoryAnalysisService,
    apiExtractor: apiExtractorService,
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
  if (apiExtractorService) {
    apiExtractorService = null;
  }

  console.log('[AnalysisServices] All analysis services disposed');
}

// Export service classes
export { ASTParserService } from './ASTParserService';
export { RepositoryAnalysisService } from './RepositoryAnalysisService';
export { APIExtractorService } from './APIExtractorService';
