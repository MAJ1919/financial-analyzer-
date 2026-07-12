const { test, expect } = require('@playwright/test');

test.describe('Tier 2: Boundary & Corner Cases', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000'); // Assuming standard local dev server
  });

  test.describe('Financial Statements', () => {
    test('handles empty input in statement generation', async ({ page }) => {
      await page.click('text=Financial Statements');
      await page.fill('[data-testid="revenue-input"]', '');
      await page.fill('[data-testid="expenses-input"]', '');
      await page.click('button:has-text("Generate")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Fields cannot be empty');
    });

    test('handles extremely large revenue numbers without overflow', async ({ page }) => {
      await page.click('text=Financial Statements');
      await page.fill('[data-testid="revenue-input"]', '999999999999999999999');
      await page.click('button:has-text("Generate")');
      await expect(page.locator('[data-testid="revenue-display"]')).toHaveText(/999,999,999,999,999,999,999/);
    });

    test('handles 0 for all financial statement fields', async ({ page }) => {
      await page.click('text=Financial Statements');
      await page.fill('[data-testid="revenue-input"]', '0');
      await page.fill('[data-testid="expenses-input"]', '0');
      await page.click('button:has-text("Generate")');
      await expect(page.locator('[data-testid="net-income-display"]')).toHaveText('0');
    });

    test('handles negative values in expenses and revenue', async ({ page }) => {
      await page.click('text=Financial Statements');
      await page.fill('[data-testid="revenue-input"]', '-50000');
      await page.fill('[data-testid="expenses-input"]', '-10000');
      await page.click('button:has-text("Generate")');
      await expect(page.locator('[data-testid="net-income-display"]')).toHaveText('-40000');
    });

    test('handles invalid non-numeric characters in numeric fields', async ({ page }) => {
      await page.click('text=Financial Statements');
      await page.fill('[data-testid="revenue-input"]', 'abc!@#');
      await page.click('button:has-text("Generate")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid number format');
    });
  });

  test.describe('Analysis Ratios', () => {
    test('handles division by zero for PE ratio (EPS is 0)', async ({ page }) => {
      await page.click('text=Analysis Ratios');
      await page.fill('[data-testid="price-input"]', '100');
      await page.fill('[data-testid="eps-input"]', '0');
      await page.click('button:has-text("Calculate Ratios")');
      await expect(page.locator('[data-testid="pe-ratio-display"]')).toHaveText('N/A');
    });

    test('handles negative earnings for EPS calculation', async ({ page }) => {
      await page.click('text=Analysis Ratios');
      await page.fill('[data-testid="net-income-input"]', '-50000');
      await page.fill('[data-testid="shares-input"]', '10000');
      await page.click('button:has-text("Calculate Ratios")');
      await expect(page.locator('[data-testid="eps-display"]')).toHaveText('-5');
    });

    test('handles extremely large shares outstanding', async ({ page }) => {
      await page.click('text=Analysis Ratios');
      await page.fill('[data-testid="net-income-input"]', '1000000');
      await page.fill('[data-testid="shares-input"]', '999999999999999');
      await page.click('button:has-text("Calculate Ratios")');
      await expect(page.locator('[data-testid="eps-display"]')).toHaveText('0.00'); // Close to 0
    });

    test('handles 0 assets and liabilities for debt ratio', async ({ page }) => {
      await page.click('text=Analysis Ratios');
      await page.fill('[data-testid="total-debt-input"]', '0');
      await page.fill('[data-testid="total-assets-input"]', '0');
      await page.click('button:has-text("Calculate Ratios")');
      await expect(page.locator('[data-testid="debt-ratio-display"]')).toHaveText('N/A');
    });

    test('handles empty inputs for ratio calculations', async ({ page }) => {
      await page.click('text=Analysis Ratios');
      await page.fill('[data-testid="price-input"]', '');
      await page.fill('[data-testid="eps-input"]', '');
      await page.click('button:has-text("Calculate Ratios")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Missing inputs for ratio calculation');
    });
  });

  test.describe('Valuation', () => {
    test('handles 0 discount rate in DCF model', async ({ page }) => {
      await page.click('text=Valuation');
      await page.fill('[data-testid="cash-flows-input"]', '1000, 2000, 3000');
      await page.fill('[data-testid="discount-rate-input"]', '0');
      await page.click('button:has-text("Calculate DCF")');
      await expect(page.locator('[data-testid="dcf-result"]')).toHaveText('6000'); // Sum of CFs
    });

    test('handles negative growth rate for terminal value', async ({ page }) => {
      await page.click('text=Valuation');
      await page.fill('[data-testid="terminal-growth-input"]', '-0.05');
      await page.fill('[data-testid="discount-rate-input"]', '0.10');
      await page.click('button:has-text("Calculate Terminal Value")');
      await expect(page.locator('[data-testid="terminal-value-result"]')).toBeVisible();
    });

    test('handles discount rate equal to growth rate (division by zero in perpetuity)', async ({ page }) => {
      await page.click('text=Valuation');
      await page.fill('[data-testid="terminal-growth-input"]', '0.05');
      await page.fill('[data-testid="discount-rate-input"]', '0.05');
      await page.click('button:has-text("Calculate Terminal Value")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Discount rate cannot equal growth rate');
    });

    test('handles extremely large projected cash flows', async ({ page }) => {
      await page.click('text=Valuation');
      await page.fill('[data-testid="cash-flows-input"]', '999999999999, 999999999999');
      await page.fill('[data-testid="discount-rate-input"]', '0.10');
      await page.click('button:has-text("Calculate DCF")');
      await expect(page.locator('[data-testid="dcf-result"]')).toContainText('e+');
    });

    test('handles empty cash flows array', async ({ page }) => {
      await page.click('text=Valuation');
      await page.fill('[data-testid="cash-flows-input"]', '');
      await page.click('button:has-text("Calculate DCF")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Please provide cash flows');
    });
  });

  test.describe('Forecasting', () => {
    test('handles 0 periods for forecasting', async ({ page }) => {
      await page.click('text=Forecasting');
      await page.fill('[data-testid="periods-input"]', '0');
      await page.click('button:has-text("Run Forecast")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Periods must be greater than 0');
    });

    test('handles negative forecasting periods', async ({ page }) => {
      await page.click('text=Forecasting');
      await page.fill('[data-testid="periods-input"]', '-5');
      await page.click('button:has-text("Run Forecast")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid number of periods');
    });

    test('handles extremely high growth rate projections', async ({ page }) => {
      await page.click('text=Forecasting');
      await page.fill('[data-testid="growth-rate-input"]', '1000'); // 100,000%
      await page.fill('[data-testid="periods-input"]', '5');
      await page.click('button:has-text("Run Forecast")');
      await expect(page.locator('[data-testid="forecast-result"]')).toBeVisible();
    });

    test('handles negative historical data trend', async ({ page }) => {
      await page.click('text=Forecasting');
      await page.fill('[data-testid="historical-data-input"]', '-10, -20, -30');
      await page.fill('[data-testid="periods-input"]', '3');
      await page.click('button:has-text("Run Forecast")');
      await expect(page.locator('[data-testid="forecast-chart"]')).toBeVisible();
    });

    test('handles empty historical data for auto-forecasting', async ({ page }) => {
      await page.click('text=Forecasting');
      await page.fill('[data-testid="historical-data-input"]', '');
      await page.click('button:has-text("Run Forecast")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Insufficient data for forecast');
    });
  });

  test.describe('Number Formatting', () => {
    test('handles formatting of 0', async ({ page }) => {
      await page.click('text=Number Formatting');
      await page.fill('[data-testid="test-number-input"]', '0');
      await page.click('button:has-text("Format")');
      await expect(page.locator('[data-testid="formatted-number-display"]')).toHaveText('$0.00');
    });

    test('handles formatting of extremely large numbers', async ({ page }) => {
      await page.click('text=Number Formatting');
      await page.fill('[data-testid="test-number-input"]', '1234567890123456');
      await page.click('button:has-text("Format")');
      await expect(page.locator('[data-testid="formatted-number-display"]')).toHaveText('$1,234,567,890,123,456.00');
    });

    test('handles formatting of negative fractions', async ({ page }) => {
      await page.click('text=Number Formatting');
      await page.fill('[data-testid="test-number-input"]', '-0.12345');
      await page.click('button:has-text("Format")');
      await expect(page.locator('[data-testid="formatted-number-display"]')).toHaveText('-$0.12');
    });

    test('handles formatting of numbers with many decimal places', async ({ page }) => {
      await page.click('text=Number Formatting');
      await page.fill('[data-testid="test-number-input"]', '100.999999999');
      await page.click('button:has-text("Format")');
      await expect(page.locator('[data-testid="formatted-number-display"]')).toHaveText('$101.00'); // Assuming rounding
    });

    test('handles empty string formatting fallback', async ({ page }) => {
      await page.click('text=Number Formatting');
      await page.fill('[data-testid="test-number-input"]', '');
      await page.click('button:has-text("Format")');
      await expect(page.locator('[data-testid="formatted-number-display"]')).toHaveText('-'); // Or whatever the fallback is
    });
  });

  test.describe('Historical Data Parsing', () => {
    test('handles empty CSV/JSON payload', async ({ page }) => {
      await page.click('text=Historical Data');
      await page.fill('[data-testid="data-input-textarea"]', '');
      await page.click('button:has-text("Parse Data")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('No data to parse');
    });

    test('handles missing columns in CSV payload', async ({ page }) => {
      await page.click('text=Historical Data');
      await page.fill('[data-testid="data-input-textarea"]', 'Date,Revenue\n2022-01-01,1000\n2022-02-01'); // Missing revenue for 2nd row
      await page.click('button:has-text("Parse Data")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Malformed data at row 2');
    });

    test('handles invalid date formats in historical data', async ({ page }) => {
      await page.click('text=Historical Data');
      await page.fill('[data-testid="data-input-textarea"]', 'Date,Revenue\ninvalid-date,1000');
      await page.click('button:has-text("Parse Data")');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid date format');
    });

    test('handles zero and negative values in historical data rows', async ({ page }) => {
      await page.click('text=Historical Data');
      await page.fill('[data-testid="data-input-textarea"]', 'Date,Revenue\n2022-01-01,-5000\n2022-02-01,0');
      await page.click('button:has-text("Parse Data")');
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Data parsed successfully');
      await expect(page.locator('[data-testid="data-table-row"]')).toHaveCount(2);
    });

    test('handles extremely large payload size (mocked by large string)', async ({ page }) => {
      await page.click('text=Historical Data');
      const largeData = 'Date,Revenue\n' + '2022-01-01,1000\n'.repeat(10000);
      await page.fill('[data-testid="data-input-textarea"]', largeData);
      await page.click('button:has-text("Parse Data")');
      await expect(page.locator('[data-testid="success-message"]')).toContainText('Data parsed successfully');
    });
  });

});
