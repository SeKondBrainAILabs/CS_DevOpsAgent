> # Implementation Roadmap & Migration Guide
> 
> **Author**: Manus AI
> 
> **Version**: 1.0
> 
> **Date**: 2026-01-15

## 1. Introduction

This document provides a strategic implementation roadmap for integrating the new **Repository Analysis Engine** into the existing DevOps Agent. It also serves as a migration guide for users transitioning to the enhanced version.

The roadmap is designed as a phased, iterative approach that minimizes disruption and delivers value incrementally.

## 2. Implementation Roadmap

The development is structured into four main phases, each building upon the last. This approach allows for continuous integration and testing while progressively adding the new capabilities.

### Phase 1: Core Engine & LLM Orchestration (2 Weeks)

**Goal**: Establish the foundational components for code analysis and enhance the LLM interaction layer.

| Epic | Key User Stories |
| :--- | :--- |
| **EPIC-010: LLM Orchestration** | US-030: Implement Model Selection Strategy<br>US-031: Load and Populate Prompt Templates<br>US-032: Handle API Errors with Retries<br>US-033: Implement Model Fallback |
| **EPIC-001: Repo Scanning** | US-002: Scan Repository File Structure (Enhanced)<br>US-003: Detect Programming Languages<br>US-004: Identify Logical Features (LLM-based) |
| **EPIC-002: Code Structure Analysis** | Create placeholder modules for `code-parser.js` and `python_parser.py`. Implement basic `tree-sitter` integration for JavaScript. |

**Outcomes**: 
- A robust, multi-model LLM orchestration service.
- A new `PromptManager` for handling templated prompts.
- The ability to scan a repository and produce a high-level map of its features and languages.
- A new CLI command: `s9n-devops-agent scan-repo`.

### Phase 2: Language Parsers & Extractors (3 Weeks)

**Goal**: Build the core analysis capabilities for extracting detailed information from the source code.

| Epic | Key User Stories |
| :--- | :--- |
| **EPIC-002: Code Structure Analysis** | US-005: Parse Python Code with AST<br>US-006: Parse JavaScript/TypeScript Code<br>US-007: Identify Function Call Relationships |
| **EPIC-003: API Extraction** | US-008: Extract API Endpoints (Flask, Express)<br>US-009: Infer Request/Response Schemas |
| **EPIC-004: Schema Analysis** | US-011: Extract ORM Models (SQLAlchemy, Sequelize)<br>US-012: Generate SQL DDL from ORM Models |
| **EPIC-005: Event Tracking** | US-014: Identify Event Producers<br>US-015: Identify Event Consumers |

**Outcomes**:
- Functional parsers for Python and JavaScript/TypeScript.
- The ability to extract detailed API and database schema information.
- The system can identify basic event-driven patterns.
- The analysis engine produces structured JSON output for each analyzer.

### Phase 3: Contract Generation & Dependency Mapping (2 Weeks)

**Goal**: Connect the analysis engine to the contract system and build a complete picture of the repository's architecture.

| Epic | Key User Stories |
| :--- | :--- |
| **EPIC-008: Contract Generation** | US-023: Generate Feature Contract<br>US-024: Merge Feature Contracts<br>US-025: Validate Contract Schemas |
| **EPIC-007: Dependency Mapping** | US-020: Build Dependency Graph<br>US-021: Detect Circular Dependencies<br>US-022: Identify External Dependencies |
| **EPIC-006: Infra Analysis** | US-017: Parse Terraform Files<br>US-018: Parse Kubernetes Manifests |

**Outcomes**:
- The system can automatically generate and populate all contract files (`API_CONTRACT.md`, `DATABASE_SCHEMA_CONTRACT.md`, etc.).
- A `repo_contract.json` is created, providing a unified view of the repository.
- A dependency graph is generated and saved in `relationships.json`.
- A new CLI command: `s9n-devops-agent analyze-repo --generate-contracts`.

### Phase 4: Integration & Automation (2 Weeks)

**Goal**: Fully integrate the new analysis engine into the existing DevOps Agent workflow and automate its execution.

| Epic | Key User Stories |
| :--- | :--- |
| **EPIC-009: Change Detection** | US-026: Integrate as Pre-Commit Hook<br>US-027: Detect Changed Files<br>US-028: Perform Incremental Analysis<br>US-029: Auto-Commit Updated Contracts |
| **Kora Integration** | Create new skills for Kora to trigger analysis and answer questions about the repository structure. |
| **Documentation** | Update all user-facing documentation, including the main `README.md` and the `houserules.md`. |

**Outcomes**:
- Contracts are automatically updated on every commit.
- Kora can answer questions like, "What are the API endpoints for the auth feature?"
- The system is fully documented and ready for release.

## 3. Migration Guide for Existing Users

This guide is for users who are already using the `s9n-devops-agent` and want to upgrade to the new version with repository analysis capabilities.

### 3.1. What's New?

The new version introduces the **Repository Analysis Engine**, which provides:
- **Automated Contract Generation**: No more manual editing of contract files. The agent keeps them in sync with your code.
- **Deep Code Intelligence**: The agent now understands your code, including APIs, database models, and feature dependencies.
- **Enhanced Kora Skills**: Ask Kora questions about your codebase architecture.
- **New CLI Commands**: `analyze-repo` and `update-contracts` for on-demand analysis.

### 3.2. Upgrading to the New Version

1.  **Update the Package**: Install the latest version of the agent globally.
    ```bash
    npm install -g s9n-devops-agent@latest
    ```

2.  **Run the Setup Wizard Again**: The wizard will detect your existing configuration and prompt you to add new settings for the analysis engine.
    ```bash
    s9n-devops-agent setup
    ```
    You will be asked to confirm the path to your Python executable if it's not in the system PATH.

3.  **Perform an Initial Analysis**: Run a full analysis of your repository to populate the contracts for the first time.
    ```bash
    s9n-devops-agent analyze-repo --generate-contracts
    ```
    This will overwrite your existing manual contract files with auto-generated content. **It is highly recommended to back up your `House_Rules_Contracts/` directory before running this command.**

4.  **Update Your Git Hook**: If you have a custom `pre-commit` hook, you may need to update it to include the new contract update step. The setup wizard will offer to do this automatically.

### 3.3. Breaking Changes

- **Manual Contract Edits**: Manually editing contract files is no longer the recommended workflow. Changes should be made to the code, and the agent will update the contracts accordingly. If you need to override a contract, you can add a `.contract-override.json` file in the feature directory.
- **`generate-contracts.js` Script**: This script is now part of the internal analysis engine and is not intended to be run directly.

### 3.4. New Workflow

Your daily workflow remains largely the same, but with added automation:

1.  **Start a session**: `s9n-devops-agent start`
2.  **Make your code changes**.
3.  **Commit your changes**: When you commit, the `pre-commit` hook will automatically:
    - Analyze your changes.
    - Update the relevant contract files.
    - Add the updated contracts to your commit.
4.  **Close your session**: `s9n-devops-agent close`

You can also ask Kora to perform analysis at any time: `s9n-devops-agent chat` -> "Kora, update the contracts for the payments feature."

## 4. Conclusion

This roadmap provides a clear, phased approach to developing and integrating the new repository analysis capabilities. By following this plan, we can build upon the solid foundation of the existing DevOps Agent to create a truly intelligent and indispensable tool for modern software development.

The migration path for existing users is straightforward, ensuring a smooth transition to the more powerful, automated system.
