/**
 * VersionService
 * Manages repo-level version reading, bumping, and auto-bump settings.
 * Inlines version-utils logic as TypeScript to avoid ESM/CJS import issues.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaseService } from './BaseService';
import { databaseService } from './DatabaseService';
import type { IpcResult, RepoVersionInfo, RepoVersionSettings } from '../../shared/types';

function parseVersion(versionStr: string | undefined): { major: number; minor: number; patch: number } {
  if (!versionStr || typeof versionStr !== 'string') {
    return { major: 0, minor: 0, patch: 0 };
  }
  const parts = versionStr.trim().split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    return { major: 0, minor: 0, patch: 0 };
  }
  return { major, minor, patch };
}

function bumpPackageVersion(repoRoot: string, component: 'major' | 'minor' | 'patch'): string | null {
  try {
    const pkgPath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return null;
    }
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const current = parseVersion(pkg.version);

    let newVersion: string;
    switch (component) {
      case 'major':
        newVersion = `${current.major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${current.major}.${current.minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${current.major}.${current.minor}.${current.patch + 1}`;
        break;
      default:
        return null;
    }

    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(`[VersionService] Bumped version: ${current.major}.${current.minor}.${current.patch} -> ${newVersion} (${component})`);
    return newVersion;
  } catch (err) {
    console.error('[VersionService] Failed to bump version:', err);
    return null;
  }
}

export class VersionService extends BaseService {
  /**
   * Read the current version from a repo's package.json
   */
  getRepoVersion(repoPath: string): IpcResult<RepoVersionInfo> {
    try {
      const pkgPath = path.join(repoPath, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        return this.error('NO_PACKAGE_JSON', 'No package.json found');
      }
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      const parsed = parseVersion(pkg.version);
      return this.success({
        version: pkg.version || '0.0.0',
        ...parsed,
      });
    } catch (err) {
      return this.error('READ_FAILED', err instanceof Error ? err.message : 'Failed to read version');
    }
  }

  /**
   * Bump a version component and return the new version info
   */
  bumpVersion(repoPath: string, component: 'major' | 'minor' | 'patch'): IpcResult<RepoVersionInfo> {
    const newVersion = bumpPackageVersion(repoPath, component);
    if (!newVersion) {
      return this.error('BUMP_FAILED', `Failed to bump ${component} version`);
    }
    const parsed = parseVersion(newVersion);
    return this.success({
      version: newVersion,
      ...parsed,
    });
  }

  /**
   * Get per-repo version settings (auto-bump toggle, etc.)
   */
  getSettings(repoPath: string): IpcResult<RepoVersionSettings> {
    const key = `version_settings:${repoPath}`;
    const settings = databaseService.getSetting<RepoVersionSettings>(key, { autoVersionBump: true });
    return this.success(settings);
  }

  /**
   * Persist per-repo version settings
   */
  setSettings(repoPath: string, settings: RepoVersionSettings): IpcResult<void> {
    const key = `version_settings:${repoPath}`;
    databaseService.setSetting(key, settings);
    return this.success(undefined);
  }
}
