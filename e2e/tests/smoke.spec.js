/**
 * End-to-end smoke test against the REAL UI:
 *   landing → create project → initialize statements → enter a value →
 *   subtotal recalculates → run forecast → valuation renders → cleanup.
 *
 * Tests run in order inside one describe.serial block and share a
 * uniquely-named project so the suite is safe to run against a dev
 * database with existing data.
 */
const { test, expect } = require('@playwright/test');

const PROJECT_NAME = `E2E Smoke ${Date.now()}`;
const API_URL = 'http://localhost:8000/api';

test.describe.serial('platform smoke', () => {
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    // Cleanup via the API (deterministic — UI deletion proved flaky):
    // remove every project this run created, then verify none remain.
    try {
      const res = await page.request.get(`${API_URL}/projects/`);
      const mine = (await res.json()).filter((p) => p.company_name === PROJECT_NAME);
      for (const p of mine) {
        await page.request.delete(`${API_URL}/projects/${p.id}`);
      }
      const after = await (await page.request.get(`${API_URL}/projects/`)).json();
      if (after.some((p) => p.company_name === PROJECT_NAME)) {
        throw new Error(`cleanup failed: ${PROJECT_NAME} still present`);
      }
    } finally {
      await page.close();
    }
  });

  test('landing page lists companies', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New Project' })).toBeVisible();
  });

  test('create a project and land on statements', async () => {
    await page.getByRole('button', { name: '+ New Project' }).click();
    await page.getByPlaceholder(/Aramco/).fill(PROJECT_NAME);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/statements/);
    // Fresh project → initialization screen
    await expect(page.getByText('Initialize Financial Statements')).toBeVisible();
  });

  test('initialize statements from the template', async () => {
    await page.getByRole('button', { name: 'Create Template' }).click();
    // Manual entry grid appears with the canonical template rows
    await expect(page.getByText('Manual Data Entry')).toBeVisible();
    await expect(page.locator('.ag-pinned-left-cols-container .ag-row', { hasText: 'Product Revenue' }).first())
      .toBeVisible({ timeout: 15_000 });
  });

  test('entering a value recalculates the subtotal', async () => {
    // AG Grid splits pinned label cells and value cells into separate row
    // containers linked by row-index.
    const labelRow = page
      .locator('.ag-pinned-left-cols-container .ag-row', { hasText: 'Product Revenue' })
      .first();
    const rowIndex = await labelRow.getAttribute('row-index');
    const valueCell = page
      .locator(`.ag-center-cols-container .ag-row[row-index="${rowIndex}"] .ag-cell`)
      .first();

    await valueCell.click(); // singleClickEdit
    await page.keyboard.type('1000');
    await page.keyboard.press('Enter');

    // The "Revenue" header row is computed from its children by
    // recalculateTotals — it must now show 1,000.
    const revenueRow = page
      .locator('.ag-pinned-left-cols-container .ag-row')
      .filter({ has: page.getByText('Revenue', { exact: true }) })
      .first();
    const revenueIndex = await revenueRow.getAttribute('row-index');
    await expect(
      page.locator(`.ag-center-cols-container .ag-row[row-index="${revenueIndex}"] .ag-cell`).first()
    ).toHaveText('1,000', { timeout: 10_000 });
  });

  test('forecast runs and renders projections', async () => {
    await page.getByRole('link', { name: 'Forecasting' }).click();
    await expect(page.getByRole('button', { name: /Run Forecast/ })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: /Run Forecast/ }).click();
    // Cumulative KPI cards appear once the backend responds
    await expect(page.getByText('Revenue CAGR')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
  });

  test('valuation page renders DCF components', async () => {
    await page.getByRole('link', { name: 'Valuation (DCF)' }).click();
    await expect(page.getByText('Enterprise Value', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Key Assumptions')).toBeVisible();
    await expect(page.getByText('Sensitivity Analysis')).toBeVisible();
  });
});
