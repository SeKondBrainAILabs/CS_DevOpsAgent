/**
 * electron-builder afterPack hook.
 *
 * Re-signs the entire app bundle with an ad-hoc identity after packing so
 * every binary inside (including the Electron Framework) shares the same
 * empty Team ID.  Without this step macOS rejects the app at launch with:
 *   "mapping process and mapped file (non-platform) have different Team IDs"
 *
 * Runs on macOS only; no-ops silently on other platforms.
 */

const { execSync } = require('child_process');
const path = require('path');

module.exports = async function afterPack(context) {
  if (process.platform !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`[afterPack] Ad-hoc re-signing: ${appPath}`);
  execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' });
  console.log('[afterPack] Re-sign complete.');
};
