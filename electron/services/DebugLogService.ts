/**
 * Debug Log Service
 * Provides file-based + in-memory logging for debugging and error reporting
 * Users can export logs from Settings for troubleshooting
 */

import { BaseService } from './BaseService';
import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import type { IpcResult } from '../../shared/types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  details?: unknown;
}

export interface DebugLogExport {
  exportedAt: string;
  appVersion: string;
  platform: string;
  entries: LogEntry[];
}

// Ring buffer size for in-memory logs
const MEMORY_BUFFER_SIZE = 500;
// Max file size before rotation (5MB)
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024;
// Keep last N rotated files
const MAX_ROTATED_FILES = 3;

export class DebugLogService extends BaseService {
  private memoryBuffer: LogEntry[] = [];
  private logFilePath: string;
  private logDir: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private isInitialized = false;

  constructor() {
    super();
    // Use app data directory for logs
    this.logDir = path.join(app.getPath('userData'), 'logs');
    this.logFilePath = path.join(this.logDir, 'debug.log');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.logDir, { recursive: true });

      // Check if we need to rotate the log file
      await this.rotateIfNeeded();

      this.isInitialized = true;
      this.info('DebugLogService', 'Debug logging initialized', { logDir: this.logDir });
    } catch (error) {
      console.error('[DebugLogService] Failed to initialize:', error);
    }
  }

  // ==========================================================================
  // LOGGING METHODS
  // ==========================================================================

  debug(source: string, message: string, details?: unknown): void {
    this.log('debug', source, message, details);
  }

  info(source: string, message: string, details?: unknown): void {
    this.log('info', source, message, details);
  }

  warn(source: string, message: string, details?: unknown): void {
    this.log('warn', source, message, details);
  }

  error(source: string, message: string, details?: unknown): void {
    this.log('error', source, message, details);
  }

  private log(level: LogLevel, source: string, message: string, details?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      details: details !== undefined ? this.sanitizeDetails(details) : undefined,
    };

    // Add to memory buffer (ring buffer)
    this.memoryBuffer.push(entry);
    if (this.memoryBuffer.length > MEMORY_BUFFER_SIZE) {
      this.memoryBuffer.shift();
    }

    // Write to file asynchronously
    if (this.isInitialized) {
      this.writeToFile(entry);
    }

    // Also log to console in development
    const consoleMsg = `[${entry.source}] ${entry.message}`;
    switch (level) {
      case 'debug':
        console.debug(consoleMsg, details || '');
        break;
      case 'info':
        console.info(consoleMsg, details || '');
        break;
      case 'warn':
        console.warn(consoleMsg, details || '');
        break;
      case 'error':
        console.error(consoleMsg, details || '');
        break;
    }
  }

  private sanitizeDetails(details: unknown): unknown {
    // Remove sensitive data from logs
    if (typeof details === 'object' && details !== null) {
      const sanitized = { ...details as Record<string, unknown> };
      const sensitiveKeys = ['password', 'apiKey', 'api_key', 'token', 'secret', 'credential'];
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    return details;
  }

  private writeToFile(entry: LogEntry): void {
    // Queue writes to avoid race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        const line = JSON.stringify(entry) + '\n';
        await fs.appendFile(this.logFilePath, line, 'utf-8');
      } catch (error) {
        console.error('[DebugLogService] Failed to write to file:', error);
      }
    });
  }

  // ==========================================================================
  // LOG RETRIEVAL
  // ==========================================================================

  /**
   * Get recent logs from memory buffer
   */
  getRecentLogs(count = 100, level?: LogLevel): IpcResult<LogEntry[]> {
    try {
      let logs = [...this.memoryBuffer];

      if (level) {
        logs = logs.filter(l => l.level === level);
      }

      // Return most recent first
      return this.success(logs.slice(-count).reverse());
    } catch (error) {
      return this.error('DEBUG_LOG_GET_FAILED', 'Failed to get logs');
    }
  }

  /**
   * Get all logs from file (for export)
   */
  async getFileLogsAsync(maxLines = 1000): Promise<IpcResult<LogEntry[]>> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8').catch(() => '');
      const lines = content.trim().split('\n').filter(l => l);

      // Parse and return last N lines
      const entries: LogEntry[] = [];
      const startIndex = Math.max(0, lines.length - maxLines);

      for (let i = startIndex; i < lines.length; i++) {
        try {
          entries.push(JSON.parse(lines[i]));
        } catch {
          // Skip malformed lines
        }
      }

      return this.success(entries);
    } catch (error) {
      return this.error('DEBUG_LOG_FILE_READ_FAILED', 'Failed to read log file');
    }
  }

  /**
   * Export logs as JSON for sharing
   */
  async exportLogs(): Promise<IpcResult<DebugLogExport>> {
    try {
      const fileLogs = await this.getFileLogsAsync(2000);
      const entries = fileLogs.success ? fileLogs.data || [] : this.memoryBuffer;

      const exportData: DebugLogExport = {
        exportedAt: new Date().toISOString(),
        appVersion: app.getVersion(),
        platform: `${process.platform} ${process.arch}`,
        entries,
      };

      return this.success(exportData);
    } catch (error) {
      return this.error('DEBUG_LOG_EXPORT_FAILED', 'Failed to export logs');
    }
  }

  /**
   * Get the path to the log file
   */
  getLogFilePath(): IpcResult<string> {
    return this.success(this.logFilePath);
  }

  /**
   * Get log directory path
   */
  getLogDirectory(): IpcResult<string> {
    return this.success(this.logDir);
  }

  // ==========================================================================
  // LOG MANAGEMENT
  // ==========================================================================

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<IpcResult<void>> {
    try {
      this.memoryBuffer = [];
      await fs.writeFile(this.logFilePath, '', 'utf-8');
      this.info('DebugLogService', 'Logs cleared');
      return this.success(undefined);
    } catch (error) {
      return this.error('DEBUG_LOG_CLEAR_FAILED', 'Failed to clear logs');
    }
  }

  /**
   * Rotate log file if it's too large
   */
  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logFilePath).catch(() => null);

      if (stats && stats.size > MAX_LOG_FILE_SIZE) {
        // Rotate existing files
        for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
          const oldPath = path.join(this.logDir, `debug.${i}.log`);
          const newPath = path.join(this.logDir, `debug.${i + 1}.log`);
          await fs.rename(oldPath, newPath).catch(() => {});
        }

        // Move current to .1
        const rotatedPath = path.join(this.logDir, 'debug.1.log');
        await fs.rename(this.logFilePath, rotatedPath).catch(() => {});

        // Create fresh log file
        await fs.writeFile(this.logFilePath, '', 'utf-8');
      }
    } catch (error) {
      console.error('[DebugLogService] Failed to rotate logs:', error);
    }
  }

  /**
   * Get log file stats
   */
  async getLogStats(): Promise<IpcResult<{
    memoryEntries: number;
    fileSize: number;
    rotatedFiles: number;
  }>> {
    try {
      const stats = await fs.stat(this.logFilePath).catch(() => ({ size: 0 }));

      // Count rotated files
      let rotatedFiles = 0;
      for (let i = 1; i <= MAX_ROTATED_FILES; i++) {
        const rotatedPath = path.join(this.logDir, `debug.${i}.log`);
        const exists = await fs.stat(rotatedPath).catch(() => null);
        if (exists) rotatedFiles++;
      }

      return this.success({
        memoryEntries: this.memoryBuffer.length,
        fileSize: stats.size,
        rotatedFiles,
      });
    } catch (error) {
      return this.error('DEBUG_LOG_STATS_FAILED', 'Failed to get log stats');
    }
  }
}
