-- ============================================================
-- Supabase Migration: User ownership + Row Level Security
-- Financial Analyzer Platform — adds per-user project isolation
-- Run via: Supabase Dashboard > SQL Editor (after 20260712_*)
-- ============================================================
--
-- Introduces authenticated ownership of projects. Every project is
-- owned by exactly one auth.users row, and RLS makes Postgres itself
-- enforce that a user can only ever see/modify their own projects —
-- independent of any filtering the API layer does or forgets to do.
--
-- Prerequisite: Supabase Auth (email/password) must be enabled for
-- the project (Dashboard > Authentication).
-- ============================================================

-- ── Ownership column ─────────────────────────────────────────
-- Nullable by design: projects created before auth existed have no
-- owner. Under the RLS policies below they become invisible to every
-- user (they are NOT deleted). Reclaim them after creating your first
-- account with, e.g.:
--     UPDATE public.projects SET user_id = '<your-auth-uid>'
--     WHERE user_id IS NULL;
-- ON DELETE CASCADE: deleting a user removes their projects.
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects (user_id);

-- ── Row Level Security ───────────────────────────────────────
-- With RLS enabled, the anon/authenticated roles can only touch rows
-- allowed by an explicit policy. The service-role key still bypasses
-- RLS entirely (used only for non-user-scoped admin operations).
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Each policy scopes to the JWT's user id (auth.uid()). SELECT/UPDATE/
-- DELETE match on the existing owner; INSERT enforces that a row can
-- only be created owned by the caller (no spoofing another user_id).
DROP POLICY IF EXISTS "select_own_projects" ON public.projects;
CREATE POLICY "select_own_projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_projects" ON public.projects;
CREATE POLICY "insert_own_projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_projects" ON public.projects;
CREATE POLICY "update_own_projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_projects" ON public.projects;
CREATE POLICY "delete_own_projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON COLUMN public.projects.user_id IS
    'Owner (auth.users.id). RLS restricts all access to auth.uid() = user_id. '
    'Nullable only for pre-auth legacy rows, which are invisible until reassigned.';
