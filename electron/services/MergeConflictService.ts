/**
 * Merge Conflict Service
 * AI-powered merge conflict resolution using LLM
 */

import { BaseService } from './BaseService';
import type { IpcResult } from '../../shared/types';
import type { AIService } from './AIService';
import { promises as fs } from 'fs';
import path from 'path';

// Dynamic import helper for execa (ESM-only module)
// Handles various bundling scenarios with fallback patterns
type ExecaFn = (cmd: string, args: string[], options?: object) => Promise<{ stdout: string; stderr: string }>;
let _execa: ExecaFn | null = null;

async function getExeca(): Promise<ExecaFn> {
  if (!_execa) {
    const mod = await import('execa');
    // Try different export patterns based on how the bundler resolves the module
    if (typeof mod.execa === 'function') {
      _execa = mod.execa as unknown as ExecaFn;
    } else if (typeof mod.default === 'function') {
      _execa = mod.default as unknown as ExecaFn;
    } else if (typeof (mod.default as Record<string, unknown>)?.execa === 'function') {
      _execa = (mod.default as Record<string, unknown>).execa as unknown as ExecaFn;
    } else {
      throw new Error(`Unable to resolve execa function from module: ${JSON.stringify(Object.keys(mod))}`);
    }
  }
  return _execa;
}

export interface ConflictedFile {
  path: string;
  content: string;
  language: string;
}

export interface ConflictAnalysis {
  currentBranchIntent: string;
  incomingBranchIntent: string;
  conflictType: 'compatible' | 'semantic' | 'structural';
  recommendedStrategy: 'merge_both' | 'prefer_current' | 'prefer_incoming' | 'manual';
  explanation: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ResolutionResult {
  file: string;
  resolved: boolean;
  content?: string;
  error?: string;
  analysis?: ConflictAnalysis;
}

export interface RebaseWithResolutionResult {
  success: boolean;
  message: string;
  conflictsResolved: number;
  conflictsFailed: number;
  resolutions: ResolutionResult[];
}

export class MergeConflictService extends BaseService {
  private aiService: AIService;

  constructor(aiService: AIService) {
    super();
    this.aiService = aiService;
  }

  /**
   * Execute a git command
   */
  private async git(args: string[], cwd: string): Promise<string> {
    const execa = await getExeca();
    const { stdout } = await execa('git', args, { cwd });
    return stdout.trim();
  }

  /**
   * Get list of files with conflicts
   */
  async getConflictedFiles(repoPath: string): Promise<IpcResult<string[]>> {
    return this.wrap(async () => {
      const output = await this.git(['diff', '--name-only', '--diff-filter=U'], repoPath);
      return output.split('\n').filter(Boolean);
    }, 'GET_CONFLICTED_FILES_FAILED');
  }

  /**
   * Read a conflicted file's content
   */
  async readConflictedFile(repoPath: string, filePath: string): Promise<IpcResult<ConflictedFile>> {
    return this.wrap(async () => {
      const fullPath = path.join(repoPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Detect language from extension
      const ext = path.extname(filePath).toLowerCase();
      const languageMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.json': 'json',
        '.md': 'markdown',
        '.css': 'css',
        '.scss': 'scss',
        '.html': 'html',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.py': 'python',
        '.go': 'go',
        '.rs': 'rust',
        '.java': 'java',
        '.sql': 'sql',
      };

      return {
        path: filePath,
        content,
        language: languageMap[ext] || 'text',
      };
    }, 'READ_CONFLICTED_FILE_FAILED');
  }

  /**
   * Check if content has conflict markers
   */
  hasConflictMarkers(content: string): boolean {
    return content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>');
  }

  /**
   * Analyze a conflict to understand what each side is doing
   */
  async analyzeConflict(
    repoPath: string,
    filePath: string
  ): Promise<IpcResult<ConflictAnalysis>> {
    return this.wrap(async () => {
      const fileResult = await this.readConflictedFile(repoPath, filePath);
      if (!fileResult.success || !fileResult.data) {
        throw new Error(`Failed to read file: ${filePath}`);
      }

      const result = await this.aiService.sendWithMode({
        modeId: 'merge_conflict_resolver',
        promptKey: 'analyze_conflict',
        variables: {
          file_path: filePath,
          conflicted_content: fileResult.data.content,
        },
        userMessage: 'Analyze this conflict and return ONLY valid JSON.',
      });

      if (!result.success || !result.data) {
        throw new Error('AI analysis failed');
      }

      // Parse JSON from response
      const jsonMatch = result.data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response as JSON');
      }

      return JSON.parse(jsonMatch[0]) as ConflictAnalysis;
    }, 'ANALYZE_CONFLICT_FAILED');
  }

