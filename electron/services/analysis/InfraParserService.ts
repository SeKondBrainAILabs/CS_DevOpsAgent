/**
 * Infrastructure Parser Service
 * Parses Terraform, Kubernetes, and Docker Compose files
 * Part of the Repository Analysis Engine - Phase 3
 */

import { BaseService } from '../BaseService';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Infrastructure resource types
export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  file: string;
  line: number;
  attributes: Record<string, unknown>;
  dependencies: string[];
}

export interface TerraformProvider {
  name: string;
  version?: string;
  alias?: string;
  file: string;
  line: number;
}

export interface TerraformVariable {
  name: string;
  type?: string;
  default?: unknown;
  description?: string;
  file: string;
  line: number;
}

export interface TerraformOutput {
  name: string;
  value: string;
  description?: string;
  sensitive?: boolean;
  file: string;
  line: number;
}

export interface KubernetesResource {
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  file: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  spec?: Record<string, unknown>;
}

export interface DockerComposeService {
  name: string;
  image?: string;
  build?: string | { context: string; dockerfile?: string };
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string> | string[];
  depends_on?: string[];
  networks?: string[];
  file: string;
}

export interface DockerComposeConfig {
  version?: string;
  services: DockerComposeService[];
  networks: string[];
  volumes: string[];
  file: string;
}

export interface InfrastructureAnalysis {
  terraform: {
    resources: TerraformResource[];
    providers: TerraformProvider[];
    variables: TerraformVariable[];
    outputs: TerraformOutput[];
    modules: string[];
  };
  kubernetes: {
    resources: KubernetesResource[];
    namespaces: string[];
    deployments: string[];
    services: string[];
    configMaps: string[];
    secrets: string[];
    ingresses: string[];
  };
  docker: {
    composeFiles: DockerComposeConfig[];
    services: DockerComposeService[];
    networks: string[];
    volumes: string[];
  };
}

// Terraform patterns
const TF_RESOURCE_PATTERN = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
const TF_PROVIDER_PATTERN = /provider\s+"([^"]+)"\s*\{/g;
const TF_VARIABLE_PATTERN = /variable\s+"([^"]+)"\s*\{/g;
const TF_OUTPUT_PATTERN = /output\s+"([^"]+)"\s*\{/g;
const TF_MODULE_PATTERN = /module\s+"([^"]+)"\s*\{/g;
const TF_DATA_PATTERN = /data\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;

