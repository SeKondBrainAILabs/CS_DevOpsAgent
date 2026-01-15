/**
 * Type declarations for Electron API exposed via preload
 */

import type { ElectronAPI } from '../../electron/preload';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
