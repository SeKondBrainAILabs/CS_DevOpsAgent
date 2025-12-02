# House Rules Contracts

**Created:** 2024-12-02  
**Version:** 1.0.0  
**Purpose:** Single source of truth for all project components to prevent duplication and conflicts

---

## Overview

This folder contains **contract files** that document all aspects of the project. These contracts serve as a **mandatory reference** for all coding agents before making changes to:

- Database schema
- SQL queries
- API endpoints
- Third-party integrations
- Features
- Infrastructure/environment variables

---

## Why Contracts Exist

### The Problem

When multiple coding agents work on the same codebase **without coordination**, they will:

❌ **Create duplicate features** with different names  
❌ **Create duplicate API endpoints** for the same functionality  
❌ **Write duplicate SQL queries** doing the same thing  
❌ **Integrate the same third-party service** multiple times  
❌ **Make conflicting database changes** that break each other  
❌ **Create duplicate environment variables** with different names  
❌ **Overwrite each other's code** unknowingly  
❌ **Break existing functionality** without realizing it  

### The Solution

**Contracts provide a single source of truth** that all agents must check before coding.

✅ **Discover existing functionality** before building new  
✅ **Reuse existing code** instead of duplicating  
✅ **Know exactly what exists** and how to use it  
✅ **Avoid conflicts** and breaking changes  
✅ **Coordinate changes** across the codebase  
✅ **Maintain consistency** and quality  
✅ **Save time** by not rebuilding what exists  

---

## Contract Files

| Contract File | Purpose | When to Check |
|---------------|---------|---------------|
| **[DATABASE_SCHEMA_CONTRACT.md](./DATABASE_SCHEMA_CONTRACT.md)** | All database tables, columns, indexes, migrations | Before creating/modifying database schema |
| **[SQL_CONTRACT.json](./SQL_CONTRACT.json)** | Reusable SQL queries with parameters and usage | Before writing any SQL query |
| **[API_CONTRACT.md](./API_CONTRACT.md)** | All API endpoints with full specifications | Before creating/modifying API endpoints |
| **[THIRD_PARTY_INTEGRATIONS.md](./THIRD_PARTY_INTEGRATIONS.md)** | External service integrations and binding modules | Before integrating third-party services |
| **[FEATURES_CONTRACT.md](./FEATURES_CONTRACT.md)** | All features with specifications and dependencies | Before implementing any feature |
| **[INFRA_CONTRACT.md](./INFRA_CONTRACT.md)** | Environment variables and infrastructure config | Before adding configuration/env vars |
| **[DEVOPS_AGENT_INSTRUCTIONS.md](./DEVOPS_AGENT_INSTRUCTIONS.md)** | Instructions for generating and maintaining contracts | For DevOps Agent to populate contracts |

---

## How to Use Contracts

### For Coding Agents

**BEFORE making ANY changes:**

1. **Identify what you're changing:**
   - Database? → Read `DATABASE_SCHEMA_CONTRACT.md`
   - SQL query? → Read `SQL_CONTRACT.json`
   - API endpoint? → Read `API_CONTRACT.md`
   - Third-party service? → Read `THIRD_PARTY_INTEGRATIONS.md`
   - Feature? → Read `FEATURES_CONTRACT.md`
   - Config/env var? → Read `INFRA_CONTRACT.md`

2. **Search for existing implementation:**
   - Does this already exist?
   - Can I reuse existing code?
   - Will my change conflict?

3. **Decide:**
   - **If exists:** ✅ REUSE it (add your module to "Used By")
   - **If not:** ✅ CREATE it and DOCUMENT it in the contract

4. **After changes:**
   - ✅ UPDATE the contract immediately
   - ✅ ADD changelog entry with date
   - ✅ INCREMENT version number
   - ✅ CROSS-REFERENCE related contracts

### For DevOps Agent

**To generate initial contracts:**

1. Read `DEVOPS_AGENT_INSTRUCTIONS.md`
2. Execute automated contract generation script
3. Review and validate generated contracts
4. Fill in missing information
5. Ensure cross-references are correct
6. Commit populated contracts

**To maintain contracts:**

1. Monitor contract updates in commits
2. Validate contract changes are correct
3. Enforce contract usage by coding agents
4. Periodically regenerate to catch drift
5. Report discrepancies

