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
import type { AIService } from './AIService';

// Helper to get globSync via dynamic import (glob v11 is ESM-only)
let _globSync: ((pattern: string, options?: object) => string[]) | null = null;
async function getGlobSync() {
  if (!_globSync) {
    const glob = await import('glob');
    // Handle both glob v11 (named export) and v7/v8/v9 or CommonJS interop (default export with sync method)
    // @ts-ignore - Dynamic import handling
    _globSync = glob.globSync || (glob.default && glob.default.sync) || glob.sync;
  }
  return _globSync;
}
import type { ContractRegistryService } from './ContractRegistryService';
import { KANVAS_PATHS } from '../../shared/agent-protocol';
// Phase 3: Analysis services for enhanced contract generation
import type { ASTParserService } from './analysis/ASTParserService';
import type { APIExtractorService } from './analysis/APIExtractorService';
import type { SchemaExtractorService } from './analysis/SchemaExtractorService';
import type { DependencyGraphService } from './analysis/DependencyGraphService';
import type { ParsedAST, ExtractedEndpoint, ExtractedSchema, DependencyGraph } from '../../shared/analysis-types';

// Repository structure analysis result
interface RepoStructureAnalysis {
  applicationType: string;
  techStack: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    keyDependencies: string[];
  };
  architecturePattern: string;
  entryPoints: Array<{ file: string; description: string }>;
  features: Array<{ name: string; path: string; description: string }>;
  externalIntegrations: Array<{ name: string; type: string; purpose: string }>;
}

// Feature analysis result with APIs exposed/consumed
interface FeatureAnalysis {
  feature: string;
  purpose: string;
  apisExposed: {
    httpEndpoints: Array<{
      method: string;
      path: string;
      handler: string;
      file: string;
      line?: number;
      parameters?: Array<{ name: string; type: string; in: string; required: boolean }>;
      responseType?: string;
      authentication?: string;
      description?: string;
    }>;
    exportedFunctions: Array<{
      name: string;
      file: string;
      line?: number;
      signature?: string;
      description?: string;
      isAsync?: boolean;
    }>;
    exportedTypes: Array<{
      name: string;
      kind: string;
      file: string;
      line?: number;
      properties?: Array<{ name: string; type: string; optional: boolean }>;
    }>;
    eventsEmitted: Array<{
      eventName: string;
      payload?: string;
      emittedFrom?: string;
    }>;
  };
  apisConsumed: {
    httpCalls: Array<{
      method: string;
      url: string;
      purpose?: string;
      calledFrom?: string;
    }>;
    internalImports: Array<{
      from: string;
      imports: string[];
      usedIn?: string;
    }>;
    externalPackages: Array<{
      package: string;
      imports: string[];
      purpose?: string;
    }>;
    databaseOperations: Array<{
      type: string;
      table?: string;
      file: string;
      line?: number;
    }>;
    eventsConsumed: Array<{
      eventName: string;
      handler?: string;
      file?: string;
    }>;
  };
  dataModels: Array<{
    name: string;
    type: string;
    file: string;
    fields?: Array<{ name: string; type: string; constraints?: string }>;
  }>;
  dependencies: {
    internal: string[];
    external: string[];
  };
}

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

// Folders to ignore when scanning top-level (common gitignore patterns + submodules)
const IGNORE_FOLDERS = new Set([
  // Build outputs
  'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.output',
  // Git and version control
  '.git', 'submodules', '.worktrees',
  // IDE and editor
  '.vscode', '.idea', '.eclipse', '.settings',
  // Test and coverage
  'coverage', 'playwright-report', 'test-results', '.nyc_output',
  // Cache and temp
  '.cache', 'tmp', 'temp', '.temp', '.tmp',
  // Documentation (usually not features)
  'docs', 'Documentation', 'doc',
  // DevOps/Kanvas specific
  '.S9N_KIT_DevOpsAgent', 'local_deploy', 'backups',
  // Vendor and third-party
  'vendor', 'third_party', 'external', 'deps',
  // Logs
  'logs', 'log',
]);

