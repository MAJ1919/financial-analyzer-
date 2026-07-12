# Project: Financial Analyzer Platform

## Architecture
- `backend`: Python FastAPI
- `frontend`: React app

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Backend Cleanup | Refactor Python backend, clean dead code/deprecated logic, ensure pytest passes | none | IN_PROGRESS |
| 2 | Frontend Cleanup & Bug Fixes | Clean up React frontend (calculations.js, FinancialGrid, data-entry), fix Forecasting engine, standardize number formatting, ensure build works | M1 | PLANNED |

## Interface Contracts
### Backend ↔ Frontend
- Backend provides forecasting and financial analysis outputs. Frontend displays and formats them. Number formatting logic must be unified.

## Code Layout
- `backend/app/services/` (analysis_engine.py, forecasting_engine.py, excel_parser.py)
- `frontend/src/` (calculations.js, FinancialGrid, data-entry components, Forecasting.jsx)
