# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Financial Statement Analysis & Business Valuation platform (KFUPM Summer Training / Bayan Altharwah). React 19 + Vite frontend, FastAPI backend, Supabase (single `projects` table, statements stored as JSONB). No auth — development tool, backend uses the Supabase service-role key.

Note: code comments cite "SRS §x.y" — that document is NOT in the repo. `ORIGINAL_REQUEST.md` and `README.md` are the closest requirement sources.

## Commands

```bash
# Backend (from backend/)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000     # API docs at :8000/docs
python -m pytest                              # full suite (~3s)
python -m pytest tests/test_forecasting_engine.py -k faithful   # single subset

# Frontend (from frontend/)
npm install
npm run dev                                   # :5173 (expects backend on :8000)
npm run build
npm run lint                                  # oxlint

# E2E (from e2e/) — needs BOTH servers already running
npx playwright test                           # smoke suite, tests/smoke.spec.js

# Database: run supabase/migrations/*.sql in order via Supabase SQL Editor
```

Backend `.env` needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; frontend `.env` needs `VITE_API_URL`. Copy from the `.env.example` files.

Backend suite is **95 tests, ~3.5s**, all passing. The `e2e/` Playwright suite was **fictional** in early revisions; it was replaced with a real smoke suite (`e2e/tests/smoke.spec.js`) that does pass — it cleans up via the API, not the UI. It's a thin smoke test, not broad coverage.

## Architecture — the three contracts that matter

### 1. Calculation ownership is split deliberately
- **Frontend owns interactive statement math** ([frontend/src/utils/calculations.js](frontend/src/utils/calculations.js)): `recalculateTotals` computes every subtotal/header as the user types; `deriveCashFlow` derives the CFS from IS + BS. Results are **persisted** via `POST /upload/manual`.
- **Backend owns analytics** ([backend/app/services/](backend/app/services/)): `analysis_engine.py` (32 ratios, horizontal analysis, DCF base metrics), `forecasting_engine.py` (5-year 3-statement model). It **reads the stored statements** — it never re-derives totals or the CFS.
- The DCF valuation itself runs **frontend-only** in `Valuation.jsx` (responsiveness requirement); the backend supplies base metrics via `/analysis/{id}/dcf-metrics`.
- A dead Python duplicate of the CFS derivation was removed — **do not reintroduce a second implementation of any statement math.**

### 2. Statement template has ONE source of truth
`backend/app/models/manualEntryTemplate.json`, loaded by `app/models/statement_templates.py`, served at `GET /api/templates/statements`. The frontend fetches it (cached in `projectStore.js`) to initialize manual entry; the Excel parser matches upload rows against its labels **strictly**. There is no frontend copy anymore — line-item changes happen in that one JSON. `frontend/public/Saudi_Template.xlsx` must be regenerated to match (`backend/scripts/generate_templates.py`).

### 3. Compat key map has ONE home
`backend/app/services/shared_utils.py` (`KEY_COMPAT_MAP`, `_get_compat`, `_parse_year`, `_build_lookups`) is shared by both engines. `tests/test_shared_utils.py` has identity assertions that fail if the helpers get re-copied into an engine. Line items are addressed by canonical camelCase `key` (e.g. `totalRevenue`, `ltDebtData`); display `label` is presentation only — never match on labels in new code (horizontal analysis is the one legacy exception).

### 4. Headers ARE the totals — no standalone aggregate rows
22 redundant aggregate rows (`Total Revenue`, `Total Assets`, `Net Cash from Operating`, …) were removed; the **section header row carries the computed total**. Enforcement is layered, so don't undo one layer and assume it's fine:
- Removed from the canonical template (so new projects / uploads / the served template are clean).
- `deriveCashFlow` no longer writes the two CFS totals — it would silently recreate the rows.
- A backend test **fails if any removed key reappears** in the template.
- Legacy projects are handled by a `DEPRECATED_ROW_KEYS` scrub (`frontend/src/store/projectStore.js`, `utils/statementDisplay.js`) applied on load; the next autosave persists the cleaned set.

Deliberately kept, because they aren't duplicates: **Total Liabilities & Equity** (the L+E side of the Balance Check, no header equivalent) and **Total Comprehensive Income** (a distinct metric).

## Excel export (`backend/app/services/excel_export.py`)

A **live-formula** workbook, not a value dump — every projected figure is a real Excel formula chain, so editing a blue driver cell recalculates statements, ratios, and the DCF.

- **7 sheets**: Income Statement, Balance Sheet, Cash Flow Statement, Ratios, Horizontal Analysis, DCF, Assumptions (`MODEL_SHEET`).
- **One Assumptions sheet drives everything.** It holds the forecast drivers, a "Valuation (DCF) Drivers" section, *and* the 57-row engine calculation block (grouped one outline level, **collapsed by default**, under a "do not edit" banner). There is **no hidden "Forecast Engine" sheet anymore** — it was merged in; older notes describing an 8th hidden sheet are stale.
- The DCF sheet holds **no local copies** of WACC/TGR/method/exit multiple/shares — it references the Assumptions sheet via green cross-sheet links (`='Assumptions'!C21`), the same convention as Base Metrics.
- **Export defaults to `balance_mode="faithful"`**, deliberately: balanced mode's cash plug would silently absorb an imbalance in the user's own source data and show a clean Balance Check. Faithful surfaces it instead. This is a default-choice, not a correctness fix — both modes are valid.
- The DCF sensitivity grid's value-per-share cell is filled yellow for visibility.

