# Synthesis: Backend Cleanup

## Consensus
1. **Pytest Integration Tests (`tests/test_integration.py` & `app/services/test_excel_parser.py`)**:
   - `test_integration.py` uses deprecated fuzzy mapping functions (`parse_and_suggest_mapping`, etc.). It must be refactored to use `parse_template_upload` and a strict template-compliant mock Excel file (sheet names: "Income Statement", "Balance Sheet", "Cash Flow Statement").
   - `test_excel_parser.py` tests old fuzzy mapping and should be deleted.
2. **Dead Code & Artifacts**:
   - `app/models/financial.py` has unused models: `MappingCandidate`, `MappingConfirmation`, `ParseResponse`. Delete them.
   - `app/services/create_dummy.py` and `app/services/dummy_messy.xlsx` are obsolete. Delete them.
   - `app/api/routes_analysis.py` has unused imports (`extract_base_data`, `_stl`, `Body`). Remove them.
3. **Duplication (`_get_compat`, `_build_lookups`, `_parse_year`)**:
   - These helpers are duplicated verbatim across `analysis_engine.py` and `forecasting_engine.py`.
   - Extract them into a single shared utility module (`app/services/shared_utils.py` or similar).
   - Fix the duplicate dictionary keys in `_get_compat` during consolidation.
4. **Bugs**:
   - `analysis_engine.py` near line 834 has a bug: `interest_expense = abs(isg("financeCosts") + isg("financeCosts"))`. Fix to use just one `isg`.
   - `forecasting_engine.py` (lines 759-805) has scenario overrides that reference non-existent fields on the `YearlyForecast` dataclass (e.g., using `f.current_assets` instead of `f.total_current_assets`). These cause `AttributeError`s and must be corrected.
5. **Redundant CFS Fallback (`derive_cash_flow_statement`)**:
   - `analysis_engine.py` implements a redundant, massive `derive_cash_flow_statement` using outdated Pandas label matching.
   - `excel_parser.py` already derives the CFS robustly on upload.
   - Action: Remove `derive_cash_flow_statement()` from `analysis_engine.py` entirely. Update `routes_analysis.py` to simply return the stored CFS from the database, removing the fallback call.

## Gaps
- None identified.

## Verification
- Run `pytest backend/tests` to ensure tests pass with 100% success.
- Ensure the FastAPI server can start up cleanly with no import errors.
