# Prompt Sequences for Claude Code Integration

## Overview

This document provides detailed prompt sequences and templates for the DevOps Agent to use with Groq-hosted LLMs (Qwen, Kimi K2, Llama). These prompts are designed to be consumed by Claude Code or similar code generation tools to build the DevOps Agent system.

## Model Selection Guide

| Analysis Type | Primary Model | Fallback Model | Context Window | Rationale |
|--------------|---------------|----------------|----------------|-----------|
| Code Structure Analysis | qwen-2.5-32b | llama-3.3-70b | 32k | Fast inference, excellent code comprehension |
| API Contract Generation | kimi-k2 | qwen-2.5-32b | 128k | Superior structured output, deep API spec knowledge |
| Schema Documentation | llama-3.3-70b | qwen-2.5-32b | 128k | Strong SQL understanding, complex relationship mapping |
| Event Flow Analysis | qwen-2.5-32b | llama-3.3-70b | 32k | Pattern recognition, async architecture expertise |
| Infrastructure Analysis | llama-3.3-70b | qwen-2.5-32b | 128k | IaC syntax proficiency, security pattern detection |
| Contract Merging | kimi-k2 | llama-3.3-70b | 128k | Conflict resolution, structured data merging |

## Prompt Template Structure

All prompts follow this standardized structure:

```
[ROLE]
Define the expert persona the LLM should adopt.

[CONTEXT]
Provide repository, feature, and task-specific context.

[TASK]
Clearly state what needs to be accomplished.

[INPUT]
The code, file content, or data to analyze.

[OUTPUT FORMAT]
Specify the exact JSON/YAML structure expected.

[CONSTRAINTS]
Define scope limitations and exclusions.

[REASONING]
Request step-by-step explanation before final output.
```

---

## 1. Repository Understanding Sequence

### Prompt 1.1: Identify Top-Level Structure

**Model**: qwen-2.5-32b

```
[ROLE]
You are an expert software architect specializing in repository analysis.

[CONTEXT]
Repository: {{repo_name}}
Total Files: {{file_count}}
Primary Languages: {{languages}}

[TASK]
Analyze the top-level directory structure and categorize each directory by its purpose.

[INPUT]
{{directory_tree}}

[OUTPUT FORMAT]
Return a JSON array:
[
  {
    "path": "string",
    "name": "string",
    "type": "feature|infrastructure|shared_library|tests|docs|config",
    "confidence": 0.0-1.0,
    "reasoning": "string"
  }
]

[CONSTRAINTS]
- Ignore hidden directories (starting with .)
- Ignore node_modules, venv, __pycache__
- Focus only on top-level directories

[REASONING]
Before providing the JSON output, explain your classification logic for each directory.
```

### Prompt 1.2: Identify Architectural Pattern

**Model**: llama-3.3-70b

```
[ROLE]
You are a senior software architect with expertise in system design patterns.

[CONTEXT]
Repository: {{repo_name}}
Directory Structure: {{directory_summary}}
Detected Frameworks: {{frameworks}}

[TASK]
Determine the overall architectural pattern of this codebase.

[INPUT]
{{directory_structure_json}}

[OUTPUT FORMAT]
{
  "architecture": "monolith|microservices|modular_monolith|serverless",
  "confidence": 0.0-1.0,
  "characteristics": ["string"],
  "communication_patterns": ["REST|gRPC|message_queue|event_bus"],
  "reasoning": "string"
}

[CONSTRAINTS]
- Base your analysis on directory structure and naming conventions
- Consider the presence of API gateways, service directories, or shared libraries

[REASONING]
Explain the key indicators that led to your architectural classification.
```

---

## 2. Feature Analysis Sequence

### Prompt 2.1: Categorize Feature Files

**Model**: qwen-2.5-32b

```
[ROLE]
You are a code organization expert specializing in feature-based architecture.

[CONTEXT]
Repository: {{repo_name}}
Feature: {{feature_name}}
Feature Path: {{feature_path}}

[TASK]
Categorize all files in this feature by their role.

[INPUT]
{{file_list_with_paths}}

[OUTPUT FORMAT]
{
  "api_files": ["string"],
  "schema_files": ["string"],
  "business_logic_files": ["string"],
  "test_files": ["string"],
  "config_files": ["string"],
  "other_files": ["string"]
}

[CONSTRAINTS]
- Use file extensions and naming patterns as primary heuristics
- Files ending in _test.py, .test.js, .spec.ts are test files
- Files named models.py, schema.sql, migrations/ are schema files

[REASONING]
Explain your categorization logic for ambiguous files.
```

