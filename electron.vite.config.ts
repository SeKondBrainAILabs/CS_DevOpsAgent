/**
 * Electron-Vite Configuration
 * SeKondBrain Kanvas
 *
 * Features:
 * - Dynamic port allocation: Automatically finds a free port on startup
 * - Falls back to ports 5173-5183 range if preferred port is busy
 */

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import detectPort from 'detect-port';

// Preferred port - will try this first, then find next available
const PREFERRED_PORT = 5173;

export default defineConfig(async () => {
  // Find an available port starting from PREFERRED_PORT
  const availablePort = await detectPort(PREFERRED_PORT);

  if (availablePort !== PREFERRED_PORT) {
    console.log(`[Kanvas] Port ${PREFERRED_PORT} is busy, using port ${availablePort}`);
  } else {
    console.log(`[Kanvas] Using port ${availablePort}`);
  }

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'dist/electron',
        lib: {
          entry: 'electron/index.ts',
        },
      },
      resolve: {
        alias: {
          '@shared': resolve(__dirname, 'shared'),
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: 'dist/preload',
        lib: {
          entry: 'electron/preload.ts',
        },
      },
      resolve: {
        alias: {
          '@shared': resolve(__dirname, 'shared'),
        },
      },
    },
    renderer: {
      plugins: [react()],
      root: '.',
      build: {
        outDir: 'dist/renderer',
        rollupOptions: {
          input: 'index.html',
        },
      },
      resolve: {
        alias: {
          '@': resolve(__dirname, 'renderer'),
          '@shared': resolve(__dirname, 'shared'),
        },
      },
      server: {
        port: availablePort,
        strictPort: false, // Allow fallback to next available port
      },
    },
  };
});
