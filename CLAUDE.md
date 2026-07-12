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

# Database: run supabase/migrations/*.sql in order via Supabase SQL Editor
```

Backend `.env` needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; frontend `.env` needs `VITE_API_URL`. Copy from the `.env.example` files.

The `e2e/` Playwright suite is **fictional** — written against a UI that never existed; it cannot pass. Don't treat it as a safety net; replace it before relying on it.

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

## Data model

One Supabase table `projects`: `income_statement` / `balance_sheet` / `cash_flow_statement` (JSONB `{years: [...], rows: [{row_id, key, label, section, level, is_header, is_subtotal, industry, values: {year: val}}]}`), plus `forecast_data` and `dcf_assumptions`. Statement saves **clear `forecast_data`** (stale-forecast guard) — the user must re-run the forecast.

## Forecasting engine specifics

`run_forecast(..., balance_mode=...)` supports two modes (see `tests/test_forecasting_engine.py` for the executable spec):
- `"balanced"` — cash (+ short-term revolver on shortfall) is the balance-sheet plug; A = L + E is forced **even if the input BS doesn't reconcile**.
- `"faithful"` — cash is CFS-driven; a base-year imbalance carries through every forecast year exactly. Unmodeled BS lines hold at base-year values.
Revenue growth: flat `revenue_growth_rate` or per-year `revenue_growth_rates` list (short lists carry the last rate forward). DSO/DIO/DPO/depreciation% are auto-derived from historicals (`/forecast/assumptions`) and user-overridable. The response includes `base_imbalance` so the UI can warn about unreconciled input.

## Gotchas

- Excel upload is **strict-template**: sheets must be named exactly "Income Statement" / "Balance Sheet" / "Cash Flow Statement" and row labels must match the template; non-matching rows are reported in `unmapped_rows`, not guessed.
- `zustand` store (`projectStore.js`) is the state authority; `ProjectLayout` also passes `{project, setProject}` through Outlet context — a known split-brain (audit item A3, not yet unified). Prefer the store in new code.
- Frontend has several formatter implementations (audit item A5, not yet unified) — check `Forecasting.jsx`/`Valuation.jsx` before adding another.
- Windows dev machine: Git Bash + PowerShell both in play; watch CRLF warnings, they're harmless here.
- pytest must run from `backend/` (imports resolve via cwd).
