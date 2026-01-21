/**
 * CommitAnalysisService
 * Analyzes file changes and generates detailed, AI-powered commit messages
 *
 * This service examines actual code diffs (not just file names) to produce
 * comprehensive commit messages that accurately describe what changed and why.
 */

import { BaseService } from './BaseService';
import type { IpcResult } from '../../shared/types';
import type { AIService } from './AIService';
import * as path from 'path';

// Dynamic import helper for execa (ESM-only module)
// Handles various bundling scenarios with fallback patterns
let _execa: ((cmd: string, args: string[], options?: object) => Promise<{ stdout: string; stderr: string }>) | null = null;

async function getExeca() {
  if (!_execa) {
    const mod = await import('execa');
    // Try different export patterns based on how the bundler resolves the module
    if (typeof mod.execa === 'function') {
      _execa = mod.execa;
    } else if (typeof mod.default === 'function') {
      _execa = mod.default;
    } else if (typeof mod.default?.execa === 'function') {
      _execa = mod.default.execa;
    } else {
      throw new Error(`Unable to resolve execa function from module: ${JSON.stringify(Object.keys(mod))}`);
    }
  }
  return _execa;
}

async function execaCmd(cmd: string, args: string[], options?: { cwd?: string }): Promise<{ stdout: string; stderr: string }> {
  const execa = await getExeca();
  return execa(cmd, args, options);
}

export interface FileChangeAnalysis {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff: string;
  language: string;
  changeType: 'feature' | 'fix' | 'refactor' | 'style' | 'docs' | 'test' | 'config' | 'other';
  summary: string; // AI-generated summary of what changed in this file
}

export interface CommitAnalysis {
  overallType: 'feat' | 'fix' | 'refactor' | 'docs' | 'style' | 'test' | 'build' | 'ci' | 'chore' | 'perf';
  scope: string | null;
  subject: string;
  body: string;
  breakingChange: boolean;
  filesAnalyzed: FileChangeAnalysis[];
  suggestedMessage: string;
  alternativeMessages: string[];
}

export interface AnalysisOptions {
  includeBody?: boolean;      // Generate detailed body (default: true)
  maxFilesToAnalyze?: number; // Limit files for large commits (default: 20)
  contextTask?: string;       // Task/issue description for context
  contextBranch?: string;     // Branch name for context
  useAI?: boolean;            // Use AI for enhanced analysis (default: true)
}

// Language detection by file extension
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript-react',
  '.js': 'javascript',
  '.jsx': 'javascript-react',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c-header',
  '.hpp': 'cpp-header',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.md': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.dockerfile': 'dockerfile',
  '.prisma': 'prisma',
  '.graphql': 'graphql',
  '.proto': 'protobuf',
};

// Change type detection patterns
const CHANGE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: FileChangeAnalysis['changeType'] }> = [
  { pattern: /\.(test|spec)\.(ts|tsx|js|jsx)$/, type: 'test' },
  { pattern: /\.(md|txt|rst)$/, type: 'docs' },
  { pattern: /\.(css|scss|less|style)/, type: 'style' },
  { pattern: /(config|\.config\.|rc\.|\.rc)/, type: 'config' },
  { pattern: /(__tests__|__mocks__|fixtures|test-data)/, type: 'test' },
  { pattern: /(README|CHANGELOG|LICENSE|CONTRIBUTING)/, type: 'docs' },
];

export class CommitAnalysisService extends BaseService {
  private aiService: AIService | null = null;

  constructor() {
    super('CommitAnalysisService');
  }

  /**
   * Set the AI service for enhanced analysis
   */
  setAIService(aiService: AIService): void {
    this.aiService = aiService;
  }