### Prompt 2.2: Extract Feature Dependencies

**Model**: qwen-2.5-32b

```
[ROLE]
You are a dependency analysis expert.

[CONTEXT]
Repository: {{repo_name}}
Feature: {{feature_name}}
Available Features: {{all_features}}

[TASK]
Identify all internal feature dependencies and external library dependencies.

[INPUT]
{{concatenated_import_statements}}

[OUTPUT FORMAT]
{
  "internal_dependencies": [
    {
      "feature": "string",
      "imported_modules": ["string"],
      "import_count": integer
    }
  ],
  "external_dependencies": [
    {
      "library": "string",
      "version": "string|null",
      "usage_count": integer
    }
  ]
}

[CONSTRAINTS]
- Only include dependencies that are actually imported
- Distinguish between internal (project) and external (third-party) imports

[REASONING]
Explain how you differentiated internal from external dependencies.
```

---

## 3. API Contract Extraction Sequence

### Prompt 3.1: Identify API Framework

**Model**: qwen-2.5-32b

```
[ROLE]
You are an API framework specialist.

[CONTEXT]
Feature: {{feature_name}}
Language: {{language}}

[TASK]
Identify the API framework(s) used in this feature.

[INPUT]
{{import_statements}}
{{first_100_lines_of_main_file}}

[OUTPUT FORMAT]
{
  "framework": "flask|fastapi|express|gin|django|spring|none",
  "version": "string|null",
  "confidence": 0.0-1.0,
  "routing_mechanism": "decorator|router|controller"
}

[CONSTRAINTS]
- Look for framework-specific imports and decorators
- If no framework is detected, return "none"

[REASONING]
Explain the indicators that identified the framework.
```

### Prompt 3.2: Extract API Endpoints

**Model**: kimi-k2

```
[ROLE]
You are an API documentation specialist with deep knowledge of REST, GraphQL, and gRPC.

[CONTEXT]
Feature: {{feature_name}}
Framework: {{framework}}
Language: {{language}}

[TASK]
Extract all API endpoints from the provided code.

[INPUT]
{{api_route_files_content}}

[OUTPUT FORMAT]
{
  "endpoints": [
    {
      "path": "string",
      "method": "GET|POST|PUT|DELETE|PATCH",
      "handler_function": "string",
      "file": "string",
      "line_number": integer,
      "description": "string|null"
    }
  ]
}

[CONSTRAINTS]
- Extract from decorators like @app.route, @router.get, app.get(), etc.
- Include the handler function name and its location

[REASONING]
Explain how you identified each endpoint and its HTTP method.
```

### Prompt 3.3: Infer Request/Response Schemas

**Model**: kimi-k2

```
[ROLE]
You are an API schema expert specializing in OpenAPI and JSON Schema.

[CONTEXT]
Feature: {{feature_name}}
Endpoint: {{method}} {{path}}
Handler Function: {{handler_name}}

[TASK]
Infer the request and response schemas for this endpoint.

[INPUT]
{{handler_function_code}}
{{related_model_definitions}}

[OUTPUT FORMAT]
{
  "request": {
    "content_type": "application/json|application/x-www-form-urlencoded|multipart/form-data",
    "schema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  },
  "response": {
    "status_code": integer,
    "content_type": "application/json",
    "schema": {
      "type": "object",
      "properties": {},
      "required": []
    }
  }
}

[CONSTRAINTS]
- Use type hints, Pydantic models, or JSDoc comments as primary sources
- If no explicit schema is found, infer from the function body
- Use JSON Schema format for the schema definitions

[REASONING]
Explain how you inferred each field in the request and response schemas.
```

### Prompt 3.4: Generate OpenAPI Specification

**Model**: kimi-k2

```
[ROLE]
You are an OpenAPI specification author.

[CONTEXT]
Feature: {{feature_name}}
Endpoints: {{endpoint_count}}

[TASK]
Generate a complete OpenAPI 3.0 specification for this feature.

[INPUT]
{{endpoints_with_schemas_json}}

[OUTPUT FORMAT]
Return a valid OpenAPI 3.0 YAML document.

[CONSTRAINTS]
- Include all standard OpenAPI sections: info, servers, paths, components
- Use the feature name as the API title
- Include all extracted endpoints with their request/response schemas

[REASONING]
Not required for this prompt. Output only the YAML.
```

---

## 4. Schema Analysis Sequence

