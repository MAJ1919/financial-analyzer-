const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'frontend/src/utils/statementTemplateStructure.json');
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

// Extract all keys from the JSON structure
const bsKeys = new Set(data.balance_sheet.map(item => item.key));
const isKeys = new Set(data.income_statement.map(item => item.key));
const cfsKeys = new Set(data.cash_flow_statement.map(item => item.key));

// Let's define the keys used in calculations.js for BS
const bsUsedKeys = [
  'tradeAccountsReceivable', 'notesReceivable', 'otherReceivables', 'allowanceForDoubtfulAccounts', 'netReceivables',
  'rawMaterials', 'workInProcess', 'finishedGoods', 'otherInventory', 'totalInventory',
  'cashAndEquivalents', 'restrictedCash', 'shortTermInvestments', 'otherCurrentAssetsData', 'totalCurrentAssets',
  'land', 'buildings', 'machineryAndEquipment', 'constructionInProgress', 'furnitureAndFixtures', 'vehicles', 'rightOfUseAssets', 'otherPPE', 'grossPPE',
  'accumulatedDepreciation', 'netPPE',
  'goodwill', 'software', 'otherIntangibleAssets', 'grossIntangibleAssets',
  'accumulatedAmortization', 'netIntangibleAssets',
  'equityInvestments', 'debtInvestments', 'investmentsInAssociates', 'otherInvestments',
  'deferredTaxAssets', 'longTermReceivables', 'otherNonCurrentAssetsData', 'totalNonCurrentAssets',
  'totalAssets',
  'accountsPayable', 'notesPayable', 'otherPayables',
  'accruedExpenses', 'accruedPayroll', 'accruedInterest', 'customerAdvances',
  'stBorrowingsData', 'currentPortionLTDebt', 'currentLeaseLiabilities',
  'deferredRevenue', 'contractLiabilities', 'incomeTaxPayable', 'otherCurrentLiabilitiesData',
  'totalCurrentLiabilities',
  'ltDebtData', 'leaseLiabilities', 'otherLongTermBorrowings',
  'deferredTaxLiabilities', 'pensionObligations', 'assetRetirementObligations', 'otherLTLiabilitiesData',
  'totalNonCurrentLiabilities',
  'totalLiabilities',
  'commonStock', 'preferredStock', 'additionalPaidInCapital', 'treasuryStock', 'retainedEarnings', 'accumulatedOCI', 'otherReserves', 'nonControllingInterest',
  'totalEquity',
  'totalLiabilitiesAndEquity', 'balanceCheck'
];

console.log('--- Missing Balance Sheet Keys in Template ---');
bsUsedKeys.forEach(k => {
  if (!bsKeys.has(k)) {
    console.log(k);
  }
});

const isUsedKeys = [
  'productRevenue', 'serviceRevenue', 'otherRevenue', 'totalRevenue', 'revenueHeader',
  'rawMaterialCosts', 'directLabor', 'manufacturingOverhead', 'freightAndDistribution', 'inventoryWriteDown',
  'costOfServices', 'otherCostOfRevenue', 'totalCostOfRevenue', 'costOfRevenueDisplayHeader',
  'grossProfit',
  'sellingExpense', 'advertisingAndMarketing', 'distributionExpense', 'otherSellingExpense', 'totalSellingExpense',
  'generalAdminExpense', 'administrativeExpense', 'professionalFees', 'informationTechnologyExpense', 'otherAdministrativeExpense', 'totalGeneralAdminExpense',
  'depreciationOpex', 'amortizationOpex', 'shareBasedCompensation', 'impairmentLosses', 'restructuringCharges', 'otherOperatingExpense', 'totalOtherOperatingExpense',
  'researchDevExpense', 'operatingExpensesHeader',
  'operatingIncome', 'operatingIncomeDisplayHeader',
  'financialIncome', 'financialExpense', 'otherNonOpIncomeExpense', 'nonOperatingHeader',
  'earningsBeforeTax',
  'incomeTaxExpense', 'incomeTaxHeader',
  'netIncome',
  'nonControllingInterest', 'netIncomeAttributableToParent',
  'depreciationCostOfSales', 'ebitda', 'ebit'
];

console.log('\n--- Missing Income Statement Keys in Template ---');
isUsedKeys.forEach(k => {
  if (!isKeys.has(k)) {
    console.log(k);
  }
});

