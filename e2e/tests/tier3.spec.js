const { test, expect } = require('@playwright/test');

test.describe('Tier 3: Cross-Feature Combinations E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('http://localhost:3000');
  });

  test('Forecasting + Valuation: Adjust revenue forecast updates DCF valuation', async ({ page }) => {
    await page.click('text=Forecasting');
    await page.fill('input[name="revenue-growth"]', '15');
    await page.click('button:has-text("Update Forecast")');
    await page.click('text=Valuation');
    const dcfValue = await page.locator('.dcf-intrinsic-value').innerText();
    expect(Number(dcfValue.replace(/[^0-9.-]+/g,""))).toBeGreaterThan(0);
  });

  test('Historical Data + Ratios: Load 5-year data and view ROE trends', async ({ page }) => {
    await page.click('text=Historical Data');
    await page.selectOption('select[name="timeframe"]', '5Y');
    await page.click('text=Financial Ratios');
    await expect(page.locator('.roe-chart')).toBeVisible();
    const roeValues = await page.locator('.roe-value-row').count();
    expect(roeValues).toBe(5);
  });

  test('Screener + Peer Comparison: Screen Tech stocks and compare', async ({ page }) => {
    await page.click('text=Screener');
    await page.selectOption('select[name="sector"]', 'Technology');
    await page.fill('input[name="max-pe"]', '20');
    await page.click('button:has-text("Run Screen")');
    await page.click('button:has-text("Add All to Compare")');
    await page.click('text=Peer Comparison');
    const comparedStocks = await page.locator('.comparison-table tbody tr').count();
    expect(comparedStocks).toBeGreaterThan(0);
  });

  test('Portfolio + Alerts: Add stock to portfolio and set price alert', async ({ page }) => {
    await page.click('text=Portfolio');
    await page.fill('input[name="ticker"]', 'AAPL');
    await page.click('button:has-text("Add Position")');
    await page.click('text=Alerts');
    await page.click('button:has-text("New Alert")');
    await page.selectOption('select[name="alert-ticker"]', 'AAPL');
    await page.fill('input[name="target-price"]', '150');
    await page.click('button:has-text("Save Alert")');
    await expect(page.locator('.alert-list')).toContainText('AAPL below 150');
  });

  test('Scenario Analysis + Export: Create Bear Case and export to PDF', async ({ page }) => {
    await page.click('text=Scenario Analysis');
    await page.click('button:has-text("New Scenario")');
    await page.fill('input[name="scenario-name"]', 'Bear Case');
    await page.fill('input[name="market-growth"]', '-5');
    await page.click('button:has-text("Run Scenario")');
    await page.click('button:has-text("Export Report")');
    await page.click('text=Download PDF');
    // Assert UI triggers export message
    await expect(page.locator('.export-success-message')).toBeVisible();
  });

  test('Valuation + Peer Comparison: DCF valuation vs peer median', async ({ page }) => {
    await page.click('text=Valuation');
    await page.fill('input[name="ticker-search"]', 'MSFT');
    await page.click('button:has-text("Calculate")');
    await page.click('text=Peer Comparison');
    await expect(page.locator('.peer-median-valuation')).toBeVisible();
    await expect(page.locator('.company-valuation-vs-peers')).toBeVisible();
  });

  test('Forecasting + Scenario Analysis: High Growth scenario increases revenue projections', async ({ page }) => {
    await page.click('text=Forecasting');
    const baselineRev = await page.locator('.proj-revenue-yr3').innerText();
    await page.click('text=Scenario Analysis');
    await page.selectOption('select[name="active-scenario"]', 'High Growth');
    await page.click('text=Forecasting');
    const highGrowthRev = await page.locator('.proj-revenue-yr3').innerText();
    expect(Number(highGrowthRev.replace(/[^0-9.-]+/g,""))).toBeGreaterThan(Number(baselineRev.replace(/[^0-9.-]+/g,"")));
  });

  test('Historical Data + Export: View 10-year income statement and export CSV', async ({ page }) => {
    await page.click('text=Historical Data');
    await page.selectOption('select[name="timeframe"]', '10Y');
    await page.click('text=Income Statement');
    const rows = await page.locator('.financial-statement-table tr').count();
    expect(rows).toBeGreaterThan(10);
    await page.click('button:has-text("Export CSV")');
    await expect(page.locator('.toast-message')).toContainText('Export successful');
  });

  test('Screener + Portfolio: Screen high yield and bulk add to portfolio', async ({ page }) => {
    await page.click('text=Screener');
    await page.fill('input[name="min-div-yield"]', '4');
    await page.click('button:has-text("Run Screen")');
    await page.click('input[name="select-all-results"]');
    await page.click('button:has-text("Add to Portfolio")');
    await page.selectOption('select[name="target-portfolio"]', 'Dividend Seekers');
    await page.click('button:has-text("Confirm Add")');
    await page.click('text=Portfolio');
    await page.selectOption('select[name="active-portfolio"]', 'Dividend Seekers');
    const holdings = await page.locator('.portfolio-holdings-table tbody tr').count();
    expect(holdings).toBeGreaterThan(0);
  });

  test('Ratios + Alerts: Set alert for Debt-to-Equity > 2.0', async ({ page }) => {
    await page.click('text=Financial Ratios');
    await page.fill('input[name="ticker-search"]', 'TSLA');
    await page.click('text=Alerts');
    await page.click('button:has-text("New Ratio Alert")');
    await page.selectOption('select[name="ratio-metric"]', 'Debt/Equity');
    await page.selectOption('select[name="alert-condition"]', 'Greater Than');
    await page.fill('input[name="ratio-threshold"]', '2.0');
    await page.click('button:has-text("Save Alert")');
    await expect(page.locator('.alert-list')).toContainText('Debt/Equity > 2.0');
  });

  test('Portfolio + Ratios: View aggregate P/E and P/B of portfolio', async ({ page }) => {
    await page.click('text=Portfolio');
    await page.click('text=Portfolio Analytics');
    await page.click('text=Aggregate Ratios');
    await expect(page.locator('.portfolio-pe-ratio')).toBeVisible();
    await expect(page.locator('.portfolio-pb-ratio')).toBeVisible();
    const aggPE = await page.locator('.portfolio-pe-ratio').innerText();
    expect(Number(aggPE)).toBeGreaterThan(0);
  });

  test('Forecasting + Export: Generate 3-year forecast and export to Excel', async ({ page }) => {
    await page.click('text=Forecasting');
    await page.selectOption('select[name="forecast-period"]', '3 Years');
    await page.click('button:has-text("Generate Forecast")');
    await expect(page.locator('.forecast-table')).toBeVisible();
    await page.click('button:has-text("Export Excel")');
    await expect(page.locator('.export-success-message')).toHaveText('Excel exported successfully');
  });

  test('Peer Comparison + Historical Data: Compare historical revenue growth rates', async ({ page }) => {
    await page.click('text=Peer Comparison');
    await page.fill('input[name="add-peer"]', 'AMD');
    await page.click('button:has-text("Add")');
    await page.fill('input[name="add-peer"]', 'INTC');
    await page.click('button:has-text("Add")');
    await page.click('text=Historical Metrics');
    await page.selectOption('select[name="metric"]', 'Revenue Growth');
    await expect(page.locator('.peer-comparison-chart')).toBeVisible();
    const chartLines = await page.locator('.recharts-line').count();
    expect(chartLines).toBeGreaterThanOrEqual(2);
  });

  test('Scenario Analysis + Valuation: Recession scenario drops intrinsic value', async ({ page }) => {
    await page.click('text=Valuation');
    await page.fill('input[name="ticker-search"]', 'JPM');
    await page.click('button:has-text("Calculate")');
    const baseValue = await page.locator('.dcf-intrinsic-value').innerText();
    
    await page.click('text=Scenario Analysis');
    await page.selectOption('select[name="active-scenario"]', 'Recession');
    
    await page.click('text=Valuation');
    const recessionValue = await page.locator('.dcf-intrinsic-value').innerText();
    
    expect(Number(recessionValue.replace(/[^0-9.-]+/g,""))).toBeLessThan(Number(baseValue.replace(/[^0-9.-]+/g,"")));
  });

  test('Alerts + Screener: Save custom screener and set weekly alert', async ({ page }) => {
    await page.click('text=Screener');
    await page.fill('input[name="min-roe"]', '15');
    await page.fill('input[name="max-debt-equity"]', '0.5');
    await page.click('button:has-text("Save Screener")');
    await page.fill('input[name="screener-name"]', 'Quality Value');
    await page.click('button:has-text("Confirm Save")');
    
    await page.click('text=Alerts');
    await page.click('button:has-text("New Screener Alert")');
    await page.selectOption('select[name="saved-screener"]', 'Quality Value');
    await page.selectOption('select[name="alert-frequency"]', 'Weekly');
    await page.click('button:has-text("Save Alert")');
    
    await expect(page.locator('.alert-list')).toContainText('Weekly alert for Quality Value');
  });

});