/**
 * Parse .gitignore file and return patterns
 */
function parseGitignore(gitignoreContent: string): string[] {
  return gitignoreContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')) // Remove empty lines and comments
    .map(pattern => {
      // Remove leading slash (gitignore uses it for root-relative paths)
      if (pattern.startsWith('/')) pattern = pattern.slice(1);
      // Remove trailing slash (directories)
      if (pattern.endsWith('/')) pattern = pattern.slice(0, -1);
      return pattern;
    });
}

/**
 * Check if a path matches any gitignore pattern
 */
function matchesGitignorePattern(relativePath: string, patterns: string[]): boolean {
  const pathParts = relativePath.split('/');
  
  for (const pattern of patterns) {
    // Exact match
    if (relativePath === pattern) return true;
    
    // Directory match (any part of path matches)
    if (pathParts.includes(pattern)) return true;
    
    // Wildcard patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*/g, '.*');  // Convert * to .*
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(relativePath)) return true;
      // Also check if any path component matches
      if (pathParts.some(part => regex.test(part))) return true;
    }
  }
  
  return false;
}

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
   * PHASE 1: Analyze repository structure to understand the codebase
   * This should be called BEFORE discovering features
   */
  async analyzeRepoStructure(repoPath: string): Promise<IpcResult<RepoStructureAnalysis>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Analyzing repository structure: ${repoPath}`);

      // Get directory tree
      const directoryTree = await this.getDirectoryTree(repoPath, 3);

      // Check for key config files
      const hasPackageJson = await this.fileExists(path.join(repoPath, 'package.json'));
      const hasTsconfig = await this.fileExists(path.join(repoPath, 'tsconfig.json'));
      const hasDockerfile = await this.fileExists(path.join(repoPath, 'Dockerfile'));
      const hasDockerCompose = await this.fileExists(path.join(repoPath, 'docker-compose.yml')) ||
                               await this.fileExists(path.join(repoPath, 'docker-compose.yaml'));

      // Read package.json if exists
      let packageJsonContent = '';
      if (hasPackageJson) {
        try {
          const content = await fs.readFile(path.join(repoPath, 'package.json'), 'utf-8');
          const parsed = JSON.parse(content);
          // Only include relevant parts
          packageJsonContent = JSON.stringify({
            name: parsed.name,
            version: parsed.version,
            description: parsed.description,
            main: parsed.main,
            scripts: Object.keys(parsed.scripts || {}),
            dependencies: Object.keys(parsed.dependencies || {}),
            devDependencies: Object.keys(parsed.devDependencies || {}),
          }, null, 2);
        } catch {
          packageJsonContent = 'Failed to parse';
        }
      }

      // Use AI to analyze the structure
      const result = await this.aiService.sendWithMode({
        modeId: 'contract_generator',
        promptKey: 'analyze_repo_structure',
        variables: {
          repo_name: path.basename(repoPath),
          directory_tree: directoryTree,
          has_package_json: String(hasPackageJson),
          has_tsconfig: String(hasTsconfig),
          has_dockerfile: String(hasDockerfile),
          has_docker_compose: String(hasDockerCompose),
          package_json_content: packageJsonContent || 'Not present',
        },
      });

      if (!result.success || !result.data) {
        throw new Error(`Failed to analyze repo structure: ${result.error?.message}`);
      }

      // Parse the JSON response
      let analysis: RepoStructureAnalysis;
      try {
        let jsonStr = result.data.trim();
        // Remove markdown code fences if present
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }
        analysis = JSON.parse(jsonStr);
      } catch {
        console.warn('[ContractGeneration] Failed to parse AI response, using defaults');
        analysis = {
          applicationType: 'Unknown',
          techStack: { languages: [], frameworks: [], databases: [], keyDependencies: [] },
          architecturePattern: 'Unknown',
          entryPoints: [],
          features: [],
          externalIntegrations: [],
        };
      }

      console.log(`[ContractGeneration] Repo analysis complete: ${analysis.applicationType}, ${analysis.features.length} features identified`);
      return analysis;
    }, 'ANALYZE_REPO_STRUCTURE_ERROR');
  }

  /**
   * PHASE 2: Generate README documentation for the repository
   */
  async generateRepoReadme(
    repoPath: string,
    structureAnalysis: RepoStructureAnalysis
  ): Promise<IpcResult<string>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Generating README for: ${repoPath}`);

      const directoryTree = await this.getDirectoryTree(repoPath, 3);

      const result = await this.aiService.sendWithMode({
        modeId: 'contract_generator',
        promptKey: 'generate_readme',
        variables: {
          repo_name: path.basename(repoPath),
          analysis_json: JSON.stringify(structureAnalysis, null, 2),
          directory_tree: directoryTree,
        },
      });

      if (!result.success || !result.data) {
        throw new Error(`Failed to generate README: ${result.error?.message}`);
      }

      // Save README to repo
      const readmePath = path.join(repoPath, 'ARCHITECTURE.md');
      await fs.writeFile(readmePath, result.data, 'utf-8');
      console.log(`[ContractGeneration] Saved architecture doc: ${readmePath}`);

      return result.data;
    }, 'GENERATE_README_ERROR');
  }

  /**
   * PHASE 3: Deep analysis of a feature - identifies APIs exposed and consumed
   */
  async analyzeFeatureDeep(
    repoPath: string,
    feature: DiscoveredFeature
  ): Promise<IpcResult<FeatureAnalysis>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Deep analyzing feature: ${feature.name}`);

      // Get file list
      const allFiles = [
        ...feature.files.api,
        ...feature.files.schema,
        ...feature.files.other.slice(0, 20), // Limit other files
      ];

      // Extract code samples from key files
      const codeSamples = await this.extractCodeSamplesDeep(repoPath, feature, 15);

      const result = await this.aiService.sendWithMode({
        modeId: 'contract_generator',
        promptKey: 'analyze_feature',
        variables: {
          feature_name: feature.name,
          feature_path: path.relative(repoPath, feature.basePath),
          repo_name: path.basename(repoPath),
          file_list: allFiles.join('\n'),
          code_samples: codeSamples,
        },
        userMessage: 'Analyze this feature and return ONLY valid JSON with the analysis structure. No explanations.',
      });

      if (!result.success || !result.data) {
        throw new Error(`Failed to analyze feature: ${result.error?.message}`);
      }

      // Parse the JSON response
      let analysis: FeatureAnalysis;
      try {
        let jsonStr = result.data.trim();
        // Remove markdown code fences if present
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }
        // Try to extract JSON if there's text before/after
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        analysis = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.warn(`[ContractGeneration] Failed to parse feature analysis for ${feature.name}:`, parseErr);
        console.warn(`[ContractGeneration] Raw response (first 500 chars): ${result.data.substring(0, 500)}`);
        analysis = this.createEmptyFeatureAnalysis(feature.name);
      }

      console.log(`[ContractGeneration] Feature ${feature.name}: ${analysis.apisExposed.httpEndpoints.length} endpoints exposed, ${analysis.apisConsumed.httpCalls.length} HTTP calls consumed`);
      return analysis;
    }, 'ANALYZE_FEATURE_DEEP_ERROR');
  }

  /**
   * Helper: Create empty feature analysis structure
   */
  private createEmptyFeatureAnalysis(featureName: string): FeatureAnalysis {
    return {
      feature: featureName,
      purpose: '',
      apisExposed: {
        httpEndpoints: [],
        exportedFunctions: [],
        exportedTypes: [],
        eventsEmitted: [],
      },
      apisConsumed: {
        httpCalls: [],
        internalImports: [],
        externalPackages: [],
        databaseOperations: [],
        eventsConsumed: [],
      },
      dataModels: [],
      dependencies: { internal: [], external: [] },
    };
  }

  /**
   * Helper: Get directory tree as string
   */
  private async getDirectoryTree(dirPath: string, maxDepth: number, currentDepth = 0, prefix = ''): Promise<string> {
    if (currentDepth >= maxDepth) return '';

    const lines: string[] = [];
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const filteredEntries = entries
        .filter(e => !e.name.startsWith('.') && !IGNORE_FOLDERS.has(e.name))
        .sort((a, b) => {
          // Directories first
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        const isLast = i === filteredEntries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');

        lines.push(`${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}`);

        if (entry.isDirectory()) {
          const subTree = await this.getDirectoryTree(
            path.join(dirPath, entry.name),
            maxDepth,
            currentDepth + 1,
            newPrefix
          );
          if (subTree) lines.push(subTree);
        }
      }
    } catch {
      // Skip unreadable directories
    }

    return lines.join('\n');
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Extract more comprehensive code samples
   */
  private async extractCodeSamplesDeep(
    repoPath: string,
    feature: DiscoveredFeature,
    maxFiles: number
  ): Promise<string> {
    const samples: string[] = [];
    let fileCount = 0;

    // Priority order: types/interfaces, routes/api, index files, services, other
    const priorityFiles = [
      ...feature.files.schema.filter(f => f.includes('types') || f.includes('interface') || f.endsWith('.d.ts')),
      ...feature.files.api.filter(f => f.includes('routes') || f.includes('api') || f.includes('controller')),
      ...feature.files.other.filter(f => f.endsWith('index.ts') || f.endsWith('index.js')),
      ...feature.files.api,
      ...feature.files.schema,
      ...feature.files.other.filter(f => f.includes('service') || f.includes('Service')),
    ];

    // Deduplicate
    const uniqueFiles = [...new Set(priorityFiles)];

    for (const file of uniqueFiles) {
      if (fileCount >= maxFiles) break;

      const fullPath = path.join(repoPath, file);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        // Truncate large files but keep more context
        const maxSize = 3000;
        const truncated = content.length > maxSize
          ? content.slice(0, maxSize) + '\n// ... truncated (' + (content.length - maxSize) + ' more chars)'
          : content;

        const ext = path.extname(file).replace('.', '') || 'txt';
        samples.push(`### ${file}\n\`\`\`${ext}\n${truncated}\n\`\`\``);
        fileCount++;
      } catch {
        // Skip unreadable files
      }
    }

    return samples.join('\n\n');
  }

  /**
   * Parse .gitmodules file to get list of submodule paths
   * Also checks for npm workspaces and symlinked packages
   */
  private async getGitSubmodulePaths(repoPath: string): Promise<Set<string>> {
    const excludedPaths = new Set<string>();

    // 1. Parse .gitmodules for git submodules
    const gitmodulesPath = path.join(repoPath, '.gitmodules');
    try {
      const content = await fs.readFile(gitmodulesPath, 'utf-8');
      const pathMatches = content.matchAll(/^\s*path\s*=\s*(.+)$/gm);
      for (const match of pathMatches) {
        const submodulePath = match[1].trim();
        excludedPaths.add(submodulePath);
        // Also add just the folder name for top-level matching
        const folderName = submodulePath.split('/')[0];
        excludedPaths.add(folderName);
      }
      console.log(`[ContractGeneration] Found ${excludedPaths.size} git submodule paths`);
    } catch {
      // No .gitmodules file - that's fine
    }

    // 2. Check for npm workspaces that might be shared packages
    const packageJsonPath = path.join(repoPath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.workspaces) {
        // Workspaces can be array or object with packages key
        const workspaces = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];
        for (const ws of workspaces) {
          // Workspace patterns like "packages/*" - we want to exclude the container
          if (ws.endsWith('/*')) {
            const container = ws.slice(0, -2);
            console.log(`[ContractGeneration] Found npm workspace container: ${container}`);
            // Don't exclude individual packages, just note the container pattern
          }
        }
      }
    } catch {
      // No package.json or can't parse - that's fine
    }

    // 3. Check for symlinks in common package locations
    const packageDirs = ['packages', 'libs', 'modules'];
    for (const dir of packageDirs) {
      const dirPath = path.join(repoPath, dir);
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) {
            const symPath = `${dir}/${entry.name}`;
            excludedPaths.add(symPath);
            console.log(`[ContractGeneration] Found symlinked package: ${symPath}`);
          }
        }
      } catch {
        // Directory doesn't exist - that's fine
      }
    }

    return excludedPaths;
  }

  /**
   * Get feature name from package.json if available, otherwise use folder name
   */
  private async getFeatureName(featurePath: string, fallbackName: string): Promise<string> {
    const packageJsonPath = path.join(featurePath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.name) {
        // Remove scope if present (e.g., @org/package-name -> package-name)
        const name = pkg.name.startsWith('@')
          ? pkg.name.split('/')[1] || pkg.name
          : pkg.name;
        return name;
      }
    } catch {
      // No package.json or can't parse it - use fallback
    }
    return fallbackName;
  }

  /**
   * AI feature info - stores name and description for each discovered feature path
   */
  private aiFeatureInfo: Map<string, { name: string; description?: string }> = new Map();

  /**
   * Use AI to filter discovered folders into actual features
   * Returns a Set of folder names/paths that are actual features
   * Also populates this.aiFeatureInfo with name/description for each path
   */
  private async filterFoldersToFeatures(
    repoPath: string,
    candidateFolders: string[]
  ): Promise<Set<string> | null> {
    // Clear previous AI feature info
    this.aiFeatureInfo.clear();

    try {
      // Get directory tree for context - use depth 4 to see inside containers
      const directoryTree = await this.getDirectoryTree(repoPath, 4);

      // Format folder list
      const folderList = candidateFolders.map(f => `- ${f}`).join('\n');

      // Use AI to filter
      const result = await this.aiService.sendWithMode({
        modeId: 'contract_generator',
        promptKey: 'filter_features',
        variables: {
          repo_name: path.basename(repoPath),
          folder_list: folderList,
          directory_tree: directoryTree,
        },
        userMessage: 'Analyze the folders and return ONLY valid JSON with the features array. No explanations, just JSON.',
      });

      if (!result.success || !result.data) {
        console.warn('[ContractGeneration] AI feature filter failed:', result.error?.message);
        return null;
      }

      // Parse the JSON response
      try {
        let jsonStr = result.data.trim();
        // Remove markdown code fences if present
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(jsonStr);
        const featureSet = new Set<string>();

        if (parsed.features && Array.isArray(parsed.features)) {
          for (const f of parsed.features) {
            // Handle both old format (path) and new format (paths array)
            const paths = f.paths || (f.path ? [f.path] : []);

            for (const featurePath of paths) {
              const normalizedPath = featurePath.replace(/^\.?\//, '');
              featureSet.add(normalizedPath);

              // Extract all path segments for flexible matching
              const pathSegments = normalizedPath.split('/');
              const topLevelFolder = pathSegments[0];
              const lastSegment = pathSegments[pathSegments.length - 1];

              // Add various path forms for matching
              featureSet.add(topLevelFolder);
              if (lastSegment !== topLevelFolder) {
                featureSet.add(lastSegment);
              }

              // Store AI-provided name and description
              const featureInfo = {
                name: f.name || lastSegment,
                description: f.description,
              };
              this.aiFeatureInfo.set(normalizedPath, featureInfo);
              this.aiFeatureInfo.set(topLevelFolder, featureInfo);
              this.aiFeatureInfo.set(lastSegment, featureInfo);
              console.log(`[ContractGeneration] Stored AI info for "${normalizedPath}": name="${featureInfo.name}"`);
            }

            const pathsStr = paths.join(', ');
            console.log(`[ContractGeneration] AI identified feature: "${f.name}" at [${pathsStr}]`);
            if (f.description) {
              console.log(`[ContractGeneration]   Description: ${f.description}`);
            }
          }
        }

        return featureSet;
      } catch (parseErr) {
        console.warn('[ContractGeneration] Failed to parse AI filter response:', parseErr);
        return null;
      }
    } catch (err) {
      console.error('[ContractGeneration] Error in filterFoldersToFeatures:', err);
      return null;
    }
  }

  /**
   * Discover all features in a repository
   * @param repoPath - Path to the repository
   * @param useAI - If true, uses LLM to intelligently identify actual features (default: true)
   */
  async discoverFeatures(repoPath: string, useAI = true): Promise<IpcResult<DiscoveredFeature[]>> {
    return this.wrap(async () => {
      console.log(`[ContractGeneration] Discovering features in ${repoPath} (useAI: ${useAI})`);
      const features: DiscoveredFeature[] = [];
      const processedPaths = new Set<string>();

      // Get git submodule paths to exclude
      const submodulePaths = await this.getGitSubmodulePaths(repoPath);

      // Get .gitignore patterns
      let gitignorePatterns: string[] = [];
      try {
        const gitignorePath = path.join(repoPath, '.gitignore');
        const content = await fs.readFile(gitignorePath, 'utf-8');
        gitignorePatterns = parseGitignore(content);
        console.log(`[ContractGeneration] Loaded ${gitignorePatterns.length} patterns from .gitignore`);
      } catch {
        // No .gitignore, that's fine
      }

      // If useAI is true, use LLM to identify actual features first
      let aiIdentifiedFeatures: Set<string> | null = null;
      if (useAI) {
        console.log('[ContractGeneration] Using AI to identify actual features...');

        // First, collect all candidate folders (mechanical scan)
        const candidateFolders: string[] = [];
        try {
          const entries = await fs.readdir(repoPath, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith('.')) continue;
            if (IGNORE_FOLDERS.has(entry.name)) continue;
            if (submodulePaths.has(entry.name)) continue;
            if (matchesGitignorePattern(entry.name, gitignorePatterns)) continue;
            candidateFolders.push(entry.name);
          }
        } catch {
          // Ignore errors
        }

        // Use AI to filter candidate folders into actual features
        if (candidateFolders.length > 0) {
          const filteredFeatures = await this.filterFoldersToFeatures(repoPath, candidateFolders);
          if (filteredFeatures) {
            aiIdentifiedFeatures = filteredFeatures;
            console.log(`[ContractGeneration] AI identified ${aiIdentifiedFeatures.size} feature paths`);
          } else {
            console.warn('[ContractGeneration] AI feature filtering failed, falling back to mechanical scan');
          }
        }
      }

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

          // Skip git submodules
          if (submodulePaths.has(entry.name)) {
            console.log(`[ContractGeneration] Skipping git submodule: ${entry.name}`);
            continue;
          }

          // Skip gitignored paths
          if (matchesGitignorePattern(entry.name, gitignorePatterns)) {
            console.log(`[ContractGeneration] Skipping gitignored folder: ${entry.name}`);
            continue;
          }

          // If AI is enabled, check if this folder is a feature or contains features
          if (aiIdentifiedFeatures) {
            const isDirectFeature = aiIdentifiedFeatures.has(entry.name);
            // Check if any AI-identified path starts with this folder (it's a parent of a feature)
            const isParentOfFeature = Array.from(aiIdentifiedFeatures).some(p => p.startsWith(entry.name + '/'));

            if (!isDirectFeature && !isParentOfFeature) {
              console.log(`[ContractGeneration] Skipping non-feature folder (AI): ${entry.name}`);
              continue;
            }

            // If it's only a parent folder (like "services"), we'll scan nested features later
            if (!isDirectFeature && isParentOfFeature) {
              console.log(`[ContractGeneration] ${entry.name} contains features - will scan nested`);
              continue; // Don't add the parent as a feature, just scan children
            }
          }

          const featurePath = path.join(repoPath, entry.name);
          if (processedPaths.has(featurePath)) continue;

          console.log(`[ContractGeneration] Scanning folder: ${entry.name}`);
          const files = await this.scanFeatureFiles(featurePath, repoPath);
          const totalFiles = this.countFeatureFiles(files);
          console.log(`[ContractGeneration] ${entry.name}: ${totalFiles} files (api:${files.api.length}, schema:${files.schema.length}, tests:${files.tests.unit.length}, other:${files.other.length})`);

          if (totalFiles > 0) {
            processedPaths.add(featurePath);
            // Check if AI provided name/description for this feature
            const aiInfo = this.aiFeatureInfo.get(entry.name);
            // Get feature name: prefer AI-provided name, then package.json, then folder name
            const featureName = aiInfo?.name || await this.getFeatureName(featurePath, entry.name);
            features.push({
              name: featureName,
              description: aiInfo?.description,
              basePath: featurePath,
              files,
              contractPatternMatches: totalFiles,
            });
            console.log(`[ContractGeneration] Found feature: ${featureName} (${totalFiles} files)${aiInfo?.description ? ` - ${aiInfo.description}` : ''}`);
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
          const globSync = await getGlobSync();
          const matches = globSync(fullPattern, {
            nodir: false,
            ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          });

          for (const featurePath of matches) {
            const stat = await fs.stat(featurePath).catch(() => null);
            if (!stat?.isDirectory()) continue;
            if (processedPaths.has(featurePath)) continue;

            const folderName = path.basename(featurePath);
            if (IGNORE_FOLDERS.has(folderName)) continue;

            // Check if this path is a submodule
            const relativePath = path.relative(repoPath, featurePath);
            if (submodulePaths.has(relativePath) || submodulePaths.has(folderName)) {
              console.log(`[ContractGeneration] Skipping git submodule: ${relativePath}`);
              continue;
            }

            // Check gitignore
            if (matchesGitignorePattern(folderName, gitignorePatterns) || matchesGitignorePattern(relativePath, gitignorePatterns)) {
              console.log(`[ContractGeneration] Skipping gitignored path: ${relativePath}`);
              continue;
            }

            // If AI is enabled, skip paths not identified as features
            if (aiIdentifiedFeatures && !aiIdentifiedFeatures.has(relativePath) && !aiIdentifiedFeatures.has(folderName)) {
              console.log(`[ContractGeneration] Skipping non-feature path (AI): ${relativePath}`);
              continue;
            }

            const files = await this.scanFeatureFiles(featurePath, repoPath);
            const totalFiles = this.countFeatureFiles(files);

            if (totalFiles > 0) {
              processedPaths.add(featurePath);
              // Check if AI provided name/description for this feature
              const aiInfo = this.aiFeatureInfo.get(relativePath) || this.aiFeatureInfo.get(folderName);
              // Get feature name: prefer AI-provided name, then package.json, then folder name
              const featureName = aiInfo?.name || await this.getFeatureName(featurePath, folderName);
              features.push({
                name: featureName,
                description: aiInfo?.description,
                basePath: featurePath,
                files,
                contractPatternMatches: totalFiles,
              });
              console.log(`[ContractGeneration] Found feature: ${featureName} (${totalFiles} files)${aiInfo?.description ? ` - ${aiInfo.description}` : ''}`);
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
          const globSync = await getGlobSync();
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
        const globSync = await getGlobSync();
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
        modeId: 'contract_generator',
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
        modeId: 'contract_generator',
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
          description: `Handler: ${ep.handler}`,
          file: ep.file,
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
    const registryDir = path.join(repoPath, KANVAS_PATHS.baseDir, 'contracts', 'features');
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

      const discoverResult = await this.discoverFeatures(repoPath, options.useAI);
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
              jsonPath: path.join(repoPath, KANVAS_PATHS.baseDir, 'contracts', 'features', `${feature.name}.contracts.json`),
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
