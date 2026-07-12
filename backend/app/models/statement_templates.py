"""
Statement template loader — SINGLE SOURCE OF TRUTH.

manualEntryTemplate.json defines the canonical row structure (keys, labels,
sections, hierarchy, industry tags) for all three financial statements.
It is consumed by:
  - excel_parser.py            (strict label matching on upload)
  - GET /api/templates/statements  (frontend fetches this to initialize
                                    manual entry — it no longer bundles
                                    its own copy of the structure)
  - scripts/generate_templates.py  (Excel template regeneration)

Any line-item change happens HERE and propagates everywhere.
"""
import json
import os
from functools import lru_cache

_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "manualEntryTemplate.json")


@lru_cache(maxsize=1)
def load_statement_templates() -> dict:
    """Return {income_statement: [...], balance_sheet: [...], cash_flow_statement: [...]}."""
    with open(_TEMPLATE_PATH, encoding="utf-8") as f:
        return json.load(f)
