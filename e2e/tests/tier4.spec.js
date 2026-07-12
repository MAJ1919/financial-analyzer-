const { test, expect } = require('@playwright/test');

test.describe('Tier 4: Real-World Scenarios (End-to-End)', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL before each test
    await page.goto('/');
  });

  test('Scenario 1: Complete platform walkthrough (File Parse -> Ratios -> Forecast -> Valuation)', async ({ page }) => {
    // 1. Upload File & Parse
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'financial_data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Year,Revenue,COGS,OperatingExpenses\n2022,1000000,400000,200000\n2023,1200000,450000,220000')
    });
    await page.click('button:has-text("Upload and Parse")');
    await expect(page.locator('.upload-success-message')).toBeVisible();

    // 2. View and Verify Ratios
    await page.click('a:has-text("Ratios")');
    await expect(page.locator('h2:has-text("Financial Ratios")')).toBeVisible();
    const grossMargin = page.locator('[data-testid="ratio-gross-margin"]');
    await expect(grossMargin).toContainText('%');

    // 3. Generate Forecast
    await page.click('a:has-text("Forecast")');
    await page.fill('input[name="revenue-growth-rate"]', '10');
    await page.click('button:has-text("Generate Forecast")');
    await expect(page.locator('.forecast-table')).toBeVisible();

    // 4. Run Valuation
    await page.click('a:has-text("Valuation")');
    await page.fill('input[name="wacc"]', '8.5');
    await page.fill('input[name="terminal-growth-rate"]', '2.5');
    await page.click('button:has-text("Calculate Valuation")');
    await expect(page.locator('.valuation-summary')).toBeVisible();

    // 5. Verify Number Formatting (e.g., "1M", "500k")
    const enterpriseValue = page.locator('[data-testid="enterprise-value"]');
    await expect(enterpriseValue).toContainText(/[0-9]+(\.[0-9]+)?[kM]/); // Matches formats like 1M, 1.5M, 500k

    const sharePrice = page.locator('[data-testid="implied-share-price"]');
    await expect(sharePrice).toContainText(/\$[0-9]+\.[0-9]{2}/); // Matches currency format like $15.50
  });

  test('Scenario 2: Data correction and re-calculation flow', async ({ page }) => {
    // 1. Initial file upload with flawed data (missing values)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'flawed_data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Year,Revenue,COGS\n2023,,450000') // Missing revenue
    });
    await page.click('button:has-text("Upload and Parse")');
    
    // Expect warning or error state
    await expect(page.locator('.data-validation-warning')).toBeVisible();

    // 2. Upload corrected file
    await fileInput.setInputFiles({
      name: 'corrected_data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Year,Revenue,COGS\n2023,1200000,450000')
    });
    await page.click('button:has-text("Upload and Parse")');
    await expect(page.locator('.upload-success-message')).toBeVisible();

    // 3. Navigate to Dashboard and verify correct number formatting is applied
    await page.click('a:has-text("Dashboard")');
    const revenueMetric = page.locator('[data-testid="dashboard-revenue"]');
    await expect(revenueMetric).toContainText(/1\.2M/i);
  });

  test('Scenario 3: Interactive scenario analysis with dynamic valuation updates', async ({ page }) => {
    // Mock navigating directly to valuation with pre-loaded session state
    await page.goto('/valuation');
    
    // Set Base Case Assumptions
    await page.fill('input[name="wacc"]', '10');
    await page.click('button:has-text("Calculate Valuation")');
    const baseValuationText = await page.locator('[data-testid="enterprise-value"]').innerText();

    // Toggle to 'Optimistic Case' or update assumptions
    await page.fill('input[name="wacc"]', '8');
    await page.fill('input[name="terminal-growth-rate"]', '4');
    await page.click('button:has-text("Calculate Valuation")');
    const optimisticValuationText = await page.locator('[data-testid="enterprise-value"]').innerText();

    // Ensure valuation changed dynamically
    expect(baseValuationText).not.toEqual(optimisticValuationText);
    
    // Verify both are formatted correctly
    expect(optimisticValuationText).toMatch(/[0-9]+(\.[0-9]+)?[kM]/);
  });

  test('Scenario 4: Dashboard summary verification for abbreviation formatting', async ({ page }) => {
    // Assuming backend returns large numbers that should be abbreviated
    await page.goto('/dashboard');
    
    const metricCards = page.locator('.metric-card-value');
    
    // Wait for at least one metric card to be visible
    await expect(metricCards.first()).toBeVisible();

    // Retrieve all text contents from metric cards
    const texts = await metricCards.allTextContents();
    
    // Assert that at least one of the values is abbreviated using 'k', 'M', or 'B'
    const hasAbbreviation = texts.some(text => /[0-9]+(\.[0-9]+)?[kMB]/.test(text));
    expect(hasAbbreviation).toBeTruthy();
  });

  test('Scenario 5: Complete workflow terminating in report export', async ({ page }) => {
    // Setup state (simulate having completed the analysis)
    await page.goto('/reports');
    
    // Assert Report Generator UI is present
    await expect(page.locator('h2:has-text("Generate Report")')).toBeVisible();

    // Select sections to include in the report
    await page.check('input[name="include-ratios"]');
    await page.check('input[name="include-valuation"]');

    // Trigger download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export PDF")');
    const download = await downloadPromise;

    // Verify the downloaded file name and successful UI feedback
    expect(download.suggestedFilename()).toMatch(/financial_report.*\.pdf/i);
    await expect(page.locator('.export-success')).toBeVisible();
  });

});
