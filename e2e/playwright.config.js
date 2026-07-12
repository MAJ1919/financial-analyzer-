const { defineConfig, devices } = require('@playwright/test');

/**
 * E2E smoke suite.
 *
 * PREREQUISITES — both dev servers must already be running:
 *   backend:  cd backend  && uvicorn app.main:app --port 8000
 *   frontend: cd frontend && npm run dev            (port 5173)
 *
 * The suite creates a uniquely-named project, drives the real flow
 * (init → data entry → forecast → valuation), and deletes it afterwards.
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
