# E2E Test Infra: Financial Analyzer Platform

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Financial Statement Calculations | ORIGINAL_REQUEST §R3 | 5      | 5      | ✓      |
| 2 | Analysis Ratios | ORIGINAL_REQUEST §R3 | 5      | 5      | ✓      |
| 3 | Forecasting Engine | ORIGINAL_REQUEST §R2 | 5      | 5      | ✓      |
| 4 | Valuation Calculations | ORIGINAL_REQUEST §R3 | 5      | 5      | ✓      |
| 5 | Number Formatting | ORIGINAL_REQUEST §R2 | 5      | 5      | ✓      |
| 6 | Historical Data Parsing | ORIGINAL_REQUEST §R3 | 5      | 5      | ✓      |

## Test Architecture
- Test runner: `@playwright/test` (Node.js)
- Invocation: `cd e2e && npm run test`
- Pass/Fail semantics: All tests must pass with exit code 0. No UI regressions, correct number formatting, and accurate grid calculations.
- Directory layout:
  `e2e/`
    `package.json`
    `playwright.config.js`
    `tests/tier1_feature.spec.js`
    `tests/tier2_boundary.spec.js`
    `tests/tier3_pairwise.spec.js`
    `tests/tier4_workload.spec.js`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | End-to-end basic forecast and valuation | F1, F3, F4 | Low |
| 2 | High-growth company analysis with large numbers | F1, F3, F4, F5 | Medium |
| 3 | Complex historical data parsing + ratios | F2, F6 | Medium |
| 4 | Valuation with edge case inputs | F3, F4 | High |
| 5 | Complete platform walkthrough (Parse, Ratio, Forecast, Value, formatting) | F1, F2, F3, F4, F5, F6 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total: 30)
- Tier 2: ≥5 per feature (Total: 30)
- Tier 3: pairwise coverage of major feature interactions (Total: 15)
- Tier 4: ≥5 realistic application scenarios (Total: 5)
