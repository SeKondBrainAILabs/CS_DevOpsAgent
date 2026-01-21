/**
 * Electron Main Process Entry Point
 * SeKondBrain Kanvas - Desktop DevOps Agent
 */

import { app, BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { registerIpcHandlers, removeIpcHandlers } from './ipc';
import { initializeServices, disposeServices, type Services } from './services';
import { agentInstanceService } from './services/AgentInstanceService';
import { IPC } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;
let services: Services | null = null;

/**
 * Check for orphaned sessions and notify the renderer
 */
async function checkForOrphanedSessions(svc: Services | null): Promise<void> {
  if (!svc || !mainWindow) return;

  try {
    const result = await svc.sessionRecovery.scanAllReposForSessions();
    if (result.success && result.data && result.data.length > 0) {
      console.log(`[Recovery] Found ${result.data.length} orphaned session(s)`);
      mainWindow.webContents.send(IPC.ORPHANED_SESSIONS_FOUND, result.data);

      // Also log to terminal
      svc.terminalLog.warn(
        `Found ${result.data.length} orphaned session(s) that may need recovery`,
        undefined,
        'Recovery'
      );
    }
  } catch (error) {
    console.error('[Recovery] Error scanning for orphaned sessions:', error);
  }
}

async function createWindow(): Promise<void> {
  const iconPath = join(__dirname, '../../resources/icon.png');

  console.log('Creating BrowserWindow...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#1a1a2e',
    show: true,
  });

  console.log('BrowserWindow created');

  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }

  // Initialize services
  try {
    console.log('Initializing services...');
    services = await initializeServices(mainWindow);
    registerIpcHandlers(services, mainWindow);
    console.log('Services initialized');
  } catch (error) {
    console.error('Service init error:', error);
  }

  // Handle load failures
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Page load failed:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    console.log('Page loaded successfully');
    // Emit stored sessions after a short delay to ensure React has mounted
    setTimeout(() => {
      agentInstanceService.emitStoredSessions();
    }, 500);

    // Check for orphaned sessions after a longer delay
    setTimeout(async () => {
      await checkForOrphanedSessions(services);
    }, 1500);
  });

  // Load the app
  // In development, electron-vite sets ELECTRON_RENDERER_URL to the dev server URL
  // In production, we load the built index.html from disk
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;

  try {
    if (devServerUrl) {
      console.log('ELECTRON_RENDERER_URL:', devServerUrl);
      console.log('Loading dev URL:', devServerUrl);
      await mainWindow.loadURL(devServerUrl);
    } else {
      const indexHtmlPath = join(__dirname, '../renderer/index.html');
      console.log('ELECTRON_RENDERER_URL not set, loading file:', indexHtmlPath);
      await mainWindow.loadFile(indexHtmlPath);
    }
    console.log('Main window load completed');
  } catch (error) {
    console.error('Error loading main window:', error);
  }

  // Open DevTools only when explicitly requested (Cmd+Option+I)
  // Uncomment below line to auto-open DevTools in development
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle events
app.whenReady().then(async () => {
  await createWindow();

  // macOS: recreate window when dock icon is clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

// Handle second instance (focus existing window)
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  removeIpcHandlers();
  await disposeServices();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
