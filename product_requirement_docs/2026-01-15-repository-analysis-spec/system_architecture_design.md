# DevOps Agent System Architecture Design

## System Overview

The DevOps Agent is an autonomous system designed to analyze repository structure, understand feature relationships, extract API contracts, track schemas and events, and maintain comprehensive contract documentation at both feature and repository levels.

## Architecture Components

### 1. Repository Analysis Engine

The core analysis engine orchestrates multiple specialized analyzers that work together to build a comprehensive understanding of the codebase.

**Sub-components:**
- **Code Structure Analyzer**: Uses AST parsing to understand code organization, classes, functions, and modules
- **Feature Detector**: Identifies logical features based on directory structure, naming conventions, and code patterns
- **Dependency Mapper**: Tracks imports, function calls, and inter-feature dependencies
- **API Extractor**: Identifies REST endpoints, GraphQL schemas, gRPC services, and other API definitions
- **Schema Analyzer**: Extracts database schemas, ORM models, migration files, and SQL queries
- **Event Tracker**: Identifies event producers, consumers, message queue interactions, and pub/sub patterns
- **Infrastructure Parser**: Analyzes Terraform, Kubernetes manifests, Docker configs, and CI/CD pipelines

### 2. Multi-Model LLM Orchestration Layer

The system leverages multiple Groq-hosted models for different analysis tasks, optimizing for speed, cost, and accuracy.

**Model Selection Strategy:**

| Task Type | Primary Model | Fallback Model | Rationale |
|-----------|--------------|----------------|-----------|
| Code Structure Analysis | Qwen-2.5-32b | Llama-3.3-70b | Fast inference, good code understanding |
| API Contract Generation | Kimi K2 | Qwen-2.5-32b | Strong structured output, API spec knowledge |
| Schema Documentation | Llama-3.3-70b | Qwen-2.5-32b | Better SQL understanding, complex relationships |
| Event Flow Analysis | Qwen-2.5-32b | Llama-3.3-70b | Pattern recognition, async architecture |
| Infrastructure Analysis | Llama-3.3-70b | Qwen-2.5-32b | Better with IaC syntax, security patterns |
| Contract Merging | Kimi K2 | Llama-3.3-70b | Conflict resolution, structured merging |

**Orchestration Patterns:**
- **Sequential Analysis**: Each analyzer runs in sequence, building on previous results
- **Parallel Processing**: Independent analyses (e.g., schema + events) run concurrently
- **Iterative Refinement**: Initial broad analysis followed by targeted deep dives
- **Consensus Building**: Multiple models analyze critical sections, results are reconciled

### 3. Contract Management System

Maintains and updates contract files at multiple levels of granularity.

**Contract Hierarchy:**
```
repository/
├── contracts/
│   ├── repo_contract.json          # Merged repository-level contract
│   ├── features/
│   │   ├── auth/
│   │   │   ├── feature_contract.json
│   │   │   ├── api_contract.yaml
│   │   │   └── schema_contract.sql
│   │   ├── payments/
│   │   │   ├── feature_contract.json
│   │   │   ├── api_contract.yaml
│   │   │   └── events_contract.json
│   │   └── ...
│   └── relationships.json          # Inter-feature dependencies
```

**Contract File Types:**
- **Feature Contract**: High-level feature description, dependencies, APIs, schemas, events
- **API Contract**: OpenAPI/AsyncAPI/gRPC specs for all endpoints
- **Schema Contract**: Database schema definitions, migrations, relationships
- **Events Contract**: Event types, producers, consumers, message formats
- **Infrastructure Contract**: Required infrastructure, third-party services, configurations

### 4. Change Detection & Incremental Updates

Monitors repository changes and triggers targeted contract updates.

**Change Detection Strategy:**
- Git diff analysis to identify modified files
- Impact analysis to determine affected features
- Dependency graph traversal to find downstream impacts
- Selective re-analysis of only affected components

**Update Coordination:**
- File-level locking to prevent concurrent edits
- Atomic updates with rollback capability
- Version tracking for contract evolution
- Merge conflict detection and resolution

### 5. Prompt Engineering Framework

A structured prompt system that guides LLMs through complex analysis tasks.

**Prompt Structure Template:**
```
[ROLE] You are an expert software architect analyzing a codebase.

[CONTEXT]
- Repository: {repo_name}
- Feature: {feature_name}
- Analysis Type: {analysis_type}
- Related Features: {dependencies}

[TASK]
Analyze the following code and extract {target_information}.

[INPUT]
{code_or_file_content}

[OUTPUT FORMAT]
Provide your analysis in the following JSON structure:
{expected_schema}

[CONSTRAINTS]
- Focus only on {specific_scope}
- Ignore test files and mock data
- Include confidence scores for each finding

[REASONING]
Before providing the final output, explain your reasoning step-by-step.
```

