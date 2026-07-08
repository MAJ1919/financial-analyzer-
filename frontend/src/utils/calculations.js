// Helper to find or create a calculated row
const ensureRow = (rows, key, label, section, options = {}) => {
  let row = rows.find(r => r.key === key);
  if (!row) {
    row = {
      row_id: `calc_${key}`,
      label,
      key,
      section: options.section || section,
      level: options.level ?? 1,
      is_subtotal: options.is_subtotal || false,
      is_header: options.is_header || false,
      is_calculated: true, // Flag to identify auto-created rows
      values: {},
      order: options.order ?? rows.length,
    };
    rows.push(row);
    console.warn(`🔄 Auto-created missing row: ${key}`);
  }
  return row;
};

export function recalculateTotals(statementType, rows) {
  // Ensure rows is a mutable copy
  let workingRows = Array.isArray(rows) ? [...rows.map(r => ({...r, values: {...r.values}}))] : [];
  
  const rowMap = {};
  workingRows.forEach(r => { rowMap[r.key] = r; });

  const getVal = (key, year) => {
    if (!rowMap[key] || rowMap[key].values[year] == null) return 0;
    return Number(rowMap[key].values[year]);
  };

  const setVal = (key, year, val, meta = {}) => {
    // Auto-create row if missing (only for calculated fields)
    if (!rowMap[key] && meta.autoCreate !== false) {
      const newRow = ensureRow(workingRows, key, meta.label || key, meta.section || 'Calculated', {
        is_subtotal: meta.is_subtotal || false,
        is_header: meta.is_header || false,
        level: meta.level ?? 1
      });
      rowMap[key] = newRow;
    }
    if (rowMap[key]) {
      rowMap[key].values[year] = val;
    }
  };

  if (!workingRows.length) return workingRows;
  
  // Get all years from all rows
  const allYears = new Set();
  workingRows.forEach(r => {
    if (r.values) Object.keys(r.values).forEach(y => allYears.add(y));
  });
  const years = [...allYears];

  years.forEach(year => {
    if (statementType === 'income_statement') {
      // --- Revenue ---
      const totalRev = getVal('productRevenue', year) + getVal('serviceRevenue', year) + getVal('otherRevenue', year);
      setVal('revenueHeader', year, totalRev, { label: 'Revenue', section: 'Revenue', is_header: true });

      // --- Cost of Revenue ---
      const cogs = getVal('rawMaterialsExpense', year) + getVal('directLabor', year) + getVal('manufacturingOverhead', year) + getVal('productionSupplies', year) + getVal('inventoryWriteDown', year);
      const services = getVal('costOfServices', year) + getVal('professionalLabor', year) + getVal('projectCosts', year) + getVal('subcontractorCosts', year);
      const shared = getVal('otherCostOfRevenue', year);
      const totalCOR = cogs + services + shared;
      setVal('manufacturingCostsHeader', year, cogs, { label: 'Manufacturing', section: 'Cost of Revenue', is_header: true });
      setVal('servicesCostsHeader', year, services, { label: 'Services', section: 'Cost of Revenue', is_header: true });
      setVal('sharedCostsHeader', year, shared, { label: 'Shared', section: 'Cost of Revenue', is_header: true });
      setVal('costOfRevenueDisplayHeader', year, totalCOR, { label: 'Cost of Revenue', section: 'Cost of Revenue', is_header: true });

      // --- Gross Profit ---
      const grossProfit = totalRev - totalCOR;
      setVal('grossProfit', year, grossProfit, { label: 'Gross Profit', section: 'Gross Profit', is_subtotal: true });

      // --- Operating Expenses ---
      const totalSelling = getVal('sellingExpense', year) + getVal('advertisingAndMarketing', year) + getVal('distributionExpense', year) + getVal('otherSellingExpense', year);
      setVal('sellingExpensesHeader', year, totalSelling, { label: 'Selling Expenses', section: 'Operating Expenses', is_header: true });

      const totalGA = getVal('generalAdminExpense', year) + getVal('professionalFees', year) + getVal('informationTechnologyExpense', year) + getVal('otherAdministrativeExpense', year);
      setVal('generalAdminHeader', year, totalGA, { label: 'General & Administrative', section: 'Operating Expenses', is_header: true });

      const totalOtherOpEx = getVal('depreciationOpex', year) + getVal('amortizationOpex', year) + getVal('shareBasedCompensation', year) + getVal('impairmentLosses', year) + getVal('restructuringCharges', year) + getVal('otherOperatingExpense', year);
      setVal('otherOperatingExpensesHeader', year, totalOtherOpEx, { label: 'Other Operating Expenses', section: 'Operating Expenses', is_header: true });

      const researchDev = getVal('researchDevExpense', year);
      setVal('researchDevHeader', year, researchDev, { label: 'Research & Development', section: 'Operating Expenses', is_header: true });

      const totalOpEx = totalSelling + totalGA + researchDev + totalOtherOpEx;
      setVal('operatingExpensesHeader', year, totalOpEx, { label: 'Operating Expenses', section: 'Operating Expenses', is_header: true });

      // --- Operating Income ---
      const opIncome = grossProfit - totalOpEx;
      setVal('operatingIncome', year, opIncome, { label: 'Operating Income', section: 'Operating Income', is_subtotal: true });

      // --- Non-Operating & EBT ---
      const nonOpNet = getVal('financeIncome', year) - getVal('financeCosts', year) + getVal('otherNonOpIncomeExpense', year);
      setVal('nonOperatingHeader', year, nonOpNet, { label: 'Non-Operating Income/(Expense)', section: 'Non-Operating', is_header: true });
      
      const ebt = opIncome + nonOpNet;
      setVal('earningsBeforeTax', year, ebt, { label: 'Earnings Before Tax', section: 'Tax', is_subtotal: true });

      // --- Tax & Net Income ---
      const tax = getVal('incomeTaxExpense', year);
      setVal('incomeTaxHeader', year, tax, { label: 'Income Tax', section: 'Tax', is_header: true });
      
      const netInc = ebt - tax;
      setVal('netIncome', year, netInc, { label: 'Net Income', section: 'Net Income', is_subtotal: true });

      // --- Bottom Line ---
      const netIncParent = netInc - getVal('nonControllingInterest', year);
      setVal('netIncomeAttributableToParent', year, netIncParent, { label: 'Net Income Attributable to Parent', section: 'Net Income', is_subtotal: true, level: 2 });

      // --- Supplemental Metrics ---
      setVal('ebitda', year, opIncome + getVal('depreciationOpex', year) + getVal('amortizationOpex', year) + getVal('depreciationCostOfSales', year), { label: 'EBITDA', section: 'Supplemental' });
    }
    
    if (statementType === 'balance_sheet') {
      // --- Assets Header ---
      
      // --- Current Assets ---
      const netRec = getVal('tradeAccountsReceivable', year) + getVal('notesReceivable', year) + getVal('otherReceivables', year) + getVal('contractAssets', year) + getVal('dueFromRelatedParties', year) - getVal('allowanceForDoubtfulAccounts', year);
      setVal('receivablesHeader', year, netRec, { label: 'Receivables', section: 'Current Assets', is_header: true });

      const totalInv = getVal('rawMaterials', year) + getVal('workInProcess', year) + getVal('finishedGoods', year) + getVal('sparePartsAndConsumables', year) + getVal('otherInventory', year);
      setVal('inventoryHeader', year, totalInv, { label: 'Inventory', section: 'Current Assets', is_header: true });

      const currentAssets = getVal('cashAndEquivalents', year) + getVal('restrictedCash', year) + getVal('shortTermInvestments', year) + getVal('prepaidExpenses', year) + getVal('vatRecoverable', year) + getVal('advancesToSuppliers', year) + netRec + totalInv + getVal('otherCurrentAssetsData', year);
      setVal('currentAssetsHeader', year, currentAssets, { label: 'Current Assets', section: 'Current Assets', is_header: true });
      
      // --- Non-Current Assets ---
      const grossPPE = getVal('land', year) + getVal('buildings', year) + getVal('machineryAndEquipment', year) + getVal('capitalWorkInProgress', year) + getVal('furnitureAndFixtures', year) + getVal('vehicles', year) + getVal('rightOfUseAssets', year) + getVal('otherPPE', year);
      setVal('grossPPE', year, grossPPE, { label: 'Gross PPE', section: 'Non-Current Assets', is_subtotal: true, level: 2 });
      const netPPE = grossPPE - getVal('accumulatedDepreciation', year);
      setVal('ppeHeader', year, netPPE, { label: 'Property, Plant & Equipment', section: 'Non-Current Assets', is_header: true });

      const grossIntangibles = getVal('goodwill', year) + getVal('software', year) + getVal('otherIntangibleAssets', year);
      setVal('grossIntangibleAssets', year, grossIntangibles, { label: 'Gross Intangible Assets', section: 'Non-Current Assets', is_subtotal: true, level: 2 });
      const netIntangibleAssets = grossIntangibles - getVal('accumulatedAmortization', year);
      setVal('intangibleAssetsHeader', year, netIntangibleAssets, { label: 'Intangible Assets', section: 'Non-Current Assets', is_header: true });

      const investments = getVal('equityInvestments', year) + getVal('debtInvestments', year) + getVal('investmentsInAssociates', year) + getVal('otherInvestments', year) + getVal('investmentProperty', year);
      setVal('investmentsHeader', year, investments, { label: 'Investments', section: 'Non-Current Assets', is_header: true });
      const otherNonCurrAssets = getVal('deferredTaxAssets', year) + getVal('longTermReceivables', year) + getVal('otherNonCurrentAssetsData', year);

      const nonCurrentAssets = netPPE + netIntangibleAssets + investments + otherNonCurrAssets;
      setVal('nonCurrentAssetsHeader', year, nonCurrentAssets, { label: 'Non-Current Assets', section: 'Non-Current Assets', is_header: true });
      
      // --- Total Assets ---
      const totalAssets = currentAssets + nonCurrentAssets;
      setVal('assetsHeader', year, totalAssets, { label: 'Assets', section: 'Total Assets', is_header: true });

      // --- Current Liabilities ---
      const tradePayables = getVal('accountsPayable', year) + getVal('notesPayable', year) + getVal('otherPayables', year) + getVal('dueToRelatedParties', year);
      setVal('tradePayablesHeader', year, tradePayables, { label: 'Trade Payables', section: 'Current Liabilities', is_header: true });
      const accruedLiab = getVal('accruedExpenses', year) + getVal('accruedPayroll', year) + getVal('accruedInterest', year) + getVal('customerAdvances', year) + getVal('warrantyProvision', year);
      setVal('accruedLiabilitiesHeader', year, accruedLiab, { label: 'Accrued Liabilities', section: 'Current Liabilities', is_header: true });
      const stDebt = getVal('stBorrowingsData', year) + getVal('currentPortionLTDebt', year) + getVal('currentLeaseLiabilities', year);
      const otherCurrLiab = getVal('deferredRevenue', year) + getVal('contractLiabilities', year) + getVal('incomeTaxPayable', year) + getVal('vatPayable', year) + getVal('zakatPayable', year) + getVal('otherCurrentLiabilitiesData', year);

      const totalCurrentLiab = tradePayables + accruedLiab + stDebt + otherCurrLiab;
      setVal('currentLiabilitiesHeader', year, totalCurrentLiab, { label: 'Current Liabilities', section: 'Current Liabilities', is_header: true });
      
      // --- Non-Current Liabilities ---
      const ltDebt = getVal('ltDebtData', year) + getVal('leaseLiabilities', year) + getVal('otherLongTermBorrowings', year);
      const otherLTLiab = getVal('deferredTaxLiabilities', year) + getVal('employeeEndOfServiceBenefits', year) + getVal('assetRetirementObligations', year) + getVal('otherLTLiabilitiesData', year);

      const totalNonCurrentLiab = ltDebt + otherLTLiab;
      setVal('nonCurrentLiabilitiesHeader', year, totalNonCurrentLiab, { label: 'Non-Current Liabilities', section: 'Non-Current Liabilities', is_header: true });
      
      // --- Totals ---
      const totalLiab = totalCurrentLiab + totalNonCurrentLiab;
      setVal('liabilitiesHeader', year, totalLiab, { label: 'Liabilities', section: 'Total Liabilities & Equity', is_header: true });
      
      const equity = getVal('shareCapital', year) + getVal('preferredStock', year) + getVal('additionalPaidInCapital', year) - getVal('treasuryStock', year) + getVal('retainedEarnings', year) + getVal('statutoryReserve', year) + getVal('accumulatedOCI', year) + getVal('otherReserves', year) + getVal('nonControllingInterest', year);
      setVal('equityHeader', year, equity, { label: 'Equity', section: 'Total Liabilities & Equity', is_header: true });
      
      const totalLiabAndEq = totalLiab + equity;
      setVal('totalLiabilitiesAndEquity', year, totalLiabAndEq, { label: 'Total Liabilities and Equity', section: 'Total Liabilities & Equity', is_subtotal: true, level: 0 });

      // --- Balance Check ---
      setVal('balanceCheck', year, totalAssets - totalLiabAndEq, { label: 'Balance Check (should be 0)', section: 'Check', level: 0 });
    }
    
    if (statementType === 'cash_flow_statement') {
      // --- Non-Cash Adjustments ---
      const totalNonCash = getVal('depreciationCostOfSales', year) + getVal('depreciationOpex', year) + getVal('amortizationOpex', year) + getVal('badDebtExpense', year) + getVal('unrealizedGainLossInvestments', year) + getVal('foreignExchangeGainLoss', year) + getVal('gainLossSaleAssets', year) + getVal('gainLossInvestments', year) + getVal('shareBasedCompensation', year) + getVal('deferredTax', year) + getVal('provisionMovements', year) + getVal('otherNonCashAdjustments', year);
      setVal('nonCashAdjustmentsHeader', year, totalNonCash, { label: 'Non-Cash Adjustments', section: 'Operating Activities', is_header: true });

      // --- Working Capital Changes ---
      const receivablesChange = getVal('changeTradeAccountsReceivable', year) + getVal('changeContractAssetsUnbilledRevenue', year) + getVal('changeRelatedPartyReceivables', year) + getVal('changeOtherReceivables', year);
      const inventoryChange = getVal('changeRawMaterials', year) + getVal('changeWorkInProcess', year) + getVal('changeFinishedGoods', year) + getVal('changeOtherInventory', year);
      const otherCAChange = getVal('changeOtherCurrentAssets', year);
      const payablesChange = getVal('changeAccountsPayable', year) + getVal('changeOtherPayables', year) + getVal('changeRelatedPartyPayables', year);
      const otherLiabChange = getVal('changeAccruedExpenses', year) + getVal('changeCustomerAdvances', year) + getVal('changeDeferredRevenueContractLiab', year) + getVal('changeIncomeTaxPayable', year) + getVal('changeInterestPayable', year) + getVal('changeEndOfServiceBenefits', year) + getVal('changeOtherCurrentLiabilities', year) + getVal('changeOtherOperatingLiabilities', year);

      const totalWCChange = receivablesChange + inventoryChange + otherCAChange + payablesChange + otherLiabChange;
      setVal('workingCapitalHeader', year, totalWCChange, { label: 'Working Capital Changes', section: 'Operating Activities', is_header: true });

      // --- Operating Cash Flow ---
      const opCash = getVal('cfNetIncomeData', year) + totalNonCash + totalWCChange + getVal('interestPaid', year) + getVal('interestReceived', year) + getVal('incomeTaxesPaid', year) + getVal('dividendsReceived', year) + getVal('otherOperatingCashFlow', year);
      setVal('operatingActivitiesHeader', year, opCash, { label: 'Operating Activities', section: 'Operating Activities', is_header: true });
      
      // --- Investing Cash Flow ---
      const invCash = -getVal('capitalExpenditures', year) + getVal('proceedsSalePPE', year) - getVal('purchaseInvestments', year) + getVal('saleInvestments', year) - getVal('investmentInAssociates', year) - getVal('purchaseIntangibleAssets', year) + getVal('businessAcquisitionsDisposals', year) + getVal('otherInvestingCashFlow', year);
      setVal('investingActivitiesHeader', year, invCash, { label: 'Investing Activities', section: 'Investing Activities', is_header: true });
      
      // --- Financing Cash Flow ---
      const finCash = getVal('cfShortTermBorrowings', year) + getVal('cfLongTermBorrowings', year) - getVal('leaseLiabilityPayments', year) + getVal('issuanceShareCapital', year) - getVal('shareRepurchases', year) + getVal('cfAdditionalPaidInCapital', year) - getVal('cfDividendsPaid', year) + getVal('relatedPartyBorrowings', year) + getVal('minorityInterestTransactions', year) + getVal('otherFinancingCashFlow', year);
      setVal('financingActivitiesHeader', year, finCash, { label: 'Financing Activities', section: 'Financing Activities', is_header: true });
      
      // --- Reconciliation ---
      const netChange = opCash + invCash + finCash + getVal('cfEffectOfExchangeRates', year);
      setVal('netIncreaseDecreaseCash', year, netChange, { label: 'Net Increase/(Decrease) in Cash', section: 'Reconciliation', is_subtotal: true });
      setVal('cfEndingCashBalance', year, getVal('cfBeginningCashBalance', year) + netChange, { label: 'Ending Cash Balance', section: 'Reconciliation', is_subtotal: true });
    }
  });

  return workingRows;
}

