# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

This repo contains the `s9n-devops-agent` CLI, a Node-based DevOps helper that automates git commits and branch management for AI coding agents. It creates isolated worktrees/sessions per agent, coordinates multi-agent edits via file locks, and enforces project-specific house rules and testing policies.

## Key documentation to read first

These files contain the canonical behavior and expectations for this project:

- `README.md` – high-level feature overview, quick start, and user-facing commands.
- `docs/INSTALLATION_GUIDE.md` – installation methods, `npm start` behavior, and how house rules and file coordination are bootstrapped.
- `houserules.md` and `docs/houserules.md` – authoritative house rules for AI agents (file coordination protocol, test location/naming, commit-message format, logging, and multi-agent handshake).
- `docs/FILE_COORDINATION_GUIDE.md` – detailed explanation of `.file-coordination/active-edits/*.json` declarations and conflict resolution.
- `docs/MULTI_AGENT_WORKFLOWS.md` – high-level multi-agent patterns and how sessions, branches, and worktrees fit together.
- `docs/SESSION_MANAGEMENT.md` – how sessions are started/closed and how worktrees and session branches are cleaned up.
- `docs/branch-management.md` – architecture and configuration of the session → daily → weekly → target branch hierarchy.
- `docs/TESTING.md`, `docs/testing-guide.md`, `docs/AUTOMATED_TESTING_STRATEGY.md`, and `test_scripts/README.md` – automated testing strategy, multi-session/multi-agent tests, and how to run them.
- `docs/V2_QUICK_REFERENCE.md` and `docs/V2_FINAL_SUMMARY.md` – v2 UI/help/tutorial modules and how they interact with the CLI.

## Commands

### Setup & CLI entrypoints

- Install dependencies:
  - `npm install`
- (Optional) Link CLI globally to test as an installed package:
  - `npm link`  
    This makes `s9n-devops-agent` available on your PATH.
- Start the interactive DevOps Agent session manager (dogfooding this repo):
  - `npm start`  
    or `./start-devops-session.sh`
- Session lifecycle helpers (run from repo root):
  - `npm run devops:start` – start session via `src/session-coordinator.js`.
  - `npm run devops:list` – list active sessions.
  - `npm run devops:close` – interactively close/merge sessions and tear down worktrees.
  - `npm run devops:cleanup` – clean up stale/abandoned sessions.
  - `npm run setup` – run the setup wizard (`src/setup-cs-devops-agent.js`).
- House rules management:
  - `npm run house-rules:status` – check whether house rules are present and up to date.
  - `npm run house-rules:update` – create or update house rules, preserving user sections.
  - `npm run house-rules:repair` – repair missing or corrupted house rules using templates.

### Tests

Core JavaScript tests are Jest-based and live under `test_cases/**`:

- Run all Jest tests:
  - `npm test`
- Watch mode:
  - `npm run test:watch`
- Coverage:
  - `npm run test:coverage`
- Focus on a directory or single spec (Jest pattern is passed through):
  - `npm test -- test_cases/<area>/<component>/`
  - `npm test -- test_cases/<area>/<component>/YYYYMMDD_slug_spec.js`

Multi-language / targeted test runner (preferred for routine development):

- Only tests for areas changed relative to `origin/main`:
  - `scripts/run-tests --changed`
- Force full suite across supported languages (Node, Python, etc., where present):
  - `scripts/run-tests --all`
- Run tests only for a specific test directory:
  - `scripts/run-tests test_cases/<area>/<component>`

Multi-agent and end-to-end test scripts (shell-based; slower, use when touching coordination or branch orchestration):

- Quick multi-agent smoke test:
  - `./test_scripts/multi-agent/quick-verify.sh`
- Comprehensive multi-agent verification:
  - `./test_scripts/multi-agent/verify-multi-agent.sh`
- End-to-end multi-session test of the full system:
  - `./test_scripts/test-e2e-multi-session.sh`
- Standalone Git multi-session behavior (no DevOps Agent dependencies):
  - See `docs/TESTING.md` and the scripts under `test_scripts/` such as `test-standalone-multi-session.sh`.

