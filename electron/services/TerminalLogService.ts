/**
 * Terminal Log Service
 * Centralized logging for terminal view - captures git commands, system events, etc.
 */

import { BaseService } from './BaseService';
import { IPC } from '../../shared/ipc-channels';
import type { TerminalLogEntry, TerminalLogLevel, IpcResult } from '../../shared/types';
import { randomUUID } from 'crypto';

const MAX_LOGS = 1000;

export class TerminalLogService extends BaseService {
  private logs: TerminalLogEntry[] = [];
  private sessionLogs: Map<string, TerminalLogEntry[]> = new Map();

  /**
   * Log a terminal entry and emit to renderer
   */
  log(
    level: TerminalLogLevel,
    message: string,
    options: {
      sessionId?: string;
      source?: string;
      command?: string;
      output?: string;
      exitCode?: number;
      duration?: number;
    } = {}
  ): void {
    const entry: TerminalLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options,
    };

    // Add to global logs
    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    // Add to session-specific logs if sessionId provided
    if (options.sessionId) {
      const sessionLogs = this.sessionLogs.get(options.sessionId) || [];
      sessionLogs.unshift(entry);
      if (sessionLogs.length > MAX_LOGS) {
        sessionLogs.splice(MAX_LOGS);
      }
      this.sessionLogs.set(options.sessionId, sessionLogs);
    }

    // Emit to renderer
    this.emitToRenderer(IPC.TERMINAL_LOG, entry);
  }

  /**
   * Log a git command with its output
   */
  logGitCommand(
    command: string,
    args: string[],
    options: {
      sessionId?: string;
      cwd?: string;
      output?: string;
      exitCode?: number;
      duration?: number;
      error?: string;
    } = {}
  ): void {
    const fullCommand = `git ${args.join(' ')}`;
    const level: TerminalLogLevel = options.exitCode !== 0 ? 'error' : 'git';

    this.log(level, options.error || `$ ${fullCommand}`, {
      sessionId: options.sessionId,
      source: 'GitService',
      command: fullCommand,
      output: options.output,
      exitCode: options.exitCode ?? 0,
      duration: options.duration,
    });
  }

  /**
   * Log a system event
   */
  logSystem(message: string, sessionId?: string): void {
    this.log('system', message, { sessionId, source: 'System' });
  }

  /**
   * Log debug information
   */
  debug(message: string, sessionId?: string, source?: string): void {
    this.log('debug', message, { sessionId, source });
  }

  /**
   * Log info message
   */
  info(message: string, sessionId?: string, source?: string): void {
    this.log('info', message, { sessionId, source });
  }

  /**
   * Log warning
   */
  warn(message: string, sessionId?: string, source?: string): void {
    this.log('warn', message, { sessionId, source });
  }

  /**
   * Log error
   */
  error(message: string, sessionId?: string, source?: string): void {
    this.log('error', message, { sessionId, source });
  }

  /**
   * Get logs for a session
   */
  getLogs(sessionId?: string, limit = 100): IpcResult<TerminalLogEntry[]> {
    if (sessionId) {
      const sessionLogs = this.sessionLogs.get(sessionId) || [];
      return this.success(sessionLogs.slice(0, limit));
    }
    return this.success(this.logs.slice(0, limit));
  }

  /**
   * Clear logs for a session or all logs
   */
  clearLogs(sessionId?: string): IpcResult<void> {
    if (sessionId) {
      this.sessionLogs.delete(sessionId);
    } else {
      this.logs = [];
      this.sessionLogs.clear();
    }
    return this.success(undefined);
  }

  /**
   * Get all logs (for terminal view)
   */
  getAllLogs(): TerminalLogEntry[] {
    return this.logs;
  }
}
