# Backend Cleanup Handoff Report

## 1. Observation
- **`backend/tests/test_integration.py`**:
  - Imports `parse_and_suggest_mapping`, `normalize_confirmed_mapping` from `app.services.excel_parser`. (Lines 6-7)
  - Imports `MappingConfirmation` from `app.models.financial`. (Line 9)
  - Calls these functions in `test_end_to_end_flow()`.
  - The test generates a generic mock Excel file via `create_test_excel()` without the required strict sheet names ("Income Statement", "Balance Sheet", "Cash Flow Statement").
- **`backend/app/services/excel_parser.py`**:
  - The functions `parse_and_suggest_mapping` and `normalize_confirmed_mapping` no longer exist. The file was rewritten to "Strict Template Mode", and now exports `parse_template_upload`.
- **`backend/app/models/financial.py`**:
  - Defines classes `MappingCandidate`, `MappingConfirmation`, and `ParseResponse` (Lines 251-281). These are unused elsewhere in the codebase.
- **`backend/app/services/forecasting_engine.py`**:
  - Re-implements `_get_compat`, `_parse_year`, etc.
  - The `compat` dictionary in `_get_compat` (Lines 38-59) contains duplicate literal keys: `accountsReceivable`, `stBorrowings`, `longTermDebt`, `capitalExpenditure`, `currentIncomeTax`.
- **`backend/app/services/analysis_engine.py`**:
  - Implements `_get_compat`, `_build_lookups` (Lines 91-145, 167-181) which are identical/functionally equivalent to those in `forecasting_engine.py`.
  - Line 834 contains a bug/redundancy: `interest_expense = abs(isg("financeCosts") + isg("financeCosts"))`.
  - Implements `derive_cash_flow_statement()` (Lines 527-788).
- **`backend/app/api/routes_analysis.py`**:
  - `derive_cash_flow_statement()` is called on Line 95 as a fallback. However, `excel_parser.py` already performs this exact CFS derivation during the upload phase (Lines 231-293) and saves it as a structured `FinancialStatement` dictionary in the database.
  - Imports `extract_base_data` and `statement_to_lookup as _stl` from `forecasting_engine.py` (Lines 10-11) but never uses them.
  - Imports `Body` from `fastapi` (Line 1) but never uses it.
- **`backend/app/services/create_dummy.py`**:
  - Generates `dummy_messy.xlsx`, which is no longer compliant with the new Strict Template Mode parser.

## 2. Logic Chain
- The integration tests are failing because they rely on the old "mapping" architecture that has been replaced by the "Strict Template Mode" parser in `excel_parser.py`. To fix them, they need to be refactored to use `parse_template_upload` with a strict template-compliant mock Excel file.
- `MappingCandidate`, `MappingConfirmation`, and `ParseResponse` were part of the old mapping architecture and are now dead code.
- `forecasting_engine.py` and `analysis_engine.py` both implement similar helper logic for data compatibility (`_get_compat`, etc.). These should be refactored into a shared utility file (e.g. `app/models/financial.py` or a new `utils/` module) to avoid repetition and fix the duplicate dictionary keys in `forecasting_engine.py`.
- The `interest_expense` calculation in `analysis_engine.py:834` adds `financeCosts` to itself, erroneously doubling the value. It should be simplified to `abs(isg("financeCosts"))`.
- `derive_cash_flow_statement()` in `analysis_engine.py` is fully redundant. The frontend requires CFS data in the `FinancialStatement` format (which `excel_parser.py` provides), while the `analysis_engine.py` version returns a bespoke `{"operating": {}, "investing": {}}` dict. Since `excel_parser.py` always saves a CFS to the database, the fallback call in `routes_analysis.py` is either dead code or would return the wrong schema. We can delete `derive_cash_flow_statement` from `analysis_engine.py` entirely, and simplify `routes_analysis.py`'s cash flow endpoint to just return the stored CFS.
- Unused imports in `routes_analysis.py` should be removed to clean up the code.
- `create_dummy.py` and `dummy_messy.xlsx` are obsolete testing relics and should be deleted.

## 3. Caveats
- I did not run pytest locally, as the test script's static imports of non-existent functions guarantee failure.
- When consolidating `_get_compat`, ensure that the merged compatibility dictionary satisfies the fallback mapping rules of *both* `analysis_engine.py` and `forecasting_engine.py`.

## 4. Conclusion
1. **Integration Tests (`tests/test_integration.py`)**: Needs rewrite to use `parse_template_upload` and generate a `manualEntryTemplate.json` compliant Excel file with correct sheet names ("Income Statement", "Balance Sheet", "Cash Flow Statement").
2. **Dead Code Removal**: Remove `MappingCandidate`, `MappingConfirmation`, `ParseResponse` from `app/models/financial.py`. Remove `create_dummy.py` and `dummy_messy.xlsx`. Remove `derive_cash_flow_statement()` from `analysis_engine.py` and its invocation in `routes_analysis.py`.
3. **Consolidation**: Extract `_get_compat`, `_build_lookups`, and `_parse_year` from both engines into a shared module. Fix the duplicate keys bug in the merged dictionary.
4. **Bug Fixes**: Fix the `interest_expense` line in `analysis_engine.py:834`. Remove unused imports in `routes_analysis.py`.

## 5. Verification Method
1. Run `pytest backend/tests/test_integration.py` to verify that the end-to-end integration test passes after the refactor.
2. Check that the FastAPI server starts without import errors and that all unused imports/models have been successfully cleared out.