### Single-test workflow for Warp

When modifying a specific feature:

1. Add or update a test under `test_cases/<area>/<component>/YYYYMMDD_<slug>_spec.js` (see naming and structure in `houserules.md`).
2. Run just that test or directory:
   - `npm test -- test_cases/<area>/<component>/YYYYMMDD_<slug>_spec.js`, or
   - `scripts/run-tests test_cases/<area>/<component>`.
3. Before you consider a change ready for merge or release, at minimum run:
   - `scripts/run-tests --changed`  
   and, for large/core changes, `npm test`.

## Architecture overview

### Top-level layout

- NPM package `s9n-devops-agent` (see `package.json`) with:
  - CLI binary `bin/cs-devops-agent` mapped via the `bin` field.
  - Main worker/runtime and supporting modules in `src/`.
  - Bash helpers and shared tooling in `scripts/` and `test_scripts/`.
  - Jest tests and branch-management helpers under `test_cases/`.
  - Documentation under `docs/`.
- `local_deploy/` (gitignored) is the sandbox for this repo when dogfooding the agent:
  - Worktrees, session locks, logs, and other local-only state live here.
  - Logic in `src/` is written to treat `local_deploy/` as an implementation detail that should not be version-controlled.

### Core runtime and branch management

- `src/cs-devops-agent-worker.js` is the long-running process that automates git operations for a single repo or worktree. It is responsible for:
  - Watching the working directory (or an agent-specific worktree) for file changes using `chokidar`.
  - Locating the active commit message file (`AC_MSG_FILE`, `.devops-commit-<session>.msg`, or `.claude-commit-msg`).
  - Enforcing commit-message requirements (minimum size, Conventional Commit-style headers, optional freshness after last non-message change).
  - Ensuring the current branch matches the expected target: either a static branch via `AC_BRANCH` or a daily branch `${AC_BRANCH_PREFIX}${YYYY-MM-DD}`.
  - Implementing the daily + version branch scheme described in `docs/branch-management.md`:
    - Daily branches (e.g., `dev_sdd_YYYY-MM-DD`).
    - Version branches (e.g., `v0.20`, `v0.21`) with configurable micro-increment via `AC_VERSION_INCREMENT`.
    - A rollover process that merges the last version branch into `main`, creates the next version branch from `origin/main`, merges the last daily branch into that version branch, and then creates/pushes today’s daily branch.
  - Handling `git push` failures due to the branch being behind remote by pulling (`git pull --no-rebase`) and retrying, including initial upstream setup for new branches.
  - Detecting changes to infrastructure-relevant files (configs, dependency manifests, Dockerfiles, workflows, migrations, routes, etc.), and using `updateInfrastructureDoc()` to append human-readable entries to `Documentation/infrastructure.md`.
  - Optionally restarting Docker containers based on session config (`.devops-session.json`) via `src/docker-utils.js`.
  - Providing an interactive command loop (`help`, `status`, `settings`, `commit`, `push`, `exit`) while the worker is running.

- Branch and session helpers (wired into CLI scripts and `npm` commands):
  - `src/session-coordinator.js` – orchestrates session creation/listing/cleanup and coordinates with worktrees and session locks.
  - `src/enhanced-close-session.js` and `src/close-session.js` – interactive session closing; can merge session branches into configured targets, remove worktrees, and clean up lock files.
  - `src/weekly-consolidator.js` – consolidates daily branches into weekly branches according to policy in `docs/branch-management.md`.
  - `src/orphan-cleaner.js` – detects and optionally cleans up sessions that have been inactive beyond `orphanSessionThresholdDays`.
  - `src/branch-config-manager.js` – manages `local_deploy/project-settings.json` and exposes the branch-management configuration interface.

### Worktrees, multi-agent support, and coordination

