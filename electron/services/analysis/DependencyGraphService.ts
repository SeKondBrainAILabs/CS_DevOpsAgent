/**
 * Dependency Graph Service
 * Builds and analyzes import/export dependency graphs
 * Detects circular dependencies and external package usage
 * Part of the Repository Analysis Engine - Phase 2
 */

import { BaseService } from '../BaseService';
import * as path from 'path';
import type {
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ExternalDependency,
  ParsedAST,
  FeatureAnalysis,
} from '../../../shared/analysis-types';

interface FileImport {
  source: string;
  symbols: string[];
  isDefault: boolean;
  isNamespace: boolean;
  resolvedPath?: string;
}

interface FileExport {
  name: string;
  type: string;
  isDefault: boolean;
}

export class DependencyGraphService extends BaseService {
  private nodeModulesCache = new Set<string>();

  constructor() {
    super();
  }

  /**
   * Build a dependency graph from parsed AST files
   */
  buildFromASTs(
    parsedFiles: Map<string, ParsedAST>,
    repoPath: string
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const externalDepsMap = new Map<string, ExternalDependency>();

    // Create nodes for each file
    Array.from(parsedFiles.entries()).forEach(([filePath, ast]) => {
      const relativePath = path.relative(repoPath, filePath);
      const nodeId = this.createNodeId(relativePath);

      nodes.push({
        id: nodeId,
        name: path.basename(filePath, path.extname(filePath)),
        type: 'file',
        path: relativePath,
        exports: ast.exports.map(e => e.name),
      });
    });

    // Create edges from imports
    for (const [filePath, ast] of Array.from(parsedFiles.entries())) {
      const relativePath = path.relative(repoPath, filePath);
      const sourceNodeId = this.createNodeId(relativePath);

      for (const imp of ast.imports) {
        const resolved = this.resolveImport(imp.source, filePath, repoPath, parsedFiles);

        if (resolved.isExternal) {
          // Track external dependency
          const pkgName = this.getPackageName(imp.source);
          const existing = externalDepsMap.get(pkgName);

          if (existing) {
            if (!existing.usedBy.includes(relativePath)) {
              existing.usedBy.push(relativePath);
            }
            existing.importCount++;
          } else {
            externalDepsMap.set(pkgName, {
              name: pkgName,
              usedBy: [relativePath],
              importCount: 1,
            });
          }
        } else if (resolved.path) {
          // Internal dependency - create edge
          const targetNodeId = this.createNodeId(resolved.path);
          const symbols = imp.isNamespace ? ['*'] : imp.isDefault ? ['default'] : [imp.name];

          // Check if edge already exists
          const existingEdge = edges.find(
            e => e.source === sourceNodeId && e.target === targetNodeId
          );

          if (existingEdge) {
            existingEdge.symbols.push(...symbols.filter(s => !existingEdge.symbols.includes(s)));
          } else {
            edges.push({
              source: sourceNodeId,
              target: targetNodeId,
              type: 'import',
              symbols,
            });
          }
        }
      }
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(nodes, edges);

    // Sort external dependencies by import count
    const externalDependencies = Array.from(externalDepsMap.values())
      .sort((a, b) => b.importCount - a.importCount);

    return {
      nodes,
      edges,
      circularDependencies,
      externalDependencies,
    };
  }

  /**
   * Build a feature-level dependency graph
   */
  buildFeatureGraph(features: FeatureAnalysis[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const externalDepsMap = new Map<string, ExternalDependency>();

    // Create nodes for each feature
    for (const feature of features) {
      nodes.push({
        id: feature.name,
        name: feature.name,
        type: 'feature',
        path: feature.basePath,
        exports: feature.exports.map(e => e.name),
      });

      // Track external dependencies
      for (const extDep of feature.externalDependencies) {
        const existing = externalDepsMap.get(extDep);
        if (existing) {
          if (!existing.usedBy.includes(feature.name)) {
            existing.usedBy.push(feature.name);
          }
          existing.importCount++;
        } else {
          externalDepsMap.set(extDep, {
            name: extDep,
            usedBy: [feature.name],
            importCount: 1,
          });
        }
      }
    }

    // Create edges between features based on internal dependencies
    for (const feature of features) {
      for (const dep of feature.internalDependencies) {
        // Try to find which feature this dependency belongs to
        const targetFeature = features.find(f =>
          dep.includes(f.basePath) || dep.includes(f.name)
        );

        if (targetFeature && targetFeature.name !== feature.name) {
          const existingEdge = edges.find(
            e => e.source === feature.name && e.target === targetFeature.name
          );

          if (existingEdge) {
            if (!existingEdge.symbols.includes(dep)) {
              existingEdge.symbols.push(dep);
            }
          } else {
            edges.push({
              source: feature.name,
              target: targetFeature.name,
              type: 'import',
              symbols: [dep],
            });
          }
        }
      }
    }

    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(nodes, edges);

    return {
      nodes,
      edges,
      circularDependencies,
      externalDependencies: Array.from(externalDepsMap.values())
        .sort((a, b) => b.importCount - a.importCount),
    };
  }

  /**
   * Resolve an import path to an absolute file path
   */
  private resolveImport(
    importSource: string,
    fromFile: string,
    repoPath: string,
    parsedFiles: Map<string, ParsedAST>
  ): { path?: string; isExternal: boolean } {
    // External package (no relative path prefix)
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      return { isExternal: true };
    }

    // Resolve relative import
    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.resolve(fromDir, importSource);

    // Try different extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

    for (const ext of extensions) {
      const testPath = resolvedPath + ext;
      if (parsedFiles.has(testPath)) {
        return { path: path.relative(repoPath, testPath), isExternal: false };
      }
    }

    // Check if exact path exists
    if (parsedFiles.has(resolvedPath)) {
      return { path: path.relative(repoPath, resolvedPath), isExternal: false };
    }

    // Could not resolve - might be external alias or missing file
    return { isExternal: false };
  }

  /**
   * Get package name from import source
   */
  private getPackageName(importSource: string): string {
    // Handle scoped packages: @scope/package
    if (importSource.startsWith('@')) {
      const parts = importSource.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importSource;
    }

    // Regular packages: package/subpath -> package
    return importSource.split('/')[0];
  }

  /**
   * Create a node ID from a file path
   */
  private createNodeId(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\.[^.]+$/, '');
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(
    nodes: DependencyNode[],
    edges: DependencyEdge[]
  ): string[][] {
    const graph = new Map<string, string[]>();

    // Build adjacency list
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    for (const edge of edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          // Normalize cycle to avoid duplicates
          if (!this.cycleExists(cycles, cycle)) {
            cycles.push([...cycle, node]); // Include the node that closes the cycle
          }
        }
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor);
      }