  /**
   * Resolve a single file's conflicts using AI
   */
  async resolveFileConflict(
    repoPath: string,
    filePath: string,
    currentBranch: string,
    incomingBranch: string
  ): Promise<IpcResult<ResolutionResult>> {
    return this.wrap(async () => {
      console.log(`[MergeConflict] Resolving conflict in: ${filePath}`);

      const fileResult = await this.readConflictedFile(repoPath, filePath);
      if (!fileResult.success || !fileResult.data) {
        return {
          file: filePath,
          resolved: false,
          error: `Failed to read file: ${filePath}`,
        };
      }

      const { content, language } = fileResult.data;

      // Check if file actually has conflicts
      if (!this.hasConflictMarkers(content)) {
        console.log(`[MergeConflict] No conflict markers in ${filePath}, skipping`);
        return {
          file: filePath,
          resolved: true,
          content,
        };
      }

      // Use AI to resolve the conflict
      const result = await this.aiService.sendWithMode({
        modeId: 'merge_conflict_resolver',
        promptKey: 'resolve_conflict',
        variables: {
          file_path: filePath,
          language,
          current_branch: currentBranch,
          incoming_branch: incomingBranch,
          conflicted_content: content,
        },
        userMessage: 'Resolve this conflict and output ONLY the final merged code. No explanations.',
      });

      if (!result.success || !result.data) {
        return {
          file: filePath,
          resolved: false,
          error: 'AI resolution failed',
        };
      }

      let resolvedContent = result.data;

      // Extract code from markdown code blocks if present
      const codeBlockMatch = resolvedContent.match(/```(?:\w+)?\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        resolvedContent = codeBlockMatch[1];
      }

      // Verify no conflict markers remain
      if (this.hasConflictMarkers(resolvedContent)) {
        console.warn(`[MergeConflict] AI output still has conflict markers, retrying...`);

        // Retry with stronger instruction
        const retryResult = await this.aiService.sendWithMode({
          modeId: 'merge_conflict_resolver',
          promptKey: 'resolve_conflict',
          variables: {
            file_path: filePath,
            language,
            current_branch: currentBranch,
            incoming_branch: incomingBranch,
            conflicted_content: content,
          },
          userMessage: 'CRITICAL: You MUST remove ALL conflict markers (<<<<<<, ======, >>>>>>) and produce clean, merged code. Output ONLY the resolved code.',
        });

        if (retryResult.success && retryResult.data) {
          resolvedContent = retryResult.data;
          const retryCodeBlock = resolvedContent.match(/```(?:\w+)?\n([\s\S]*?)```/);
          if (retryCodeBlock) {
            resolvedContent = retryCodeBlock[1];
          }
        }

        // If still has markers, fail
        if (this.hasConflictMarkers(resolvedContent)) {
          return {
            file: filePath,
            resolved: false,
            error: 'AI could not fully resolve conflict markers',
          };
        }
      }

      return {
        file: filePath,
        resolved: true,
        content: resolvedContent.trim(),
      };
    }, 'RESOLVE_FILE_CONFLICT_FAILED');
  }

  /**
   * Apply a resolved file's content
   */
  async applyResolution(repoPath: string, filePath: string, content: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      const fullPath = path.join(repoPath, filePath);
      await fs.writeFile(fullPath, content, 'utf-8');
      await this.git(['add', filePath], repoPath);
      console.log(`[MergeConflict] Applied resolution and staged: ${filePath}`);
    }, 'APPLY_RESOLUTION_FAILED');
  }

  /**
   * Perform rebase with automatic AI conflict resolution
   */
  async rebaseWithResolution(
    repoPath: string,
    targetBranch: string,
    maxRetries = 3
  ): Promise<IpcResult<RebaseWithResolutionResult>> {
    return this.wrap(async () => {
      const currentBranch = await this.git(['branch', '--show-current'], repoPath);
      console.log(`[MergeConflict] Starting rebase of ${currentBranch} onto ${targetBranch}`);

      const resolutions: ResolutionResult[] = [];
      let conflictsResolved = 0;
      let conflictsFailed = 0;
      let retries = 0;

      // Start the rebase
      try {
        await this.git(['fetch', 'origin', targetBranch], repoPath);
      } catch (fetchError) {
        return {
          success: false,
          message: `Failed to fetch ${targetBranch}`,
          conflictsResolved: 0,
          conflictsFailed: 0,
          resolutions: [],
        };
      }

      // Start rebase (may fail with conflicts)
      try {
        await this.git(['rebase', `origin/${targetBranch}`], repoPath);
        // If no error, rebase succeeded without conflicts
        return {
          success: true,
          message: 'Rebase completed without conflicts',
          conflictsResolved: 0,
          conflictsFailed: 0,
          resolutions: [],
        };
      } catch {
        // Expected - rebase has conflicts, continue to resolve
        console.log(`[MergeConflict] Rebase has conflicts, attempting AI resolution`);
      }

      // Resolution loop - handle each conflict
      while (retries < maxRetries) {
        // Get conflicted files
        const conflictedResult = await this.getConflictedFiles(repoPath);
        if (!conflictedResult.success || !conflictedResult.data) {
          break;
        }

        const conflictedFiles = conflictedResult.data;
        if (conflictedFiles.length === 0) {
          // No more conflicts, continue rebase
          try {
            await this.git(['rebase', '--continue'], repoPath);
            // Check if rebase is complete or has more conflicts
            continue;
          } catch {
            // May still have conflicts or rebase is complete
            break;
          }
        }

        console.log(`[MergeConflict] Found ${conflictedFiles.length} conflicted files`);

        // Resolve each conflicted file
        let allResolved = true;
        for (const file of conflictedFiles) {
          const resolution = await this.resolveFileConflict(
            repoPath,
            file,
            currentBranch,
            targetBranch
          );

          if (resolution.success && resolution.data) {
            resolutions.push(resolution.data);

            if (resolution.data.resolved && resolution.data.content) {
              // Apply the resolution
              const applyResult = await this.applyResolution(
                repoPath,
                file,
                resolution.data.content
              );

              if (applyResult.success) {
                conflictsResolved++;
              } else {
                conflictsFailed++;
                allResolved = false;
              }
            } else {
              conflictsFailed++;
              allResolved = false;
            }
          } else {
            conflictsFailed++;
            allResolved = false;
            resolutions.push({
              file,
              resolved: false,
              error: 'Resolution failed',
            });
          }
        }

        if (!allResolved) {
          // Some conflicts couldn't be resolved, abort
          console.warn(`[MergeConflict] Could not resolve all conflicts, aborting rebase`);
          try {
            await this.git(['rebase', '--abort'], repoPath);
          } catch {
            // Ignore abort errors
          }
          return {
            success: false,
            message: `Failed to resolve ${conflictsFailed} conflict(s). Rebase aborted.`,
            conflictsResolved,
            conflictsFailed,
            resolutions,
          };
        }

        // Try to continue the rebase
        try {
          await this.git(['rebase', '--continue'], repoPath);
          // If successful, may have more conflicts or be complete
        } catch {
          // More conflicts or rebase complete
        }

        retries++;
      }

      // Check if rebase is complete
      try {
        // If we can get status without rebase in progress, it's complete
        await this.git(['status'], repoPath);

        // Verify no rebase in progress
        const gitDir = await this.git(['rev-parse', '--git-dir'], repoPath);
        const rebaseInProgress = await fs.access(path.join(repoPath, gitDir, 'rebase-merge'))
          .then(() => true)
          .catch(() => false);

        if (rebaseInProgress) {
          // Still in rebase, abort
          await this.git(['rebase', '--abort'], repoPath);
          return {
            success: false,
            message: 'Rebase could not complete after max retries',
            conflictsResolved,
            conflictsFailed,
            resolutions,
          };
        }

        return {
          success: true,
          message: `Rebase completed. Resolved ${conflictsResolved} conflict(s).`,
          conflictsResolved,
          conflictsFailed,
          resolutions,
        };
      } catch {
        return {
          success: false,
          message: 'Rebase status check failed',
          conflictsResolved,
          conflictsFailed,
          resolutions,
        };
      }
    }, 'REBASE_WITH_RESOLUTION_FAILED');
  }
}
