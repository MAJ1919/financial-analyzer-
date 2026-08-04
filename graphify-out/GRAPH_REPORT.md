# Graph Report - financial-analyzer-platform - Claude  (2026-08-04)

## Corpus Check
- 66 files · ~47,748 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 532 nodes · 1016 edges · 32 communities (21 shown, 11 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc0b73c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Forecasting Engine
- Analysis Engine (Ratios/DCF)
- Excel Export
- React App Shell & Valuation
- Frontend Dependencies
- Financial Models & Excel Parser
- Auth & Request Dependencies
- Shared Utils (Compat Map)
- Analysis API Routes
- Projects API Routes
- Statement Templates API
- README Setup Guide
- Original Request & Acceptance
- Backend Test Fixtures
- Lint Config
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

## God Nodes (most connected - your core abstractions)
1. `ForecastInputs` - 27 edges
2. `ForecastingEngine` - 25 edges
3. `build_workbook()` - 23 edges
4. `run_forecast()` - 20 edges
5. `compute_ratios()` - 18 edges
6. `parse_template_upload()` - 17 edges
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
- `Contract 4: Headers Are The Totals (No Standalone Aggregate Rows)` --references--> `deriveCashFlow()`  [EXTRACTED]
  CLAUDE.md → frontend/src/utils/calculations.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Contracts: Calc Ownership Split, Template Source, Compat Key Map, Headers-As-Totals** — claude_calc_ownership_contract, claude_template_single_source_contract, claude_compat_key_map_contract, claude_headers_are_totals_contract [EXTRACTED 1.00]
- **DCF Valuation Flow: Forecast Engine Feeds Resolved DCF Wiring Under Thousands Reporting Convention** — claude_dcf_forecast_wiring_resolved, claude_forecasting_engine_specifics, claude_reporting_unit_thousands [INFERRED 0.75]
- **Excel Upload Open Issues: Strict-Template Constraint and Unvalidated Parsing** — claude_known_gap_excel_upload_validation, claude_known_gap_valuation_base_scenario_only, claude_gotcha_strict_template_upload [INFERRED 0.75]

## Communities (32 total, 11 thin omitted)

### Community 0 - "Forecasting Engine"
Cohesion: 0.09
Nodes (30): BaseFinancialData, calculate_historical_assumptions(), extract_base_data(), ForecastingEngine, ForecastInputs, ForecastScenario, Forecasting Engine Service ========================== Complete 5-year financia, Pull the most-recent-year values from stored JSONB statements     into a flat B (+22 more)

### Community 1 - "Analysis Engine (Ratios/DCF)"
Cohesion: 0.08
Nodes (28): label_to_key(), Financial data models (Pydantic) + Line Item Key Mapping.  Storage model (JSONB, Convert a display label to a camelCase canonical key. Returns label as-is if unk, Convert a stored FinancialStatement dict into a flat lookup:         { camelCase, statement_to_lookup(), calculate_ratio(), compute_dcf_base_metrics(), compute_horizontal_analysis() (+20 more)

### Community 2 - "Excel Export"
Cohesion: 0.10
Nodes (39): _apply_col_widths(), _build_assumptions(), _build_dcf(), _build_engine(), _build_horizontal(), _build_overrides(), _build_ratios(), _build_statement() (+31 more)

### Community 3 - "React App Shell & Valuation"
Cohesion: 0.08
Nodes (48): Contract 1: Calculation Ownership Split, Contract 4: Headers Are The Totals (No Standalone Aggregate Rows), Reporting Unit: Everything In Thousands, FinancialGrid(), NOTE: v33 uses the Theming API (Quartz by default). Do NOT import the, Header(), styles, ManualEntryTemplate() (+40 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (39): ag-grid-community, ag-grid-react, axios, dependencies, ag-grid-community, ag-grid-react, axios, react (+31 more)

### Community 6 - "Financial Models & Excel Parser"
Cohesion: 0.12
Nodes (21): FinancialRow, FinancialStatement, BaseModel, Represents a single line item in a financial statement.     Values are stored pe, Wrapper for a full financial statement (IS or BS)., _clean_numeric_value(), _extract_year_from_cell(), parse_template_upload() (+13 more)

### Community 7 - "Auth & Request Dependencies"
Cohesion: 0.10
Nodes (27): _extract_bearer_token(), get_current_user(), get_db(), get_user_db(), Client, Shared FastAPI dependencies — injected via Depends()., Yield the **service-role** Supabase client (bypasses RLS).      Reserved for ope, Pull the raw JWT out of an ``Authorization: Bearer <token>`` header. (+19 more)

### Community 8 - "Shared Utils (Compat Map)"
Cohesion: 0.10
Nodes (14): _build_lookups(), _get_compat(), _parse_year(), Shared Financial Data Utilities =============================== Single source of, Convert stored JSONB statement dicts to flat key→{year→value} lookups., Extract the last block of digits from a string to form a valid year.      Exampl, # NOTE: compat returns the FIRST non-zero hit only; the summed, Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.      Resolu (+6 more)

### Community 9 - "Analysis API Routes"
Cohesion: 0.16
Nodes (16): compute_forecast(), ComputeForecastPayload, ForecastInputsPayload, get_dcf_base_metrics(), get_financial_ratios(), get_forecast(), get_historical_assumptions(), get_horizontal_analysis() (+8 more)

### Community 10 - "Projects API Routes"
Cohesion: 0.18
Nodes (17): create_project(), delete_project(), export_project_excel(), get_project(), list_projects(), Client, Permanently delete a project (RLS: owner only)., Return the current user's saved projects (Companies landing page). (+9 more)

### Community 11 - "Statement Templates API"
Cohesion: 0.08
Nodes (22): get_statement_templates(), Canonical statement structure for manual entry initialization.      Returns the, Any, Settings, configure_logging(), get_logger(), Central logging configuration (NFR-S-03).  Establishes ONE logging convention fo, Idempotently configure root logging. Called once at app startup. (+14 more)

### Community 13 - "README Setup Guide"
Cohesion: 0.17
Nodes (11): 1. Supabase Setup, 2. Backend, 3. Frontend, Backend (`backend/.env`), Environment Variables, Financial Analyzer Platform, Frontend (`frontend/.env`), Getting Started (+3 more)

### Community 14 - "Original Request & Acceptance"
Cohesion: 0.18
Nodes (10): Acceptance Criteria, Backend Refactoring, Frontend Refactoring, Functional Verification, Initial Request — 2026-07-09T09:20:57Z, Original User Request, R1. Backend Code Cleanup, R2. Frontend Code Cleanup & Bug Fixes (+2 more)

### Community 15 - "Backend Test Fixtures"
Cohesion: 0.12
Nodes (15): compute_ratios(), Compute all 32 financial ratios for each available fiscal year.      Returns:, balance_sheet(), base_balanced(), income_statement(), label_for(), make_statement(), Shared fixtures for the backend test suite.  Statement fixtures use the SAME can (+7 more)

### Community 17 - "Lint Config"
Cohesion: 0.08
Nodes (27): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, App(), ErrorBoundary, ProjectLayout() (+19 more)

### Community 19 - "PROJECT.md Architecture"
Cohesion: 0.29
Nodes (6): Architecture, Backend ↔ Frontend, Code Layout, Interface Contracts, Milestones, Project: Financial Analyzer Platform

## Knowledge Gaps
- **67 isolated node(s):** `$schema`, `oxc`, `react/rules-of-hooks`, `warn`, `name` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_forecast()` connect `Forecasting Engine` to `Analysis API Routes`, `Excel Export`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `calculate_historical_assumptions()` connect `Forecasting Engine` to `Shared Utils (Compat Map)`, `Analysis API Routes`, `Excel Export`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ForecastInputs` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastInputs` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `ForecastingEngine` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastingEngine` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `oxc`, `react/rules-of-hooks` to the rest of the system?**
  _67 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Forecasting Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08583959899749373 - nodes in this community are weakly interconnected._
- **Should `Analysis Engine (Ratios/DCF)` be split into smaller, more focused modules?**
  _Cohesion score 0.07560975609756097 - nodes in this community are weakly interconnected._