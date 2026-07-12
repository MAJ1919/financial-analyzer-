-- ============================================================
-- Migration: add projects.cash_flow_statement
-- ============================================================
-- The initial migration (20260101_init.sql) deliberately omitted this
-- column ("CFS is derived on demand"), but the application has since
-- moved to deriving the CFS on the frontend and PERSISTING it: the
-- upload and manual-save endpoints write it, and the analysis routes
-- read it. Databases created from the initial migration alone fail at
-- runtime without this column.
--
-- Safe to run on existing databases: IF NOT EXISTS makes it a no-op
-- where the column was already added manually.
-- Run via: Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS cash_flow_statement JSONB;

COMMENT ON COLUMN public.projects.cash_flow_statement IS
    'FinancialStatement JSONB — derived on the frontend (calculations.js deriveCashFlow) from IS + BS, persisted on save';