### Prompt 4.1: Identify ORM Models

**Model**: llama-3.3-70b

```
[ROLE]
You are a database schema expert with deep knowledge of ORMs.

[CONTEXT]
Feature: {{feature_name}}
Language: {{language}}
Detected ORM: {{orm_framework}}

[TASK]
Extract all ORM model definitions from the provided code.

[INPUT]
{{model_files_content}}

[OUTPUT FORMAT]
{
  "models": [
    {
      "name": "string",
      "table_name": "string",
      "file": "string",
      "columns": [
        {
          "name": "string",
          "type": "string",
          "nullable": boolean,
          "primary_key": boolean,
          "foreign_key": "string|null",
          "default": "string|null"
        }
      ],
      "relationships": [
        {
          "name": "string",
          "type": "one_to_many|many_to_one|many_to_many",
          "target_model": "string"
        }
      ]
    }
  ]
}

[CONSTRAINTS]
- Support SQLAlchemy, Django ORM, TypeORM, Sequelize
- Extract column types, constraints, and relationships

[REASONING]
Explain how you identified each model and its relationships.
```

### Prompt 4.2: Generate SQL DDL

**Model**: llama-3.3-70b

```
[ROLE]
You are a database architect specializing in schema design.

[CONTEXT]
Feature: {{feature_name}}
Database: PostgreSQL (default)

[TASK]
Convert the ORM models to SQL CREATE TABLE statements.

[INPUT]
{{models_json}}

[OUTPUT FORMAT]
Return SQL DDL statements as plain text.

[CONSTRAINTS]
- Use PostgreSQL syntax
- Include primary keys, foreign keys, and indexes
- Add comments for each table describing its purpose

[REASONING]
Not required. Output only the SQL.
```

---

## 5. Event Flow Analysis Sequence

### Prompt 5.1: Identify Event Producers

**Model**: qwen-2.5-32b

```
[ROLE]
You are an event-driven architecture specialist.

[CONTEXT]
Feature: {{feature_name}}
Event Libraries: {{detected_libraries}}

[TASK]
Find all locations where this feature publishes or emits events.

[INPUT]
{{feature_code_files}}

[OUTPUT FORMAT]
{
  "producers": [
    {
      "event_name": "string",
      "topic": "string",
      "file": "string",
      "line_number": integer,
      "method_call": "string",
      "payload_schema": {}
    }
  ]
}

[CONSTRAINTS]
- Look for method calls like publish(), send(), emit(), produce()
- Infer event names from string literals or constants
- Infer payload structure from the data being sent

[REASONING]
Explain how you identified each event producer and inferred its payload.
```

### Prompt 5.2: Identify Event Consumers

**Model**: qwen-2.5-32b

```
[ROLE]
You are an event-driven architecture specialist.

[CONTEXT]
Feature: {{feature_name}}
Event Libraries: {{detected_libraries}}

[TASK]
Find all locations where this feature subscribes to or listens for events.

[INPUT]
{{feature_code_files}}

[OUTPUT FORMAT]
{
  "consumers": [
    {
      "event_name": "string",
      "topic": "string",
      "handler_function": "string",
      "file": "string",
      "line_number": integer
    }
  ]
}

[CONSTRAINTS]
- Look for method calls like subscribe(), listen(), on(), consume()
- Look for decorators like @consumer, @event_handler

[REASONING]
Explain how you identified each event consumer.
```

---

## 6. Infrastructure Analysis Sequence

### Prompt 6.1: Parse Terraform Resources

**Model**: llama-3.3-70b

```
[ROLE]
You are an Infrastructure as Code expert specializing in Terraform.

[CONTEXT]
Repository: {{repo_name}}

[TASK]
Extract all resource definitions from Terraform files.

[INPUT]
{{terraform_files_content}}

[OUTPUT FORMAT]
{
  "provider": "aws|gcp|azure|other",
  "resources": [
    {
      "type": "string",
      "name": "string",
      "attributes": {}
    }
  ]
}

[CONSTRAINTS]
- Focus on resource and provider blocks
- Extract key attributes like region, instance type, etc.

[REASONING]
Explain the infrastructure components you identified.
```

### Prompt 6.2: Identify Third-Party Services

**Model**: llama-3.3-70b