**Prompt Sequences for Complex Analysis:**

1. **Repository Understanding Sequence**:
   - Prompt 1: "Identify all top-level directories and their purposes"
   - Prompt 2: "For each directory, determine if it represents a feature or infrastructure"
   - Prompt 3: "Extract the primary programming languages and frameworks used"
   - Prompt 4: "Identify the architectural pattern (monolith, microservices, modular monolith)"

2. **Feature Analysis Sequence**:
   - Prompt 1: "List all files in this feature and categorize them (API, schema, business logic, tests)"
   - Prompt 2: "Extract all API endpoints defined in this feature"
   - Prompt 3: "Identify all database tables/models used by this feature"
   - Prompt 4: "Find all events this feature produces or consumes"
   - Prompt 5: "Map dependencies on other features and external services"

3. **API Contract Extraction Sequence**:
   - Prompt 1: "Identify the API framework and routing mechanism"
   - Prompt 2: "Extract endpoint paths, HTTP methods, and handler functions"
   - Prompt 3: "Analyze request/response schemas from code or decorators"
   - Prompt 4: "Identify authentication and authorization requirements"
   - Prompt 5: "Generate OpenAPI specification from extracted information"

4. **Schema Analysis Sequence**:
   - Prompt 1: "Identify ORM models and database tables"
   - Prompt 2: "Extract column definitions, types, and constraints"
   - Prompt 3: "Map relationships (foreign keys, joins, associations)"
   - Prompt 4: "Analyze migration files for schema evolution"
   - Prompt 5: "Generate comprehensive schema documentation"

5. **Event Flow Analysis Sequence**:
   - Prompt 1: "Identify message queue libraries and event bus implementations"
   - Prompt 2: "Extract event producer locations and event types"
   - Prompt 3: "Find event consumers and their handlers"
   - Prompt 4: "Map event flow between features"
   - Prompt 5: "Document event schemas and contracts"

6. **Contract Merging Sequence**:
   - Prompt 1: "Review all feature-level contracts"
   - Prompt 2: "Identify overlapping or conflicting definitions"
   - Prompt 3: "Resolve conflicts using dependency priority and timestamps"
   - Prompt 4: "Merge contracts into unified repository-level contract"
   - Prompt 5: "Validate merged contract for consistency and completeness"

## Data Flow

```
1. Repository Scan
   ↓
2. Feature Detection & Categorization
   ↓
3. Parallel Analysis (per feature):
   - Code Structure → AST parsing
   - APIs → Endpoint extraction
   - Schemas → Model extraction
   - Events → Producer/Consumer mapping
   - Infrastructure → Config parsing
   ↓
4. Relationship Mapping
   ↓
5. Contract Generation (per feature)
   ↓
6. Contract Validation & Merging
   ↓
7. Repository-level Contract Output
   ↓
8. Change Detection (continuous)
   ↓
9. Incremental Updates (on changes)
```

## Integration with Claude Code

The system is designed to provide structured output that Claude Code can consume for code generation and modification tasks.

**Output Formats for Claude Code:**
- **Feature Specification**: JSON describing feature purpose, dependencies, and contracts
- **API Contracts**: OpenAPI/AsyncAPI specs for endpoint generation
- **Schema Definitions**: SQL DDL or ORM model definitions
- **Event Contracts**: AsyncAPI specs for event-driven communication
- **Dependency Graph**: JSON graph of feature relationships
- **Infrastructure Requirements**: Terraform/Kubernetes templates

**Integration Points:**
- Contract files stored in repository for version control
- JSON/YAML formats for machine readability
- Markdown documentation for human readability
- Git hooks for automatic updates on commit
- CI/CD integration for contract validation

## Scalability Considerations

**Performance Optimizations:**
- Incremental analysis (only changed files)
- Parallel processing of independent features
- Caching of analysis results
- Smart file filtering (ignore tests, vendor code)
- Chunked processing for large files

**Coordination Mechanism:**
- Distributed locking for multi-agent scenarios
- Message bus for agent communication
- Conflict detection and resolution
- Atomic contract updates
- Version control integration

## Security & Privacy

**Code Analysis Security:**
- Local processing (no code sent to external services except LLM API)
- Credential detection and masking
- Sensitive data filtering
- API key rotation support

**Contract Storage:**
- Encrypted storage for sensitive contracts
- Access control for contract repositories
- Audit logging for contract changes
- Compliance with data governance policies
