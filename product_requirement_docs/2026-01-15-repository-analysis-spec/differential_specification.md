> # Differential Specification: DevOps Agent
> 
> **Author**: Manus AI
> 
> **Version**: 1.0
> 
> **Date**: 2026-01-15

## 1. Introduction

This document provides a differential specification that bridges the gap between the current implementation of the DevOps Agent on the `dev_sdd_claude_rebuildUX` branch and the target system defined in the previously generated Product Requirements Document (PRD) and Technical Specification.

Its purpose is to guide the development effort by clearly identifying what exists, what is missing, and how to integrate new capabilities into the existing application.

## 2. System State Analysis

### 2.1. Current State: Git Workflow Automator

The current system is a robust **Node.js-based Git workflow automation tool**. Its primary function is to manage development sessions for multiple AI agents, prevent merge conflicts, and enforce project standards through a manual contract system.

**Core Strengths:**
- **Multi-Agent Coordination**: Manages file locks and isolated worktrees.
- **Session Management**: Automates the lifecycle of development tasks (start, work, close, merge).
- **Contract Infrastructure**: Provides a well-defined structure and validation for manually created contract files.
- **AI-Assisted Workflow**: Uses Groq for conversational control (Kora) and generating commit messages.

### 2.2. Target State: Repository Intelligence Platform

The target system is a **repository analysis and contract generation platform**. Its primary function is to autonomously understand a codebase using LLMs and maintain a set of "living" contracts that are always synchronized with the code.

**Core Capabilities:**
- **Automated Code Analysis**: Uses Abstract Syntax Trees (AST) and LLM prompts to parse and understand code.
- **Intelligent Feature Detection**: Automatically identifies logical features within a repository.
- **Dynamic Contract Generation**: Generates API, schema, and event contracts directly from the source code.
- **Multi-Model LLM Orchestration**: Leverages the best model for each specific analysis task (Qwen, Kimi, Llama).

## 3. Gap Analysis

The fundamental gap is the absence of an **automated repository analysis engine**. The current system has the destination for the data (the contract files) but lacks the vehicle to collect and populate that data automatically.

| Feature Area | Gap Description |
| :--- | :--- |
| **Repository Analysis** | The system cannot scan a repository to identify its structure, languages, or features. This is the largest and most critical gap. |
| **Code Intelligence** | There is no capability to parse source code (AST), extract classes/functions, or build call graphs. The system is code-agnostic. |
| **Contract Generation** | Contracts are manually created. The existing `generate-contracts.js` script performs only basic regex-based scanning and does not populate the contracts in the required detail. |
| **API & Schema Extraction** | The system cannot automatically identify API endpoints or database schemas from code. This information must be entered manually into the contract files. |
| **Dependency Mapping** | No mechanism exists to build a dependency graph between features or track external library usage beyond a simple `package.json` scan. |
| **LLM Orchestration** | The current LLM integration is for conversational control and commit messages, not for deep code analysis. It lacks multi-model support and a structured prompt management system. |
| **Language Support** | The system is built in Node.js. The target specification requires analysis of Python and Go, which is not supported. |

## 4. Proposed Changes and Implementation Strategy

To bridge the gap, we propose enhancing the existing Node.js application with a new, integrated **Repository Analysis Engine**. This engine can be built as a combination of Node.js and Python modules to leverage the best of both ecosystems.

### 4.1. New Component: Repository Analysis Engine

This engine will be a new set of modules responsible for all code analysis and contract generation tasks.

**Architecture:**
- A main Node.js controller that orchestrates the analysis workflow.
- JavaScript modules using `tree-sitter` for parsing JavaScript/TypeScript.
- A Python sub-process or microservice for parsing Python and Go code (using `ast` and other Python libraries).
- Data exchange between Node.js and Python will happen via JSON over stdin/stdout or a simple REST API.

### 4.2. Enhancement of Existing Components

- **`scripts/contract-automation/`**: The existing scripts will be significantly upgraded.
    - **`generate-contracts.js`**: Will be refactored to be the main controller for the new Analysis Engine. It will delegate parsing to language-specific modules.
    - **`analyze-with-llm.js`**: Will be enhanced to become the **LLM Orchestrator**, incorporating the multi-model strategy and prompt sequences from the target spec.
- **`House_Rules_Contracts/`**: The structure is sound and will be kept. The new engine will automatically populate and update these files.
- **CLI (`s9n-devops-agent`)**: A new command will be added.
    - `s9n-devops-agent analyze-repo`: Triggers a full analysis of the repository.
    - `s9n-devops-agent update-contracts`: Runs an incremental analysis based on Git changes.

### 4.3. Detailed Implementation Plan

| Epic from Spec | Action Required |
| :--- | :--- |
| **EPIC-001: Repo Scanning** | Enhance `generate-contracts.js` to perform a full file system scan and implement LLM-based feature detection. |
| **EPIC-002: Code Structure Analysis** | Create a new `code-parser.js` module using `tree-sitter`. Create a new `python_parser.py` script for Python/Go analysis. |
| **EPIC-003: API Extraction** | Add an `api-extractor.js` module that uses the AST from the parser to find routes and schemas. |
| **EPIC-004: Schema Analysis** | Add a `schema-analyzer.js` module to parse ORM models (e.g., Sequelize, Prisma) from the AST. |
| **EPIC-005: Event Tracking** | Add an `event-tracker.js` module to find event bus patterns in the code. |
| **EPIC-006: Infra Analysis** | Add an `infra-parser.js` module to parse `*.tf` and `*.yaml` files. |
| **EPIC-007: Dependency Mapping** | Add a `dependency-mapper.js` module that uses `networkx` (via a Python script) to build and store the graph. |
| **EPIC-008: Contract Generation** | Refactor `generate-contracts.js` to take the JSON output from all analyzers and populate the Markdown/JSON contract files using templates. |
| **EPIC-009: Change Detection** | Integrate the new analysis engine with the existing Git hooks. The hook will call `s9n-devops-agent update-contracts`. |
| **EPIC-010: LLM Orchestration** | Refactor `analyze-with-llm.js` into a full-fledged `LLMOrchestrator` with a prompt template system and multi-model support. |

## 5. Integration Plan

The new analysis engine will be integrated into the existing DevOps Agent workflow without disrupting its current functionality.

1.  **CLI Integration**: The new `analyze-repo` and `update-contracts` commands will be added to the main `s9n-devops-agent` binary defined in `package.json`.
2.  **Git Hook Integration**: The existing `pre-commit` hook can be modified to call `s9n-devops-agent update-contracts` in addition to its current tasks.
3.  **Kora Integration**: The conversational agent (Kora) can be taught new skills to trigger analysis. A new entry in `kora-skills.json` could be:
    ```json
    {
      "intent": "update repository contracts",
      "command": "s9n-devops-agent update-contracts",
      "description": "Analyzes recent changes and updates all contract files."
    }
    ```
4.  **Configuration**: All new settings (e.g., Python path, analysis depth) will be added to the existing `.env` file and managed by the `setup-cs-devops-agent.js` wizard.

## 6. Conclusion

The existing DevOps Agent is a strong foundation for Git automation and agent coordination. By implementing the proposed **Repository Analysis Engine**, we can elevate the system into a true Repository Intelligence Platform, fulfilling the vision of the target specification.

The recommended path is an **evolutionary, not revolutionary**, approach: enhance the current Node.js application by adding new analysis modules (some in Python) and integrating them seamlessly into the existing, robust workflow.
