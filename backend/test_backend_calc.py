import json
from app.services.analysis_engine import derive_cash_flow_statement, compute_dcf_base_metrics

# Load a mock project
with open(r"c:\Users\s9378\Desktop\Summer Work\Code Work\financial-analyzer-platform\frontend\src\utils\statementTemplateStructure.json", "r", encoding="utf-8") as f:
    template = json.load(f)

def build_statement(rows, val):
    new_rows = []
    for r in rows:
        r_copy = dict(r)
        r_copy['values'] = {"2022": val, "2023": val + 10}
        new_rows.append(r_copy)
    return {"rows": new_rows, "years": ["2022", "2023"]}

income_statement = build_statement(template["income_statement"], 100)
balance_sheet = build_statement(template["balance_sheet"], 500)
cash_flow = build_statement(template["cash_flow_statement"], 50)

# The DCF test
try:
    dcf = compute_dcf_base_metrics(income_statement, balance_sheet, cash_flow)
    print("DCF Output:")
    print(json.dumps(dcf, indent=2))
except Exception as e:
    print("DCF Error:", e)

# The derive test
try:
    derived_cfs = derive_cash_flow_statement(income_statement, balance_sheet)
    print("Derived CFS:")
    print(json.dumps(derived_cfs, indent=2))
except Exception as e:
    print("Derive Error:", e)