Verified historically by recalculating with real Excel via COM (~3,050 formulas, zero errors) and checking numeric parity against `run_forecast` in both modes.

## Reporting unit — everything is in thousands

All money figures are **thousands** (`SAR '000`, or the project's `currency`). This is a **labeling/UI convention, not a math change**: the platform's arithmetic is scale-invariant, so ratios, margins, growth, common-size and horizontal analysis are unchanged, and DCF values simply come out in thousands.

The one real trap: **per-share metrics**. EPS / book-value-per-share / DCF value-per-share divide money by a share *count*, so the share count must **also be entered in thousands** for the scales to cancel. The Valuation shares field is labeled `'000` for this reason.

Use `fmtMoney` / `unitLabel` from `frontend/src/utils/formatters.js` for money headlines — **not** the compact `fmtCurrency`, which would render 5,000,000-in-thousands as a misleading "5.0K".

## Data model

One Supabase table `projects`: `income_statement` / `balance_sheet` / `cash_flow_statement` (JSONB `{years: [...], rows: [{row_id, key, label, section, level, is_header, is_subtotal, industry, values: {year: val}}]}`), plus `forecast_data` and `dcf_assumptions`. Statement saves **clear `forecast_data`** (stale-forecast guard) — the user must re-run the forecast.

## Forecasting engine specifics

`run_forecast(..., balance_mode=...)` supports two modes (see `tests/test_forecasting_engine.py` for the executable spec):
- `"balanced"` — cash (+ short-term revolver on shortfall) is the balance-sheet plug; A = L + E is forced **even if the input BS doesn't reconcile**.
- `"faithful"` — cash is CFS-driven; a base-year imbalance carries through every forecast year exactly. Unmodeled BS lines hold at base-year values.
Revenue growth: flat `revenue_growth_rate` or per-year `revenue_growth_rates` list (short lists carry the last rate forward). DSO/DIO/DPO/depreciation% are auto-derived from historicals (`/forecast/assumptions`) and user-overridable. The response includes `base_imbalance` so the UI can warn about unreconciled input.

## DCF ↔ forecast wiring (resolved — was a known gap)

`Valuation.jsx` now prefers the **saved forecast's actual FCFs** over the old growth heuristic:

- `extractForecastFCFs(project.forecast_data)` reads `scenarios.<scenario>.forecasts[]` → per-year `free_cash_flow`, plus the terminal year's `ebitda` (used directly for the exit-multiple terminal value instead of growing base-year EBITDA).
- `projectFCFs`'s `min(TGR × 1.5, 8%)` curve is now only a **fallback**, used when no forecast is stored. Statement saves clear `forecast_data`, so it reverts to the fallback until the forecast is re-run — by design.
- `computeDCF` returns `fcfSource: 'forecast' | 'heuristic'`, surfaced as a **Forecast-driven / Estimated** banner. A valuation is never silently based on the placeholder.
- This keeps the DCF frontend-only (<100ms, the responsiveness rule) — it reads stored data, it does not call the backend.
- A forecast shorter than `forecastYears` is extended from its last year so the discounting horizon still matches.
- Note: with a forecast present, TGR no longer moves the projected FCFs (only the terminal value) — correct, since the model's cash flows are already fixed.

`valuationMethod` / `exitMultiple` are now persisted in `dcf_assumptions` (`valuation_method`, `exit_multiple`) and restored on load. This was **two** bugs: they were missing from the autosave payload *and* their onChange handlers never set `dirtyRef`, so the dirty-guard suppressed the save regardless.

## Known gaps (real, still open — don't "discover" these as bugs)

- Excel upload parsing/bucket-mapping is still in progress; calculations have not yet been validated against a real company's statements.
- The Valuation page reads only the `base` scenario; `optimistic`/`pessimistic` forecasts are computed and stored but unused by the DCF.

## Gotchas

- Excel upload is **strict-template**: sheets must be named exactly "Income Statement" / "Balance Sheet" / "Cash Flow Statement" and row labels must match the template; non-matching rows are reported in `unmapped_rows`, not guessed.
- `zustand` store (`projectStore.js`) is the **sole** state authority. The old Outlet-context split-brain (audit item A3) is **resolved** — there are zero `useOutletContext` callers; don't reintroduce one.
- Number formatting is unified in `frontend/src/utils/formatters.js` (audit item A5, **resolved**). Add to that file rather than writing a local formatter.
- Windows dev machine: Git Bash + PowerShell both in play; watch CRLF warnings, they're harmless here. Python `multiprocessing` needs an `if __name__ == '__main__'` guard here (spawn, not fork).
- pytest must run from `backend/` (imports resolve via cwd).
- Branches: work has landed on `main`; `version-2-claude` and `old-main` are older lines still on the remote.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
