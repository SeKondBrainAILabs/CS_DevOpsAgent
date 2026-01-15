/**
 * Repository Analysis Types
 * Types for AST parsing, code analysis, and contract generation
 * Part of the Repository Analysis Engine (Phase 1)
 */

// =============================================================================
// LANGUAGE & PARSING TYPES
// =============================================================================

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go';

export type SymbolType = 'function' | 'class' | 'interface' | 'type' | 'const' | 'variable' | 'enum' | 'method';

export interface ParsedAST {
  language: SupportedLanguage;
  filePath: string;
  contentHash: string;
  exports: ExportedSymbol[];
  imports: ImportedSymbol[];
  functions: FunctionDefinition[];
  classes: ClassDefinition[];
  types: TypeDefinition[];
  parseTime: number; // ms
}

export interface ExportedSymbol {
  name: string;
  type: SymbolType;
  line: number;
  column: number;
  signature?: string;
  isDefault: boolean;
  jsdoc?: string;
}

export interface ImportedSymbol {
  name: string;
  alias?: string;
  source: string;
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface FunctionDefinition {
  name: string;
  line: number;
  column: number;
  endLine: number;
  params: ParameterDefinition[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  isArrow: boolean;
  jsdoc?: string;
}

export interface ParameterDefinition {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ClassDefinition {
  name: string;
  line: number;
  column: number;
  endLine: number;
  extends?: string;
  implements?: string[];
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
  isExported: boolean;
  isAbstract: boolean;
  jsdoc?: string;
}

export interface MethodDefinition {
  name: string;
  line: number;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  params: ParameterDefinition[];
  returnType?: string;
}

export interface PropertyDefinition {
  name: string;
  line: number;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isReadonly: boolean;
}

export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
  column: number;
  isExported: boolean;
  properties?: TypePropertyDefinition[];
  enumValues?: string[];
  jsdoc?: string;
}

export interface TypePropertyDefinition {
  name: string;
  type: string;
  optional: boolean;
}

// =============================================================================
// API EXTRACTION TYPES
// =============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export type APIFramework = 'express' | 'fastify' | 'koa' | 'hapi' | 'flask' | 'fastapi' | 'django' | 'gin' | 'unknown';

export interface ExtractedEndpoint {
  method: HttpMethod;
  path: string;
  handler: string;
  file: string;
  line: number;
  framework: APIFramework;
  params?: RouteParam[];
  queryParams?: RouteParam[];
  bodySchema?: string;
  responseSchema?: string;
  middleware?: string[];
  description?: string;
}

export interface RouteParam {
  name: string;
  type?: string;
  required: boolean;
  description?: string;
}

// =============================================================================
// SCHEMA EXTRACTION TYPES
// =============================================================================

export type SchemaSourceType = 'prisma' | 'typeorm' | 'sequelize' | 'drizzle' | 'mongoose' | 'sql' | 'json-schema' | 'zod' | 'unknown';

export interface ExtractedSchema {
  name: string;
  sourceType: SchemaSourceType;
  file: string;
  line: number;
  columns: SchemaColumn[];
  relations?: SchemaRelation[];
  indexes?: SchemaIndex[];
  primaryKey?: string[];
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  unique?: boolean;
  primaryKey?: boolean;
}

export interface SchemaRelation {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  foreignKey?: string;
  through?: string;
}

export interface SchemaIndex {
  name?: string;
  columns: string[];
  unique: boolean;
}

// =============================================================================
// EVENT TRACKING TYPES
// =============================================================================

export type EventPatternType = 'eventemitter' | 'rxjs' | 'redis-pubsub' | 'kafka' | 'rabbitmq' | 'socket.io' | 'custom';

export interface ExtractedEvent {
  name: string;
  patternType: EventPatternType;
  file: string;
  line: number;
  isProducer: boolean;
  isConsumer: boolean;
  topic?: string;
  payloadSchema?: string;
  handler?: string;
}

export interface EventProducer {
  eventName: string;
  topic?: string;
  file: string;
  line: number;
  emitCall: string;
}

export interface EventConsumer {
  eventName: string;
  topic?: string;
  file: string;
  line: number;
  handler: string;
}

// =============================================================================
// DEPENDENCY GRAPH TYPES
// =============================================================================

export interface DependencyNode {
  id: string;
  name: string;
  type: 'feature' | 'module' | 'file' | 'external';
  path?: string;
  exports: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'import' | 'export' | 'call' | 'extends' | 'implements';
  symbols: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularDependencies: string[][];
  externalDependencies: ExternalDependency[];
}

export interface ExternalDependency {
  name: string;
  version?: string;
  usedBy: string[];
  importCount: number;
}

// =============================================================================
// INFRASTRUCTURE TYPES
// =============================================================================

export type InfraType = 'terraform' | 'kubernetes' | 'docker' | 'docker-compose' | 'cloudformation' | 'unknown';

export interface ExtractedInfraResource {
  type: InfraType;
  resourceType: string;
  name: string;
  file: string;
  line: number;
  properties: Record<string, unknown>;
  dependencies?: string[];
}

// =============================================================================
// FEATURE ANALYSIS TYPES
// =============================================================================

export interface FeatureAnalysis {
  name: string;
  basePath: string;
  language: SupportedLanguage;
  frameworks: string[];
  exports: ExportedSymbol[];
  apis: ExtractedEndpoint[];
  schemas: ExtractedSchema[];
  events: ExtractedEvent[];
  dependencies: string[];
  internalDependencies: string[];
  externalDependencies: string[];
  fileCount: number;
  lineCount: number;
  lastAnalyzed: string;
}

// =============================================================================
// REPOSITORY ANALYSIS TYPES
// =============================================================================

export interface RepositoryAnalysis {
  repoPath: string;
  repoName: string;
  analyzedAt: string;
  features: FeatureAnalysis[];
  dependencyGraph: DependencyGraph;
  languages: LanguageStats[];
  totalFiles: number;
  totalLines: number;
  analysisDuration: number; // ms
}

export interface LanguageStats {
  language: SupportedLanguage;
  files: number;
  lines: number;
  percentage: number;
}

// =============================================================================
// ANALYSIS PROGRESS TYPES
// =============================================================================

export type AnalysisPhase =
  | 'initializing'
  | 'scanning'
  | 'detecting-features'
  | 'parsing'
  | 'extracting-apis'
  | 'extracting-schemas'
  | 'tracking-events'
  | 'building-graph'
  | 'generating-contracts'
  | 'complete'
  | 'error';

export interface AnalysisProgress {
  phase: AnalysisPhase;
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  currentFeature?: string;
  errors: AnalysisError[];
  startedAt: string;
  estimatedCompletion?: string;
}

export interface AnalysisError {
  file: string;
  line?: number;
  message: string;
  severity: 'warning' | 'error';
  recoverable: boolean;
}

// =============================================================================
// ANALYSIS OPTIONS & RESULTS
// =============================================================================

export interface AnalysisOptions {
  /** Include AST caching for incremental analysis */
  useCache?: boolean;
  /** Force re-analysis even if cached */
  forceRefresh?: boolean;
  /** Maximum file size to parse (bytes) */
  maxFileSize?: number;
  /** Directories to exclude */
  excludeDirs?: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Enable LLM-assisted analysis for complex patterns */
  useLLM?: boolean;
  /** LLM model to use for analysis */
  llmModel?: string;
  /** Generate contracts after analysis */
  generateContracts?: boolean;
  /** Specific features to analyze (empty = all) */
  features?: string[];
}

export interface AnalysisResult {
  success: boolean;
  analysis?: RepositoryAnalysis;
  progress: AnalysisProgress;
  contracts?: GeneratedAnalysisContract[];
  errors: AnalysisError[];
  duration: number; // ms
}

// =============================================================================
// CONTRACT GENERATION TYPES (Analysis-based)
// =============================================================================

export interface GeneratedAnalysisContract {
  featureName: string;
  description: string;
  path: string;
  language: SupportedLanguage;
  frameworks: string[];
  dependencies: {
    internal: string[];
    external: string[];
  };
  contracts: {
    api?: string; // Path to generated API contract
    schema?: string; // Path to generated schema contract
    events?: string; // Path to generated events contract
  };
  generatedAt: string;
  generatorVersion: string;
}

export interface RepositoryContract {
  repoName: string;
  version: string;
  generatedAt: string;
  features: GeneratedAnalysisContract[];
  dependencyGraph: DependencyGraph;
  overview: {
    totalFeatures: number;
    totalEndpoints: number;
    totalSchemas: number;
    totalEvents: number;
    languages: LanguageStats[];
  };
}

// =============================================================================
// AST CACHE TYPES
// =============================================================================

export interface ASTCacheEntry {
  filePath: string;
  contentHash: string;
  language: SupportedLanguage;
  ast: ParsedAST;
  cachedAt: string;
  accessCount: number;
  lastAccessed: string;
}

export interface ASTCacheStats {
  totalEntries: number;
  totalSize: number; // bytes
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry: string;
  newestEntry: string;
}
