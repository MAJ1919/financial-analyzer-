const { test, expect } = require('@playwright/test');

test.describe('Financial Statements', () => {
  test('should display income statement', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    await page.click('text=Income Statement');
    await expect(page.locator('h2')).toContainText('Income Statement');
  });

  test('should display balance sheet', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    await page.click('text=Balance Sheet');
    await expect(page.locator('h2')).toContainText('Balance Sheet');
  });

  test('should display cash flow statement', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    await page.click('text=Cash Flow');
    await expect(page.locator('h2')).toContainText('Cash Flow');
  });

  test('should allow selecting different periods', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    await page.selectOption('select#period', 'Annual');
    await expect(page.locator('.statement-grid')).toBeVisible();
  });

  test('should load financial statements for a valid ticker', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'AAPL');
    await page.click('button:has-text("Search")');
    await expect(page.locator('.financial-data-table')).toBeVisible();
  });
});

test.describe('Analysis Ratios', () => {
  test('should calculate profitability ratios', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Analysis Ratios');
    await expect(page.locator('text=Gross Margin')).toBeVisible();
  });

  test('should calculate liquidity ratios', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Analysis Ratios');
    await expect(page.locator('text=Current Ratio')).toBeVisible();
  });

  test('should display historical trends for ratios', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Analysis Ratios');
    await page.click('text=View Trend');
    await expect(page.locator('.trend-chart')).toBeVisible();
  });

  test('should allow comparing ratios against industry average', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Analysis Ratios');
    await page.check('input#compare-industry');
    await expect(page.locator('text=Industry Avg')).toBeVisible();
  });

  test('should highlight ratios outside normal bounds', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'TSLA');
    await page.click('button:has-text("Search")');
    await page.click('text=Analysis Ratios');
    await expect(page.locator('.warning-highlight')).toBeVisible();
  });
});

test.describe('Valuation', () => {
  test('should provide DCF valuation model', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Valuation');
    await expect(page.locator('text=Discounted Cash Flow')).toBeVisible();
  });

  test('should allow adjusting discount rate', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Valuation');
    await page.fill('input#discount-rate', '10');
    await page.click('button:has-text("Calculate")');
    await expect(page.locator('.implied-price')).toBeVisible();
  });

  test('should calculate multiples valuation', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Valuation');
    await page.click('text=Multiples');
    await expect(page.locator('text=P/E Ratio')).toBeVisible();
  });

  test('should save valuation models', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Valuation');
    await page.click('button:has-text("Save Model")');
    await expect(page.locator('.toast-success')).toContainText('Model saved');
  });

  test('should compare current price to implied value', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Valuation');
    await expect(page.locator('.upside-downside')).toBeVisible();
  });
});

test.describe('Forecasting', () => {
  test('should generate revenue forecast', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Forecasting');
    await expect(page.locator('text=Revenue Projection')).toBeVisible();
  });

  test('should allow adjusting growth rate assumptions', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Forecasting');
    await page.fill('input#revenue-growth', '15');
    await page.click('button:has-text("Update Forecast")');
    await expect(page.locator('.forecast-chart')).toBeVisible();
  });

  test('should forecast operating expenses', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Forecasting');
    await expect(page.locator('text=Operating Expenses Forecast')).toBeVisible();
  });

  test('should project free cash flow', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Forecasting');
    await expect(page.locator('text=Projected FCF')).toBeVisible();
  });

  test('should allow scenario analysis (base, bull, bear)', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Forecasting');
    await page.selectOption('select#scenario', 'Bull Case');
    await expect(page.locator('.scenario-indicator')).toContainText('Bull Case');
  });
});

test.describe('Number Formatting', () => {
  test('should format large numbers with k/m/b suffixes', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'AAPL');
    await page.click('button:has-text("Search")');
    await expect(page.locator('text=1k').first()).toBeVisible();
  });

  test('should format percentages correctly', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Analysis Ratios');
    await expect(page.locator('text=%').first()).toBeVisible();
  });

  test('should allow toggling decimal precision', async ({ page }) => {
    await page.goto('/settings');
    await page.selectOption('select#precision', '2');
    await page.goto('/');
    await expect(page.locator('.financial-value').first()).toHaveText(/\.\d{2}$/);
  });

  test('should display currency symbols appropriate to the security', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'LSE:RDSA');
    await page.click('button:has-text("Search")');
    await expect(page.locator('text=£').first()).toBeVisible();
  });

  test('should handle negative numbers with parentheses', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    await expect(page.locator('.negative-value').first()).toHaveText(/^\(.*\)$/);
  });
});

test.describe('Historical Data Parsing', () => {
  test('should parse 10 years of historical data', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'MSFT');
    await page.click('button:has-text("Search")');
    const cols = await page.locator('.data-table-header-cell').count();
    expect(cols).toBeGreaterThanOrEqual(10);
  });

  test('should handle missing data points gracefully', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'NEWCO');
    await page.click('button:has-text("Search")');
    await expect(page.locator('text=N/A').first()).toBeVisible();
  });

  test('should align data columns chronologically', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Financial Statements');
    const firstYear = await page.locator('.year-header').first().innerText();
    const lastYear = await page.locator('.year-header').last().innerText();
    expect(parseInt(lastYear)).toBeGreaterThan(parseInt(firstYear));
  });

  test('should parse SEC filings correctly', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Filings');
    await expect(page.locator('.filing-link').first()).toBeVisible();
  });

  test('should identify fiscal year ends correctly', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Ticker"]', 'AAPL');
    await page.click('button:has-text("Search")');
    await expect(page.locator('text=FYE: Sep').first()).toBeVisible();
  });
});
