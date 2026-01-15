/**
 * Repository Analysis Service
 * Main orchestrator for repository scanning, feature detection, and analysis
 * Part of the Repository Analysis Engine
 */

import { BaseService } from '../BaseService';
import { ASTParserService } from './ASTParserService';
import * as fs from 'fs';
import * as path from 'path';
import { sync as globSync } from 'glob';
import { IPC } from '../../../shared/ipc-channels';
import type {
  RepositoryAnalysis,
  FeatureAnalysis,
  AnalysisProgress,
  AnalysisOptions,
  AnalysisResult,
  AnalysisError,
  AnalysisPhase,
  SupportedLanguage,
  LanguageStats,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ExternalDependency,
  ParsedAST,
} from '../../../shared/analysis-types';
import type { DiscoveredFeature } from '../../../shared/types';

// Patterns for identifying features in a repository
const FEATURE_PATTERNS = [
  // Standard feature directories
  'src/features/*',
  'src/modules/*',
  'packages/*',
  'apps/*',
  'services/*',
  'libs/*',
  // Common project structures
  'backend/*',
  'frontend/*',
  'api/*',
  'web/*',
  'mobile/*',
  // Monorepo patterns
  'packages/*/src',
  'apps/*/src',
];

// Files/directories to ignore during scanning
const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/out/**',
  '**/__pycache__/**',
  '**/.pytest_cache/**',
  '**/venv/**',
  '**/.venv/**',
  '**/target/**', // Rust
  '**/vendor/**', // Go
];

// Source file patterns
const SOURCE_PATTERNS: Record<SupportedLanguage, string[]> = {
  typescript: ['**/*.ts', '**/*.tsx'],
  javascript: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  python: ['**/*.py'],
  go: ['**/*.go'],
};

export class RepositoryAnalysisService extends BaseService {
  private astParser: ASTParserService;
  private currentProgress: AnalysisProgress | null = null;
  private abortController: AbortController | null = null;

  constructor(astParser: ASTParserService) {
    super();
    this.astParser = astParser;
  }

  async initialize(): Promise<void> {
    await this.astParser.initialize();
    console.log('[RepositoryAnalysisService] Initialized');
  }

