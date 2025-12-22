import fs from 'fs';
import path from 'path';

export class ConfigService {
  constructor(repoRoot) {
    this.repoRoot = repoRoot;
    
    // Store user settings in home directory for cross-project usage
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    this.globalSettingsDir = path.join(homeDir, '.devops-agent');
    this.globalSettingsPath = path.join(this.globalSettingsDir, 'settings.json');
    
    // Store project-specific settings in local_deploy
    this.projectSettingsPath = path.join(this.repoRoot, 'local_deploy', 'project-settings.json');
    
    this.ensureDirectories();
    this.ensureSettingsFile();
  }

  ensureDirectories() {
     if (!fs.existsSync(this.globalSettingsDir)) {
      fs.mkdirSync(this.globalSettingsDir, { recursive: true });
    }
  }

  ensureSettingsFile() {
    // Create global settings if not exists
    if (!fs.existsSync(this.globalSettingsPath)) {
      const defaultGlobalSettings = {
        developerInitials: "",
        email: "",
        preferences: {
          defaultTargetBranch: "main",
          pushOnCommit: true,
          verboseLogging: false
        },
        configured: false
      };
      fs.writeFileSync(this.globalSettingsPath, JSON.stringify(defaultGlobalSettings, null, 2));
    }
    
    // Create project settings if not exists
    if (!fs.existsSync(this.projectSettingsPath)) {
      const defaultProjectSettings = {
        versioningStrategy: {
          prefix: "v0.",
          startMinor: 20,
          configured: false
        },
        autoMergeConfig: {
          enabled: false,
          targetBranch: "main",
          strategy: "pull-request"
        }
      };
      const projectDir = path.dirname(this.projectSettingsPath);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      fs.writeFileSync(this.projectSettingsPath, JSON.stringify(defaultProjectSettings, null, 2));
    }
  }

  loadGlobalSettings() {
    if (fs.existsSync(this.globalSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.globalSettingsPath, 'utf8'));
    }
    return {
      developerInitials: "",
      email: "",
      preferences: {},
      configured: false
    };
  }

  loadProjectSettings() {
    if (fs.existsSync(this.projectSettingsPath)) {
      return JSON.parse(fs.readFileSync(this.projectSettingsPath, 'utf8'));
    }
    return {
      versioningStrategy: {
        prefix: "v0.",
        startMinor: 20,
        configured: false
      },
      autoMergeConfig: {}
    };
  }

  loadSettings() {
    const global = this.loadGlobalSettings();
    const project = this.loadProjectSettings();
    return {
      ...global,
      ...project,
      developerInitials: global.developerInitials,
      configured: global.configured
    };
  }

  saveGlobalSettings(settings) {
    fs.writeFileSync(this.globalSettingsPath, JSON.stringify(settings, null, 2));
    return this.globalSettingsPath;
  }

  saveProjectSettings(settings) {
    const projectDir = path.dirname(this.projectSettingsPath);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    fs.writeFileSync(this.projectSettingsPath, JSON.stringify(settings, null, 2));
    return this.projectSettingsPath;
  }

  saveSettings(settings) {
    // Split settings into global and project
    const globalSettings = {
      developerInitials: settings.developerInitials,
      email: settings.email || "",
      preferences: settings.preferences || {},
      configured: settings.configured,
      lastUpdateCheck: settings.lastUpdateCheck,
      groqApiKeyConfigured: settings.groqApiKeyConfigured
    };
    
    const projectSettings = {
      versioningStrategy: settings.versioningStrategy,
      autoMergeConfig: settings.autoMergeConfig || {},
      dockerConfig: settings.dockerConfig
    };
    
    this.saveGlobalSettings(globalSettings);
    this.saveProjectSettings(projectSettings);
  }
}
