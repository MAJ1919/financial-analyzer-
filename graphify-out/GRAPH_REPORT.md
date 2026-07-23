# Graph Report - .  (2026-07-23)

## Corpus Check
- 28 files · ~48,385 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 548 nodes · 952 edges · 42 communities (28 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.55)
- Token cost: 69,232 input · 0 output

## Community Hubs (Navigation)
- Forecasting Engine
- Analysis Engine (Ratios/DCF)
- Excel Export
- React App Shell & Valuation
- Statement Grid & Contracts
- Frontend Dependencies
- Financial Models & Excel Parser
- Auth & Request Dependencies
- Shared Utils (Compat Map)
- Analysis API Routes
- Projects API Routes
- Statement Templates API
- Logging Configuration
- README Setup Guide
- Original Request & Acceptance
- Backend Test Fixtures
- E2E Dev Dependencies
- Lint Config
- Upload API Routes
- PROJECT.md Architecture
- Backend Config/Settings
- Project Pydantic Models
- Doc: Excel Export Notes
- Doc: Excel Upload Gap
- Doc: graphify Integration
- Playwright Config
- E2E Smoke Test
- BaseModel (external)
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
3. `build_workbook()` - 20 edges
4. `run_forecast()` - 18 edges
5. `compute_ratios()` - 18 edges
6. `_parse_year()` - 17 edges
7. `parse_template_upload()` - 16 edges
8. `_get_compat()` - 16 edges
9. `react` - 15 edges
10. `TestComputeRatios` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Forecasting Engine Specifics (balanced vs faithful modes)` --references--> `run_forecast()`  [EXTRACTED]
  CLAUDE.md → backend/app/services/forecasting_engine.py
- `Reporting Unit: Everything In Thousands` --references--> `fmtMoney()`  [EXTRACTED]
  CLAUDE.md → frontend/src/utils/formatters.js
- `Reporting Unit: Everything In Thousands` --references--> `unitLabel()`  [EXTRACTED]
  CLAUDE.md → frontend/src/utils/formatters.js
- `Auth/RLS: get_user_db vs get_db Ownership Enforcement` --references--> `get_db()`  [EXTRACTED]
  CLAUDE.md → backend/app/api/dependencies.py
- `Auth/RLS: get_user_db vs get_db Ownership Enforcement` --references--> `get_user_db()`  [EXTRACTED]
  CLAUDE.md → backend/app/api/dependencies.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Architecture Contracts: Calc Ownership Split, Template Source, Compat Key Map, Headers-As-Totals** — claude_calc_ownership_contract, claude_template_single_source_contract, claude_compat_key_map_contract, claude_headers_are_totals_contract [EXTRACTED 1.00]
- **DCF Valuation Flow: Forecast Engine Feeds Resolved DCF Wiring Under Thousands Reporting Convention** — claude_dcf_forecast_wiring_resolved, claude_forecasting_engine_specifics, claude_reporting_unit_thousands [INFERRED 0.75]
- **Excel Upload Open Issues: Strict-Template Constraint and Unvalidated Parsing** — claude_known_gap_excel_upload_validation, claude_known_gap_valuation_base_scenario_only, claude_gotcha_strict_template_upload [INFERRED 0.75]

## Communities (42 total, 14 thin omitted)

### Community 0 - "Forecasting Engine"
Cohesion: 0.08
Nodes (32): Convert a stored FinancialStatement dict into a flat lookup:         { camelCase, statement_to_lookup(), BaseFinancialData, calculate_historical_assumptions(), extract_base_data(), ForecastingEngine, ForecastInputs, ForecastScenario (+24 more)

### Community 1 - "Analysis Engine (Ratios/DCF)"
Cohesion: 0.06
Nodes (33): calculate_ratio(), compute_dcf_base_metrics(), compute_horizontal_analysis(), compute_ratios(), _get(), _get_avg(), Any, Analysis Engine Service ======================= All financial arithmetic lives (+25 more)

### Community 2 - "Excel Export"
Cohesion: 0.09
Nodes (42): _apply_col_widths(), _build_assumptions(), _build_dcf(), _build_engine(), _build_horizontal(), _build_overrides(), _build_ratios(), _build_statement() (+34 more)

### Community 3 - "React App Shell & Valuation"
Cohesion: 0.08
Nodes (32): App(), ErrorBoundary, ProjectLayout(), NAV_ITEMS, Sidebar(), styles, ProtectedRoute(), SkeletonLine() (+24 more)

### Community 4 - "Statement Grid & Contracts"
Cohesion: 0.10
Nodes (36): Contract 1: Calculation Ownership Split, Contract 4: Headers Are The Totals (No Standalone Aggregate Rows), Reporting Unit: Everything In Thousands, FinancialGrid(), NOTE: v33 uses the Theming API (Quartz by default). Do NOT import the, Header(), styles, ManualEntryTemplate() (+28 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (39): ag-grid-community, ag-grid-react, axios, dependencies, ag-grid-community, ag-grid-react, axios, react (+31 more)

### Community 6 - "Financial Models & Excel Parser"
Cohesion: 0.10
Nodes (26): FinancialRow, FinancialStatement, label_to_key(), ManualEntryPayload, BaseModel, Financial data models (Pydantic) + Line Item Key Mapping.  Storage model (JSONB, Convert a display label to a camelCase canonical key. Returns label as-is if unk, Represents a single line item in a financial statement.     Values are stored pe (+18 more)

### Community 7 - "Auth & Request Dependencies"
Cohesion: 0.14
Nodes (19): _extract_bearer_token(), get_current_user(), get_db(), get_user_db(), Client, Shared FastAPI dependencies — injected via Depends()., Yield the **service-role** Supabase client (bypasses RLS).      Reserved for ope, Pull the raw JWT out of an ``Authorization: Bearer <token>`` header. (+11 more)

### Community 8 - "Shared Utils (Compat Map)"
Cohesion: 0.13
Nodes (8): _get_compat(), Shared Financial Data Utilities =============================== Single source of, # NOTE: compat returns the FIRST non-zero hit only; the summed, Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.      Resolu, shared_utils is the single source of truth for the compat key map. These tests p, If these fail, someone re-copied the helpers into an engine — don't., TestGetCompat, TestNoDuplication

### Community 9 - "Analysis API Routes"
Cohesion: 0.17
Nodes (16): compute_forecast(), ComputeForecastPayload, ForecastInputsPayload, get_dcf_base_metrics(), get_financial_ratios(), get_forecast(), get_historical_assumptions(), get_horizontal_analysis() (+8 more)

### Community 10 - "Projects API Routes"
Cohesion: 0.17
Nodes (15): create_project(), delete_project(), export_project_excel(), get_project(), list_projects(), Client, Permanently delete a project (RLS: owner only)., Return the current user's saved projects (Companies landing page). (+7 more)

### Community 11 - "Statement Templates API"
Cohesion: 0.19
Nodes (9): get_statement_templates(), Canonical statement structure for manual entry initialization.      Returns the, load_statement_templates(), Statement template loader — SINGLE SOURCE OF TRUTH.  manualEntryTemplate.json de, Return {income_statement: [...], balance_sheet: [...], cash_flow_statement: [..., GET /api/templates/statements — the frontend initializes manual entry from this, Aggregates live in the computed header rows (Revenue, Assets, ...) —     standal, test_matches_canonical_template() (+1 more)

### Community 12 - "Logging Configuration"
Cohesion: 0.19
Nodes (10): configure_logging(), get_logger(), Central logging configuration (NFR-S-03).  Establishes ONE logging convention fo, Idempotently configure root logging. Called once at app startup., Return a module logger, ensuring logging is configured first., unhandled_exception_handler(), NFR-S-03: No Financial Data In Logs/Errors, Exception (+2 more)

### Community 13 - "README Setup Guide"
Cohesion: 0.17
Nodes (11): 1. Supabase Setup, 2. Backend, 3. Frontend, Backend (`backend/.env`), Environment Variables, Financial Analyzer Platform, Frontend (`frontend/.env`), Getting Started (+3 more)

### Community 14 - "Original Request & Acceptance"
Cohesion: 0.18
Nodes (10): Acceptance Criteria, Backend Refactoring, Frontend Refactoring, Functional Verification, Initial Request — 2026-07-09T09:20:57Z, Original User Request, R1. Backend Code Cleanup, R2. Frontend Code Cleanup & Bug Fixes (+2 more)

### Community 15 - "Backend Test Fixtures"
Cohesion: 0.31
Nodes (8): balance_sheet(), base_balanced(), income_statement(), label_for(), make_statement(), Shared fixtures for the backend test suite.  Statement fixtures use the SAME can, Build a stored-JSONB-shaped FinancialStatement from {key: {year: value}}., Base-year data where A = L + E exactly (15,000 = 6,000 + 9,000).

### Community 16 - "E2E Dev Dependencies"
Cohesion: 0.25
Nodes (7): devDependencies, @playwright/test, name, scripts, test, version, @playwright/test

### Community 17 - "Lint Config"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 18 - "Upload API Routes"
Cohesion: 0.29
Nodes (7): Client, Step 1 & 2 combined: Reads a template-conforming .xlsx file,     parses it direc, Alternative ingestion path - direct manual entry from a structured template., save_manual_entry(), upload_template(), ManualEntryPayload, UploadFile

### Community 19 - "PROJECT.md Architecture"
Cohesion: 0.29
Nodes (6): Architecture, Backend ↔ Frontend, Code Layout, Interface Contracts, Milestones, Project: Financial Analyzer Platform

### Community 20 - "Backend Config/Settings"
Cohesion: 0.40
Nodes (3): Any, Settings, BaseSettings

### Community 21 - "Project Pydantic Models"
Cohesion: 0.60
Nodes (4): ProjectCreate, ProjectResponse, ProjectUpdate, BaseModel

## Knowledge Gaps
- **73 isolated node(s):** `name`, `version`, `test`, `@playwright/test`, `{ defineConfig, devices }` (+68 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_get_compat()` connect `Shared Utils (Compat Map)` to `Forecasting Engine`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `compute_ratios()` connect `Analysis Engine (Ratios/DCF)` to `Analysis API Routes`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `_parse_year()` connect `Excel Export` to `Forecasting Engine`, `Shared Utils (Compat Map)`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ForecastInputs` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastInputs` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `ForecastingEngine` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastingEngine` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `test` to the rest of the system?**
  _73 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Forecasting Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08240794856808883 - nodes in this community are weakly interconnected._