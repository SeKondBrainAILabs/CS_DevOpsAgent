/**
 * AutoUpdateService
 * Handles app auto-updates via direct GitHub Releases API check.
 * Does NOT use electron's native autoUpdater (Squirrel.Mac) because that
 * requires a Developer ID code signature. Instead we fetch latest-mac.yml
 * directly and open the releases page for the user to install manually.
 */

import { BrowserWindow, app, shell } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { AppUpdateInfo } from '../../shared/types';
import https from 'https';

const OWNER = 'SeKondBrainAILabs';
const REPO = 'DevOps-Agent-KIT';

export class AutoUpdateService {
  private mainWindow: BrowserWindow | null = null;
  private status: AppUpdateInfo;

  constructor() {
    this.status = {
      currentVersion: app.getVersion(),
      updateAvailable: false,
      downloading: false,
      downloaded: false,
    };
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  /**
   * Initialize — no-op now since we don't use native autoUpdater events.
   * Kept for API compatibility.
   */
  initialize(): void {
    if (!app.isPackaged) {
      console.log('[AutoUpdate] Skipping auto-updater setup in development mode');
    }
  }

  /**
   * Check for available updates by fetching latest-mac.yml directly from GitHub.
   * Works without code signing, no Squirrel.Mac involved.
   */
  async checkForUpdates(): Promise<AppUpdateInfo> {
    if (!app.isPackaged) {
      return { ...this.status };
    }

    try {
      this.status.error = undefined;
      const latestVersion = await this.fetchLatestVersion();
      if (!latestVersion) {
        return { ...this.status };
      }

      const current = app.getVersion();
      if (this.isNewer(latestVersion, current)) {
        console.log(`[AutoUpdate] Update available: ${current} → ${latestVersion}`);
        this.status.updateAvailable = true;
        this.status.latestVersion = latestVersion;
        this.sendToRenderer(IPC.UPDATE_AVAILABLE, this.status);
      } else {
        console.log(`[AutoUpdate] Up to date: ${current}`);
        this.status.updateAvailable = false;
        this.status.latestVersion = latestVersion;
        this.sendToRenderer(IPC.UPDATE_NOT_AVAILABLE, this.status);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AutoUpdate] Check failed:', msg);
      this.status.error = msg;
      this.sendToRenderer(IPC.UPDATE_ERROR, this.status);
    }

    return { ...this.status };
  }

  /**
   * "Download" — for non-signed builds, we just mark as ready immediately
   * and open the releases page on install. This keeps the UI flow intact.
   */
  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) return;
    // Mark as downloaded so the pill switches to "Restart to update"
    this.status.downloading = false;
    this.status.downloaded = true;
    this.sendToRenderer(IPC.UPDATE_DOWNLOADED, this.status);
  }

  /**
   * Open the GitHub releases page so the user can download and install manually.
   */
  installUpdate(): void {
    if (!app.isPackaged) return;
    const version = this.status.latestVersion;
    const releaseUrl = version
      ? `https://github.com/${OWNER}/${REPO}/releases/tag/v${version}`
      : `https://github.com/${OWNER}/${REPO}/releases/latest`;
    console.log('[AutoUpdate] Opening release page:', releaseUrl);
    shell.openExternal(releaseUrl);
  }

  /**
   * Return the current update status snapshot.
   */
  getStatus(): AppUpdateInfo {
    return { ...this.status };
  }

  // ---------------------------------------------------------------------------

  private fetchLatestVersion(): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const url = `https://github.com/${OWNER}/${REPO}/releases/latest/download/latest-mac.yml`;
      const req = https.get(url, {
        headers: { 'User-Agent': `KanvasForKit/${app.getVersion()}` },
      }, (res) => {
        // Follow redirect (GitHub issues 302 for /latest/download/)
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (!location) { resolve(null); return; }
          https.get(location, { headers: { 'User-Agent': `KanvasForKit/${app.getVersion()}` } }, (res2) => {
            this.readBody(res2).then((body) => resolve(this.parseVersion(body))).catch(reject);
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) { resolve(null); return; }
        this.readBody(res).then((body) => resolve(this.parseVersion(body))).catch(reject);
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('Update check timed out')); });
    });
  }

  private readBody(res: import('http').IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  }

  private parseVersion(yml: string): string | null {
    const match = yml.match(/^version:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  }

  /** Compare semver: returns true if candidate > current */
  private isNewer(candidate: string, current: string): boolean {
    const parse = (v: string) => v.split('.').map(Number);
    const [ca, cb, cc] = parse(candidate);
    const [ra, rb, rc] = parse(current);
    if (ca !== ra) return ca > ra;
    if (cb !== rb) return cb > rb;
    return cc > rc;
  }

  private sendToRenderer(channel: string, data: AppUpdateInfo): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
