# Graph Report - financial-analyzer-platform - Claude  (2026-07-23)

## Corpus Check
- 70 files · ~48,331 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 543 nodes · 1049 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 33 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70ec68e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- React Frontend UI
- Forecasting Engine
- Analysis Engine (Ratios/DCF)
- Excel Parser
- Excel Export
- Frontend Dependencies
- App.jsx
- Templates & Compat Map
- Shared Utils (Compat Map)
- Projects API Routes
- Analysis API Routes
- compute_ratios
- E2E Dev Dependencies
- Lint Config
- Playwright Config
- E2E Smoke Test
- Financial Analyzer Platform
- Acceptance Criteria
- Project: Financial Analyzer Platform

## God Nodes (most connected - your core abstractions)
1. `ForecastInputs` - 27 edges
2. `run_forecast()` - 26 edges
3. `ForecastingEngine` - 25 edges
4. `build_workbook()` - 23 edges
5. `compute_ratios()` - 18 edges
6. `parse_template_upload()` - 17 edges
7. `_parse_year()` - 16 edges
8. `_get_compat()` - 15 edges
9. `react` - 15 edges
10. `calculate_historical_assumptions()` - 14 edges

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

## Communities (24 total, 2 thin omitted)

### Community 0 - "React Frontend UI"
Cohesion: 0.06
Nodes (59): manualEntryTemplate.json, KEY_COMPAT_MAP, Canonical camelCase Key Addressing (labels are presentation only), Compat Key Map Has One Home (shared_utils), DEPRECATED_ROW_KEYS Legacy Scrub, Known Gap: DCF Does Not Use the Forecasting Engine, Headers ARE the Totals (no standalone aggregate rows), Per-Share Metrics Scale Trap (+51 more)

### Community 1 - "Forecasting Engine"
Cohesion: 0.09
Nodes (29): BaseFinancialData, calculate_historical_assumptions(), extract_base_data(), ForecastingEngine, ForecastInputs, ForecastScenario, Forecasting Engine Service ========================== Complete 5-year financia, Pull the most-recent-year values from stored JSONB statements     into a flat B (+21 more)

### Community 2 - "Analysis Engine (Ratios/DCF)"
Cohesion: 0.06
Nodes (34): label_to_key(), Financial data models (Pydantic) + Line Item Key Mapping.  Storage model (JSONB, Convert a display label to a camelCase canonical key. Returns label as-is if unk, Convert a stored FinancialStatement dict into a flat lookup:         { camelCase, statement_to_lookup(), calculate_ratio(), compute_dcf_base_metrics(), compute_horizontal_analysis() (+26 more)

### Community 3 - "Excel Parser"
Cohesion: 0.08
Nodes (30): get_statement_templates(), Canonical statement structure for manual entry initialization.      Returns the, FinancialRow, FinancialStatement, BaseModel, Represents a single line item in a financial statement.     Values are stored pe, Wrapper for a full financial statement (IS or BS)., load_statement_templates() (+22 more)

### Community 4 - "Excel Export"
Cohesion: 0.09
Nodes (41): _apply_col_widths(), _build_assumptions(), _build_dcf(), _build_engine(), _build_horizontal(), _build_overrides(), _build_ratios(), _build_statement() (+33 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.05
Nodes (39): ag-grid-community, ag-grid-react, axios, dependencies, ag-grid-community, ag-grid-react, axios, react (+31 more)

### Community 6 - "App.jsx"
Cohesion: 0.11
Nodes (20): App(), ErrorBoundary, ProjectLayout(), NAV_ITEMS, Sidebar(), styles, ProtectedRoute(), SkeletonLine() (+12 more)

### Community 7 - "Templates & Compat Map"
Cohesion: 0.08
Nodes (20): Client, Step 1 & 2 combined: Reads a template-conforming .xlsx file,     parses it direc, Alternative ingestion path - direct manual entry from a structured template., save_manual_entry(), upload_template(), Any, Settings, configure_logging() (+12 more)

### Community 8 - "Shared Utils (Compat Map)"
Cohesion: 0.11
Nodes (11): _get_compat(), _parse_year(), Shared Financial Data Utilities =============================== Single source of, Extract the last block of digits from a string to form a valid year.      Exampl, # NOTE: compat returns the FIRST non-zero hit only; the summed, Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.      Resolu, shared_utils is the single source of truth for the compat key map. These tests p, If these fail, someone re-copied the helpers into an engine — don't. (+3 more)

### Community 9 - "Projects API Routes"
Cohesion: 0.08
Nodes (35): _extract_bearer_token(), get_current_user(), get_db(), get_user_db(), Client, Shared FastAPI dependencies — injected via Depends()., Yield the **service-role** Supabase client (bypasses RLS).      Reserved for ope, Pull the raw JWT out of an ``Authorization: Bearer <token>`` header. (+27 more)

### Community 10 - "Analysis API Routes"
Cohesion: 0.17
Nodes (16): compute_forecast(), ComputeForecastPayload, ForecastInputsPayload, get_dcf_base_metrics(), get_financial_ratios(), get_forecast(), get_historical_assumptions(), get_horizontal_analysis() (+8 more)

### Community 11 - "compute_ratios"
Cohesion: 0.12
Nodes (15): compute_ratios(), Compute all 32 financial ratios for each available fiscal year.      Returns:, balance_sheet(), base_balanced(), income_statement(), label_for(), make_statement(), Shared fixtures for the backend test suite.  Statement fixtures use the SAME can (+7 more)

### Community 13 - "E2E Dev Dependencies"
Cohesion: 0.25
Nodes (7): devDependencies, @playwright/test, name, scripts, test, version, @playwright/test

### Community 14 - "Lint Config"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

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
- **70 isolated node(s):** `name`, `version`, `test`, `@playwright/test`, `{ defineConfig, devices }` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Split Calculation Ownership (frontend statement math / backend analytics)` connect `React Frontend UI` to `Forecasting Engine`, `Analysis Engine (Ratios/DCF)`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `run_forecast()` connect `Forecasting Engine` to `React Frontend UI`, `Analysis API Routes`, `Analysis Engine (Ratios/DCF)`, `Excel Export`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `ForecastInputs` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastInputs` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `ForecastingEngine` (e.g. with `TestBalancedMode` and `TestFaithfulMode`) actually correct?**
  _`ForecastingEngine` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `test` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `React Frontend UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0640503517215846 - nodes in this community are weakly interconnected._
- **Should `Forecasting Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.08896103896103896 - nodes in this community are weakly interconnected._