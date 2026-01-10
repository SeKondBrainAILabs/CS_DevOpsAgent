name: repo-analyzer
description: Performs comprehensive repository analysis. Use when starting 
  a new project, onboarding to a codebase, or preparing for spec generation.
---

# Repository Analysis Skill

## Analysis Phases

### Phase 1: Structure Discovery
1. Run `tree -L 3 -I 'node_modules|__pycache__|.git|dist|build'`
2. Identify entry points (main.*, index.*, app.*)
3. Map directory conventions (src/, lib/, tests/, docs/)

### Phase 2: Dependency & Config Analysis
- Read package.json / pyproject.toml / Cargo.toml / go.mod
- Identify frameworks, libraries, and their versions
- Note dev dependencies vs production dependencies
- Extract scripts/commands available

### Phase 3: Architecture Extraction
- Identify architectural patterns (MVC, layered, microservices, monolith)
- Map module boundaries and responsibilities
- Document data flow between components
- Identify external integrations (APIs, databases, services)

### Phase 4: Code Pattern Analysis
- Extract interfaces, types, and contracts
- Identify domain models and entities
- Document API endpoints if present
- Note authentication/authorization patterns

### Phase 5: Gap & Debt Assessment
- Missing tests or low coverage areas
- Incomplete documentation
- TODO/FIXME comments
- Outdated dependencies

## Output Format

Generate a JSON file: `analysis-output.json`
```json
{
  "repository": {
    "name": "",
    "primary_language": "",
    "frameworks": [],
    "architecture_pattern": ""
  },
  "components": [
    {
      "name": "",
      "path": "",
      "responsibility": "",
      "dependencies": [],
      "exports": []
    }
  ],
  "data_models": [],
  "api_contracts": [],
  "external_integrations": [],
  "identified_gaps": [],
  "concepts_extracted": []
}
```
