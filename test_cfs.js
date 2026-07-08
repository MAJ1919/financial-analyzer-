import fs from 'fs';
import { recalculateTotals, deriveCashFlow } from './frontend/src/utils/calculations.js';

const template = JSON.parse(fs.readFileSync('./frontend/src/utils/statementTemplateStructure.json', 'utf8'));

let isRows = template.income_statement.map(row => ({ ...row, values: { '2022': 0, '2023': 0 } }));
let bsRows = template.balance_sheet.map(row => ({ ...row, values: { '2022': 0, '2023': 0 } }));
let cfsRows = template.cash_flow_statement.map(row => ({ ...row, values: { '2022': 0, '2023': 0 } }));

const setVal = (rows, key, year, val) => {
    const row = rows.find(r => r.key === key);
    if (row) row.values[year] = val;
}

// Year 2022
setVal(isRows, 'netIncome', '2022', 100);
setVal(isRows, 'depreciationCostOfSales', '2022', 20);

// Year 2023
setVal(isRows, 'netIncome', '2023', 150);
setVal(isRows, 'depreciationCostOfSales', '2023', 25);
setVal(bsRows, 'netReceivables', '2022', 50);
setVal(bsRows, 'netReceivables', '2023', 70); // Increase of 20 -> change is -20

cfsRows = deriveCashFlow(isRows, bsRows, cfsRows, ['2022', '2023']);

console.log("CFS 2022 Net Income:", cfsRows.find(r => r.key === 'cfNetIncomeData').values['2022']);
console.log("CFS 2022 Depreciation:", cfsRows.find(r => r.key === 'depreciationCostOfSales').values['2022']);
console.log("CFS 2022 Total Non-Cash:", cfsRows.find(r => r.key === 'totalNonCashAdjustments').values['2022']);
console.log("CFS 2023 AR Change:", cfsRows.find(r => r.key === 'changeTradeAccountsReceivable').values['2023']);
console.log("CFS 2023 Total WC Change:", cfsRows.find(r => r.key === 'totalWorkingCapitalAdjustments').values['2023']);
console.log("CFS 2023 Operating Cash Flow:", cfsRows.find(r => r.key === 'operatingCashFlow').values['2023']);

