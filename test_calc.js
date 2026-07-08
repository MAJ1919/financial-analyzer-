import fs from 'fs';
import { recalculateTotals, deriveCashFlow } from './frontend/src/utils/calculations.js';

const template = JSON.parse(fs.readFileSync('./frontend/src/utils/statementTemplateStructure.json', 'utf8'));

let isRows = template.income_statement.map(row => ({ ...row, values: { '2022': 0 } }));
let bsRows = template.balance_sheet.map(row => ({ ...row, values: { '2022': 0 } }));
let cfsRows = template.cash_flow_statement.map(row => ({ ...row, values: { '2022': 0 } }));

// Simulate user input
const setVal = (rows, key, val) => {
    const row = rows.find(r => r.key === key);
    if (row) row.values['2022'] = val;
}

setVal(isRows, 'productRevenue', 5);
setVal(isRows, 'serviceRevenue', 56);
setVal(isRows, 'otherRevenue', 56);
setVal(isRows, 'rawMaterialsExpense', 65);
setVal(isRows, 'directLabor', 6);

isRows = recalculateTotals('income_statement', isRows);

console.log("Total Revenue:", isRows.find(r => r.key === 'totalRevenue').values['2022']);
console.log("Total Cost of Revenue:", isRows.find(r => r.key === 'totalCostOfRevenue').values['2022']);
console.log("Gross Profit:", isRows.find(r => r.key === 'grossProfit').values['2022']);

