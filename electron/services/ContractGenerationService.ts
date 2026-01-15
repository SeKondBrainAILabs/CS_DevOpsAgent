/**
 * Contract Generation Service
 * Scans codebases feature-by-feature and generates contract documentation using AI
 * Outputs both Markdown and JSON formats to feature folders and central registry
 */

import { BaseService } from './BaseService';
import type {
  IpcResult,
  DiscoveredFeature,
  ContractGenerationOptions,
  ContractGenerationProgress,
  GeneratedContractResult,
  BatchContractGenerationResult,
  GeneratedContractJSON,
} from '../../shared/types';
import { IPC } from '../../shared/ipc-channels';
import { promises as fs } from 'fs';
import path from 'path';
import { sync as globSync } from 'glob';
import type { AIService } from './AIService';
import type { ContractRegistryService } from './ContractRegistryService';
import { KANVAS_PATHS } from '../../shared/agent-protocol';
// Phase 3: Analysis services for enhanced contract generation
import type { ASTParserService } from './analysis/ASTParserService';
import type { APIExtractorService } from './analysis/APIExtractorService';
import type { SchemaExtractorService } from './analysis/SchemaExtractorService';
import type { DependencyGraphService } from './analysis/DependencyGraphService';
import type { ParsedAST, ExtractedEndpoint, ExtractedSchema, DependencyGraph } from '../../shared/analysis-types';

// Contract file patterns - reused from ContractDetectionService
const CONTRACT_PATTERNS = {
  // API files
  api: [
    '**/openapi.yaml', '**/openapi.json', '**/swagger.yaml', '**/swagger.json',
    '**/*.graphql', '**/schema.graphql', '**/schema.gql',
    '**/*.proto',
    '**/routes/**/*.ts', '**/api/**/*.ts', '**/controllers/**/*.ts',
    '**/endpoints/**/*.ts', '**/handlers/**/*.ts',
  ],
  // Schema/Type files
  schema: [
    '**/types/*.ts', '**/interfaces/*.ts', '**/*.d.ts',
    '**/shared/types.ts', '**/shared/types/*.ts',
    '**/migrations/*.sql', '**/schema.prisma', '**/schema.sql',
    '**/*.schema.json', '**/schemas/*.json',
    '**/models/**/*.ts', '**/entities/**/*.ts',
  ],
  // E2E Tests
  e2e: [
    '**/*.e2e.spec.ts', '**/*.e2e.ts',
    '**/e2e/**/*.spec.ts', '**/playwright/**/*.spec.ts',
    '**/tests/e2e/**/*.ts',
  ],
  // Unit Tests
  unit: [
    '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts',
    '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx',
  ],
  // Integration Tests
  integration: [
    '**/*.integration.ts', '**/*.integration.spec.ts',
    '**/tests/integration/**/*.ts',
  ],
  // Fixtures
  fixtures: [
    '**/fixtures/**/*.json', '**/fixtures/**/*.ts',
    '**/mocks/**/*.ts', '**/__mocks__/**/*.ts',
    '**/test-data/**/*.json',
  ],
  // Config
  config: [
    '**/.env.example', '**/config.schema.json', '**/app.config.ts',
    '**/config/*.ts', '**/config/*.json',
  ],
};

// Generic source file patterns to identify code areas (for feature discovery)
const SOURCE_PATTERNS = [
  '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
  '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
  '**/*.vue', '**/*.svelte',
];

// Feature folder patterns to scan (ordered by specificity)
const FEATURE_FOLDER_PATTERNS = [
  // Standard patterns
  'src/features/*',
  'src/modules/*',
  'packages/*',
  'apps/*',
  'lib/*',
  'services/*',
  // Common top-level structures
  'backend',
  'frontend',
  'server',
  'client',
  'api',
  'web',
  'mobile',
  'extension',
  'firebase',
  'functions',
  'lambdas',
  'workers',
  'ai-worker',
  'devops',
  // Any top-level folder with code (fallback)
  '*',
];

// Folders to ignore when scanning top-level
const IGNORE_FOLDERS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', 'tmp', 'temp', '.vscode', '.idea',
  'backups', 'docs', 'Documentation', '.S9N_KIT_DevOpsAgent',
  'local_deploy', 'playwright-report', 'test-results',
]);

export class ContractGenerationService extends BaseService {
  private aiService: AIService;
  private registryService: ContractRegistryService;
  private isCancelled = false;
  private currentProgress: ContractGenerationProgress | null = null;

