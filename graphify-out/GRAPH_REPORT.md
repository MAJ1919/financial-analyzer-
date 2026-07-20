# Graph Report - financial-analyzer-platform - Claude  (2026-07-20)

## Corpus Check
- 63 files · ~43,882 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 500 nodes · 867 edges · 29 communities (27 shown, 2 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 141 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9399c8a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- React Frontend UI
- Forecasting Engine
- Analysis Engine (Ratios/DCF)
- Excel Parser
- Excel Export
- Frontend Dependencies
- Upload & Entry Models
- Templates & Compat Map
- Shared Utils (Compat Map)
- Projects API Routes
- Analysis API Routes
- Supabase / DB Access
- Backend Test Fixtures
- E2E Dev Dependencies
- Lint Config
- Backend Config / CORS
- Reporting Unit & DCF Gaps
- Playwright Config
- E2E Smoke Test
- Financial Analyzer Platform
- Acceptance Criteria
- Project: Financial Analyzer Platform

## God Nodes (most connected - your core abstractions)
1. `ForecastInputs` - 26 edges
2. `ForecastingEngine` - 24 edges
3. `run_forecast()` - 23 edges
4. `build_workbook()` - 16 edges
5. `build_workbook()` - 15 edges
6. `parse_template_upload()` - 15 edges
7. `useProjectStore` - 14 edges
8. `_parse_year()` - 13 edges
9. `compute_ratios()` - 12 edges
10. `react` - 12 edges

## Surprising Connections (you probably didn't know these)
- `run_forecast()` --references--> `KEY_COMPAT_MAP`  [EXTRACTED]
  backend/app/services/forecasting_engine.py → CLAUDE.md
- `run_forecast()` --implements--> `Balanced Balance Mode (cash plug)`  [EXTRACTED]
  backend/app/services/forecasting_engine.py → CLAUDE.md
- `run_forecast()` --shares_data_with--> `Supabase `projects` Table Data Model (JSONB statements)`  [EXTRACTED]
  backend/app/services/forecasting_engine.py → CLAUDE.md
- `Known Gap: DCF Does Not Use the Forecasting Engine` --references--> `run_forecast()`  [EXTRACTED]
  CLAUDE.md → backend/app/services/forecasting_engine.py
- `Split Calculation Ownership (frontend statement math / backend analytics)` --references--> `run_forecast()`  [EXTRACTED]
  CLAUDE.md → backend/app/services/forecasting_engine.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Layered enforcement that headers carry the totals** — claude_headers_are_the_totals, backend_app_models_manualentrytemplate_json, frontend_src_utils_calculations_derivecashflow, claude_deprecated_row_keys_scrub, frontend_src_store_projectstore, frontend_src_utils_statementdisplay [EXTRACTED 1.00]
- **The three architectural contracts that govern the platform** — claude_split_calculation_ownership, claude_single_source_of_truth_template, claude_compat_key_map_single_home, claude_headers_are_the_totals [EXTRACTED 1.00]
- **DCF valuation flow and its known gaps** — frontend_src_pages_valuation_projectfcfs, claude_gap_dcf_ignores_forecast_engine, claude_gap_valuation_method_not_persisted, backend_app_services_forecasting_engine_run_forecast, claude_per_share_scale_trap [INFERRED 0.85]

## Communities (29 total, 2 thin omitted)

### Community 0 - "React Frontend UI"
Cohesion: 0.06
Nodes (61): DEPRECATED_ROW_KEYS Legacy Scrub, Headers ARE the Totals (no standalone aggregate rows), Split Calculation Ownership (frontend statement math / backend analytics), App(), ErrorBoundary, FinancialGrid(), NOTE: v33 uses the Theming API (Quartz by default). Do NOT import the, Header() (+53 more)

### Community 1 - "Forecasting Engine"
Cohesion: 0.08
Nodes (29): BaseFinancialData, calculate_historical_assumptions(), extract_base_data(), ForecastingEngine, ForecastInputs, ForecastScenario, Forecasting Engine Service ========================== Complete 5-year financia, Pull the most-recent-year values from stored JSONB statements     into a flat B (+21 more)

### Community 2 - "Analysis Engine (Ratios/DCF)"
Cohesion: 0.07
Nodes (28): calculate_ratio(), compute_dcf_base_metrics(), compute_horizontal_analysis(), compute_ratios(), _get(), _get_avg(), Any, Analysis Engine Service ======================= All financial arithmetic lives (+20 more)

### Community 3 - "Excel Parser"
Cohesion: 0.09
Nodes (30): _clean_numeric_value(), _extract_year_from_cell(), parse_template_upload(), Any, Excel Parser Service (Strict Template Mode) ===================================, Strictly extract a 4-digit year from a cell., Read .xlsx bytes, find global years, and STRICTLY map data row-by-row      to t, _cash_flow() (+22 more)

### Community 4 - "Excel Export"
Cohesion: 0.12
Nodes (30): _apply_col_widths(), _build_assumptions(), _build_dcf(), _build_engine(), _build_horizontal(), _build_overrides(), _build_ratios(), _build_statement() (+22 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (37): ag-grid-community, ag-grid-react, axios, dependencies, ag-grid-community, ag-grid-react, axios, react (+29 more)

### Community 6 - "Upload & Entry Models"
Cohesion: 0.08
Nodes (23): Client, Step 1 & 2 combined: Reads a template-conforming .xlsx file,     parses it direc, Alternative ingestion path - direct manual entry from a structured template., save_manual_entry(), upload_template(), FinancialRow, FinancialStatement, label_to_key() (+15 more)

### Community 7 - "Templates & Compat Map"
Cohesion: 0.09
Nodes (16): get_statement_templates(), Canonical statement structure for manual entry initialization.      Returns the, manualEntryTemplate.json, load_statement_templates(), Statement template loader — SINGLE SOURCE OF TRUTH.  manualEntryTemplate.json de, Return {income_statement: [...], balance_sheet: [...], cash_flow_statement: [..., KEY_COMPAT_MAP, GET /api/templates/statements — the frontend initializes manual entry from this (+8 more)

### Community 8 - "Shared Utils (Compat Map)"
Cohesion: 0.15
Nodes (6): _get_compat(), Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.      Resolu, shared_utils is the single source of truth for the compat key map. These tests p, If these fail, someone re-copied the helpers into an engine — don't., TestGetCompat, TestNoDuplication

### Community 9 - "Projects API Routes"
Cohesion: 0.15
Nodes (17): create_project(), delete_project(), export_project_excel(), get_project(), list_projects(), Client, Return all saved projects (Companies landing page)., Fetch a single project by ID. (+9 more)

### Community 10 - "Analysis API Routes"
Cohesion: 0.17
Nodes (16): compute_forecast(), ComputeForecastPayload, ForecastInputsPayload, get_dcf_base_metrics(), get_financial_ratios(), get_forecast(), get_historical_assumptions(), get_horizontal_analysis() (+8 more)

### Community 11 - "Supabase / DB Access"
Cohesion: 0.20
Nodes (8): get_db(), Client, Shared FastAPI dependencies — injected via Depends()., Yield a Supabase client instance for each request., get_supabase_client(), Client, Supabase client singleton., Returns a cached Supabase client.     Uses lru_cache so the client is created on

### Community 12 - "Backend Test Fixtures"
Cohesion: 0.31
Nodes (8): balance_sheet(), base_balanced(), income_statement(), label_for(), make_statement(), Shared fixtures for the backend test suite.  Statement fixtures use the SAME can, Build a stored-JSONB-shaped FinancialStatement from {key: {year: value}}., Base-year data where A = L + E exactly (15,000 = 6,000 + 9,000).

### Community 13 - "E2E Dev Dependencies"
Cohesion: 0.25
Nodes (7): devDependencies, @playwright/test, name, scripts, test, version, @playwright/test

### Community 14 - "Lint Config"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 15 - "Backend Config / CORS"
Cohesion: 0.40
Nodes (3): Any, Settings, BaseSettings

### Community 16 - "Reporting Unit & DCF Gaps"
Cohesion: 0.50
Nodes (4): Known Gap: DCF Does Not Use the Forecasting Engine, Per-Share Metrics Scale Trap, Reporting Unit: Thousands ('000), projectFCFs

### Community 26 - "Financial Analyzer Platform"
Cohesion: 0.17
Nodes (11): 1. Supabase Setup, 2. Backend, 3. Frontend, Backend (`backend/.env`), Environment Variables, Financial Analyzer Platform, Frontend (`frontend/.env`), Getting Started (+3 more)

### Community 27 - "Acceptance Criteria"
Cohesion: 0.18
Nodes (10): Acceptance Criteria, Backend Refactoring, Frontend Refactoring, Functional Verification, Initial Request — 2026-07-09T09:20:57Z, Original User Request, R1. Backend Code Cleanup, R2. Frontend Code Cleanup & Bug Fixes (+2 more)

### Community 28 - "Project: Financial Analyzer Platform"
Cohesion: 0.29
Nodes (6): Architecture, Backend ↔ Frontend, Code Layout, Interface Contracts, Milestones, Project: Financial Analyzer Platform

## Knowledge Gaps
- **67 isolated node(s):** `name`, `version`, `test`, `@playwright/test`, `{ defineConfig, devices }` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_forecast()` connect `Forecasting Engine` to `React Frontend UI`, `Analysis Engine (Ratios/DCF)`, `Excel Parser`, `Excel Export`, `Templates & Compat Map`, `Analysis API Routes`, `Reporting Unit & DCF Gaps`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `Split Calculation Ownership (frontend statement math / backend analytics)` connect `React Frontend UI` to `Reporting Unit & DCF Gaps`, `Forecasting Engine`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **Why does `statement_to_lookup()` connect `Upload & Entry Models` to `Forecasting Engine`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `ForecastInputs` (e.g. with `TestBalancedMode` and `.test_balances_even_with_bad_input()`) actually correct?**
  _`ForecastInputs` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `ForecastingEngine` (e.g. with `TestBalancedMode` and `.test_balances_even_with_bad_input()`) actually correct?**
  _`ForecastingEngine` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `run_forecast()` (e.g. with `compute_forecast()` and `project()`) actually correct?**
  _`run_forecast()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `build_workbook()` (e.g. with `test_dcf_has_value_per_share_formula()` and `test_export_without_data_raises()`) actually correct?**
  _`build_workbook()` has 7 INFERRED edges - model-reasoned connections that need verification._