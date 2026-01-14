/**
 * Shared type definitions for SeKondBrain Kanvas
 * Used by both main (Electron) and renderer (React) processes
 */

// =============================================================================
// SESSION TYPES
// =============================================================================

export type SessionStatus = 'idle' | 'active' | 'watching' | 'paused' | 'error' | 'closed';

export type AgentType = 'claude' | 'cursor' | 'copilot' | 'cline' | 'aider' | 'warp' | 'custom';

export interface Session {
  id: string;
  name: string;
  task: string;
  agentType: AgentType;
  status: SessionStatus;
  branchName: string;
  worktreePath: string;
  repoPath: string;
  created: string;
  updated: string;
  commitCount: number;
  lastCommit?: string;
  error?: string;
}

export interface CreateSessionRequest {
  repoPath: string;
  task: string;
  agentType: AgentType;
  description?: string;
}

export interface CloseSessionRequest {
  sessionId: string;
  merge?: boolean;
  mergeTarget?: string;
  deleteRemote?: boolean;
}

// =============================================================================
// GIT TYPES
// =============================================================================

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';

export interface GitFileChange {
  path: string;
  status: FileStatus;
  staged: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  clean: boolean;
  changes: GitFileChange[];
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: string;
}

// =============================================================================
// FILE LOCK TYPES
// =============================================================================

export interface FileLock {
  sessionId: string;
  agentType: AgentType;
  files: string[];
  operation: 'edit' | 'read' | 'delete';
  declaredAt: string;
  estimatedDuration: number; // minutes
  reason?: string;
}

export interface FileConflict {
  file: string;
  conflictsWith: string;
  session: string;
  reason: string;
  declaredAt: string;
}

// =============================================================================
// ACTIVITY LOG TYPES
// =============================================================================

export type LogType = 'success' | 'error' | 'warning' | 'info' | 'commit' | 'file' | 'git';

export interface ActivityLogEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  type: LogType;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// WATCHER TYPES
// =============================================================================

export type FileChangeType = 'add' | 'change' | 'unlink';

export interface FileChangeEvent {
  sessionId: string;
  filePath: string;
  type: FileChangeType;
  timestamp: string;
}

export interface CommitTriggerEvent {
  sessionId: string;
  message: string;
  timestamp: string;
}

export interface CommitCompleteEvent {
  sessionId: string;
  commitHash: string;
  message: string;
  filesChanged: number;
  timestamp: string;
}

// =============================================================================
// AI/CHAT TYPES
// =============================================================================

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  streaming?: boolean;
}

export interface ChatStreamChunk {
  sessionId: string;
  content: string;
  done: boolean;
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  defaultAgentType: AgentType;
  recentProjects: string[];
  autoWatch: boolean;
  autoPush: boolean;
}

export interface BranchManagementSettings {
  defaultMergeTarget: string;
  enableDualMerge: boolean;
  enableWeeklyConsolidation: boolean;
  orphanSessionThresholdDays: number;
  mergeStrategy: 'hierarchical-first' | 'target-first' | 'parallel';
  conflictResolution: 'prompt' | 'auto';
}

export interface Credentials {
  groqApiKey?: string;
  openaiApiKey?: string;
  updatedAt?: string;
}

// =============================================================================
// IPC RESULT TYPES
// =============================================================================

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Helper type for extracting data from IpcResult
export type ExtractData<T> = T extends IpcResult<infer U> ? U : never;

// =============================================================================
// AGENT INSTANCE TYPES
// For creating new agent instances from Kanvas dashboard
// =============================================================================

export type InstanceStatus = 'pending' | 'initializing' | 'waiting' | 'active' | 'error';

export type RebaseFrequency = 'never' | 'daily' | 'weekly' | 'on-demand';

export interface AgentInstanceConfig {
  repoPath: string;
  agentType: AgentType;
  taskDescription: string;
  branchName: string;
  baseBranch: string;
  useWorktree: boolean;
  autoCommit: boolean;
  commitInterval: number;
  // Extended configuration
  rebaseFrequency: RebaseFrequency;
  systemPrompt: string;
  contextPreservation: string;
}

export interface AgentInstance {
  id: string;
  config: AgentInstanceConfig;
  status: InstanceStatus;
  createdAt: string;
  instructions?: string;
  prompt?: string; // The comprehensive prompt to copy to the coding agent
  sessionId?: string;
  error?: string;
}

export interface RepoValidation {
  isValid: boolean;
  isGitRepo: boolean;
  repoName: string;
  currentBranch: string;
  remoteUrl?: string;
  hasKanvasDir: boolean;
  branches: string[];
  error?: string;
}

