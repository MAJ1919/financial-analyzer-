-- ============================================================
-- Supabase Migration: Initial Schema
-- Financial Analyzer Platform — v1.0
-- Run via: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- projects table
-- Core table — stores everything for a single company analysis.
-- Financial data is stored as flexible JSONB to accommodate
-- varying numbers of years and line items across clients.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name        TEXT NOT NULL,
    fiscal_year_end     TEXT,                    -- e.g. "December", "March"
    currency            TEXT DEFAULT 'SAR',

    -- Financial Statements (JSONB — FinancialStatement schema)
    income_statement    JSONB,                   -- IS rows + years
    balance_sheet       JSONB,                   -- BS rows + years

    -- Derived / Computed (stored to avoid recomputation on every load)
    -- Cash Flow Statement is always derived on-demand by the backend;
    -- it is NOT stored here.

    -- Forecasting (5-year projection)
    forecast_data       JSONB,                   -- growth_rates + projected rows

    -- Valuation
    dcf_assumptions     JSONB,                   -- wacc, terminal_growth_rate, net_debt

    -- Metadata
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── Auto-update updated_at on every row change ──────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ───────────────────────────────────────
-- In v1 there is no auth; using service role key bypasses RLS.
-- Uncomment and configure these when adding user auth in a future version.

-- ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role full access" ON public.projects
--     USING (true) WITH CHECK (true);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_company_name ON public.projects (company_name);
CREATE INDEX IF NOT EXISTS idx_projects_created_at   ON public.projects (created_at DESC);

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.projects IS
    'One row per company analysis project. Financial data stored as JSONB.';
COMMENT ON COLUMN public.projects.income_statement IS
    'FinancialStatement JSON: { years: string[], rows: FinancialRow[] }';
COMMENT ON COLUMN public.projects.balance_sheet IS
    'FinancialStatement JSON: { years: string[], rows: FinancialRow[] }';
COMMENT ON COLUMN public.projects.dcf_assumptions IS
    'DCF inputs: { wacc: float, terminal_growth_rate: float, net_debt: float }';