      path.pop();
      recursionStack.delete(node);
    };

    // Run DFS from each node
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Check if a cycle already exists in the list (normalized comparison)
   */
  private cycleExists(cycles: string[][], newCycle: string[]): boolean {
    const normalized = this.normalizeCycle(newCycle);

    for (const existing of cycles) {
      if (this.normalizeCycle(existing) === normalized) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalize a cycle for comparison (start from smallest element)
   */
  private normalizeCycle(cycle: string[]): string {
    if (cycle.length <= 1) return cycle.join(',');

    // Remove the last element if it's the same as the first (closing the cycle)
    const withoutClosing = cycle[cycle.length - 1] === cycle[0]
      ? cycle.slice(0, -1)
      : cycle;

    // Find the smallest element
    const minIdx = withoutClosing.indexOf(
      withoutClosing.reduce((min, curr) => curr < min ? curr : min)
    );

    // Rotate to start from smallest
    const rotated = [
      ...withoutClosing.slice(minIdx),
      ...withoutClosing.slice(0, minIdx),
    ];

    return rotated.join(',');
  }

  /**
   * Get dependency statistics
   */
  getStats(graph: DependencyGraph): {
    totalNodes: number;
    totalEdges: number;
    avgDependencies: number;
    maxDependencies: { node: string; count: number };
    circularCount: number;
    externalPackages: number;
    mostUsedExternal: ExternalDependency | null;
  } {
    // Count outgoing edges per node
    const outgoingCount = new Map<string, number>();
    for (const edge of graph.edges) {
      outgoingCount.set(edge.source, (outgoingCount.get(edge.source) || 0) + 1);
    }

    let maxNode = '';
    let maxCount = 0;
    let totalDeps = 0;

    Array.from(outgoingCount.entries()).forEach(([node, count]) => {
      totalDeps += count;
      if (count > maxCount) {
        maxCount = count;
        maxNode = node;
      }
    });

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      avgDependencies: graph.nodes.length > 0 ? totalDeps / graph.nodes.length : 0,
      maxDependencies: { node: maxNode, count: maxCount },
      circularCount: graph.circularDependencies.length,
      externalPackages: graph.externalDependencies.length,
      mostUsedExternal: graph.externalDependencies[0] || null,
    };
  }

  /**
   * Find all files that depend on a given file
   */
  getDependents(graph: DependencyGraph, nodeId: string): string[] {
    return graph.edges
      .filter(e => e.target === nodeId)
      .map(e => e.source);
  }

  /**
   * Find all files that a given file depends on
   */
  getDependencies(graph: DependencyGraph, nodeId: string): string[] {
    return graph.edges
      .filter(e => e.source === nodeId)
      .map(e => e.target);
  }

  /**
   * Export graph to DOT format for visualization
   */
  toDOT(graph: DependencyGraph, options?: {
    title?: string;
    highlightCircular?: boolean;
  }): string {
    const title = options?.title || 'Dependency Graph';
    const lines: string[] = [
      `digraph "${title}" {`,
      '  rankdir=LR;',
      '  node [shape=box, style=rounded];',
      '',
    ];

    // Add nodes
    for (const node of graph.nodes) {
      const label = node.name;
      const isInCycle = options?.highlightCircular &&
        graph.circularDependencies.some(c => c.includes(node.id));

      const style = isInCycle ? ', color=red, penwidth=2' : '';
      lines.push(`  "${node.id}" [label="${label}"${style}];`);
    }

    lines.push('');

    // Add edges
    for (const edge of graph.edges) {
      const isCircular = options?.highlightCircular &&
        graph.circularDependencies.some(c =>
          c.includes(edge.source) && c.includes(edge.target)
        );

      const style = isCircular ? ' [color=red, penwidth=2]' : '';
      lines.push(`  "${edge.source}" -> "${edge.target}"${style};`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Export graph to JSON format (NetworkX compatible)
   */
  toJSON(graph: DependencyGraph): string {
    return JSON.stringify({
      directed: true,
      multigraph: false,
      graph: {},
      nodes: graph.nodes.map(n => ({
        id: n.id,
        name: n.name,
        type: n.type,
        path: n.path,
        exports: n.exports,
      })),
      links: graph.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type,
        symbols: e.symbols,
      })),
    }, null, 2);
  }
}