export interface RecentRepo {
  path: string;
  name: string;
  lastUsed: string;
  agentCount: number;
}

export interface KanvasConfig {
  version: string;
  repoPath: string;
  initialized: string;
  settings: {
    autoCommit: boolean;
    commitInterval: number;
    watchPatterns: string[];
    ignorePatterns: string[];
  };
}

// =============================================================================
// CONTRACT TYPES
// Matches House_Rules_Contracts/ structure
// Categories: API, Schema, Events (Feature Bus), CSS, Features
// =============================================================================

/**
 * Contract categories matching House_Rules_Contracts/ structure
 * - api: API endpoints (openapi, graphql, protobuf, REST routes)
 * - schema: Database schemas, TypeScript types, JSON schemas
 * - events: Event bus / pub-sub events (Feature Bus)
 * - css: Styles, themes, design tokens
 * - features: Feature flags and toggles
 * - infra: Infrastructure contracts
 * - integrations: Third-party service integrations
 */
export type ContractType = 'api' | 'schema' | 'events' | 'css' | 'features' | 'infra' | 'integrations';

export type ContractStatus = 'active' | 'modified' | 'deprecated' | 'breaking' | 'beta';

/**
 * Base contract interface matching House_Rules_Contracts format
 */
export interface Contract {
  id: string;
  type: ContractType;
  name: string;
  description?: string;
  filePath: string;
  status: ContractStatus;
  version: string;
  lastUpdated: string;
  modifiedBy?: string; // agent or session that modified it
  breaking?: boolean; // true if changes break compatibility
  changeLog?: ContractChangeLogEntry[];
}

export interface ContractChangeLogEntry {
  date: string;
  version: string;
  agent: string;
  changes: string;
  impact: 'breaking' | 'non-breaking' | 'documentation';
}

/**
 * API Contract - matches API_CONTRACT.md structure
 * Covers: OpenAPI, GraphQL, Protobuf, REST endpoints
 */
export interface APIContract extends Contract {
  type: 'api';
  baseUrl?: string;
  apiVersion?: string;
  endpoints?: APIEndpoint[];
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description?: string;
  authRequired: boolean;
  roles?: string[];
  rateLimit?: string;
}

/**
 * Schema Contract - matches DATABASE_SCHEMA_CONTRACT.md structure
 * Covers: Database migrations, TypeScript types, JSON Schema, Prisma, Drizzle
 */
export interface SchemaContract extends Contract {
  type: 'schema';
  schemaType: 'database' | 'graphql' | 'json' | 'typescript' | 'prisma' | 'protobuf';
  tables?: string[];
  types?: string[];
}

/**
 * Events Contract - matches EVENTS_CONTRACT.md structure
 * Feature Bus / pub-sub event definitions
 */
export interface EventsContract extends Contract {
  type: 'events';
  events?: EventDefinition[];
}

export interface EventDefinition {
  name: string;
  producer: string;
  consumers?: string[];
  schemaRef?: string; // reference to schema file
  deliverySemantics?: 'at-least-once' | 'exactly-once' | 'at-most-once';
}

/**
 * CSS Contract - for design tokens, themes, styles
 */
export interface CSSContract extends Contract {
  type: 'css';
  scope: 'global' | 'component' | 'theme';
  variables?: string[];
  breakpoints?: Record<string, string>;
  colorTokens?: string[];
}

/**
 * Features Contract - matches FEATURES_CONTRACT.md structure
 * Feature flags and toggles
 */
export interface FeaturesContract extends Contract {
  type: 'features';
  flags?: FeatureFlag[];
}

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  conditions?: string[];
  rolloutPercentage?: number;
}

/**
 * Infrastructure Contract - matches INFRA_CONTRACT.md
 */
export interface InfraContract extends Contract {
  type: 'infra';
  services?: string[];
  environment?: string;
}

/**
 * Third-party Integrations Contract - matches THIRD_PARTY_INTEGRATIONS.md
 */
export interface IntegrationsContract extends Contract {
  type: 'integrations';
  provider?: string;
  apiVersion?: string;
  sdkVersion?: string;
}

export type AnyContract =
  | APIContract
  | SchemaContract
  | EventsContract
  | CSSContract
  | FeaturesContract
  | InfraContract
  | IntegrationsContract;

/**
 * Contract file change detection result
 * From ContractDetectionService
 */
export interface ContractFileChange {
  file: string;
  type: 'openapi' | 'graphql' | 'protobuf' | 'database' | 'typescript' | 'jsonSchema' | 'apiRoutes' | 'config';
  changeType: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  impactLevel: 'breaking' | 'non-breaking' | 'unknown';
  details?: string;
}
