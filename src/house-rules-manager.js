/**
 * House Rules Version Manager
 * ============================
 * 
 * Manages versioning and updates of DevOps Agent sections in house rules.
 * Allows intelligent updates while preserving user customizations.
 * 
 * Each managed section includes:
 * - Version marker: <!-- DEVOPS_AGENT_SECTION:name:version:checksum -->
 * - Content checksum for change detection
 * - End marker: <!-- END_DEVOPS_AGENT_SECTION:name -->
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Version of our house rules sections
const HOUSERULES_VERSION = '1.3.0';

// Managed sections with their content
const MANAGED_SECTIONS = {
  'file-coordination': {
    version: '1.3.0',
    title: '## 🚨 CRITICAL: File Coordination Protocol (MUST FOLLOW)',
    content: `**IMPORTANT: Always check the house rules at the beginning of each session!**

To prevent conflicts with other agents editing the same files, you MUST follow this protocol:

### Before Editing ANY Files:

1. **DECLARE YOUR INTENT FIRST**
   Create a file at \`.file-coordination/active-edits/<your-name>-<session>.json\` with:
   \`\`\`json
   {
     "agent": "<your-name>",
     "session": "<session-id>",
     "files": ["list", "of", "files", "you", "will", "edit"],
     "operation": "edit",
     "reason": "Brief description of what you're doing",
     "declaredAt": "<current-ISO-8601-timestamp>",
     "estimatedDuration": 300
   }
   \`\`\`

2. **CHECK FOR CONFLICTS**
   - Read ALL files in \`.file-coordination/active-edits/\`
   - If ANY other agent has declared the same files, you must:
     - WAIT for them to finish, OR
     - Choose different files to edit

3. **ONLY EDIT DECLARED FILES**
   - Never edit files you haven't declared
   - Stay within your declared scope

4. **RELEASE WHEN DONE**
   - Delete your declaration file after completing edits
   - Or move it to \`.file-coordination/completed-edits/\`

### If You Detect a Conflict:
- DO NOT proceed with edits
- Report the conflict to the user
- Wait or choose alternative files

        ### Helper Scripts Available:
        - \`./scripts/coordination/check-file-availability.sh <files>\` - Check if files are available
        - \`./scripts/coordination/declare-file-edits.sh <agent> <session> <files>\` - Declare your intent
        - \`./scripts/coordination/release-file-edits.sh <agent> <session>\` - Release files after editing

**This coordination prevents wasted work and merge conflicts!**`
  },
  'core-principles': {
    version: '1.0.0',
    title: '## Core Principles',
    content: `1. **Always preserve existing functionality** - Never break working code
2. **Follow existing patterns** - Match the codebase style and conventions
3. **Communicate clearly** - Document your changes and reasoning
4. **Coordinate with others** - Follow the file coordination protocol below`
  },
  'project-conventions': {
    version: '1.0.0',
    title: '## Project Conventions',
    content: `### Code Style
- Follow existing indentation and formatting patterns
- Maintain consistent naming conventions used in the project
- Keep functions small and focused
- Write clear, descriptive variable and function names

### Git Workflow
- Write clear, descriptive commit messages
- Follow conventional commit format when applicable (feat:, fix:, docs:, etc.)
- Keep commits atomic and focused on a single change
- Never commit sensitive information or credentials

### Testing
- Write tests for new functionality
- Ensure existing tests pass before committing
- Update tests when changing functionality

### Documentation
- Update README files when adding new features
- Document complex logic with clear comments
- Keep API documentation up to date
- Update CHANGELOG for significant changes`
  }
};

class HouseRulesManager {
  constructor(projectRoot) {
    const cwd = projectRoot || process.cwd();
    
    // If we're running from within a DevOpsAgent directory, we need to find the parent project
    if (cwd.includes('/DevOpsAgent') || cwd.includes('/CS_DevOpsAgent')) {
      // Parse the path to find where the DevOpsAgent directory is
      const pathParts = cwd.split(path.sep);
      
      // Find the index of DevOpsAgent or CS_DevOpsAgent
      let targetIndex = -1;
      for (let i = pathParts.length - 1; i >= 0; i--) {
        if (pathParts[i] === 'CS_DevOpsAgent' || pathParts[i] === 'DevOpsAgent') {
          targetIndex = i;
          break;
        }
      }
      
      // If found, use the parent directory as the project root
      if (targetIndex > 0) {
        // Check if the parent directory is 'Scripts_Dev' or similar subdirectory
        // If so, go up one more level to reach the actual project root
        let parentIndex = targetIndex;
        if (targetIndex > 1 && (pathParts[targetIndex - 1] === 'Scripts_Dev' || 
                                pathParts[targetIndex - 1] === 'scripts' || 
                                pathParts[targetIndex - 1] === 'tools')) {
          parentIndex = targetIndex - 1;
        }
        this.projectRoot = pathParts.slice(0, parentIndex).join(path.sep);
      } else {
        // Fallback: try to use git to find the parent repo
        try {
          const gitRoot = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf8' }).trim();
          // Only use git root if it's not a DevOpsAgent directory
          if (!gitRoot.includes('/DevOpsAgent') && !gitRoot.includes('/CS_DevOpsAgent')) {
            this.projectRoot = gitRoot;
          } else {
            // Use parent of cwd
            this.projectRoot = path.dirname(path.dirname(cwd));
          }
        } catch (err) {
          // Default to parent of parent directory
          this.projectRoot = path.dirname(path.dirname(cwd));
        }
      }
    } else {
      this.projectRoot = cwd;
    }
    
    this.houseRulesPath = null;
    this.findHouseRulesFile();
  }

  /**
   * Find existing house rules file
   * STRICT MODE: Only searches in the project root
   */
  findHouseRulesFile() {
    // Standard locations in root only
    const possiblePaths = [
      'houserules.md',
      'HOUSERULES.md',
      '.github/HOUSERULES.md',
      'docs/houserules.md',
      'docs/HOUSERULES.md'
    ];

    for (const relativePath of possiblePaths) {
      const fullPath = path.join(this.projectRoot, relativePath);
      if (fs.existsSync(fullPath)) {
        // NEVER use house rules from within DevOpsAgent directories
        if (fullPath.includes('/DevOpsAgent/') || fullPath.includes('/CS_DevOpsAgent/')) {
          continue;
        }
        
        this.houseRulesPath = fullPath;
        // Only log if not running as CLI
        if (!process.argv[1]?.endsWith('house-rules-manager.js')) {
          console.log(`Found house rules at: ${fullPath}`);
        }
        return fullPath;
      }
    }

    // STRICT MODE: Do not search recursively.
    // If not found in root, return null.
    return null;
  }

  /**
   * Recursively search for house rules files
   * @param {string} dir Directory to search
   * @param {number} depth Current depth (to prevent infinite recursion)
   * @returns {string|null} Path to house rules file or null
   */
  searchForHouseRules(dir, depth = 0) {
    // Limit search depth to prevent excessive recursion
    if (depth > 5) return null;

    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        // Check if it's a house rules file
        if (stat.isFile() && /^houserules\.md$/i.test(file)) {
          // Skip if it's in a DevOps agent directory
          if (!filePath.includes('DevOpsAgent') && 
              !filePath.includes('CS_DevOpsAgent') &&
              !filePath.includes('node_modules') &&
              !filePath.includes('.git')) {
            return filePath;
          }
        }
        
        // Recursively search subdirectories
        if (stat.isDirectory() && 
            !file.startsWith('.') && 
            file !== 'node_modules' && 
            file !== 'DevOpsAgent' &&
            file !== 'CS_DevOpsAgent' &&
            file !== '.git') {
          const found = this.searchForHouseRules(filePath, depth + 1);
          if (found) return found;
        }
      }
    } catch (err) {
      // Ignore permission errors and continue searching
      if (err.code !== 'EACCES' && err.code !== 'EPERM') {
        console.error(`Error searching ${dir}:`, err.message);
      }
    }
    
    return null;
  }

  /**
   * Calculate checksum for content
   */
  calculateChecksum(content) {
    return crypto.createHash('md5').update(content.trim()).digest('hex').substring(0, 8);
  }

  /**
   * Create section marker
   */
  createSectionMarker(sectionName, version, checksum) {
    return `<!-- DEVOPS_AGENT_SECTION:${sectionName}:${version}:${checksum} -->`;
  }

  /**
   * Create end marker
   */
  createEndMarker(sectionName) {
    return `<!-- END_DEVOPS_AGENT_SECTION:${sectionName} -->`;
  }

  /**
   * Extract managed sections from existing house rules
   */
  extractManagedSections(content) {
    const sections = {};
    const pattern = /<!-- DEVOPS_AGENT_SECTION:(\w+[-\w]*):([0-9.]+):([a-f0-9]+) -->([\s\S]*?)<!-- END_DEVOPS_AGENT_SECTION:\1 -->/g;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      sections[match[1]] = {
        name: match[1],
        version: match[2],
        checksum: match[3],
        content: match[4].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length
      };
    }
    
    return sections;
  }

  /**
   * Check if a section needs updating
   */
  needsUpdate(sectionName, existingVersion, existingChecksum) {
    const currentSection = MANAGED_SECTIONS[sectionName];
    if (!currentSection) return false;

    // Check version
    if (this.compareVersions(currentSection.version, existingVersion) > 0) {
      return true;
    }

    // Check checksum (in case we updated content without version bump)
    const currentChecksum = this.calculateChecksum(currentSection.content);
    return currentChecksum !== existingChecksum;
  }

  /**
   * Compare semantic versions
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }
    
    return 0;
  }

  /**
   * Format a managed section with markers
   */
  formatSection(sectionName) {
    const section = MANAGED_SECTIONS[sectionName];
    if (!section) return '';

    const checksum = this.calculateChecksum(section.content);
    const marker = this.createSectionMarker(sectionName, section.version, checksum);
    const endMarker = this.createEndMarker(sectionName);

    return `${marker}
${section.title}

${section.content}
${endMarker}`;
  }

  /**
   * Create new house rules with all managed sections
   */
  createNewHouseRules() {
    const sections = [];
    
    // Header
    sections.push(`# House Rules for AI Agents

**IMPORTANT: All AI agents (Claude, Cline, Copilot, etc.) must read and follow these rules at the start of each session.**
`);

    // Add managed sections
    sections.push(this.formatSection('file-coordination'));
    sections.push('');
    sections.push(this.formatSection('core-principles'));
    sections.push('');
    sections.push(this.formatSection('project-conventions'));

    return sections.join('\n');
  }

  /**
   * Update house rules intelligently
   */
  async updateHouseRules(options = {}) {
    const { createIfMissing = true, backupExisting = true } = options;

    // Find or create house rules file
    if (!this.houseRulesPath) {
      if (!createIfMissing) {
        return { updated: false, reason: 'No house rules file found' };
      }
      
      this.houseRulesPath = path.join(this.projectRoot, 'houserules.md');
      const content = this.createNewHouseRules();
      fs.writeFileSync(this.houseRulesPath, content);
      
      return { 
        updated: true, 
        created: true,
        path: this.houseRulesPath,
        sections: Object.keys(MANAGED_SECTIONS)
      };
    }

    // Read existing content
    const existingContent = fs.readFileSync(this.houseRulesPath, 'utf8');
    const existingSections = this.extractManagedSections(existingContent);
    
    // Check what needs updating
    const updates = [];
    const additions = [];
    
    for (const [sectionName, sectionData] of Object.entries(MANAGED_SECTIONS)) {
      if (existingSections[sectionName]) {
        // Section exists - check if needs update
        if (this.needsUpdate(sectionName, existingSections[sectionName].version, existingSections[sectionName].checksum)) {
          updates.push(sectionName);
        }
      } else {
        // Section doesn't exist - needs to be added
        additions.push(sectionName);
      }
    }

    // If no updates needed, return
    if (updates.length === 0 && additions.length === 0) {
      return { updated: false, reason: 'All sections are up to date' };
    }

    // Create backup if requested
    if (backupExisting) {
      // Create backup in DevopsAgent_Backups folder
      const backupDir = path.join(this.projectRoot, 'DevopsAgent_Backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        // Ensure backup folder is in gitignore
        this.ensureBackupInGitignore();
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupFileName = `houserules_backup_${timestamp}.md`;
      const backupPath = path.join(backupDir, backupFileName);
      
      fs.copyFileSync(this.houseRulesPath, backupPath);
      
      // Only log if not running as CLI
      if (!process.argv[1]?.endsWith('house-rules-manager.js')) {
        console.log(`Backup created: ${backupPath}`);
      }
    }

    // Build new content
    let newContent = existingContent;

    // Update existing sections
    for (const sectionName of updates) {
      const existingSection = existingSections[sectionName];
      const newSection = this.formatSection(sectionName);
      
      // Replace the old section with the new one
      const beforeSection = newContent.substring(0, existingSection.startIndex);
      const afterSection = newContent.substring(existingSection.endIndex);
      newContent = beforeSection + newSection + afterSection;
      
      // Recalculate positions for remaining sections
      const diff = newSection.length - (existingSection.endIndex - existingSection.startIndex);
      for (const section of Object.values(existingSections)) {
        if (section.startIndex > existingSection.startIndex) {
          section.startIndex += diff;
          section.endIndex += diff;
        }
      }
    }

    // Add new sections
    if (additions.length > 0) {
      // Find the best place to insert new sections
      let insertPosition = 0;
      
      // Try to insert after the main header
      const headerMatch = /^# .+\n/m.exec(newContent);
      if (headerMatch) {
        insertPosition = headerMatch.index + headerMatch[0].length;
        
        // Skip any immediate description
        const descMatch = /\*\*IMPORTANT:.+\*\*\n/m.exec(newContent.substring(insertPosition));
        if (descMatch && descMatch.index === 0) {
          insertPosition += descMatch[0].length;
        }
      }

      // Add each new section
      const sectionsToAdd = additions.map(name => '\n' + this.formatSection(name) + '\n').join('');
      newContent = newContent.substring(0, insertPosition) + sectionsToAdd + newContent.substring(insertPosition);
    }

    // Write updated content
    fs.writeFileSync(this.houseRulesPath, newContent);

    return {
      updated: true,
      path: this.houseRulesPath,
      updatedSections: updates,
      addedSections: additions,
      totalChanges: updates.length + additions.length
    };
  }

  /**
   * Ensure backup folder is in gitignore
   */
  ensureBackupInGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const backupPattern = 'DevopsAgent_Backups/';
    
    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        
        // Check if pattern already exists
        if (!content.includes(backupPattern)) {
          // Add to gitignore
          const updatedContent = content.trimEnd() + '\n\n# DevOps Agent backup files\n' + backupPattern + '\n';
          fs.writeFileSync(gitignorePath, updatedContent);
        }
      } else {
        // Create gitignore with the pattern
        const content = '# DevOps Agent backup files\n' + backupPattern + '\n';
        fs.writeFileSync(gitignorePath, content);
      }
    } catch (err) {
      // Silently fail - not critical if gitignore can't be updated
    }
  }

  /**
   * Initial setup - prompt for folder structure preference and copy appropriate files
   */
  async initialSetup() {
    // Check if house rules already exist
    if (this.houseRulesPath && fs.existsSync(this.houseRulesPath)) {
      return {
        alreadyExists: true,
        path: this.houseRulesPath,
        message: 'House rules already exist'
      };
    }

    // Import readline for interactive prompts
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      console.log('\n' + '='.repeat(70));
      console.log('📋 FIRST-TIME PROJECT SETUP: House Rules Configuration');
      console.log('='.repeat(70));
      console.log('\nChoose your project organization style:\n');
      console.log('  ✅ STRUCTURED (Recommended for new projects)');
      console.log('     • Enforced modular folder organization');
      console.log('     • Pattern: /ModuleName/src/featurename/');
      console.log('     • Includes: houserules.md + folders.md guide');
      console.log('     • Best for: New projects, large applications, teams');
      console.log();
      console.log('  ❌ FLEXIBLE (Recommended for existing projects)');
      console.log('     • No enforced folder structure');
      console.log('     • Organize files your own way');
      console.log('     • Includes: houserules.md only');
      console.log('     • Best for: Existing projects, personal projects');
      console.log('\n' + '─'.repeat(70));
      
      rl.question('\nDo you want STRUCTURED folder organization? (Y/N) [N]: ', (answer) => {
        const wantStructure = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
        rl.close();
        
        try {
          const result = this.setupHouseRules(wantStructure);
          console.log();
          console.log(`${wantStructure ? '📁' : '📄'} House rules setup complete!`);
          console.log(`   Location: ${result.houseRulesPath}`);
          
          if (wantStructure) {
            console.log(`   Folder guide: ${result.foldersPath}`);
            console.log();
            console.log('💡 TIP: Open folders.md to customize your project structure');
          }
          
          if (result.infrastructurePath) {
            console.log(`   Infrastructure docs: ${result.infrastructurePath}`);
          }
          
          console.log();
          resolve(result);
        } catch (error) {
          console.error('❌ Failed to setup house rules:', error.message);
          resolve({ success: false, error: error.message });
        }
      });
    });
  }

  /**
   * Setup house rules by copying appropriate template
   */
  setupHouseRules(withStructure = false) {
    // Determine source and target paths
    const agentRoot = path.join(__dirname, '..');
    const sourceFileName = withStructure ? 'houserules_structured.md' : 'houserules.md';
    const sourcePath = path.join(agentRoot, sourceFileName);
    const targetPath = path.join(this.projectRoot, 'houserules.md');
    
    // Verify source file exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source house rules template not found: ${sourcePath}`);
    }
    
    // Copy house rules
    fs.copyFileSync(sourcePath, targetPath);
    this.houseRulesPath = targetPath;
    
    const result = {
      success: true,
      withStructure,
      houseRulesPath: targetPath
    };
    
    // If structured, also copy folders.md
    if (withStructure) {
      const foldersSrc = path.join(agentRoot, 'folders.md');
      const foldersDest = path.join(this.projectRoot, 'folders.md');
      
      if (fs.existsSync(foldersSrc)) {
        fs.copyFileSync(foldersSrc, foldersDest);
        result.foldersPath = foldersDest;
      }
    }
    
    // Always create infrastructure directory and template
    const infraDir = path.join(this.projectRoot, 'infrastructure');
    if (!fs.existsSync(infraDir)) {
      fs.mkdirSync(infraDir, { recursive: true });
    }
    
    const infraDocPath = path.join(infraDir, 'infrastructure.md');
    if (!fs.existsSync(infraDocPath)) {
      const infraTemplate = this.getInfrastructureTemplate();
      fs.writeFileSync(infraDocPath, infraTemplate);
      result.infrastructurePath = infraDocPath;
    }
    
    return result;
  }

  /**
   * Get infrastructure.md template content
   */
  getInfrastructureTemplate() {
    return `# Infrastructure Documentation

**IMPORTANT**: This file documents all infrastructure resources for this project.
Always read this file before creating new servers, instances, or Docker containers.

## Overview
Last Updated: ${new Date().toISOString()}

## Docker Containers

### Example Container
- **Name**: example-service
- **Image**: nginx:latest
- **Ports**: 8080:80
- **Purpose**: Example web server
- **Dependencies**: None
- **Configuration**: 
  - Environment: \`ENV=production\`
  - Volumes: \`./data:/usr/share/nginx/html\`

## Servers / Instances

### Example Server
- **Name**: api-server
- **Type**: AWS EC2 t2.micro
- **IP/Domain**: api.example.com
- **Purpose**: REST API backend
- **Access**: SSH key required
- **Dependencies**: PostgreSQL database

## Databases

### Example Database
- **Name**: main-db
- **Type**: PostgreSQL 14
- **Host**: localhost:5432
- **Purpose**: Application data storage
- **Backup Schedule**: Daily at 2 AM UTC

## Services / APIs

### Example Service
- **Name**: auth-service
- **Type**: OAuth2 Provider
- **Endpoint**: https://auth.example.com
- **Purpose**: User authentication
- **API Keys**: Stored in environment variables

## Network Configuration

- **VPC/Network**: default
- **Subnets**: 
  - Public: 10.0.1.0/24
  - Private: 10.0.2.0/24
- **Security Groups**: 
  - web-sg: Allows 80, 443
  - api-sg: Allows 8080

## Monitoring & Logging

- **Monitoring**: CloudWatch / Prometheus
- **Logging**: Centralized logging to /var/log/
- **Alerts**: Email notifications enabled

## Backup & Recovery

- **Backup Location**: S3 bucket or local path
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 15 minutes

## Access & Credentials

**NOTE**: Never commit credentials to this file.
Document where credentials are stored (e.g., password manager, secrets vault).

- **SSH Keys**: Stored in team password manager
- **API Keys**: Environment variables only
- **Database Passwords**: AWS Secrets Manager

## Rollback Procedures

### How to Remove/Rollback Infrastructure

1. **Docker Containers**: 
   \`\`\`bash
   docker-compose down
   \`\`\`

2. **Servers**: 
   - Stop the instance via cloud console
   - Take snapshot before termination
   - Document instance ID and configuration

## Change History

### YYYY-MM-DD - Initial Setup
- Created base infrastructure
- Deployed example services
- Configured networking and security
`;
  }

  /**
   * Get status of house rules
   */
  getStatus() {
    if (!this.houseRulesPath) {
      return {
        exists: false,
        path: null,
        managedSections: {},
        needsUpdate: true
      };
    }

    const content = fs.readFileSync(this.houseRulesPath, 'utf8');
    const existingSections = this.extractManagedSections(content);
    const status = {
      exists: true,
      path: this.houseRulesPath,
      managedSections: {},
      needsUpdate: false
    };

    // Check each managed section
    for (const [sectionName, sectionData] of Object.entries(MANAGED_SECTIONS)) {
      if (existingSections[sectionName]) {
        const existing = existingSections[sectionName];
        const needsUpdate = this.needsUpdate(sectionName, existing.version, existing.checksum);
        
        status.managedSections[sectionName] = {
          installed: true,
          installedVersion: existing.version,
          currentVersion: sectionData.version,
          needsUpdate
        };
        
        if (needsUpdate) {
          status.needsUpdate = true;
        }
      } else {
        status.managedSections[sectionName] = {
          installed: false,
          currentVersion: sectionData.version,
          needsUpdate: true
        };
        status.needsUpdate = true;
      }
    }

    return status;
  }
}

export default HouseRulesManager;

// CLI interface when run directly
// Check if this is the main module being run
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('house-rules-manager.js');

if (isMainModule) {
  const manager = new HouseRulesManager();
  const command = process.argv[2];

  switch (command) {
    case 'status':
      // Output only the JSON for the bash script to parse
      console.log(JSON.stringify(manager.getStatus()));
      break;
      
    case 'update':
      manager.updateHouseRules().then(result => {
        console.log(JSON.stringify(result));
      });
      break;
      
    default:
      console.log('Usage: node house-rules-manager.js [status|update]');
  }
}