```
[ROLE]
You are a software integration expert.

[CONTEXT]
Feature: {{feature_name}}

[TASK]
Identify all third-party API integrations.

[INPUT]
{{http_client_usage_code}}

[OUTPUT FORMAT]
{
  "integrations": [
    {
      "service": "stripe|sendgrid|twilio|aws_s3|unknown",
      "base_url": "string",
      "endpoints": ["string"],
      "authentication": "api_key|oauth|basic_auth|none"
    }
  ]
}

[CONSTRAINTS]
- Look for HTTP client calls (requests, axios, fetch)
- Identify services by their base URLs

[REASONING]
Explain how you classified each third-party service.
```

---

## 7. Contract Merging Sequence

### Prompt 7.1: Merge Feature Contracts

**Model**: kimi-k2

```
[ROLE]
You are a software architect specializing in contract-driven development.

[CONTEXT]
Repository: {{repo_name}}
Total Features: {{feature_count}}

[TASK]
Merge all feature contracts into a single repository-level contract.

[INPUT]
{{all_feature_contracts_json}}

[OUTPUT FORMAT]
{
  "repository": "string",
  "features": [
    {
      "name": "string",
      "path": "string",
      "dependencies": ["string"]
    }
  ],
  "global_dependency_graph": {
    "nodes": ["string"],
    "edges": [{"from": "string", "to": "string"}]
  },
  "api_summary": {
    "total_endpoints": integer,
    "by_feature": {}
  },
  "schema_summary": {
    "total_tables": integer,
    "by_feature": {}
  }
}

[CONSTRAINTS]
- Resolve any conflicting definitions (prefer most recent)
- Build a complete dependency graph
- Provide summary statistics

[REASONING]
Explain how you resolved any conflicts between feature contracts.
```

---

## 8. Implementation Notes for Claude Code

### Integration Pattern

When using these prompts with Claude Code:

1. **Sequential Execution**: Run prompts in the order specified within each sequence.
2. **Context Passing**: Pass the output of one prompt as input to the next.
3. **Error Handling**: If a prompt fails validation, retry with a clarification prompt.
4. **Caching**: Cache intermediate results to avoid re-running expensive prompts.

### Example Workflow

```python
# Pseudocode for Claude Code integration

def analyze_feature(feature_path):
    # Step 1: Categorize files
    files = scan_directory(feature_path)
    categorized = llm_call(
        model="qwen-2.5-32b",
        prompt=PROMPT_2_1,
        context={"feature_path": feature_path, "file_list": files}
    )
    
    # Step 2: Extract APIs
    api_files = categorized["api_files"]
    endpoints = llm_call(
        model="kimi-k2",
        prompt=PROMPT_3_2,
        context={"api_files": api_files}
    )
    
    # Step 3: Generate OpenAPI spec
    openapi_spec = llm_call(
        model="kimi-k2",
        prompt=PROMPT_3_4,
        context={"endpoints": endpoints}
    )
    
    # Step 4: Save contracts
    save_contract(feature_path, "api_contract.yaml", openapi_spec)
    
    return {
        "feature": feature_path,
        "contracts": {
            "api": "api_contract.yaml"
        }
    }
```

### Validation

After each LLM call:

1. Parse the JSON/YAML output
2. Validate against the expected schema (use Pydantic or JSON Schema)
3. If validation fails, retry with error feedback
4. Log all prompts and responses for debugging

### Rate Limiting

Groq API has rate limits. Implement:

- Exponential backoff on 429 errors
- Request queuing with max concurrent requests
- Token usage tracking per model

---

## 9. Prompt Optimization Tips

### For Better Code Understanding

- Include surrounding context (imports, class definitions)
- Provide language and framework information
- Use actual code snippets, not descriptions

### For Better Structured Output

- Provide example outputs in the prompt
- Use JSON Schema to define expected structure
- Request reasoning before the final answer (chain-of-thought)

### For Better Accuracy

- Use larger models (llama-3.3-70b, kimi-k2) for complex tasks
- Break down complex prompts into smaller, focused prompts
- Validate outputs and provide feedback for corrections

---

## 10. Testing Strategy

### Prompt Evaluation

Create a test suite with:

- Sample code snippets with known outputs
- Golden dataset of expected contract files
- Automated comparison of LLM output vs. expected output

### Metrics

- **Accuracy**: Percentage of correctly extracted entities
- **Completeness**: Percentage of entities found vs. total entities
- **Validity**: Percentage of outputs that pass schema validation
- **Latency**: Average time per prompt execution

### Continuous Improvement

- Log all LLM interactions
- Analyze failures and edge cases
- Iteratively refine prompts based on real-world usage
- A/B test different prompt variations