export function deriveCashFlow(isRows, bsRows, cfsRows, years) {
  if (!isRows || !bsRows || !cfsRows || !years || years.length === 0) return cfsRows;

  // Create deep copies to avoid mutation issues
  const workingCfsRows = cfsRows.map(r => ({...r, values: {...r.values}}));
  
  const isMap = {}; isRows.forEach(r => isMap[r.key] = r);
  const bsMap = {}; bsRows.forEach(r => bsMap[r.key] = r);
  const cfsMap = {}; workingCfsRows.forEach(r => cfsMap[r.key] = r);

  const getIs = (key, year) => (isMap[key] && isMap[key].values[year] != null) ? Number(isMap[key].values[year]) : 0;
  const getBs = (key, year) => (bsMap[key] && bsMap[key].values[year] != null) ? Number(bsMap[key].values[year]) : 0;
  
  const setCfs = (key, year, val) => {
    // Auto-create row if missing
    if (!cfsMap[key]) {
      const newRow = {
        row_id: `derived_${key}`,
        label: key,
        key,
        section: 'Derived',
        level: 2,
        is_subtotal: false,
        is_header: false,
        is_calculated: true,
        values: {},
        order: workingCfsRows.length,
      };
      workingCfsRows.push(newRow);
      cfsMap[key] = newRow;
      console.warn(`🔄 deriveCashFlow: Auto-created missing row: ${key}`);
    }
    cfsMap[key].values[year] = val;
  };

  const sortedYears = [...years].sort();
  
  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const prevYear = i > 0 ? sortedYears[i - 1] : null;

    console.log(`📊 Deriving Cash Flow for ${year}, prevYear: ${prevYear}`);

    // --- Operating ---
    const netIncome = getIs('netIncome', year);
    setCfs('cfNetIncomeData', year, netIncome);

    const depCostSales = getIs('depreciationCostOfSales', year);
    const depOpex = getIs('depreciationOpex', year);
    const amortOpex = getIs('amortizationOpex', year);
    
    setCfs('depreciationCostOfSales', year, depCostSales);
    setCfs('depreciationOpex', year, depOpex);
    setCfs('amortizationOpex', year, amortOpex);
    setCfs('totalNonCashAdjustments', year, Math.abs(depCostSales + depOpex + amortOpex));

    // Working Capital and Investing/Financing Cash Flows require a previous year
    if (prevYear) {
      // Receivables
      const currNetRec = getBs('netReceivables', year) || (getBs('tradeAccountsReceivable', year) + getBs('notesReceivable', year) + getBs('otherReceivables', year) - getBs('allowanceForDoubtfulAccounts', year));
      const prevNetRec = getBs('netReceivables', prevYear) || (getBs('tradeAccountsReceivable', prevYear) + getBs('notesReceivable', prevYear) + getBs('otherReceivables', prevYear) - getBs('allowanceForDoubtfulAccounts', prevYear));
      const recChange = prevNetRec - currNetRec;
      setCfs('changeTradeAccountsReceivable', year, recChange);
      console.log(`  Receivables: prev=${prevNetRec}, curr=${currNetRec}, change=${recChange}`);

      // Inventory
      const currInv = getBs('totalInventory', year) || (getBs('rawMaterials', year) + getBs('workInProcess', year) + getBs('finishedGoods', year) + getBs('otherInventory', year));
      const prevInv = getBs('totalInventory', prevYear) || (getBs('rawMaterials', prevYear) + getBs('workInProcess', prevYear) + getBs('finishedGoods', prevYear) + getBs('otherInventory', prevYear));
      const invChange = prevInv - currInv;
      setCfs('changeRawMaterials', year, invChange);
      console.log(`  Inventory: prev=${prevInv}, curr=${currInv}, change=${invChange}`);

      // Payables
      const currAP = getBs('accountsPayable', year) + getBs('notesPayable', year) + getBs('otherPayables', year);
      const prevAP = getBs('accountsPayable', prevYear) + getBs('notesPayable', prevYear) + getBs('otherPayables', prevYear);
      const apChange = currAP - prevAP;
      setCfs('changeAccountsPayable', year, apChange);
      console.log(`  Payables: prev=${prevAP}, curr=${currAP}, change=${apChange}`);
      
      // Accrued & Deferred Revenue
      const currAccrued = getBs('accruedExpenses', year) + getBs('accruedPayroll', year) + getBs('accruedInterest', year) + getBs('customerAdvances', year) + getBs('deferredRevenue', year) + getBs('contractLiabilities', year);
      const prevAccrued = getBs('accruedExpenses', prevYear) + getBs('accruedPayroll', prevYear) + getBs('accruedInterest', prevYear) + getBs('customerAdvances', prevYear) + getBs('deferredRevenue', prevYear) + getBs('contractLiabilities', prevYear);
      const accruedChange = currAccrued - prevAccrued;
      setCfs('changeAccruedExpenses', year, accruedChange);
      console.log(`  Accrued: prev=${prevAccrued}, curr=${currAccrued}, change=${accruedChange}`);


      // EOSB
      const currEosb = getBs('employeeEndOfServiceBenefits', year);
      const prevEosb = getBs('employeeEndOfServiceBenefits', prevYear);
      const eosbChange = currEosb - prevEosb;
      setCfs('changeEndOfServiceBenefits', year, eosbChange);
      console.log(`  EOSB: prev=${prevEosb}, curr=${currEosb}, change=${eosbChange}`);

      // Total Working Capital
      const totalWC = recChange + invChange + apChange + accruedChange + eosbChange;
      setCfs('totalWorkingCapitalAdjustments', year, totalWC);
      console.log(`  Total WC Change: ${totalWC}`);

      // --- Investing ---
      const currPpe = getBs('grossPPE', year);
      const prevPpe = getBs('grossPPE', prevYear);
      const capEx = -(currPpe - prevPpe);
      setCfs('capitalExpenditures', year, capEx);
      console.log(`  CapEx: prevPPE=${prevPpe}, currPPE=${currPpe}, capEx=${capEx}`);

      // --- Financing ---
      const currStDebt = getBs('stBorrowingsData', year) + getBs('currentPortionLTDebt', year);
      const prevStDebt = getBs('stBorrowingsData', prevYear) + getBs('currentPortionLTDebt', prevYear);
      setCfs('cfShortTermBorrowings', year, currStDebt - prevStDebt);

      const currLtDebt = getBs('ltDebtData', year);
      const prevLtDebt = getBs('ltDebtData', prevYear);
      setCfs('cfLongTermBorrowings', year, currLtDebt - prevLtDebt);
      
      const deltaRE = getBs('retainedEarnings', year) - getBs('retainedEarnings', prevYear);
      const expectedDividends = netIncome - deltaRE;
      if (expectedDividends > 0) {
        setCfs('cfDividendsPaid', year, expectedDividends);
        console.log(`  Dividends: netIncome=${netIncome}, deltaRE=${deltaRE}, dividends=${expectedDividends}`);
      }
      
      const currEq = getBs('shareCapital', year) + getBs('additionalPaidInCapital', year) - getBs('treasuryStock', year);
      const prevEq = getBs('shareCapital', prevYear) + getBs('additionalPaidInCapital', prevYear) - getBs('treasuryStock', prevYear);
      setCfs('issuanceShareCapital', year, currEq - prevEq);
    } else {
      // For the first year, set WC and CapEx to 0
      console.log(`  First year - setting derived values to 0`);
      setCfs('changeTradeAccountsReceivable', year, 0);
      setCfs('changeRawMaterials', year, 0);
      setCfs('changeAccountsPayable', year, 0);
      setCfs('changeAccruedExpenses', year, 0);
      setCfs('totalWorkingCapitalAdjustments', year, 0);
      setCfs('capitalExpenditures', year, 0);
      setCfs('cfShortTermBorrowings', year, 0);
      setCfs('cfLongTermBorrowings', year, 0);
      setCfs('cfDividendsPaid', year, 0);
      setCfs('issuanceShareCapital', year, 0);
    }
  }

  // Now recalculate totals for cash flow
  return recalculateTotals('cash_flow_statement', workingCfsRows);
}
