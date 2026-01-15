/**
 * API Extractor Service
 * Extracts API endpoints from Express, Fastify, and other frameworks
 * Part of the Repository Analysis Engine
 */

import { BaseService } from '../BaseService';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtractedEndpoint,
  HttpMethod,
  APIFramework,
  RouteParam,
  ParsedAST,
} from '../../../shared/analysis-types';

// HTTP methods to detect
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

// Patterns for different frameworks
const FRAMEWORK_PATTERNS: Record<APIFramework, RegExp[]> = {
  express: [
    /\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
    /router\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
    /app\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
  ],
  fastify: [
    /fastify\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
    /\.route\s*\(\s*\{[^}]*method:\s*['"](.*?)['"][^}]*url:\s*['"](.*?)['"]/gi,
  ],
  koa: [
    /router\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
  ],
  hapi: [
    /server\.route\s*\(\s*\{[^}]*method:\s*['"](.*?)['"][^}]*path:\s*['"](.*?)['"]/gi,
  ],
  flask: [
    /@app\.route\s*\(\s*['"](.*?)['"](?:.*?methods\s*=\s*\[([^\]]+)\])?/gi,
    /@blueprint\.route\s*\(\s*['"](.*?)['"](?:.*?methods\s*=\s*\[([^\]]+)\])?/gi,
  ],
  fastapi: [
    /@app\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
    /@router\.(get|post|put|delete|patch|options|head)\s*\(\s*['"](.*?)['"]/gi,
  ],
  django: [
    /path\s*\(\s*['"](.*?)['"],\s*(\w+)/gi,
    /url\s*\(\s*r?['"](.*?)['"],\s*(\w+)/gi,
  ],
  gin: [
    /\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*['"](.*?)['"]/gi,
    /router\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*['"](.*?)['"]/gi,
  ],
  unknown: [],
};

export class APIExtractorService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Extract API endpoints from a file
   */
  async extractFromFile(filePath: string, ast?: ParsedAST): Promise<ExtractedEndpoint[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const endpoints: ExtractedEndpoint[] = [];

    // Detect framework
    const framework = this.detectFramework(content, filePath);

    // Use AST for more accurate extraction if available
    if (ast) {
      const astEndpoints = this.extractFromAST(ast, content, framework);
      endpoints.push(...astEndpoints);
    }

    // Also use regex patterns as fallback
    const regexEndpoints = this.extractWithRegex(content, filePath, framework, lines);

    // Deduplicate by path + method
    const seen = new Set<string>();
    const uniqueEndpoints: ExtractedEndpoint[] = [];

    for (const endpoint of [...endpoints, ...regexEndpoints]) {
      const key = `${endpoint.method}:${endpoint.path}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEndpoints.push(endpoint);
      }
    }

    return uniqueEndpoints;
  }

  /**
   * Extract endpoints from multiple files
   */
  async extractFromFiles(files: Array<{ path: string; ast?: ParsedAST }>): Promise<ExtractedEndpoint[]> {
    const allEndpoints: ExtractedEndpoint[] = [];

    for (const { path: filePath, ast } of files) {
      try {
        const endpoints = await this.extractFromFile(filePath, ast);
        allEndpoints.push(...endpoints);
      } catch (error) {
        console.warn(`[APIExtractorService] Failed to extract from ${filePath}:`, error);
      }
    }

    return allEndpoints;
  }

  /**
   * Detect which framework is being used
   */
  private detectFramework(content: string, filePath: string): APIFramework {
    const lower = content.toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // Python frameworks
    if (ext === '.py') {
      if (lower.includes('from fastapi') || lower.includes('import fastapi')) {
        return 'fastapi';
      }
      if (lower.includes('from flask') || lower.includes('import flask')) {
        return 'flask';
      }
      if (lower.includes('from django') || lower.includes('import django')) {
        return 'django';
      }
    }

    // Go frameworks
    if (ext === '.go') {
      if (lower.includes('github.com/gin-gonic/gin')) {
        return 'gin';
      }
    }

    // JavaScript/TypeScript frameworks
    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
      if (lower.includes('from \'fastify\'') || lower.includes('require(\'fastify\')') ||
          lower.includes('from "fastify"') || lower.includes('require("fastify")')) {
        return 'fastify';
      }
      if (lower.includes('from \'koa\'') || lower.includes('require(\'koa\')') ||
          lower.includes('from "koa"') || lower.includes('require("koa")')) {
        return 'koa';
      }
      if (lower.includes('from \'@hapi/hapi\'') || lower.includes('require(\'@hapi/hapi\')')) {
        return 'hapi';
      }
      if (lower.includes('from \'express\'') || lower.includes('require(\'express\')') ||
          lower.includes('from "express"') || lower.includes('require("express")') ||
          lower.includes('express()') || lower.includes('express.router')) {
        return 'express';
      }
    }

    return 'unknown';
  }

  /**
   * Extract endpoints using AST analysis
   */
  private extractFromAST(ast: ParsedAST, content: string, framework: APIFramework): ExtractedEndpoint[] {
    const endpoints: ExtractedEndpoint[] = [];
    const lines = content.split('\n');

    // Look for function calls that match route patterns
    for (const func of ast.functions) {
      // Check if function is a route handler
      const lineContent = lines[func.line - 1] || '';
      const endpoint = this.parseRouteFromLine(lineContent, func.line, ast.filePath, framework);
      if (endpoint) {
        endpoint.handler = func.name;
        endpoints.push(endpoint);
      }
    }

    // Look for class methods that might be route handlers
    for (const cls of ast.classes) {
      for (const method of cls.methods) {
        // Check decorators or method names
        if (method.name.toLowerCase().includes('get') ||
            method.name.toLowerCase().includes('post') ||
            method.name.toLowerCase().includes('put') ||
            method.name.toLowerCase().includes('delete')) {
          // This might be a controller method, check surrounding context
          const lineContent = lines[method.line - 1] || '';
          const prevLine = lines[method.line - 2] || '';

          // Check for decorators
          const decoratorMatch = prevLine.match(/@(Get|Post|Put|Delete|Patch)\s*\(['"]([^'"]+)['"]\)/i);
          if (decoratorMatch) {
            endpoints.push({
              method: decoratorMatch[1].toUpperCase() as HttpMethod,
              path: decoratorMatch[2],
              handler: `${cls.name}.${method.name}`,
              file: ast.filePath,
              line: method.line,
              framework: 'unknown', // NestJS or similar decorator-based
            });
          }
        }
      }
    }

    return endpoints;
  }

  /**
   * Extract endpoints using regex patterns
   */
  private extractWithRegex(
    content: string,
    filePath: string,
    framework: APIFramework,
    lines: string[]
  ): ExtractedEndpoint[] {
    const endpoints: ExtractedEndpoint[] = [];
    const patterns = framework !== 'unknown'
      ? FRAMEWORK_PATTERNS[framework]
      : Object.values(FRAMEWORK_PATTERNS).flat();

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        const method = this.normalizeMethod(match[1]);
        const routePath = match[2] || match[1]; // Some patterns have path in different groups

        if (method && routePath) {
          // Find line number
          const matchIndex = match.index;
          let lineNumber = 1;
          let charCount = 0;
          for (let i = 0; i < lines.length; i++) {
            charCount += lines[i].length + 1; // +1 for newline
            if (charCount > matchIndex) {
              lineNumber = i + 1;
              break;
            }
          }

          // Extract route parameters
          const params = this.extractRouteParams(routePath);

          // Try to find handler name
          const handler = this.findHandlerName(content, match.index);

          endpoints.push({
            method,
            path: routePath,
            handler: handler || '<anonymous>',
            file: filePath,
            line: lineNumber,
            framework,
            params: params.length > 0 ? params : undefined,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Parse a route from a line of code
   */
  private parseRouteFromLine(
    line: string,
    lineNumber: number,
    filePath: string,
    framework: APIFramework
  ): ExtractedEndpoint | null {
    for (const method of HTTP_METHODS) {
      const patterns = [
        new RegExp(`\\.${method.toLowerCase()}\\s*\\(\\s*['"]([^'"]+)['"]`, 'i'),
        new RegExp(`${method.toLowerCase()}\\s*\\(\\s*['"]([^'"]+)['"]`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return {
            method,
            path: match[1],
            handler: '',
            file: filePath,
            line: lineNumber,
            framework,
            params: this.extractRouteParams(match[1]),
          };
        }
      }
    }

    return null;
  }

  /**
   * Normalize HTTP method string
   */
  private normalizeMethod(method: string): HttpMethod | null {
    const upper = method.toUpperCase();
    if (HTTP_METHODS.includes(upper as HttpMethod)) {
      return upper as HttpMethod;
    }
    return null;
  }

  /**
   * Extract route parameters from path
   */
  private extractRouteParams(routePath: string): RouteParam[] {
    const params: RouteParam[] = [];

    // Express-style: /users/:id
    const colonParams = routePath.match(/:(\w+)/g);
    if (colonParams) {
      for (const param of colonParams) {
        params.push({
          name: param.slice(1),
          required: true,
        });
      }
    }

    // Bracket-style: /users/{id}
    const bracketParams = routePath.match(/\{(\w+)\}/g);
    if (bracketParams) {
      for (const param of bracketParams) {
        params.push({
          name: param.slice(1, -1),
          required: true,
        });
      }
    }

    // Flask/FastAPI style: /users/<id>
    const angleParams = routePath.match(/<(\w+)(?::\w+)?>/g);
    if (angleParams) {
      for (const param of angleParams) {
        const match = param.match(/<(\w+)(?::\w+)?>/);
        if (match) {
          params.push({
            name: match[1],
            required: true,
          });
        }
      }
    }

    return params;
  }

  /**
   * Try to find handler function name near the route definition
   */
  private findHandlerName(content: string, matchIndex: number): string | null {
    // Look for function name after the route definition
    const after = content.slice(matchIndex, matchIndex + 200);

    // Pattern: .get('/path', handlerName)
    const directHandler = after.match(/,\s*(\w+)\s*\)/);
    if (directHandler) {
      return directHandler[1];
    }

    // Pattern: .get('/path', (req, res) => { ... })
    if (after.includes('=>') || after.includes('function')) {
      // Anonymous handler
      return null;
    }

    // Pattern: controller.method
    const controllerMethod = after.match(/,\s*(\w+\.\w+)/);
    if (controllerMethod) {
      return controllerMethod[1];
    }

    return null;
  }

  /**
   * Check if a file is likely to contain API routes
   */
  isAPIFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const apiIndicators = [
      'route',
      'controller',
      'endpoint',
      'api',
      'handler',
      'router',
    ];

    return apiIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Get supported file extensions for API extraction
   */
  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go'];
  }
}
