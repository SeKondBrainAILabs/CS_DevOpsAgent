/**
 * Quick Action Service
 * Handles opening terminal, VS Code, Finder, and clipboard operations
 */

import { BaseService } from './BaseService';
import { shell, clipboard } from 'electron';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import type { IpcResult } from '../../shared/types';

export class QuickActionService extends BaseService {
  /**
   * Open terminal at the specified path
   * macOS: Opens Terminal.app or iTerm2 if available
   */
  async openTerminal(dirPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      if (!existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const platform = process.platform;

      if (platform === 'darwin') {
        // macOS - Try iTerm2 first, fall back to Terminal
        try {
          // Check if iTerm2 is installed
          const iterm = '/Applications/iTerm.app';
          if (existsSync(iterm)) {
            spawn('open', ['-a', 'iTerm', dirPath], { detached: true });
          } else {
            spawn('open', ['-a', 'Terminal', dirPath], { detached: true });
          }
        } catch {
          // Fallback to basic open
          spawn('open', ['-a', 'Terminal', dirPath], { detached: true });
        }
      } else if (platform === 'win32') {
        // Windows - Open cmd or PowerShell
        spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', `cd /d "${dirPath}"`], {
          detached: true,
          shell: true,
        });
      } else {
        // Linux - Try common terminal emulators
        const terminals = ['gnome-terminal', 'konsole', 'xterm', 'x-terminal-emulator'];
        for (const term of terminals) {
          try {
            spawn(term, ['--working-directory', dirPath], { detached: true });
            return;
          } catch {
            continue;
          }
        }
        throw new Error('No terminal emulator found');
      }
    }, 'OPEN_TERMINAL_FAILED');
  }

  /**
   * Open VS Code at the specified path
   */
  async openVSCode(dirPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      if (!existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      const platform = process.platform;

      try {
        if (platform === 'darwin') {
          // macOS - Use 'code' CLI command
          spawn('code', [dirPath], { detached: true, stdio: 'ignore' });
        } else if (platform === 'win32') {
          // Windows - Use 'code' or 'code.cmd'
          spawn('code', [dirPath], { detached: true, shell: true, stdio: 'ignore' });
        } else {
          // Linux
          spawn('code', [dirPath], { detached: true, stdio: 'ignore' });
        }
      } catch (error) {
        // Try VS Code Insiders if regular VS Code fails
        try {
          spawn('code-insiders', [dirPath], { detached: true, stdio: 'ignore' });
        } catch {
          throw new Error(
            'VS Code not found. Please install VS Code and ensure the "code" command is in your PATH.'
          );
        }
      }
    }, 'OPEN_VSCODE_FAILED');
  }

  /**
   * Open Finder/Explorer at the specified path
   */
  async openFinder(dirPath: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      if (!existsSync(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }

      // Use Electron's shell API to show item in folder
      shell.showItemInFolder(dirPath);
    }, 'OPEN_FINDER_FAILED');
  }

  /**
   * Copy path to clipboard
   */
  async copyPath(pathToCopy: string): Promise<IpcResult<void>> {
    return this.wrap(async () => {
      clipboard.writeText(pathToCopy);
    }, 'COPY_PATH_FAILED');
  }
}
