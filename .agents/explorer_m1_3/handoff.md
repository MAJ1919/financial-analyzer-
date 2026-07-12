# Handoff Report: Backend Refactoring & Cleanup

## 1. Observation
- **Redundant Fallback Logic**: 
  - `analysis_engine.py` (lines 91-146) and `forecasting_engine.py` (lines 31-77) duplicate an identical `_get_compat` function which maps old fallback keys (e.g., `"totalRevenue": ["revenueHeader"]`). 
  - `analysis_engine.py` (lines 636-700) uses a highly redundant `_find_label_or_key` function within `derive_cash_flow_statement`, heavily relying on hardcoded arrays of display strings (`labels=["Cash & Cash Equivalents", "Cash", ...]`) to extract values from pandas DataFrames.
- **Dead Code / Deprecated Functions**: 
  - `app/services/test_excel_parser.py` tests a removed function `parse_messy_excel` using fuzzy matching logic (`_best_match`).
  - `app/services/create_dummy.py` and `app/services/dummy_messy.xlsx` are test fixtures for this removed parser logic.
  - `tests/test_integration.py` (lines 6, 49, 89) imports and tests `parse_and_suggest_mapping` and `normalize_confirmed_mapping`, which no longer exist in `excel_parser.py`.
- **Unused Imports**: 
  - `app/api/routes_analysis.py` (lines 10-12) imports `extract_base_data` and `statement_to_lookup as _stl` from `forecasting_engine.py`, but they are never used.
- **Repeated Patterns for Consolidation**:
  - `analysis_engine.py` converts financial statements into Pandas DataFrames (`_to_dataframe`, lines 461-477) for computing YoY changes and CFS derivation, while simultaneously using flat dictionaries (`_build_lookups`) elsewhere. 
- **Pytest Integration Tests Readiness**:
  - The `test_end_to_end_flow()` in `tests/test_integration.py` will fail with an `ImportError` due to missing parser functions.
  - If the test progresses past parsing, it will hit multiple `AttributeError`s in `forecasting_engine.py` (lines 759-805) during `run_forecast(..., scenarios=["base", "optimistic"])` because the `YearlyForecast` object `f` is accessed using non-existent fields:
    - `f.current_assets` instead of `f.total_current_assets`
    - `f.intangible_assets` (does not exist, should be `f.goodwill + f.other_intangibles`)
    - `f.non_current_assets` (does not exist)
    - `f.short_term_debt` and `f.current_portion_lt_debt` (does not exist)
    - `f.current_liabilities` instead of `f.total_current_liabilities`
    - `f.non_current_liabilities` (does not exist)
    - `f.total_liabilities_and_equity` (does not exist)
    - `f.change_in_working_capital` instead of `f.working_capital_change`
    - `f.capital_expenditures` instead of `f.capex`
    - `f.change_in_short_term_debt` and `f.change_in_long_term_debt` (do not exist)
    - `f.net_change_in_cash` instead of `f.net_cash_change`

## 2. Logic Chain
1. The platform recently migrated to a Strict Template Mode (`manualEntryTemplate.json`) which ensures that `excel_parser.py` maps data to predefined keys exactly. 
2. Because keys are strictly enforced on parsing, old fallback mapping logics in `_get_compat` are redundant and can be removed (or centralized to a single shared utility if legacy DB data must still be supported).
3. The CFS derivation's `_find_label_or_key` uses legacy label matching against Pandas Indices, which is completely unnecessary since it can use `_get(is_l, key, year)` dict lookups just like the Ratio calculations, allowing `_to_dataframe` and the label-matching logic to be removed from CFS entirely.
4. Old messy parser test code (`test_excel_parser.py`, `create_dummy.py`) and deprecated imports (`tests/test_integration.py`) remain in the codebase, preventing test execution.
5. In `forecasting_engine.py`, the logic that applies scenario multipliers to the `full_balance_sheet` and `full_cash_flow_statement` references incorrectly named fields on the `YearlyForecast` dataclass, reflecting out-of-sync schemas that crash upon any scenario invocation.

## 3. Caveats
- I did not explore if older projects in the Supabase DB still rely on `_get_compat` mappings. If they do, `_get_compat` cannot be entirely removed but should at least be centralized (e.g., in `models/financial.py` or a shared `utils` file) instead of duplicated.
- I was unable to execute the pytest command directly due to terminal permission constraints, so test failures were identified purely via static analysis.

## 4. Conclusion
To ensure tests pass and clean the backend:
1. **Refactor `test_integration.py`**: Update `create_test_excel` to conform to `manualEntryTemplate.json` (Strict Template Mode), replace deprecated parser imports with `parse_template_upload`, and remove manual mapping logic.
2. **Fix `forecasting_engine.py` AttributeErrors**: Correct the field names mapping `YearlyForecast` to the `full_balance_sheet` and `full_cash_flow_statement` override dictionaries (lines 759-805).
3. **Consolidate & Remove Fallbacks**: 
   - Extract `_get_compat` to a shared utility and eliminate duplication between the two engines.
   - Rewrite `derive_cash_flow_statement` in `analysis_engine.py` to use `_build_lookups` (the `is_l` and `bs_l` dicts) instead of Pandas `_to_dataframe` and `_find_label_or_key`.
4. **Delete Dead Code**: Remove `app/services/test_excel_parser.py`, `create_dummy.py`, `dummy_messy.xlsx`, and unused imports in `app/api/routes_analysis.py`.

## 5. Verification Method
- Ensure all dead files are deleted.
- Run `pytest tests/test_integration.py` — it must pass successfully without any `ImportError` or `AttributeError`.
- Check `app/api/routes_analysis.py` for cleanly formatted imports.
- Verify `derive_cash_flow_statement` no longer calls `_to_dataframe` or `_find_label_or_key`.