- Worktree/session layer:
  - `src/worktree-manager.js` – manages `.worktrees/` for target projects where DevOps Agent is installed. `cs-devops-agent-worker.js` explicitly avoids using worktrees when it detects it is running inside this core repo so that development stays simple here.
  - `src/run-with-agent.js` and `src/claude-session-manager.js` – helper flows that start the worker with per-agent configuration (agent name, task slug, commit message file, etc.).
  - `docs/SESSION_MANAGEMENT.md` documents how sessions are started, how command files like `.devops-command-<sessionId>` can be used to control the worker, and how clean shutdown/cleanup is supposed to behave.

- File coordination and lock protocol:
  - `src/file-coordinator.cjs` – CommonJS module used by the worker to:
    - Inspect `.file-coordination/active-edits/*.json` declarations.
    - Detect undeclared edits and potential multi-agent conflicts.
    - Write advisory conflict reports (Markdown) under Git metadata, which other tools (and humans) can surface.
  - `.file-coordination/active-edits/<agent>-<session>.json` – per-agent declarations of which files are being edited; the schema and required behavior (declare first, hold locks for entire session, release only on session close) are defined in `houserules.md` and `docs/FILE_COORDINATION_GUIDE.md`.
  - Higher-level coarse-grained coordination uses the “prep handshake” described in the `Prep TODO & Coordination (Multi-Agent Handshake)` section of `houserules.md`:
    - Agents write prep plans to `.ac-prep/<agent>.json`.
    - The commit agent responds with `.ac/ack/<agent>.json` including `status: ok|blocked|queued` and shard reservations.
    - Alerts and shard claims are stored under `.git/.ac/`.

### House rules, templates, and documentation system

- House rules for this repo and for downstream projects are kept in several Markdown files:
  - Root `houserules.md` – comprehensive rules for this repository when dogfooding the DevOps Agent: file coordination, project structure guidance, commit-message format, testing policy, logging, debug file locations, and multi-agent handshake expectations.
  - `docs/houserules.md` – “Claude house rules” focused on file coordination and TDD expectations; often referenced in copy-paste instructions for agents.
  - `houserules_structured.md` and `folders.md` – alternative “structured” variant intended for projects that adopt a strict `/ModuleName/src/feature/` layout. These are templates used when the DevOps Agent bootstraps other repos and should generally be preserved and kept in sync with implementation changes.
  - `docs/HOUSERULES_README.md` – explains the difference between the core and structured house-rule variants and when to use each.

- House rules management tooling:
  - `src/house-rules-manager.js` plus `scripts/repair-house-rules.sh` and the `house-rules:*` npm scripts implement:
    - Detection of missing/out-of-date house rules.
    - Creation and update of DevOps-managed sections while preserving user-authored sections.
    - Repair flows when house-rule files are removed or corrupted.
  - `docs/INSTALLATION_GUIDE.md` describes how `npm start` invokes these flows on first run (both for this repo and for target projects).

### UI, tutorial, and help system (v2)

- v2 UX modules live in `src/` and are documented in `docs/V2_QUICK_REFERENCE.md` and `docs/V2_FINAL_SUMMARY.md`:
  - `src/ui-utils.js` – terminal UI primitives (colors, icons, section headings, prompts, progress indicators) used by other modules instead of raw `console.log`/`readline`.
  - `src/help-system.js` – interactive help browser with multiple topics (sessions, file coordination, agents, house rules, commit messages, worktrees, troubleshooting, workflows, advanced).
  - `src/tutorial-mode.js` – 5-module guided tutorial that walks users through sessions, AI assistants, multi-agent workflows, and advanced features.
  - `src/instruction-formatter.js` – generates the rich, copy-paste instructions handed to coding agents for each session (including house-rule and coordination requirements).
  - `agent-commands.js`, `display-utils.cjs`, and the CLI entry in `bin/cs-devops-agent` glue these modules into subcommands such as `tutorial`, `help-topics`, and `start`.

### Testing and tooling infrastructure

- Jest is configured in `jest.config.cjs` to discover Node tests in `test_cases/**` and ignore generated/worktree-related directories.
- `scripts/run-tests` is a language-aware test runner that:
  - Determines which languages are present (Node, Python, Go, Java, Ruby) based on repo contents.
  - Maps changed files (via `scripts/changed-areas.sh`) to corresponding `test_cases/<area>/<component>` directories.
  - Invokes Jest (or other language test runners, if present) with `--runInBand` for the selected test directories.
