const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'frontend/src/utils/statementTemplateStructure.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

const calculatedKeys = [
  'totalRevenue', 'revenueHeader', 'totalCostOfRevenue', 'costOfRevenueDisplayHeader',
  'grossProfit', 'totalSellingExpense', 'totalGeneralAdminExpense', 'totalOtherOperatingExpense',
  'operatingExpensesHeader', 'operatingIncome', 'operatingIncomeDisplayHeader',
  'nonOperatingHeader', 'earningsBeforeTax', 'incomeTaxHeader', 'netIncome',
  'netIncomeAttributableToParent', 'ebitda', 'ebit',
  'netReceivables', 'totalInventory', 'totalCurrentAssets', 'grossPPE', 'netPPE',
  'grossIntangibleAssets', 'netIntangibleAssets', 'totalNonCurrentAssets', 'totalAssets',
  'totalCurrentLiabilities', 'totalNonCurrentLiabilities', 'totalLiabilities',
  'totalEquity', 'totalLiabilitiesAndEquity', 'balanceCheck'
];

let changed = false;

for (const type of ['income_statement', 'balance_sheet']) {
  data[type].forEach(item => {
    if (calculatedKeys.includes(item.key)) {
      if (!item.is_subtotal && !item.is_header) {
        console.log(`Fixing ${item.key}: changing to is_subtotal = true`);
        item.is_subtotal = true;
        changed = true;
      }
    } else {
        if (item.is_subtotal && !item.is_header) {
            console.log(`Warning: ${item.key} is a subtotal but not in calculatedKeys. Consider if it should be.`);
        }
    }
  });
}

if (changed) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log('Fixed statementTemplateStructure.json');
} else {
  console.log('No fixes needed for statementTemplateStructure.json');
}