  /**
   * Scan repository and detect its structure
   */
  async scanRepository(repoPath: string): Promise<{
    features: DiscoveredFeature[];
    languages: LanguageStats[];
    totalFiles: number;
  }> {
    const absolutePath = path.isAbsolute(repoPath) ? repoPath : path.resolve(repoPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Repository path does not exist: ${absolutePath}`);
    }

    // Detect features
    const features = await this.detectFeatures(absolutePath);

    // Scan all source files for language stats
    const allFiles: string[] = [];
    const languageCounts: Record<SupportedLanguage, { files: number; lines: number }> = {
      typescript: { files: 0, lines: 0 },
      javascript: { files: 0, lines: 0 },
      python: { files: 0, lines: 0 },
      go: { files: 0, lines: 0 },
    };

    for (const [language, patterns] of Object.entries(SOURCE_PATTERNS)) {
      for (const pattern of patterns) {
        const files = globSync(path.join(absolutePath, pattern), {
          ignore: IGNORE_PATTERNS,
        });
        allFiles.push(...files);

        for (const file of files) {
          languageCounts[language as SupportedLanguage].files++;
          try {
            const content = fs.readFileSync(file, 'utf-8');
            languageCounts[language as SupportedLanguage].lines += content.split('\n').length;
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    const totalFiles = allFiles.length;
    const totalLines = Object.values(languageCounts).reduce((sum, l) => sum + l.lines, 0);

    const languages: LanguageStats[] = Object.entries(languageCounts)
      .filter(([, stats]) => stats.files > 0)
      .map(([language, stats]) => ({
        language: language as SupportedLanguage,
        files: stats.files,
        lines: stats.lines,
        percentage: totalLines > 0 ? (stats.lines / totalLines) * 100 : 0,
      }))
      .sort((a, b) => b.lines - a.lines);

    return { features, languages, totalFiles };
  }

  /**
   * Detect features in a repository
   */
  async detectFeatures(repoPath: string): Promise<DiscoveredFeature[]> {
    const features: DiscoveredFeature[] = [];
    const processedPaths = new Set<string>();

    // Try each feature pattern
    for (const pattern of FEATURE_PATTERNS) {
      const matches = globSync(path.join(repoPath, pattern), {
        ignore: IGNORE_PATTERNS,
      });

      for (const match of matches) {
        const stat = fs.statSync(match);
        if (!stat.isDirectory()) continue;
        if (processedPaths.has(match)) continue;
        processedPaths.add(match);

        const feature = await this.analyzeFeatureDirectory(match, repoPath);
        if (feature && feature.contractPatternMatches > 0) {
          features.push(feature);
        }
      }
    }

    // If no features found with patterns, scan top-level directories
    if (features.length === 0) {
      const topLevel = fs.readdirSync(repoPath).filter(name => {
        const fullPath = path.join(repoPath, name);
        if (!fs.statSync(fullPath).isDirectory()) return false;
        if (name.startsWith('.')) return false;
        if (['node_modules', 'dist', 'build', 'coverage'].includes(name)) return false;
        return true;
      });

      for (const dir of topLevel) {
        const fullPath = path.join(repoPath, dir);
        if (processedPaths.has(fullPath)) continue;

        const feature = await this.analyzeFeatureDirectory(fullPath, repoPath);
        if (feature && feature.contractPatternMatches > 0) {
          features.push(feature);
          processedPaths.add(fullPath);
        }
      }
    }

    return features.sort((a, b) => b.contractPatternMatches - a.contractPatternMatches);
  }

  /**
   * Analyze a directory to determine if it's a feature
   */
  private async analyzeFeatureDirectory(dirPath: string, repoPath: string): Promise<DiscoveredFeature | null> {
    const relativePath = path.relative(repoPath, dirPath);
    const name = path.basename(dirPath);

    const feature: DiscoveredFeature = {
      name,
      basePath: relativePath,
      files: {
        api: [],
        schema: [],
        tests: { e2e: [], unit: [], integration: [] },
        fixtures: [],
        config: [],
        other: [],
      },
      contractPatternMatches: 0,
    };

    // Scan for source files
    const allSourceFiles: string[] = [];
    for (const patterns of Object.values(SOURCE_PATTERNS)) {
      for (const pattern of patterns) {
        const files = globSync(path.join(dirPath, pattern), {
          ignore: IGNORE_PATTERNS,
        });
        allSourceFiles.push(...files.map(f => path.relative(repoPath, f)));
      }
    }

    // Categorize files
    for (const file of allSourceFiles) {
      const lower = file.toLowerCase();

      // API files
      if (lower.includes('route') || lower.includes('controller') ||
          lower.includes('endpoint') || lower.includes('api') ||
          lower.includes('handler')) {
        feature.files.api.push(file);
        feature.contractPatternMatches++;
      }
      // Schema files
      else if (lower.includes('schema') || lower.includes('model') ||
               lower.includes('entity') || lower.includes('type') ||
               lower.includes('interface') || lower.includes('prisma')) {
        feature.files.schema.push(file);
        feature.contractPatternMatches++;
      }
      // E2E tests
      else if ((lower.includes('e2e') || lower.includes('spec')) &&
               (lower.includes('.test.') || lower.includes('.spec.'))) {
        feature.files.tests.e2e.push(file);
      }
      // Unit tests
      else if (lower.includes('.test.') || lower.includes('.spec.')) {
        if (lower.includes('integration')) {
          feature.files.tests.integration.push(file);
        } else {
          feature.files.tests.unit.push(file);
        }
      }
      // Fixtures
      else if (lower.includes('fixture') || lower.includes('mock') ||
               lower.includes('stub') || lower.includes('fake')) {
        feature.files.fixtures.push(file);
      }
      // Config files
      else if (lower.includes('config') || lower.includes('setting') ||
               lower.endsWith('.json') || lower.endsWith('.yaml') ||
               lower.endsWith('.yml')) {
        feature.files.config.push(file);
      }
      // Other source files
      else {
        feature.files.other.push(file);
        feature.contractPatternMatches += 0.1; // Small weight for other files
      }
    }

    // Only return if there are meaningful files
    if (allSourceFiles.length === 0) return null;

    return feature;
  }

  /**
   * Perform full repository analysis
   */
  async analyzeRepository(repoPath: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const errors: AnalysisError[] = [];

    try {
      // Initialize progress
      this.updateProgress('initializing', 0, 0);

      // Step 1: Scan repository
      this.updateProgress('scanning', 0, 0);
      const { features, languages, totalFiles } = await this.scanRepository(repoPath);

      if (features.length === 0) {
        return {
          success: false,
          progress: this.currentProgress!,
          errors: [{
            file: repoPath,
            message: 'No features detected in repository',
            severity: 'error',
            recoverable: false,
          }],
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Parse all files
      this.updateProgress('parsing', totalFiles, 0);
      const featuresToAnalyze = options.features?.length
        ? features.filter(f => options.features!.includes(f.name))
        : features;

      const featureAnalyses: FeatureAnalysis[] = [];
      const allParsedFiles = new Map<string, ParsedAST>();
      let processedFiles = 0;

      for (const feature of featuresToAnalyze) {
        if (this.abortController.signal.aborted) break;

        this.updateProgress('parsing', totalFiles, processedFiles, undefined, feature.name);

        const featureFiles = [
          ...feature.files.api,
          ...feature.files.schema,
          ...feature.files.other,
        ].filter(f => this.astParser.isSupported(f));

        const absoluteFiles = featureFiles.map(f => path.join(repoPath, f));

        for (const file of absoluteFiles) {
          if (this.abortController.signal.aborted) break;

          try {
            this.updateProgress('parsing', totalFiles, processedFiles, file, feature.name);
            const ast = await this.astParser.parseFile(file, { useCache: options.useCache ?? true });
            allParsedFiles.set(file, ast);
          } catch (error) {
            errors.push({
              file,
              message: error instanceof Error ? error.message : 'Parse error',
              severity: 'warning',
              recoverable: true,
            });
          }
          processedFiles++;
        }

        // Build feature analysis from parsed files
        const featureAnalysis = this.buildFeatureAnalysis(feature, allParsedFiles, repoPath);
        featureAnalyses.push(featureAnalysis);
      }

      // Step 3: Build dependency graph
      this.updateProgress('building-graph', totalFiles, processedFiles);
      const dependencyGraph = this.buildDependencyGraph(featureAnalyses, allParsedFiles);

      // Step 4: Complete
      this.updateProgress('complete', totalFiles, processedFiles);

      const analysis: RepositoryAnalysis = {
        repoPath,
        repoName: path.basename(repoPath),
        analyzedAt: new Date().toISOString(),
        features: featureAnalyses,
        dependencyGraph,
        languages,
        totalFiles,
        totalLines: languages.reduce((sum, l) => sum + l.lines, 0),
        analysisDuration: Date.now() - startTime,
      };

      return {
        success: true,
        analysis,
        progress: this.currentProgress!,
        errors,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      this.updateProgress('error', 0, 0);
      errors.push({
        file: repoPath,
        message: error instanceof Error ? error.message : 'Analysis failed',
        severity: 'error',
        recoverable: false,
      });

      return {
        success: false,
        progress: this.currentProgress!,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Build feature analysis from parsed files
   */
  private buildFeatureAnalysis(
    feature: DiscoveredFeature,
    parsedFiles: Map<string, ParsedAST>,
    repoPath: string
  ): FeatureAnalysis {
    const allExports: ParsedAST['exports'] = [];
    const internalDeps = new Set<string>();
    const externalDeps = new Set<string>();
    let primaryLanguage: SupportedLanguage = 'typescript';
    const frameworks = new Set<string>();
    let lineCount = 0;

    const featureFiles = [
      ...feature.files.api,
      ...feature.files.schema,
      ...feature.files.other,
    ];

    for (const relFile of featureFiles) {
      const absFile = path.join(repoPath, relFile);
      const ast = parsedFiles.get(absFile);
      if (!ast) continue;

      allExports.push(...ast.exports);
      primaryLanguage = ast.language;

      // Analyze imports for dependencies
      for (const imp of ast.imports) {
        if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
          // Internal dependency
          internalDeps.add(imp.source);
        } else {
          // External dependency
          externalDeps.add(imp.source.split('/')[0]);

          // Detect frameworks
          if (['express', 'fastify', 'koa', 'hapi'].includes(imp.source)) {
            frameworks.add(imp.source);
          }
          if (['react', 'vue', 'svelte', 'angular'].includes(imp.source)) {
            frameworks.add(imp.source);
          }
          if (['prisma', 'typeorm', 'sequelize', 'drizzle-orm'].includes(imp.source) ||
              imp.source.includes('@prisma')) {
            frameworks.add('prisma');
          }
        }
      }
    }

    // Count lines
    for (const file of featureFiles) {
      try {
        const content = fs.readFileSync(path.join(repoPath, file), 'utf-8');
        lineCount += content.split('\n').length;
      } catch {
        // Skip unreadable files
      }
    }

    return {
      name: feature.name,
      basePath: feature.basePath,
      language: primaryLanguage,
      frameworks: Array.from(frameworks),
      exports: allExports,
      apis: [], // Will be populated by APIExtractorService
      schemas: [], // Will be populated by SchemaExtractorService
      events: [], // Will be populated by EventTrackerService
      dependencies: Array.from(new Set([...internalDeps, ...externalDeps])),
      internalDependencies: Array.from(internalDeps),
      externalDependencies: Array.from(externalDeps),
      fileCount: featureFiles.length,
      lineCount,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  /**
   * Build dependency graph from analyzed features
   */
  private buildDependencyGraph(
    features: FeatureAnalysis[],
    parsedFiles: Map<string, ParsedAST>
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const externalDeps = new Map<string, ExternalDependency>();

    // Create nodes for each feature
    for (const feature of features) {
      nodes.push({
        id: feature.name,
        name: feature.name,
        type: 'feature',
        path: feature.basePath,
        exports: feature.exports.map(e => e.name),
      });

      // Track external dependencies
      for (const dep of feature.externalDependencies) {
        const existing = externalDeps.get(dep);
        if (existing) {
          existing.usedBy.push(feature.name);
          existing.importCount++;
        } else {
          externalDeps.set(dep, {
            name: dep,
            usedBy: [feature.name],
            importCount: 1,
          });
        }
      }
    }

    // Create edges from imports
    for (const [filePath, ast] of parsedFiles) {
      const sourceFeature = features.find(f =>
        filePath.includes(f.basePath)
      );
      if (!sourceFeature) continue;

      for (const imp of ast.imports) {
        // Find target feature
        const targetFeature = features.find(f =>
          imp.source.includes(f.basePath) || imp.source.includes(f.name)
        );

        if (targetFeature && targetFeature.name !== sourceFeature.name) {
          // Check if edge already exists
          const existingEdge = edges.find(e =>
            e.source === sourceFeature.name && e.target === targetFeature.name
          );

          if (existingEdge) {
            existingEdge.symbols.push(imp.name);
          } else {
            edges.push({
              source: sourceFeature.name,
              target: targetFeature.name,
              type: 'import',
              symbols: [imp.name],
            });
          }
        }
      }
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(edges);

    return {
      nodes,
      edges,
      circularDependencies,
      externalDependencies: Array.from(externalDeps.values())
        .sort((a, b) => b.importCount - a.importCount),
    };
  }

  /**
   * Detect circular dependencies in the graph
   */
  private detectCircularDependencies(edges: DependencyEdge[]): string[][] {
    const graph = new Map<string, string[]>();

    // Build adjacency list
    for (const edge of edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, []);
    }

    return cycles;
  }

  /**
   * Update and emit progress
   */
  private updateProgress(
    phase: AnalysisPhase,
    totalFiles: number,
    processedFiles: number,
    currentFile?: string,
    currentFeature?: string
  ): void {
    this.currentProgress = {
      phase,
      totalFiles,
      processedFiles,
      currentFile,
      currentFeature,
      errors: [],
      startedAt: this.currentProgress?.startedAt || new Date().toISOString(),
    };

    this.emitToRenderer(IPC.ANALYSIS_PROGRESS, this.currentProgress);
    this.emit('progress', this.currentProgress);
  }

  /**
   * Cancel ongoing analysis
   */
  cancelAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get current progress
   */
  getProgress(): AnalysisProgress | null {
    return this.currentProgress;
  }

  async dispose(): Promise<void> {
    this.cancelAnalysis();
    await this.astParser.dispose();
  }
}