- `docs/AUTOMATED_TESTING_STRATEGY.md` and `docs/TESTING.md` describe dedicated test harnesses for the branch-management system and multi-session behavior.
- `test_scripts/README.md` outlines shell-based multi-agent and E2E test suites used to verify coordination behavior, push-behind handling, and multi-session workflows.

## Guidelines for Warp and other AI agents in this repo

These are project-specific expectations distilled from `houserules.md` and the docs. Follow them when editing this repository.

1. **Always respect file coordination and multi-agent locks**
   - Before editing files, either:
     - Create or update a declaration in `.file-coordination/active-edits/<agent>-<session>.json` listing the exact files you intend to modify, or
     - At minimum, inspect existing declarations and avoid touching files that other agents have claimed.
   - If another agent has already declared a file you plan to edit, stop and surface a clear conflict summary (who, which session, which files) to the user instead of proceeding silently.
   - Do not remove or modify other agents’ declaration files except in documented “stale lock” recovery flows.

2. **Treat `local_deploy/` and coordination metadata as internal state**
   - You may read `local_deploy/` (settings, session locks, logs) to understand behavior, but avoid committing new tracked files there or hard-coding behavior that depends on specific local paths.
   - When you add logging or debug output in this repo, write to `local_deploy/logs/` as described in `houserules.md`; do not introduce new tracked log directories.

3. **Follow the existing testing and commit-message conventions**
   - For new behavior (features or bug fixes), add Jest specs under `test_cases/<area>/<component>/YYYYMMDD_<slug>_spec.js` and follow the structure shown in `houserules.md`.
   - Use targeted runs (`npm test -- <path>` or `scripts/run-tests test_cases/<area>/<component>`) while iterating, but before work is considered complete ensure at least `scripts/run-tests --changed` passes, and use `npm test` if you have touched core runtime or branch-management modules.
   - When you adjust logic that depends on commit-message parsing or infrastructure detection, keep it aligned with the commit format and infra policies described in `houserules.md` and implemented in `src/cs-devops-agent-worker.js`.

4. **Prefer DevOps Agent flows over raw git in user-facing behavior**
   - In documentation, code comments, and examples, prefer commands such as `s9n-devops-agent start`, `npm start`, `npm run devops:*`, and the session commands in `docs/SESSION_MANAGEMENT.md` instead of raw `git` sequences.
   - When changing session or branch behavior, update the corresponding docs (`docs/branch-management.md`, `docs/SESSION_MANAGEMENT.md`, `docs/MULTI_AGENT_WORKFLOWS.md`) and, if relevant, the tutorial and help topics so that users and other agents receive consistent guidance.

5. **Keep house rules, templates, and implementation in sync**
   - If you change how coordination JSON, prep handshake files, infrastructure logging, or logging paths work, update:
     - `houserules.md` and `docs/houserules.md` (and `houserules_structured.md` / `folders.md` when behavior also affects structured projects).
     - Any relevant sections in `docs/FILE_COORDINATION_GUIDE.md`, `docs/INSTALLATION_GUIDE.md`, and `docs/V2_QUICK_REFERENCE.md`.
   - Avoid duplicating behavior in multiple places; instead, prefer central helpers (e.g., `scripts/run-tests`, `src/file-coordinator.cjs`, `src/house-rules-manager.js`) and keep their documented contracts up to date.

6. **Respect the branch-management invariants**
   - The core invariants from `docs/branch-management.md` should remain true unless intentionally redesigned:
     - Session branches roll into daily branches.
     - Daily branches roll into weekly and target branches using the configured strategy.
     - Orphan sessions are detected and cleaned up based on configured thresholds.
   - When you change branch naming, rollover behavior, or cleanup logic, confirm that the automated tests under `test_cases/branch-management/` and relevant scripts under `test_scripts/` still reflect reality, and update docs accordingly.

Following these guidelines and using the commands and architecture notes above should allow future Warp agents to be productive quickly while staying aligned with the DevOps Agent’s design and safety guarantees.