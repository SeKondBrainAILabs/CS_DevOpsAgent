/**
 * Schema Extractor Service
 * Extracts database schemas from Prisma, TypeORM, Sequelize, Drizzle, SQL, and Zod
 * Part of the Repository Analysis Engine - Phase 2
 */

import { BaseService } from '../BaseService';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtractedSchema,
  SchemaColumn,
  SchemaRelation,
  SchemaIndex,
  SchemaSourceType,
  ParsedAST,
} from '../../../shared/analysis-types';

// Patterns for detecting schema types
const PRISMA_MODEL_PATTERN = /model\s+(\w+)\s*\{([^}]+)\}/g;
const PRISMA_FIELD_PATTERN = /(\w+)\s+(\w+)(\[\])?\s*(\?)?\s*(.*)/;
const PRISMA_RELATION_PATTERN = /@relation\s*\([^)]*\)/;

const SQL_CREATE_TABLE_PATTERN = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^;]+)\)/gi;
const SQL_COLUMN_PATTERN = /[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]+\))?)\s*(.*?)(?:,|$)/gi;

const TYPEORM_ENTITY_PATTERN = /@Entity\s*\([^)]*\)/;
const TYPEORM_COLUMN_PATTERN = /@Column\s*\(([^)]*)\)/;
const SEQUELIZE_DEFINE_PATTERN = /sequelize\.define\s*\(\s*['"](\w+)['"]\s*,\s*\{/;
const DRIZZLE_TABLE_PATTERN = /(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"](\w+)['"]\s*,\s*\{/;

export class SchemaExtractorService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Extract schemas from a file based on its type
   */
  async extractFromFile(filePath: string, ast?: ParsedAST): Promise<ExtractedSchema[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Detect schema source type
    const sourceType = this.detectSchemaType(content, filePath);

    switch (sourceType) {
      case 'prisma':
        return this.extractPrismaSchemas(content, filePath);
      case 'sql':
        return this.extractSQLSchemas(content, filePath);
      case 'typeorm':
        return this.extractTypeORMSchemas(content, filePath, ast);
      case 'sequelize':
        return this.extractSequelizeSchemas(content, filePath, ast);
      case 'drizzle':
        return this.extractDrizzleSchemas(content, filePath, ast);
      case 'zod':
        return this.extractZodSchemas(content, filePath, ast);
      case 'json-schema':
        return this.extractJSONSchemas(content, filePath);
      default:
        // Try to extract TypeScript interfaces/types as schemas
        if (ast && (ext === '.ts' || ext === '.tsx')) {
          return this.extractTypeScriptSchemas(ast, filePath);
        }
        return [];
    }
  }

  /**
   * Extract schemas from multiple files
   */
  async extractFromFiles(files: Array<{ path: string; ast?: ParsedAST }>): Promise<ExtractedSchema[]> {
    const allSchemas: ExtractedSchema[] = [];

    for (const { path: filePath, ast } of files) {
      try {
        const schemas = await this.extractFromFile(filePath, ast);
        allSchemas.push(...schemas);
      } catch (error) {
        console.warn(`[SchemaExtractorService] Failed to extract from ${filePath}:`, error);
      }
    }

    return allSchemas;
  }

  /**
   * Detect what type of schema source this file contains
   */
  private detectSchemaType(content: string, filePath: string): SchemaSourceType {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Check file extension first
    if (ext === '.prisma' || fileName === 'schema.prisma') {
      return 'prisma';
    }
    if (ext === '.sql') {
      return 'sql';
    }

    // Check content patterns
    if (content.includes('@Entity') && content.includes('typeorm')) {
      return 'typeorm';
    }
    if (content.includes('sequelize.define') || content.includes('Model.init')) {
      return 'sequelize';
    }
    if (content.includes('pgTable') || content.includes('mysqlTable') || content.includes('sqliteTable')) {
      return 'drizzle';
    }
    if (content.includes('z.object') || content.includes('z.string') || content.includes('from \'zod\'')) {
      return 'zod';
    }
    if (content.includes('"$schema"') || content.includes('"type": "object"')) {
      return 'json-schema';
    }

    // Check for Prisma-like model syntax
    if (PRISMA_MODEL_PATTERN.test(content)) {
      return 'prisma';
    }

    return 'unknown';
  }

  /**
   * Extract Prisma schema models
   */
  private extractPrismaSchemas(content: string, filePath: string): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];
    const modelPattern = /model\s+(\w+)\s*\{([^}]+)\}/g;

    let match;
    while ((match = modelPattern.exec(content)) !== null) {
      const modelName = match[1];
      const modelBody = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const columns: SchemaColumn[] = [];
      const relations: SchemaRelation[] = [];
      const indexes: SchemaIndex[] = [];

      // Parse fields
      const lines = modelBody.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

        // Check for @@index or @@unique
        if (trimmed.startsWith('@@index')) {
          const indexMatch = trimmed.match(/@@index\s*\(\s*\[([^\]]+)\]/);
          if (indexMatch) {
            indexes.push({
              columns: indexMatch[1].split(',').map(c => c.trim()),
              unique: false,
            });
          }
          continue;
        }
        if (trimmed.startsWith('@@unique')) {
          const uniqueMatch = trimmed.match(/@@unique\s*\(\s*\[([^\]]+)\]/);
          if (uniqueMatch) {
            indexes.push({
              columns: uniqueMatch[1].split(',').map(c => c.trim()),
              unique: true,
            });
          }
          continue;
        }

        // Parse field
        const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?\s*(\?)?(.*)$/);
        if (fieldMatch) {
          const [, fieldName, fieldType, isArray, isOptional, rest] = fieldMatch;

          // Check if it's a relation
          if (rest.includes('@relation')) {
            const relMatch = rest.match(/@relation\s*\(\s*(?:fields:\s*\[([^\]]+)\])?\s*,?\s*(?:references:\s*\[([^\]]+)\])?/);
            relations.push({
              type: isArray ? 'one-to-many' : 'many-to-one',
              target: fieldType,
              foreignKey: relMatch?.[1]?.trim(),
            });
          } else {
            columns.push({
              name: fieldName,
              type: this.mapPrismaType(fieldType, isArray === '[]'),
              nullable: isOptional === '?',
              primaryKey: rest.includes('@id'),
              unique: rest.includes('@unique'),
              defaultValue: this.extractPrismaDefault(rest),
            });
          }
        }
      }

      schemas.push({
        name: modelName,
        sourceType: 'prisma',
        file: filePath,
        line: lineNumber,
        columns,
        relations: relations.length > 0 ? relations : undefined,
        indexes: indexes.length > 0 ? indexes : undefined,
        primaryKey: columns.filter(c => c.primaryKey).map(c => c.name),
      });
    }

    return schemas;
  }

  /**
   * Map Prisma types to SQL-like types
   */
  private mapPrismaType(prismaType: string, isArray: boolean): string {
    const typeMap: Record<string, string> = {
      'String': 'VARCHAR',
      'Int': 'INTEGER',
      'BigInt': 'BIGINT',
      'Float': 'FLOAT',
      'Decimal': 'DECIMAL',
      'Boolean': 'BOOLEAN',
      'DateTime': 'TIMESTAMP',
      'Json': 'JSON',
      'Bytes': 'BYTEA',
    };

    const mapped = typeMap[prismaType] || prismaType;
    return isArray ? `${mapped}[]` : mapped;
  }

  /**
   * Extract default value from Prisma field
   */
  private extractPrismaDefault(rest: string): string | undefined {
    const defaultMatch = rest.match(/@default\s*\(([^)]+)\)/);
    if (defaultMatch) {
      return defaultMatch[1].trim();
    }
    return undefined;
  }

  /**
   * Extract SQL CREATE TABLE statements
   */
  private extractSQLSchemas(content: string, filePath: string): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];
    const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^;]+)\)/gi;

    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      const tableName = match[1];
      const tableBody = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const columns: SchemaColumn[] = [];
      const indexes: SchemaIndex[] = [];
      const primaryKey: string[] = [];

      // Parse columns
      const columnDefs = tableBody.split(',').map(c => c.trim()).filter(c => c);

      for (const colDef of columnDefs) {
        // Skip constraints
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|INDEX|KEY|CONSTRAINT)/i.test(colDef)) {
          // Extract PRIMARY KEY
          const pkMatch = colDef.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
          if (pkMatch) {
            primaryKey.push(...pkMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, '')));
          }
          // Extract UNIQUE
          const uniqueMatch = colDef.match(/UNIQUE\s*(?:KEY\s+\w+\s*)?\(([^)]+)\)/i);
          if (uniqueMatch) {
            indexes.push({
              columns: uniqueMatch[1].split(',').map(c => c.trim().replace(/[`"']/g, '')),
              unique: true,
            });
          }
          continue;
        }

        // Parse column definition
        const colMatch = colDef.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\([^)]+\))?)\s*(.*)?$/i);
        if (colMatch) {
          const [, colName, colType, rest = ''] = colMatch;
          columns.push({
            name: colName,
            type: colType.toUpperCase(),
            nullable: !/NOT\s+NULL/i.test(rest),
            primaryKey: /PRIMARY\s+KEY/i.test(rest),
            unique: /UNIQUE/i.test(rest),
            defaultValue: this.extractSQLDefault(rest),
          });

          if (/PRIMARY\s+KEY/i.test(rest)) {
            primaryKey.push(colName);
          }
        }
      }

      schemas.push({
        name: tableName,
        sourceType: 'sql',
        file: filePath,
        line: lineNumber,
        columns,
        indexes: indexes.length > 0 ? indexes : undefined,
        primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      });
    }

    return schemas;
  }

  /**
   * Extract default value from SQL column definition
   */
  private extractSQLDefault(rest: string): string | undefined {
    const defaultMatch = rest.match(/DEFAULT\s+([^\s,]+)/i);
    if (defaultMatch) {
      return defaultMatch[1].replace(/^['"]|['"]$/g, '');
    }
    return undefined;
  }

  /**
   * Extract TypeORM entity schemas
   */
  private extractTypeORMSchemas(content: string, filePath: string, ast?: ParsedAST): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    if (!ast) {
      // Fall back to regex-based extraction
      return this.extractTypeORMWithRegex(content, filePath);
    }

    // Use AST to find classes with @Entity decorator
    for (const cls of ast.classes) {
      // Check if class has @Entity decorator by looking at surrounding lines
      const lines = content.split('\n');
      const decoratorLine = lines[cls.line - 2] || '';

      if (!decoratorLine.includes('@Entity')) continue;

      const columns: SchemaColumn[] = [];
      const relations: SchemaRelation[] = [];

      for (const prop of cls.properties) {
        const propLine = lines[prop.line - 2] || '';
        const propLineCurrent = lines[prop.line - 1] || '';

        if (propLine.includes('@Column') || propLineCurrent.includes('@Column')) {
          columns.push({
            name: prop.name,
            type: prop.type || 'unknown',
            nullable: propLine.includes('nullable: true'),
            primaryKey: propLine.includes('@PrimaryColumn') || propLine.includes('@PrimaryGeneratedColumn'),
            unique: propLine.includes('unique: true'),
          });
        }

        // Check for relations
        if (propLine.includes('@OneToMany') || propLineCurrent.includes('@OneToMany')) {
          relations.push({ type: 'one-to-many', target: prop.type?.replace(/\[\]$/, '') || 'unknown' });
        }
        if (propLine.includes('@ManyToOne') || propLineCurrent.includes('@ManyToOne')) {
          relations.push({ type: 'many-to-one', target: prop.type || 'unknown' });
        }
        if (propLine.includes('@OneToOne') || propLineCurrent.includes('@OneToOne')) {
          relations.push({ type: 'one-to-one', target: prop.type || 'unknown' });
        }
        if (propLine.includes('@ManyToMany') || propLineCurrent.includes('@ManyToMany')) {
          relations.push({ type: 'many-to-many', target: prop.type?.replace(/\[\]$/, '') || 'unknown' });
        }
      }

      schemas.push({
        name: cls.name,
        sourceType: 'typeorm',
        file: filePath,
        line: cls.line,
        columns,
        relations: relations.length > 0 ? relations : undefined,
      });
    }

    return schemas;
  }

  /**
   * Fallback regex-based TypeORM extraction
   */
  private extractTypeORMWithRegex(content: string, filePath: string): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];
    const entityPattern = /@Entity\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g;

    let match;
    while ((match = entityPattern.exec(content)) !== null) {
      const entityName = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      schemas.push({
        name: entityName,
        sourceType: 'typeorm',
        file: filePath,
        line: lineNumber,
        columns: [], // Would need more complex parsing
      });
    }

    return schemas;
  }

  /**
   * Extract Sequelize model schemas
   */
  private extractSequelizeSchemas(content: string, filePath: string, ast?: ParsedAST): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    // Match sequelize.define() pattern
    const definePattern = /(?:sequelize\.define|Model\.init)\s*\(\s*['"](\w+)['"]\s*,\s*\{([^}]+)\}/g;

    let match;
    while ((match = definePattern.exec(content)) !== null) {
      const modelName = match[1];
      const fieldsBody = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const columns: SchemaColumn[] = [];

      // Parse field definitions
      const fieldPattern = /(\w+)\s*:\s*\{([^}]+)\}|(\w+)\s*:\s*DataTypes\.(\w+)/g;
      let fieldMatch;

      while ((fieldMatch = fieldPattern.exec(fieldsBody)) !== null) {
        if (fieldMatch[1] && fieldMatch[2]) {
          // Full definition: fieldName: { type: DataTypes.STRING, ... }
          const fieldName = fieldMatch[1];
          const fieldDef = fieldMatch[2];
          const typeMatch = fieldDef.match(/type\s*:\s*DataTypes\.(\w+)/);

          columns.push({
            name: fieldName,
            type: typeMatch ? typeMatch[1] : 'unknown',
            nullable: !fieldDef.includes('allowNull: false'),
            primaryKey: fieldDef.includes('primaryKey: true'),
            unique: fieldDef.includes('unique: true'),
          });
        } else if (fieldMatch[3] && fieldMatch[4]) {
          // Short definition: fieldName: DataTypes.STRING
          columns.push({
            name: fieldMatch[3],
            type: fieldMatch[4],
            nullable: true,
          });
        }
      }

      schemas.push({
        name: modelName,
        sourceType: 'sequelize',
        file: filePath,
        line: lineNumber,
        columns,
      });
    }

    return schemas;
  }

  /**
   * Extract Drizzle ORM schemas
   */
  private extractDrizzleSchemas(content: string, filePath: string, ast?: ParsedAST): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    // Match table definitions
    const tablePattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*['"](\w+)['"]\s*,\s*\{([^}]+)\}/g;

    let match;
    while ((match = tablePattern.exec(content)) !== null) {
      const varName = match[1];
      const tableName = match[2];
      const columnsBody = match[3];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const columns: SchemaColumn[] = [];

      // Parse column definitions
      const columnPattern = /(\w+)\s*:\s*(\w+)\s*\(\s*['"]?(\w+)?['"]?\s*\)/g;
      let colMatch;

      while ((colMatch = columnPattern.exec(columnsBody)) !== null) {
        const [, colName, colType] = colMatch;
        columns.push({
          name: colName,
          type: this.mapDrizzleType(colType),
          nullable: columnsBody.includes(`${colName}:`) && !columnsBody.includes('.notNull()'),
          primaryKey: columnsBody.includes('.primaryKey()'),
        });
      }

      schemas.push({
        name: tableName,
        sourceType: 'drizzle',
        file: filePath,
        line: lineNumber,
        columns,
      });
    }

    return schemas;
  }

  /**
   * Map Drizzle column types
   */
  private mapDrizzleType(drizzleType: string): string {
    const typeMap: Record<string, string> = {
      'text': 'TEXT',
      'varchar': 'VARCHAR',
      'integer': 'INTEGER',
      'bigint': 'BIGINT',
      'boolean': 'BOOLEAN',
      'timestamp': 'TIMESTAMP',
      'date': 'DATE',
      'json': 'JSON',
      'jsonb': 'JSONB',
      'uuid': 'UUID',
      'serial': 'SERIAL',
      'bigserial': 'BIGSERIAL',
    };
    return typeMap[drizzleType.toLowerCase()] || drizzleType.toUpperCase();
  }

  /**
   * Extract Zod schemas
   */
  private extractZodSchemas(content: string, filePath: string, ast?: ParsedAST): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    // Match z.object() definitions
    const zodPattern = /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*z\.object\s*\(\s*\{([^}]+)\}\s*\)/g;

    let match;
    while ((match = zodPattern.exec(content)) !== null) {
      const schemaName = match[1];
      const schemaBody = match[2];
      const lineNumber = content.substring(0, match.index).split('\n').length;

      const columns: SchemaColumn[] = [];

      // Parse Zod field definitions
      const fieldPattern = /(\w+)\s*:\s*z\.(\w+)\s*\(\s*\)/g;
      let fieldMatch;

      while ((fieldMatch = fieldPattern.exec(schemaBody)) !== null) {
        const [, fieldName, fieldType] = fieldMatch;
        columns.push({
          name: fieldName,
          type: this.mapZodType(fieldType),
          nullable: schemaBody.includes(`${fieldName}:`) && schemaBody.includes('.optional()'),
        });
      }

      schemas.push({
        name: schemaName,
        sourceType: 'zod',
        file: filePath,
        line: lineNumber,
        columns,
      });
    }

    return schemas;
  }

  /**
   * Map Zod types to SQL-like types
   */
  private mapZodType(zodType: string): string {
    const typeMap: Record<string, string> = {
      'string': 'VARCHAR',
      'number': 'NUMERIC',
      'boolean': 'BOOLEAN',
      'date': 'DATE',
      'bigint': 'BIGINT',
      'array': 'ARRAY',
      'object': 'JSON',
    };
    return typeMap[zodType.toLowerCase()] || zodType.toUpperCase();
  }

  /**
   * Extract JSON Schema definitions
   */
  private extractJSONSchemas(content: string, filePath: string): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    try {
      const json = JSON.parse(content);

      if (json.type === 'object' && json.properties) {
        const columns: SchemaColumn[] = [];
        const required = json.required || [];

        for (const [propName, propDef] of Object.entries(json.properties as Record<string, any>)) {
          columns.push({
            name: propName,
            type: this.mapJSONSchemaType(propDef.type, propDef.format),
            nullable: !required.includes(propName),
          });
        }

        schemas.push({
          name: json.title || path.basename(filePath, '.json'),
          sourceType: 'json-schema',
          file: filePath,
          line: 1,
          columns,
        });
      }
    } catch {
      // Not valid JSON, skip
    }

    return schemas;
  }

  /**
   * Map JSON Schema types
   */
  private mapJSONSchemaType(type: string, format?: string): string {
    if (format === 'date-time') return 'TIMESTAMP';
    if (format === 'date') return 'DATE';
    if (format === 'uuid') return 'UUID';
    if (format === 'email') return 'VARCHAR';

    const typeMap: Record<string, string> = {
      'string': 'VARCHAR',
      'integer': 'INTEGER',
      'number': 'NUMERIC',
      'boolean': 'BOOLEAN',
      'array': 'ARRAY',
      'object': 'JSON',
    };
    return typeMap[type] || type?.toUpperCase() || 'UNKNOWN';
  }

  /**
   * Extract TypeScript interfaces/types as schemas
   */
  private extractTypeScriptSchemas(ast: ParsedAST, filePath: string): ExtractedSchema[] {
    const schemas: ExtractedSchema[] = [];

    for (const typeDef of ast.types) {
      if (typeDef.kind === 'interface' && typeDef.properties) {
        const columns: SchemaColumn[] = typeDef.properties.map(prop => ({
          name: prop.name,
          type: prop.type,
          nullable: prop.optional,
        }));

        schemas.push({
          name: typeDef.name,
          sourceType: 'unknown', // TypeScript interface
          file: filePath,
          line: typeDef.line,
          columns,
        });
      }
    }

    return schemas;
  }

  /**
   * Check if a file is likely to contain schema definitions
   */
  isSchemaFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const schemaIndicators = [
      'schema',
      'model',
      'entity',
      'migration',
      '.prisma',
      'types',
      'interface',
    ];

    return schemaIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Get supported file extensions for schema extraction
   */
  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx', '.prisma', '.sql', '.json'];
  }
}
