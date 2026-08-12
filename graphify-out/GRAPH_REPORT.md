# Graph Report - financial-analyzer-platform - Claude  (2026-08-12)

## Corpus Check
- 68 files · ~50,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 566 nodes · 1069 edges · 31 communities (18 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `febef326`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Forecasting Engine
- Analysis Engine (Ratios/DCF)
- Excel Export
- React App Shell & Valuation
- .oxlintrc.json
- Frontend Dependencies
- Financial Models & Excel Parser
- Auth & Request Dependencies
- Shared Utils (Compat Map)
- Analysis API Routes
- Statement Templates API
- vercel.json
- README Setup Guide
- Original Request & Acceptance
- PROJECT.md Architecture
- Doc: Excel Export Notes
- Doc: Excel Upload Gap
- Doc: graphify Integration
- Doc: Backend Test Suite
- Doc: Branch Layout
- Doc: Data Model
- Doc: E2E Smoke Suite
- Doc: Number Formatting
- Doc: Windows Dev Machine
- Doc: zustand Store Authority
- Doc: Statement Template Contract
- Vite Config

## God Nodes (most connected - your core abstractions)
1. `ForecastInputs` - 27 edges
2. `parse_template_upload()` - 26 edges
3. `ForecastingEngine` - 25 edges
4. `build_workbook()` - 23 edges
5. `run_forecast()` - 20 edges
6. `compute_ratios()` - 18 edges
7. `_parse_year()` - 17 edges
8. `_get_compat()` - 16 edges
9. `react` - 15 edges
10. `calculate_historical_assumptions()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Auth/RLS: get_user_db vs get_db Ownership Enforcement` --references--> `get_db()`  [EXTRACTED]
  CLAUDE.md → backend/app/api/dependencies.py
- `Auth/RLS: get_user_db vs get_db Ownership Enforcement` --references--> `get_user_db()`  [EXTRACTED]
  CLAUDE.md → backend/app/api/dependencies.py
- `NFR-S-03: No Financial Data In Logs/Errors` --references--> `get_logger()`  [EXTRACTED]
  CLAUDE.md → backend/app/core/logging_config.py
- `Forecasting Engine Specifics (balanced vs faithful modes)` --references--> `run_forecast()`  [EXTRACTED]
  CLAUDE.md → backend/app/services/forecasting_engine.py
- `Contract 3: Compat Key Map Single Home` --references--> `_parse_year()`  [EXTRACTED]
  CLAUDE.md → backend/app/services/shared_utils.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Contracts: Calc Ownership Split, Template Source, Compat Key Map, Headers-As-Totals** — claude_calc_ownership_contract, claude_template_single_source_contract, claude_compat_key_map_contract, claude_headers_are_totals_contract [EXTRACTED 1.00]
- **DCF Valuation Flow: Forecast Engine Feeds Resolved DCF Wiring Under Thousands Reporting Convention** — claude_dcf_forecast_wiring_resolved, claude_forecasting_engine_specifics, claude_reporting_unit_thousands [INFERRED 0.75]
- **Excel Upload Open Issues: Strict-Template Constraint and Unvalidated Parsing** — claude_known_gap_excel_upload_validation, claude_known_gap_valuation_base_scenario_only, claude_gotcha_strict_template_upload [INFERRED 0.75]

## Communities (31 total, 13 thin omitted)

### Community 0 - "Forecasting Engine"
Cohesion: 0.09
Nodes (28): BaseFinancialData, calculate_historical_assumptions(), ForecastingEngine, ForecastInputs, ForecastScenario, Forecasting Engine Service ========================== Complete 5-year financia, Derive sensible ForecastInputs from historical financial data.     Falls back t, Forecast assumptions, split in two tiers:      CORE (user-facing form): (+20 more)

### Community 1 - "Analysis Engine (Ratios/DCF)"
Cohesion: 0.06
Nodes (37): calculate_ratio(), compute_dcf_base_metrics(), compute_horizontal_analysis(), compute_ratios(), _get(), _get_avg(), Any, Analysis Engine Service ======================= All financial arithmetic lives (+29 more)

### Community 2 - "Excel Export"
Cohesion: 0.09
Nodes (43): _apply_col_widths(), _build_assumptions(), _build_dcf(), _build_engine(), _build_horizontal(), _build_overrides(), _build_ratios(), _build_statement() (+35 more)

### Community 3 - "React App Shell & Valuation"
Cohesion: 0.05
Nodes (68): Contract 1: Calculation Ownership Split, Contract 4: Headers Are The Totals (No Standalone Aggregate Rows), Reporting Unit: Everything In Thousands, App(), ErrorBoundary, FinancialGrid(), NOTE: v33 uses the Theming API (Quartz by default). Do NOT import the, Header() (+60 more)

### Community 4 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (39): ag-grid-community, ag-grid-react, axios, dependencies, ag-grid-community, ag-grid-react, axios, react (+31 more)

### Community 6 - "Financial Models & Excel Parser"
Cohesion: 0.05
Nodes (43): Client, Step 1 & 2 combined: Reads a template-conforming .xlsx file,     parses it dire, Alternative ingestion path - direct manual entry from a structured template., save_manual_entry(), upload_template(), FinancialRow, FinancialStatement, label_to_key() (+35 more)

### Community 7 - "Auth & Request Dependencies"
Cohesion: 0.08
Nodes (36): _extract_bearer_token(), get_current_user(), get_db(), get_user_db(), Client, Shared FastAPI dependencies — injected via Depends()., Yield the **service-role** Supabase client (bypasses RLS).      Reserved for o, Pull the raw JWT out of an ``Authorization: Bearer <token>`` header. (+28 more)

### Community 8 - "Shared Utils (Compat Map)"
Cohesion: 0.09
Nodes (14): Convert a stored FinancialStatement dict into a flat lookup:         { camelCase, statement_to_lookup(), _build_lookups(), _get_compat(), Shared Financial Data Utilities =============================== Single source, Convert stored JSONB statement dicts to flat key→{year→value} lookups., # NOTE: compat returns the FIRST non-zero hit only; the summed, Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.      Reso (+6 more)

### Community 9 - "Analysis API Routes"
Cohesion: 0.16
Nodes (16): compute_forecast(), ComputeForecastPayload, ForecastInputsPayload, get_dcf_base_metrics(), get_financial_ratios(), get_forecast(), get_historical_assumptions(), get_horizontal_analysis() (+8 more)

### Community 11 - "Statement Templates API"
Cohesion: 0.07
Nodes (26): get_statement_templates(), Canonical statement structure for manual entry initialization.      Returns the, Any, Settings, configure_logging(), get_logger(), Central logging configuration (NFR-S-03).  Establishes ONE logging convention, Idempotently configure root logging. Called once at app startup. (+18 more)

### Community 13 - "README Setup Guide"
Cohesion: 0.12
Nodes (15): 1. Supabase Setup, 2. Backend, 3. Frontend, Backend (`backend/.env`), Backend (Render), Deployment, Environment Variables, Financial Analyzer Platform (+7 more)

### Community 14 - "Original Request & Acceptance"
Cohesion: 0.18
Nodes (10): Acceptance Criteria, Backend Refactoring, Frontend Refactoring, Functional Verification, Initial Request — 2026-07-09T09:20:57Z, Original User Request, R1. Backend Code Cleanup, R2. Frontend Code Cleanup & Bug Fixes (+2 more)

### Community 19 - "PROJECT.md Architecture"
Cohesion: 0.29
Nodes (6): Architecture, Backend ↔ Frontend, Code Layout, Interface Contracts, Milestones, Project: Financial Analyzer Platform

## Knowledge Gaps
- **72 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `label_to_key()` connect `Financial Models & Excel Parser` to `Shared Utils (Compat Map)`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `run_forecast()` connect `Forecasting Engine` to `Analysis API Routes`, `Excel Export`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ForecastInputs` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastInputs` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `ForecastingEngine` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastingEngine` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Forecasting Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08956228956228957 - nodes in this community are weakly interconnected._
- **Should `Analysis Engine (Ratios/DCF)` be split into smaller, more focused modules?**
  _Cohesion score 0.05747126436781609 - nodes in this community are weakly interconnected._