---

## Contract Relationships

Contracts are interconnected:

```
FEATURES_CONTRACT.md
    ├─→ API_CONTRACT.md (endpoints used by feature)
    │       └─→ SQL_CONTRACT.json (queries used by endpoints)
    │               └─→ DATABASE_SCHEMA_CONTRACT.md (tables accessed)
    ├─→ THIRD_PARTY_INTEGRATIONS.md (services used by feature)
    │       └─→ INFRA_CONTRACT.md (API keys and config)
    └─→ INFRA_CONTRACT.md (feature flags and env vars)
```

**When updating one contract, check if related contracts need updates too.**

---

## Quick Reference

**Before you code, ask yourself:**

- 📋 "Does this feature already exist?" → Check `FEATURES_CONTRACT.md`
- 🔌 "Does this API endpoint already exist?" → Check `API_CONTRACT.md`
- 🗄️ "Does this database table already exist?" → Check `DATABASE_SCHEMA_CONTRACT.md`
- 📝 "Does this SQL query already exist?" → Check `SQL_CONTRACT.json`
- 🌐 "Is this service already integrated?" → Check `THIRD_PARTY_INTEGRATIONS.md`
- ⚙️ "Does this env variable already exist?" → Check `INFRA_CONTRACT.md`

**If YES → REUSE IT**  
**If NO → CREATE IT and DOCUMENT IT**

---

## Contract Update Requirements

Every contract update MUST include:

1. **Date stamp** - When the change was made (YYYY-MM-DD)
2. **Version increment** - Following semver (1.0.0 → 1.0.1 or 1.1.0)
3. **Changelog entry** - What changed and why
4. **Impact assessment** - Breaking change? Which modules affected?
5. **Cross-references** - Links to related contracts

---

## Enforcement

**This is MANDATORY, not optional.**

If a coding agent:
- Creates a feature without checking `FEATURES_CONTRACT.md`
- Writes SQL without checking `SQL_CONTRACT.json`
- Creates an endpoint without checking `API_CONTRACT.md`
- Integrates a service without checking `THIRD_PARTY_INTEGRATIONS.md`
- Modifies database without checking `DATABASE_SCHEMA_CONTRACT.md`
- Adds env vars without checking `INFRA_CONTRACT.md`

**They are violating house rules and creating technical debt.**

The user should reject the changes and require:
1. Read the relevant contract(s)
2. Check for existing implementation
3. Reuse or properly document changes
4. Update contracts appropriately

---

## Benefits

### For the Project

✅ **No duplicate code** - Agents reuse instead of rebuild  
✅ **No conflicts** - Agents coordinate changes  
✅ **Consistent quality** - All agents follow same patterns  
✅ **Faster development** - Reuse saves time  
✅ **Better maintainability** - Everything is documented  
✅ **Easier onboarding** - New agents know what exists  

### For Agents

✅ **Clear guidance** - Know exactly what to do  
✅ **Avoid mistakes** - Don't break existing code  
✅ **Save time** - Don't rebuild what exists  
✅ **Better collaboration** - Know what others built  

### For Users

✅ **Higher quality** - Less bugs and conflicts  
✅ **Faster delivery** - Less wasted work  
✅ **Lower cost** - Efficient development  
✅ **Better product** - Consistent and well-architected  

---

## Status

| Contract | Status | Completion | Last Updated |
|----------|--------|------------|--------------|
| DATABASE_SCHEMA_CONTRACT.md | Template | 0% | 2024-12-02 |
| SQL_CONTRACT.json | Template | 0% | 2024-12-02 |
| API_CONTRACT.md | Template | 0% | 2024-12-02 |
| THIRD_PARTY_INTEGRATIONS.md | Template | 0% | 2024-12-02 |
| FEATURES_CONTRACT.md | Template | 0% | 2024-12-02 |
| INFRA_CONTRACT.md | Template | 0% | 2024-12-02 |

**Next Steps:**
1. DevOps Agent executes contract generation (see `DEVOPS_AGENT_INSTRUCTIONS.md`)
2. Review and validate generated contracts
3. Fill in missing information
4. Begin using contracts for all development

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-02 | 1.0.0 | Initial contract system creation |

---

*These contracts are living documents. Update them with every change.*