  // Phase 3: Analysis services for enhanced contract generation
  private astParser?: ASTParserService;
  private apiExtractor?: APIExtractorService;
  private schemaExtractor?: SchemaExtractorService;
  private dependencyGraph?: DependencyGraphService;

  constructor(aiService: AIService, registryService: ContractRegistryService) {
    super();
    this.aiService = aiService;
    this.registryService = registryService;
  }

  /**
   * Set analysis services for enhanced contract generation (Phase 3)
   */
  setAnalysisServices(
    astParser: ASTParserService,
    apiExtractor: APIExtractorService,
    schemaExtractor: SchemaExtractorService,
    dependencyGraph: DependencyGraphService
  ): void {
    this.astParser = astParser;
    this.apiExtractor = apiExtractor;
    this.schemaExtractor = schemaExtractor;
    this.dependencyGraph = dependencyGraph;
    console.log('[ContractGeneration] Analysis services configured for enhanced generation');
  }

  /**
   * Discover all features in a repository
   */
  async discoverFeatures(repoPath: string): Promise<IpcResult<DiscoveredFeature[]>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Discovering features in ${repoPath}`);
      const features: DiscoveredFeature[] = [];
      const processedPaths = new Set<string>();

      // 1. Scan top-level directories first (most repos have this structure)
      try {
        const entries = await fs.readdir(repoPath, { withFileTypes: true });
        console.log(`[ContractGeneration] Found ${entries.length} entries in ${repoPath}`);

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.startsWith('.')) continue;
          if (IGNORE_FOLDERS.has(entry.name)) {
            console.log(`[ContractGeneration] Skipping ignored folder: ${entry.name}`);
            continue;
          }

          const featurePath = path.join(repoPath, entry.name);
          if (processedPaths.has(featurePath)) continue;

          console.log(`[ContractGeneration] Scanning folder: ${entry.name}`);
          const files = await this.scanFeatureFiles(featurePath, repoPath);
          const totalFiles = this.countFeatureFiles(files);
          console.log(`[ContractGeneration] ${entry.name}: ${totalFiles} files (api:${files.api.length}, schema:${files.schema.length}, tests:${files.tests.unit.length}, other:${files.other.length})`);

          if (totalFiles > 0) {
            processedPaths.add(featurePath);
            features.push({
              name: entry.name,
              basePath: featurePath,
              files,
              contractPatternMatches: totalFiles,
            });
            console.log(`[ContractGeneration] Found feature: ${entry.name} (${totalFiles} files)`);
          }
        }
      } catch (err) {
        console.error('[ContractGeneration] Error scanning top-level:', err);
      }

      // 2. Also scan nested feature folders (src/features/*, packages/*, etc)
      for (const pattern of FEATURE_FOLDER_PATTERNS) {
        if (pattern === '*') continue; // Already handled above
        const fullPattern = path.join(repoPath, pattern);
        try {
          const matches = globSync(fullPattern, {
            nodir: false,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          });

          for (const featurePath of matches) {
            const stat = await fs.stat(featurePath).catch(() => null);
            if (!stat?.isDirectory()) continue;
            if (processedPaths.has(featurePath)) continue;

            const featureName = path.basename(featurePath);
            if (IGNORE_FOLDERS.has(featureName)) continue;

            const files = await this.scanFeatureFiles(featurePath, repoPath);
            const totalFiles = this.countFeatureFiles(files);

            if (totalFiles > 0) {
              processedPaths.add(featurePath);
              features.push({
                name: featureName,
                basePath: featurePath,
                files,
                contractPatternMatches: totalFiles,
              });
              console.log(`[ContractGeneration] Found feature: ${featureName} (${totalFiles} files)`);
            }
          }
        } catch (err) {
          // Pattern didn't match anything, continue
        }
      }

      // 3. If still no features found, treat root as single feature
      if (features.length === 0) {
        console.log('[ContractGeneration] No feature folders found, analyzing root as single feature...');
        const rootFeature = await this.analyzeRootAsFeature(repoPath);
        if (rootFeature && this.countFeatureFiles(rootFeature.files) > 0) {
          features.push(rootFeature);
        }
      }

      console.log(`[ContractGeneration] Discovered ${features.length} features`);
      return features;
    }, 'DISCOVER_FEATURES_ERROR');
  }

  /**
   * Scan a feature directory for contract-related files
   */
  private async scanFeatureFiles(
    featurePath: string,
    repoPath: string
  ): Promise<DiscoveredFeature['files']> {
    const files: DiscoveredFeature['files'] = {
      api: [],
      schema: [],
      tests: { e2e: [], unit: [], integration: [] },
      fixtures: [],
      config: [],
      other: [],
    };

    // Scan for each pattern type
    for (const [category, patterns] of Object.entries(CONTRACT_PATTERNS)) {
      for (const pattern of patterns) {
        const fullPattern = path.join(featurePath, pattern);
        try {
          const matches = globSync(fullPattern, {
            ignore: ['**/node_modules/**', '**/.git/**'],
          });

          // Ensure matches is an array
          const matchArray = Array.isArray(matches) ? matches : [];

          for (const match of matchArray) {
          const relativePath = path.relative(repoPath, match);

          switch (category) {
            case 'api':
              if (!files.api.includes(relativePath)) files.api.push(relativePath);
              break;
            case 'schema':
              if (!files.schema.includes(relativePath)) files.schema.push(relativePath);
              break;
            case 'e2e':
              if (!files.tests.e2e.includes(relativePath)) files.tests.e2e.push(relativePath);
              break;
            case 'unit':
              // Exclude e2e files from unit
              if (!relativePath.includes('.e2e.') && !relativePath.includes('/e2e/')) {
                if (!files.tests.unit.includes(relativePath)) files.tests.unit.push(relativePath);
              }
              break;
            case 'integration':
              if (!files.tests.integration.includes(relativePath)) files.tests.integration.push(relativePath);
              break;
            case 'fixtures':
              if (!files.fixtures.includes(relativePath)) files.fixtures.push(relativePath);
              break;
            case 'config':
              if (!files.config.includes(relativePath)) files.config.push(relativePath);
              break;
          }
          }
        } catch {
          // Pattern didn't match or glob error, continue
        }
      }
    }

    // Also scan for general source files (to ensure we discover features even without contract-specific files)
    // Only log once for debugging
    let loggedPattern = false;
    for (const pattern of SOURCE_PATTERNS) {
      const fullPattern = path.join(featurePath, pattern);
      try {
        const matches = globSync(fullPattern, {
          ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        });
        const matchArray = Array.isArray(matches) ? matches : [];
        if (!loggedPattern && matchArray.length > 0) {
          console.log(`[ContractGeneration] Pattern ${pattern} found ${matchArray.length} files in ${path.basename(featurePath)}`);
          loggedPattern = true;
        }
        for (const match of matchArray) {
          const relativePath = path.relative(repoPath, match);
          // Only add if not already categorized
          const alreadyCategorized =
            files.api.includes(relativePath) ||
            files.schema.includes(relativePath) ||
            files.tests.e2e.includes(relativePath) ||
            files.tests.unit.includes(relativePath) ||
            files.tests.integration.includes(relativePath) ||
            files.fixtures.includes(relativePath) ||
            files.config.includes(relativePath);
          if (!alreadyCategorized && !files.other.includes(relativePath)) {
            files.other.push(relativePath);
          }
        }
      } catch (err) {
        // Log first error
        if (!loggedPattern) {
          console.error(`[ContractGeneration] Glob error for ${fullPattern}:`, err);
          loggedPattern = true;
        }
      }
    }

    return files;
  }

  /**
   * Analyze repository root as a single feature (fallback)
   */
  private async analyzeRootAsFeature(repoPath: string): Promise<DiscoveredFeature | null> {
    const repoName = path.basename(repoPath);
    const files = await this.scanFeatureFiles(repoPath, repoPath);

    return {
      name: repoName,
      basePath: repoPath,
      files,
      contractPatternMatches: this.countFeatureFiles(files),
    };
  }

  /**
   * Count total files in a feature
   */
  private countFeatureFiles(files: DiscoveredFeature['files']): number {
    return (
      files.api.length +
      files.schema.length +
      files.tests.e2e.length +
      files.tests.unit.length +
      files.tests.integration.length +
      files.fixtures.length +
      files.config.length +
      files.other.length
    );
  }

  /**
   * Generate contract for a single feature
   */
  async generateFeatureContract(
    repoPath: string,
    feature: DiscoveredFeature,
    options: ContractGenerationOptions = {}
  ): Promise<IpcResult<GeneratedContractResult>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Generating contract for feature: ${feature.name}`);

      // Extract code samples for AI context
      const codeSamples = options.includeCodeSamples !== false
        ? await this.extractCodeSamples(repoPath, feature, options.maxFilesPerFeature || 10)
        : '';

      // Build file lists for prompt
      const apiFiles = feature.files.api.join('\n- ') || 'None';
      const schemaFiles = feature.files.schema.join('\n- ') || 'None';
      const testFiles = [
        ...feature.files.tests.e2e.map(f => `[E2E] ${f}`),
        ...feature.files.tests.unit.map(f => `[Unit] ${f}`),
        ...feature.files.tests.integration.map(f => `[Integration] ${f}`),
      ].join('\n- ') || 'None';
      const otherFiles = [...feature.files.fixtures, ...feature.files.config].join('\n- ') || 'None';

      // Generate Markdown contract using AI
      const markdownResult = await this.aiService.sendWithMode({
        modeId: 'contract-generator',
        promptKey: 'generate_feature_contract',
        variables: {
          feature_name: feature.name,
          feature_path: path.relative(repoPath, feature.basePath),
          api_files: apiFiles,
          schema_files: schemaFiles,
          test_files: testFiles,
          other_files: otherFiles,
          code_samples: codeSamples || 'No code samples available',
        },
      });

      if (!markdownResult.success || !markdownResult.data) {
        throw new Error(`Failed to generate markdown: ${markdownResult.error?.message}`);
      }

      // Generate JSON contract using AI
      const jsonResult = await this.aiService.sendWithMode({
        modeId: 'contract-generator',
        promptKey: 'generate_json_contract',
        variables: {
          feature_name: feature.name,
          feature_path: path.relative(repoPath, feature.basePath),
          api_files: apiFiles,
          schema_files: schemaFiles,
          test_files: testFiles,
          code_samples: codeSamples || 'No code samples available',
        },
      });

      let jsonContract: GeneratedContractJSON;
      if (jsonResult.success && jsonResult.data) {
        try {
          // Parse AI response as JSON (may have markdown fences)
          let jsonStr = jsonResult.data.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          jsonContract = JSON.parse(jsonStr);
        } catch {
          console.warn(`[ContractGeneration] Failed to parse JSON, using fallback`);
          jsonContract = await this.createFallbackJSON(feature, repoPath);
        }
      } else {
        jsonContract = await this.createFallbackJSON(feature, repoPath);
      }

      // Save contracts
      const savedPaths = await this.saveContract(
        repoPath,
        feature,
        markdownResult.data,
        jsonContract
      );

      return {
        feature: feature.name,
        success: true,
        markdownPath: savedPaths.markdownPath,
        jsonPath: savedPaths.jsonPath,
      };
    }, 'GENERATE_CONTRACT_ERROR');
  }

  /**
   * Extract code samples from key files for AI context
   */
  private async extractCodeSamples(
    repoPath: string,
    feature: DiscoveredFeature,
    maxFiles: number
  ): Promise<string> {
    const samples: string[] = [];
    let fileCount = 0;

    // Prioritize type/interface files and API routes
    const priorityFiles = [
      ...feature.files.schema.filter(f => f.includes('types') || f.includes('interface')),
      ...feature.files.api.filter(f => f.includes('routes') || f.includes('api')),
      ...feature.files.schema.slice(0, 3),
    ];

    for (const file of priorityFiles) {
      if (fileCount >= maxFiles) break;

      const fullPath = path.join(repoPath, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        // Truncate large files
        const truncated = content.length > 2000
          ? content.slice(0, 2000) + '\n// ... truncated'
          : content;

        samples.push(`### ${file}\n\`\`\`typescript\n${truncated}\n\`\`\``);
        fileCount++;
      } catch {
        // Skip unreadable files
      }
    }

    return samples.join('\n\n');
  }

  /**
   * Create fallback JSON contract when AI fails
   * Enhanced with AST data when analysis services are available (Phase 3)
   */
  private async createFallbackJSON(feature: DiscoveredFeature, repoPath: string): Promise<GeneratedContractJSON> {
    // Extract analysis data if services are available
    const analysisData = await this.extractAnalysisData(feature, repoPath);

    return {
      feature: feature.name,
      version: '1.0.0',
      lastGenerated: new Date().toISOString(),
      generatorVersion: '1.0.0',
      overview: `Auto-generated contract for ${feature.name} feature`,
      apis: {
        endpoints: analysisData.endpoints.map(ep => ({
          method: ep.method,
          path: ep.path,
          handler: ep.handler,
          file: ep.file,
          line: ep.line,
        })),
        exports: analysisData.exports.map(exp => ({
          name: exp.name,
          type: exp.type as 'function' | 'class' | 'interface' | 'type' | 'const',
          file: exp.file,
          line: exp.line,
          signature: exp.signature,
        })),
      },
      schemas: analysisData.schemas.map(schema => ({
        name: schema.name,
        type: 'interface' as const,
        file: schema.file,
        columns: schema.columns?.map(c => ({
          name: c.name,
          type: c.type,
          nullable: c.nullable,
          primaryKey: c.primaryKey,
        })),
      })),
      dependencies: analysisData.dependencies,
      testCoverage: {
        e2e: { count: feature.files.tests.e2e.length, files: feature.files.tests.e2e },
        unit: { count: feature.files.tests.unit.length, files: feature.files.tests.unit },
        integration: { count: feature.files.tests.integration.length, files: feature.files.tests.integration },
      },
      breakingChangeFiles: [...feature.files.api.slice(0, 5), ...feature.files.schema.slice(0, 5)],
      sourceFiles: [
        ...feature.files.api,
        ...feature.files.schema,
        ...feature.files.tests.e2e,
        ...feature.files.tests.unit,
      ],
    };
  }

  /**
   * Extract analysis data from feature files using analysis services (Phase 3)
   */
  private async extractAnalysisData(
    feature: DiscoveredFeature,
    repoPath: string
  ): Promise<{
    exports: Array<{ name: string; type: string; file: string; line: number; signature?: string }>;
    endpoints: ExtractedEndpoint[];
    schemas: ExtractedSchema[];
    dependencies: string[];
  }> {
    const result = {
      exports: [] as Array<{ name: string; type: string; file: string; line: number; signature?: string }>,
      endpoints: [] as ExtractedEndpoint[],
      schemas: [] as ExtractedSchema[],
      dependencies: [] as string[],
    };

    // If analysis services not available, return empty data
    if (!this.astParser || !this.apiExtractor || !this.schemaExtractor) {
      console.log('[ContractGeneration] Analysis services not available, using basic extraction');
      return result;
    }

    try {
      // Extract exports from all source files using AST parser
      const allFiles = [
        ...feature.files.api,
        ...feature.files.schema,
        ...feature.files.other,
      ];

      for (const relFile of allFiles.slice(0, 20)) { // Limit to prevent slowdown
        const absPath = path.join(repoPath, relFile);
        try {
          const ast = await this.astParser.parseFile(absPath);
          if (ast) {
            for (const exp of ast.exports) {
              result.exports.push({
                name: exp.name,
                type: exp.type,
                file: relFile,
                line: exp.line,
                signature: exp.signature,
              });
            }
          }
        } catch {
          // Skip files that fail to parse
        }
      }

      // Extract API endpoints
      const apiFiles = feature.files.api.map(f => ({
        path: path.join(repoPath, f),
      }));
      if (apiFiles.length > 0) {
        const endpoints = await this.apiExtractor.extractFromFiles(apiFiles);
        result.endpoints.push(...endpoints);
      }

      // Extract schemas
      const schemaFiles = feature.files.schema.map(f => ({
        path: path.join(repoPath, f),
      }));
      if (schemaFiles.length > 0) {
        const schemas = await this.schemaExtractor.extractFromFiles(schemaFiles);
        result.schemas.push(...schemas);
      }

      // Collect dependencies from AST imports
      const depSet = new Set<string>();
      for (const relFile of allFiles.slice(0, 20)) {
        const absPath = path.join(repoPath, relFile);
        try {
          const ast = await this.astParser.parseFile(absPath);
          if (ast) {
            for (const imp of ast.imports) {
              if (!imp.source.startsWith('.') && !imp.source.startsWith('/')) {
                // External dependency
                const pkgName = imp.source.split('/')[0];
                if (!pkgName.startsWith('@')) {
                  depSet.add(pkgName);
                } else {
                  // Scoped package
                  const parts = imp.source.split('/');
                  if (parts.length >= 2) {
                    depSet.add(`${parts[0]}/${parts[1]}`);
                  }
                }
              }
            }
          }
        } catch {
          // Skip files that fail to parse
        }
      }
      result.dependencies = Array.from(depSet);

      console.log(`[ContractGeneration] Extracted ${result.exports.length} exports, ${result.endpoints.length} endpoints, ${result.schemas.length} schemas for ${feature.name}`);
    } catch (error) {
      console.error('[ContractGeneration] Error extracting analysis data:', error);
    }

    return result;
  }

  /**
   * Save contract to both feature folder and registry
   */
  private async saveContract(
    repoPath: string,
    feature: DiscoveredFeature,
    markdown: string,
    json: GeneratedContractJSON
  ): Promise<{ markdownPath: string; jsonPath: string }> {
    // 1. Save Markdown to feature folder
    const markdownPath = path.join(feature.basePath, 'CONTRACTS.md');
    await fs.writeFile(markdownPath, markdown, 'utf-8');
    console.log(`[ContractGeneration] Saved markdown: ${markdownPath}`);

    // 2. Save JSON to registry
    const registryDir = path.join(repoPath, KANVAS_PATHS.ROOT, 'contracts', 'features');
    await fs.mkdir(registryDir, { recursive: true });

    const jsonPath = path.join(registryDir, `${feature.name}.contracts.json`);
    await fs.writeFile(jsonPath, JSON.stringify(json, null, 2), 'utf-8');
    console.log(`[ContractGeneration] Saved JSON: ${jsonPath}`);

    return { markdownPath, jsonPath };
  }

  /**
   * Generate contracts for all features in a repository
   */
  async generateAllContracts(
    repoPath: string,
    options: ContractGenerationOptions = {}
  ): Promise<IpcResult<BatchContractGenerationResult>> {
    return this.wrap(async () => {
      this.isCancelled = false;
      const startTime = Date.now();
      const results: GeneratedContractResult[] = [];

      // Discover features
      this.emitProgress({
        total: 0,
        completed: 0,
        currentFeature: 'Discovering features...',
        currentStep: 'discovering',
        errors: [],
      });

      const discoverResult = await this.discoverFeatures(repoPath);
      if (!discoverResult.success || !discoverResult.data) {
        throw new Error(`Failed to discover features: ${discoverResult.error?.message}`);
      }

      let features = discoverResult.data;

      // Filter to specific features if requested
      if (options.features && options.features.length > 0) {
        features = features.filter(f => options.features!.includes(f.name));
      }

      console.log(`[ContractGeneration] Generating contracts for ${features.length} features`);

      // Generate contract for each feature
      for (let i = 0; i < features.length; i++) {
        if (this.isCancelled) {
          console.log('[ContractGeneration] Cancelled by user');
          break;
        }

        const feature = features[i];

        this.emitProgress({
          total: features.length,
          completed: i,
          currentFeature: feature.name,
          currentStep: 'generating',
          errors: results.filter(r => !r.success).map(r => r.error || 'Unknown error'),
        });

        // Check if should skip existing
        if (options.skipExisting) {
          const existingPath = path.join(feature.basePath, 'CONTRACTS.md');
          try {
            await fs.access(existingPath);
            results.push({
              feature: feature.name,
              success: true,
              markdownPath: existingPath,
              jsonPath: path.join(repoPath, KANVAS_PATHS.ROOT, 'contracts', 'features', `${feature.name}.contracts.json`),
            });
            console.log(`[ContractGeneration] Skipping existing: ${feature.name}`);
            continue;
          } catch {
            // File doesn't exist, generate it
          }
        }

        // Generate contract
        const result = await this.generateFeatureContract(repoPath, feature, options);
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          results.push({
            feature: feature.name,
            success: false,
            error: result.error?.message || 'Unknown error',
          });
        }
      }

      const duration = Date.now() - startTime;
      const batchResult: BatchContractGenerationResult = {
        totalFeatures: features.length,
        generated: results.filter(r => r.success).length,
        skipped: options.skipExisting ? results.filter(r => r.success && !r.error).length : 0,
        failed: results.filter(r => !r.success).length,
        results,
        duration,
      };

      // Emit completion
      this.emitToRenderer(IPC.CONTRACT_GENERATION_COMPLETE, batchResult);
      console.log(`[ContractGeneration] Batch complete: ${batchResult.generated} generated, ${batchResult.failed} failed in ${duration}ms`);

      return batchResult;
    }, 'GENERATE_ALL_ERROR');
  }

  /**
   * Emit progress event to renderer
   */
  private emitProgress(progress: ContractGenerationProgress): void {
    this.currentProgress = progress;
    this.emitToRenderer(IPC.CONTRACT_GENERATION_PROGRESS, progress);
  }

  /**
   * Cancel ongoing generation
   */
  cancelGeneration(): void {
    this.isCancelled = true;
    console.log('[ContractGeneration] Cancel requested');
  }

  /**
   * Get current generation progress
   */
  getProgress(): ContractGenerationProgress | null {
    return this.currentProgress;
  }
}