export class InfraParserService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Analyze infrastructure files in a repository
   */
  async analyzeInfrastructure(repoPath: string): Promise<InfrastructureAnalysis> {
    const analysis: InfrastructureAnalysis = {
      terraform: {
        resources: [],
        providers: [],
        variables: [],
        outputs: [],
        modules: [],
      },
      kubernetes: {
        resources: [],
        namespaces: [],
        deployments: [],
        services: [],
        configMaps: [],
        secrets: [],
        ingresses: [],
      },
      docker: {
        composeFiles: [],
        services: [],
        networks: [],
        volumes: [],
      },
    };

    // Find and parse Terraform files
    const tfFiles = await this.findFiles(repoPath, '**/*.tf');
    for (const file of tfFiles) {
      try {
        const tfAnalysis = await this.parseTerraformFile(file);
        analysis.terraform.resources.push(...tfAnalysis.resources);
        analysis.terraform.providers.push(...tfAnalysis.providers);
        analysis.terraform.variables.push(...tfAnalysis.variables);
        analysis.terraform.outputs.push(...tfAnalysis.outputs);
        analysis.terraform.modules.push(...tfAnalysis.modules);
      } catch (error) {
        console.warn(`[InfraParserService] Failed to parse Terraform file ${file}:`, error);
      }
    }

    // Find and parse Kubernetes YAML files
    const k8sPatterns = [
      '**/k8s/**/*.yaml',
      '**/k8s/**/*.yml',
      '**/kubernetes/**/*.yaml',
      '**/kubernetes/**/*.yml',
      '**/manifests/**/*.yaml',
      '**/manifests/**/*.yml',
      '**/deploy/**/*.yaml',
      '**/deploy/**/*.yml',
    ];

    for (const pattern of k8sPatterns) {
      const k8sFiles = await this.findFiles(repoPath, pattern);
      for (const file of k8sFiles) {
        try {
          const resources = await this.parseKubernetesFile(file);
          analysis.kubernetes.resources.push(...resources);

          // Categorize resources
          for (const resource of resources) {
            switch (resource.kind) {
              case 'Namespace':
                if (!analysis.kubernetes.namespaces.includes(resource.name)) {
                  analysis.kubernetes.namespaces.push(resource.name);
                }
                break;
              case 'Deployment':
              case 'StatefulSet':
              case 'DaemonSet':
                if (!analysis.kubernetes.deployments.includes(resource.name)) {
                  analysis.kubernetes.deployments.push(resource.name);
                }
                break;
              case 'Service':
                if (!analysis.kubernetes.services.includes(resource.name)) {
                  analysis.kubernetes.services.push(resource.name);
                }
                break;
              case 'ConfigMap':
                if (!analysis.kubernetes.configMaps.includes(resource.name)) {
                  analysis.kubernetes.configMaps.push(resource.name);
                }
                break;
              case 'Secret':
                if (!analysis.kubernetes.secrets.includes(resource.name)) {
                  analysis.kubernetes.secrets.push(resource.name);
                }
                break;
              case 'Ingress':
                if (!analysis.kubernetes.ingresses.includes(resource.name)) {
                  analysis.kubernetes.ingresses.push(resource.name);
                }
                break;
            }
          }
        } catch (error) {
          console.warn(`[InfraParserService] Failed to parse Kubernetes file ${file}:`, error);
        }
      }
    }

    // Find and parse Docker Compose files
    const composePatterns = [
      '**/docker-compose.yaml',
      '**/docker-compose.yml',
      '**/docker-compose*.yaml',
      '**/docker-compose*.yml',
      '**/compose.yaml',
      '**/compose.yml',
    ];

    for (const pattern of composePatterns) {
      const composeFiles = await this.findFiles(repoPath, pattern);
      for (const file of composeFiles) {
        try {
          const config = await this.parseDockerComposeFile(file);
          if (config) {
            analysis.docker.composeFiles.push(config);
            analysis.docker.services.push(...config.services);

            for (const network of config.networks) {
              if (!analysis.docker.networks.includes(network)) {
                analysis.docker.networks.push(network);
              }
            }

            for (const volume of config.volumes) {
              if (!analysis.docker.volumes.includes(volume)) {
                analysis.docker.volumes.push(volume);
              }
            }
          }
        } catch (error) {
          console.warn(`[InfraParserService] Failed to parse Docker Compose file ${file}:`, error);
        }
      }
    }

    return analysis;
  }

  /**
   * Parse a Terraform file
   */
  async parseTerraformFile(filePath: string): Promise<{
    resources: TerraformResource[];
    providers: TerraformProvider[];
    variables: TerraformVariable[];
    outputs: TerraformOutput[];
    modules: string[];
  }> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const resources: TerraformResource[] = [];
    const providers: TerraformProvider[] = [];
    const variables: TerraformVariable[] = [];
    const outputs: TerraformOutput[] = [];
    const modules: string[] = [];

    // Parse resources
    let match;
    const resourceRegex = new RegExp(TF_RESOURCE_PATTERN.source, 'g');
    while ((match = resourceRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const resourceType = match[1];
      const resourceName = match[2];
      const provider = resourceType.split('_')[0];

      // Extract block content
      const blockContent = this.extractBlock(content, match.index + match[0].length);
      const dependencies = this.extractTerraformDependencies(blockContent);

      resources.push({
        type: resourceType,
        name: resourceName,
        provider,
        file: filePath,
        line,
        attributes: this.parseHclAttributes(blockContent),
        dependencies,
      });
    }

    // Parse providers
    const providerRegex = new RegExp(TF_PROVIDER_PATTERN.source, 'g');
    while ((match = providerRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const blockContent = this.extractBlock(content, match.index + match[0].length);
      const attrs = this.parseHclAttributes(blockContent);

      providers.push({
        name: match[1],
        version: attrs.version as string | undefined,
        alias: attrs.alias as string | undefined,
        file: filePath,
        line,
      });
    }

    // Parse variables
    const variableRegex = new RegExp(TF_VARIABLE_PATTERN.source, 'g');
    while ((match = variableRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const blockContent = this.extractBlock(content, match.index + match[0].length);
      const attrs = this.parseHclAttributes(blockContent);

      variables.push({
        name: match[1],
        type: attrs.type as string | undefined,
        default: attrs.default,
        description: attrs.description as string | undefined,
        file: filePath,
        line,
      });
    }

    // Parse outputs
    const outputRegex = new RegExp(TF_OUTPUT_PATTERN.source, 'g');
    while ((match = outputRegex.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      const blockContent = this.extractBlock(content, match.index + match[0].length);
      const attrs = this.parseHclAttributes(blockContent);

      outputs.push({
        name: match[1],
        value: attrs.value as string || '',
        description: attrs.description as string | undefined,
        sensitive: attrs.sensitive as boolean | undefined,
        file: filePath,
        line,
      });
    }

    // Parse modules
    const moduleRegex = new RegExp(TF_MODULE_PATTERN.source, 'g');
    while ((match = moduleRegex.exec(content)) !== null) {
      modules.push(match[1]);
    }

    return { resources, providers, variables, outputs, modules };
  }

  /**
   * Parse a Kubernetes YAML file
   */
  async parseKubernetesFile(filePath: string): Promise<KubernetesResource[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const resources: KubernetesResource[] = [];

    // Split by YAML document separator
    const documents = content.split(/^---$/m);

    for (const doc of documents) {
      if (!doc.trim()) continue;

      try {
        const parsed = yaml.load(doc) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object') continue;

        // Check if it's a Kubernetes resource
        if (parsed.apiVersion && parsed.kind) {
          const metadata = (parsed.metadata || {}) as Record<string, unknown>;

          resources.push({
            apiVersion: parsed.apiVersion as string,
            kind: parsed.kind as string,
            name: (metadata.name as string) || 'unnamed',
            namespace: metadata.namespace as string | undefined,
            file: filePath,
            labels: metadata.labels as Record<string, string> | undefined,
            annotations: metadata.annotations as Record<string, string> | undefined,
            spec: parsed.spec as Record<string, unknown> | undefined,
          });
        }

        // Handle List types
        if (parsed.kind === 'List' && Array.isArray(parsed.items)) {
          for (const item of parsed.items as Record<string, unknown>[]) {
            if (item.apiVersion && item.kind) {
              const metadata = (item.metadata || {}) as Record<string, unknown>;
              resources.push({
                apiVersion: item.apiVersion as string,
                kind: item.kind as string,
                name: (metadata.name as string) || 'unnamed',
                namespace: metadata.namespace as string | undefined,
                file: filePath,
                labels: metadata.labels as Record<string, string> | undefined,
                annotations: metadata.annotations as Record<string, string> | undefined,
                spec: item.spec as Record<string, unknown> | undefined,
              });
            }
          }
        }
      } catch (error) {
        // Skip invalid YAML documents
        console.warn(`[InfraParserService] Invalid YAML in ${filePath}:`, error);
      }
    }

    return resources;
  }

  /**
   * Parse a Docker Compose file
   */
  async parseDockerComposeFile(filePath: string): Promise<DockerComposeConfig | null> {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    try {
      const parsed = yaml.load(content) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;

      const services: DockerComposeService[] = [];
      const networks: string[] = [];
      const volumes: string[] = [];

      // Parse services
      const servicesObj = (parsed.services || {}) as Record<string, Record<string, unknown>>;
      for (const [name, config] of Object.entries(servicesObj)) {
        services.push({
          name,
          image: config.image as string | undefined,
          build: config.build as string | { context: string; dockerfile?: string } | undefined,
          ports: config.ports as string[] | undefined,
          volumes: config.volumes as string[] | undefined,
          environment: config.environment as Record<string, string> | string[] | undefined,
          depends_on: config.depends_on as string[] | undefined,
          networks: config.networks as string[] | undefined,
          file: filePath,
        });
      }

      // Parse networks
      const networksObj = parsed.networks as Record<string, unknown> | undefined;
      if (networksObj) {
        networks.push(...Object.keys(networksObj));
      }

      // Parse volumes
      const volumesObj = parsed.volumes as Record<string, unknown> | undefined;
      if (volumesObj) {
        volumes.push(...Object.keys(volumesObj));
      }

      return {
        version: parsed.version as string | undefined,
        services,
        networks,
        volumes,
        file: filePath,
      };
    } catch (error) {
      console.warn(`[InfraParserService] Invalid Docker Compose file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Find files matching a glob pattern
   */
  private async findFiles(basePath: string, pattern: string): Promise<string[]> {
    const { glob } = await import('glob');
    return glob(pattern, {
      cwd: basePath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Extract a HCL block from content
   */
  private extractBlock(content: string, startIndex: number): string {
    let depth = 1;
    let i = startIndex;

    // Find opening brace if not at one
    while (i < content.length && content[i] !== '{') i++;
    i++; // Skip opening brace

    const blockStart = i;

    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }

    return content.substring(blockStart, i - 1);
  }

  /**
   * Parse simple HCL attributes (not a full HCL parser)
   */
  private parseHclAttributes(block: string): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};
    const lines = block.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // Match simple key = value patterns
      const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1];
        let value: unknown = match[2].trim();

        // Parse value type
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (typeof value === 'string' && !isNaN(Number(value))) {
          value = Number(value);
        }

        attrs[key] = value;
      }
    }

    return attrs;
  }

  /**
   * Extract Terraform dependencies from a block
   */
  private extractTerraformDependencies(block: string): string[] {
    const deps: string[] = [];

    // Look for resource references: resource_type.resource_name
    const refPattern = /(\w+)\.(\w+)(?:\.(\w+))?/g;
    let match;

    while ((match = refPattern.exec(block)) !== null) {
      const ref = `${match[1]}.${match[2]}`;
      if (!deps.includes(ref) && !['var', 'local', 'data', 'module', 'path', 'terraform'].includes(match[1])) {
        deps.push(ref);
      }
    }

    // Look for explicit depends_on
    const dependsOnMatch = block.match(/depends_on\s*=\s*\[([^\]]+)\]/);
    if (dependsOnMatch) {
      const dependsOn = dependsOnMatch[1].split(',').map(d => d.trim().replace(/[\[\]"]/g, ''));
      deps.push(...dependsOn.filter(d => d && !deps.includes(d)));
    }

    return deps;
  }

  /**
   * Get infrastructure summary
   */
  getSummary(analysis: InfrastructureAnalysis): {
    terraform: { resourceCount: number; providerCount: number; moduleCount: number };
    kubernetes: { resourceCount: number; namespaceCount: number };
    docker: { serviceCount: number; networkCount: number };
  } {
    return {
      terraform: {
        resourceCount: analysis.terraform.resources.length,
        providerCount: analysis.terraform.providers.length,
        moduleCount: analysis.terraform.modules.length,
      },
      kubernetes: {
        resourceCount: analysis.kubernetes.resources.length,
        namespaceCount: analysis.kubernetes.namespaces.length,
      },
      docker: {
        serviceCount: analysis.docker.services.length,
        networkCount: analysis.docker.networks.length,
      },
    };
  }
}