  /**
   * Analyze staged changes and generate a detailed commit message
   */
  async analyzeStaged(
    repoPath: string,
    options: AnalysisOptions = {}
  ): Promise<IpcResult<CommitAnalysis>> {
    const {
      includeBody = true,
      maxFilesToAnalyze = 20,
      contextTask,
      contextBranch,
      useAI = true,
    } = options;

    try {
      // Get list of staged files
      const stagedResult = await execaCmd('git', ['diff', '--cached', '--name-status'], { cwd: repoPath });
      const stagedLines = stagedResult.stdout.split('\n').filter(Boolean);

      if (stagedLines.length === 0) {
        return {
          success: false,
          error: { code: 'NO_STAGED_CHANGES', message: 'No staged changes to analyze' },
        };
      }

      // Also get unstaged changes for complete picture
      const unstagedResult = await execaCmd('git', ['diff', '--name-status'], { cwd: repoPath });
      const unstagedLines = unstagedResult.stdout.split('\n').filter(Boolean);

      // Get untracked files
      const untrackedResult = await execaCmd('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoPath });
      const untrackedFiles = untrackedResult.stdout.split('\n').filter(Boolean);

      // Combine all changes
      const allChanges = new Map<string, string>();

      for (const line of stagedLines) {
        const [status, ...pathParts] = line.split('\t');
        const filePath = pathParts.join('\t'); // Handle paths with tabs
        allChanges.set(filePath, status);
      }

      for (const line of unstagedLines) {
        const [status, ...pathParts] = line.split('\t');
        const filePath = pathParts.join('\t');
        if (!allChanges.has(filePath)) {
          allChanges.set(filePath, status);
        }
      }

      for (const file of untrackedFiles) {
        if (!allChanges.has(file)) {
          allChanges.set(file, 'A'); // Untracked = Added
        }
      }

      // Analyze each file
      const filesAnalyzed: FileChangeAnalysis[] = [];
      let filesProcessed = 0;

      for (const [filePath, statusCode] of allChanges) {
        if (filesProcessed >= maxFilesToAnalyze) {
          console.log(`[CommitAnalysisService] Reached max files limit (${maxFilesToAnalyze}), skipping remaining`);
          break;
        }

        const analysis = await this.analyzeFile(repoPath, filePath, statusCode);
        if (analysis) {
          filesAnalyzed.push(analysis);
          filesProcessed++;
        }
      }

      // Determine overall commit type based on file analysis
      const commitAnalysis = await this.generateCommitAnalysis(
        filesAnalyzed,
        { contextTask, contextBranch, includeBody, useAI }
      );

      return { success: true, data: commitAnalysis };
    } catch (error) {
      console.error('[CommitAnalysisService] Analysis failed:', error);
      return {
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Analyze a specific commit by hash
   */
  async analyzeCommit(
    repoPath: string,
    commitHash: string,
    options: AnalysisOptions = {}
  ): Promise<IpcResult<CommitAnalysis>> {
    const { maxFilesToAnalyze = 20, contextTask, contextBranch, includeBody = true, useAI = true } = options;

    try {
      // Get files changed in the commit
      const showResult = await execaCmd(
        'git',
        ['show', '--name-status', '--format=', commitHash],
        { cwd: repoPath }
      );
      const lines = showResult.stdout.split('\n').filter(Boolean);

      if (lines.length === 0) {
        return {
          success: false,
          error: { code: 'EMPTY_COMMIT', message: 'Commit has no file changes' },
        };
      }

      // Analyze each file
      const filesAnalyzed: FileChangeAnalysis[] = [];

      for (const line of lines.slice(0, maxFilesToAnalyze)) {
        const [status, ...pathParts] = line.split('\t');
        const filePath = pathParts.join('\t');

        const analysis = await this.analyzeFileInCommit(repoPath, commitHash, filePath, status);
        if (analysis) {
          filesAnalyzed.push(analysis);
        }
      }

      // Generate analysis
      const commitAnalysis = await this.generateCommitAnalysis(
        filesAnalyzed,
        { contextTask, contextBranch, includeBody, useAI }
      );

      return { success: true, data: commitAnalysis };
    } catch (error) {
      console.error('[CommitAnalysisService] Commit analysis failed:', error);
      return {
        success: false,
        error: {
          code: 'COMMIT_ANALYSIS_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Analyze a single file's changes (staged/unstaged)
   */
  private async analyzeFile(
    repoPath: string,
    filePath: string,
    statusCode: string
  ): Promise<FileChangeAnalysis | null> {
    try {
      const status = this.parseStatusCode(statusCode);
      const ext = path.extname(filePath).toLowerCase();
      const language = LANGUAGE_MAP[ext] || 'unknown';
      const changeType = this.detectChangeType(filePath);

      // Get diff for this file
      let diff = '';
      let additions = 0;
      let deletions = 0;

      if (status !== 'deleted') {
        try {
          // Get staged diff
          const stagedDiff = await execaCmd('git', ['diff', '--cached', '--', filePath], { cwd: repoPath })
            .then(r => r.stdout)
            .catch(() => '');

          // Get unstaged diff
          const unstagedDiff = await execaCmd('git', ['diff', '--', filePath], { cwd: repoPath })
            .then(r => r.stdout)
            .catch(() => '');

          // For untracked files
          if (!stagedDiff && !unstagedDiff && statusCode === 'A') {
            const content = await execaCmd('cat', [filePath], { cwd: repoPath })
              .then(r => r.stdout)
              .catch(() => '');
            diff = `+++ new file\n${content.split('\n').map(l => `+ ${l}`).join('\n')}`;
          } else {
            diff = (stagedDiff + '\n' + unstagedDiff).trim();
          }

          // Count additions/deletions
          const lines = diff.split('\n');
          additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
          deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

          // Truncate large diffs
          if (diff.length > 3000) {
            diff = diff.substring(0, 3000) + '\n... (truncated)';
          }
        } catch {
          diff = '(unable to read diff)';
        }
      }

      // Generate file summary
      const summary = this.generateFileSummary(filePath, status, additions, deletions, diff);

      return {
        path: filePath,
        status,
        additions,
        deletions,
        diff,
        language,
        changeType,
        summary,
      };
    } catch (error) {
      console.warn(`[CommitAnalysisService] Failed to analyze file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Analyze a file within a specific commit
   */
  private async analyzeFileInCommit(
    repoPath: string,
    commitHash: string,
    filePath: string,
    statusCode: string
  ): Promise<FileChangeAnalysis | null> {
    try {
      const status = this.parseStatusCode(statusCode);
      const ext = path.extname(filePath).toLowerCase();
      const language = LANGUAGE_MAP[ext] || 'unknown';
      const changeType = this.detectChangeType(filePath);

      // Get diff for this file in the commit
      let diff = '';
      let additions = 0;
      let deletions = 0;

      try {
        const diffResult = await execaCmd(
          'git',
          ['show', '--format=', commitHash, '--', filePath],
          { cwd: repoPath }
        );
        diff = diffResult.stdout;

        // Count additions/deletions
        const lines = diff.split('\n');
        additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

        // Truncate large diffs
        if (diff.length > 3000) {
          diff = diff.substring(0, 3000) + '\n... (truncated)';
        }
      } catch {
        diff = '(unable to read diff)';
      }

      const summary = this.generateFileSummary(filePath, status, additions, deletions, diff);

      return {
        path: filePath,
        status,
        additions,
        deletions,
        diff,
        language,
        changeType,
        summary,
      };
    } catch (error) {
      console.warn(`[CommitAnalysisService] Failed to analyze file ${filePath} in commit:`, error);
      return null;
    }
  }

  /**
   * Generate the full commit analysis from file analyses
   */
  private async generateCommitAnalysis(
    filesAnalyzed: FileChangeAnalysis[],
    options: {
      contextTask?: string;
      contextBranch?: string;
      includeBody: boolean;
      useAI: boolean;
    }
  ): Promise<CommitAnalysis> {
    // Determine overall commit type based on file changes
    const overallType = this.determineOverallType(filesAnalyzed);

    // Determine scope from common path prefix or primary changed area
    const scope = this.determineScope(filesAnalyzed);

    // If AI is enabled and available, use it for enhanced analysis
    if (options.useAI && this.aiService) {
      try {
        return await this.generateAIAnalysis(filesAnalyzed, overallType, scope, options);
      } catch (error) {
        console.warn('[CommitAnalysisService] AI analysis failed, falling back to rule-based:', error);
      }
    }

    // Fallback: Rule-based analysis
    return this.generateRuleBasedAnalysis(filesAnalyzed, overallType, scope, options);
  }

  /**
   * Generate AI-powered commit analysis
   */
  private async generateAIAnalysis(
    filesAnalyzed: FileChangeAnalysis[],
    overallType: CommitAnalysis['overallType'],
    scope: string | null,
    options: {
      contextTask?: string;
      contextBranch?: string;
      includeBody: boolean;
    }
  ): Promise<CommitAnalysis> {
    // Build context for AI
    const filesChangedSummary = filesAnalyzed
      .map(f => `- ${f.path} (${f.status}): +${f.additions}/-${f.deletions} - ${f.summary}`)
      .join('\n');

    const diffContent = filesAnalyzed
      .filter(f => f.diff && f.diff !== '(unable to read diff)')
      .map(f => `=== ${f.path} ===\n${f.diff}`)
      .join('\n\n')
      .substring(0, 8000); // Limit total diff size for AI

    // Use the commit_message mode
    const promptKey = options.contextTask ? 'generate_with_context' : 'generate';

    const variables: Record<string, string> = {
      files_changed: filesChangedSummary,
      diff_content: diffContent,
    };

    if (options.contextTask) {
      variables.task_description = options.contextTask;
    }
    if (options.contextBranch) {
      variables.branch_name = options.contextBranch;
    }

    const aiResult = await this.aiService!.sendWithMode({
      modeId: 'commit_message',
      promptKey,
      variables,
    });

    if (!aiResult.success || !aiResult.data?.content) {
      throw new Error('AI generation failed');
    }

    // Parse AI response
    const aiMessage = aiResult.data.content.trim();
    const lines = aiMessage.split('\n');
    const subject = lines[0];
    const body = options.includeBody && lines.length > 2
      ? lines.slice(2).join('\n').trim()
      : '';

    // Generate alternatives
    const alternativeMessages = await this.generateAlternatives(diffContent);

    return {
      overallType,
      scope,
      subject,
      body,
      breakingChange: this.detectBreakingChange(filesAnalyzed),
      filesAnalyzed,
      suggestedMessage: body ? `${subject}\n\n${body}` : subject,
      alternativeMessages,
    };
  }

  /**
   * Generate rule-based commit analysis (fallback when AI unavailable)
   */
  private generateRuleBasedAnalysis(
    filesAnalyzed: FileChangeAnalysis[],
    overallType: CommitAnalysis['overallType'],
    scope: string | null,
    options: {
      includeBody: boolean;
    }
  ): CommitAnalysis {
    // Build subject line
    const action = this.getActionVerb(overallType);
    const primaryChange = this.getPrimaryChange(filesAnalyzed);

    const scopePart = scope ? `(${scope})` : '';
    const subject = `${overallType}${scopePart}: ${action} ${primaryChange}`;

    // Build body
    let body = '';
    if (options.includeBody && filesAnalyzed.length > 1) {
      const changes = filesAnalyzed
        .slice(0, 10)
        .map(f => `- ${f.status} ${f.path}: ${f.summary}`)
        .join('\n');

      body = `Changes:\n${changes}`;

      if (filesAnalyzed.length > 10) {
        body += `\n... and ${filesAnalyzed.length - 10} more files`;
      }
    }

    return {
      overallType,
      scope,
      subject,
      body,
      breakingChange: this.detectBreakingChange(filesAnalyzed),
      filesAnalyzed,
      suggestedMessage: body ? `${subject}\n\n${body}` : subject,
      alternativeMessages: [],
    };
  }

  /**
   * Generate alternative commit message suggestions
   */
  private async generateAlternatives(diffContent: string): Promise<string[]> {
    if (!this.aiService) return [];

    try {
      const result = await this.aiService.sendWithMode({
        modeId: 'commit_message',
        promptKey: 'suggest_multiple',
        variables: { diff_content: diffContent.substring(0, 4000) },
      });

      if (result.success && result.data?.content) {
        // Parse the numbered suggestions
        const lines = result.data.content.split('\n').filter(Boolean);
        return lines
          .filter(l => /^\d+\.|^-/.test(l.trim()))
          .map(l => l.replace(/^\d+\.\s*|-\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 3);
      }
    } catch {
      // Ignore errors for alternatives
    }

    return [];
  }

  // Helper methods

  private parseStatusCode(code: string): FileChangeAnalysis['status'] {
    const first = code[0];
    switch (first) {
      case 'A': return 'added';
      case 'D': return 'deleted';
      case 'R': return 'renamed';
      case 'M':
      default: return 'modified';
    }
  }

  private detectChangeType(filePath: string): FileChangeAnalysis['changeType'] {
    for (const { pattern, type } of CHANGE_TYPE_PATTERNS) {
      if (pattern.test(filePath)) {
        return type;
      }
    }
    return 'other';
  }

  private generateFileSummary(
    filePath: string,
    status: string,
    additions: number,
    deletions: number,
    diff: string
  ): string {
    const fileName = path.basename(filePath);

    if (status === 'added') {
      return `new ${this.getFileType(filePath)} file`;
    }
    if (status === 'deleted') {
      return `removed ${fileName}`;
    }

    // Analyze diff content for better summary
    const hasNewFunctions = /^\+\s*(export\s+)?(async\s+)?function\s+\w+/m.test(diff);
    const hasNewClass = /^\+\s*(export\s+)?class\s+\w+/m.test(diff);
    const hasNewInterface = /^\+\s*(export\s+)?interface\s+\w+/m.test(diff);
    const hasImportChanges = /^[+-]\s*import\s+/m.test(diff);
    const hasFixes = /fix|bug|error|issue/i.test(diff);
    const hasRefactor = additions > 10 && deletions > 10;

    if (hasNewClass) return 'added new class';
    if (hasNewInterface) return 'added new interface/type';
    if (hasNewFunctions) return 'added new function(s)';
    if (hasFixes) return 'bug fix';
    if (hasRefactor) return 'refactored code';
    if (hasImportChanges && additions < 5) return 'updated imports';

    return `updated (+${additions}/-${deletions} lines)`;
  }

  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return LANGUAGE_MAP[ext] || 'file';
  }

  private determineOverallType(files: FileChangeAnalysis[]): CommitAnalysis['overallType'] {
    // Count change types
    const typeCounts: Record<string, number> = {};
    for (const file of files) {
      typeCounts[file.changeType] = (typeCounts[file.changeType] || 0) + 1;
    }

    // Priority order for type determination
    if (typeCounts['test'] > files.length / 2) return 'test';
    if (typeCounts['docs'] > files.length / 2) return 'docs';
    if (typeCounts['style'] > files.length / 2) return 'style';
    if (typeCounts['config'] > 0 && files.length <= 3) return 'build';

    // Check for features vs fixes based on diff content
    const hasFixes = files.some(f => /fix|bug|error|issue/i.test(f.diff));
    const hasFeatures = files.some(f =>
      /^\+\s*(export\s+)?(async\s+)?function\s+\w+/m.test(f.diff) ||
      /^\+\s*(export\s+)?class\s+\w+/m.test(f.diff)
    );

    if (hasFixes && !hasFeatures) return 'fix';
    if (hasFeatures) return 'feat';

    // Check for refactoring (similar additions and deletions)
    const totalAdd = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDel = files.reduce((sum, f) => sum + f.deletions, 0);
    if (totalAdd > 20 && totalDel > 20 && Math.abs(totalAdd - totalDel) < totalAdd * 0.3) {
      return 'refactor';
    }

    return 'chore';
  }

  private determineScope(files: FileChangeAnalysis[]): string | null {
    if (files.length === 0) return null;
    if (files.length === 1) {
      // Use directory name for single file
      const dir = path.dirname(files[0].path);
      if (dir && dir !== '.') {
        const parts = dir.split('/');
        return parts[parts.length - 1];
      }
      return null;
    }

    // Find common directory prefix
    const dirs = files.map(f => path.dirname(f.path).split('/'));
    const commonParts: string[] = [];

    for (let i = 0; i < dirs[0].length; i++) {
      const part = dirs[0][i];
      if (dirs.every(d => d[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }

    if (commonParts.length > 0 && commonParts[0] !== '.') {
      return commonParts[commonParts.length - 1];
    }

    return null;
  }

  private detectBreakingChange(files: FileChangeAnalysis[]): boolean {
    return files.some(f =>
      /BREAKING|breaking.?change/i.test(f.diff) ||
      // Major API changes
      /^\-\s*export\s+(interface|type|class|function)/m.test(f.diff)
    );
  }

  private getActionVerb(type: CommitAnalysis['overallType']): string {
    const verbs: Record<string, string> = {
      feat: 'add',
      fix: 'fix',
      docs: 'update',
      style: 'style',
      refactor: 'refactor',
      perf: 'optimize',
      test: 'add tests for',
      build: 'update',
      ci: 'update',
      chore: 'update',
    };
    return verbs[type] || 'update';
  }

  private getPrimaryChange(files: FileChangeAnalysis[]): string {
    if (files.length === 0) return 'files';
    if (files.length === 1) {
      return path.basename(files[0].path);
    }

    // Group by change type
    const byType: Record<string, FileChangeAnalysis[]> = {};
    for (const f of files) {
      byType[f.changeType] = byType[f.changeType] || [];
      byType[f.changeType].push(f);
    }

    // Find dominant type
    const dominantType = Object.entries(byType)
      .sort((a, b) => b[1].length - a[1].length)[0];

    if (dominantType) {
      const [type, typeFiles] = dominantType;
      if (type === 'test') return 'tests';
      if (type === 'docs') return 'documentation';
      if (type === 'config') return 'configuration';

      // Use common scope if available
      const scope = this.determineScope(typeFiles);
      if (scope) return scope;
    }

    // Fallback to file count
    return `${files.length} files`;
  }
}

// Export singleton
export const commitAnalysisService = new CommitAnalysisService();
