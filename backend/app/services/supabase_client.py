"""
Supabase client factories.

Two flavours:
- ``get_supabase_client`` — a cached, process-wide **service-role** client that
  bypasses Row Level Security. Use it only for operations that are genuinely not
  user-scoped (e.g. admin/maintenance). It must never be used to serve a request
  on behalf of a specific user, or RLS is silently defeated.
- ``get_anon_client`` / ``build_user_client`` — **anon-key** clients that run
  under RLS. A per-request user client carries the caller's JWT so Postgres
  enforces ``auth.uid() = user_id`` on every query.
"""
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Returns a cached **service-role** Supabase client (bypasses RLS).
    Uses lru_cache so the client is created once per process lifetime.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """
    Returns a cached **anon-key** Supabase client, used for token verification
    (``auth.get_user``). It carries no user session by itself.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def build_user_client(access_token: str) -> Client:
    """
    Build a fresh anon-key client whose PostgREST requests are authenticated as
    the given user (via their JWT). Every query it makes runs under RLS as that
    user. A new instance is returned per call so tokens never leak across
    requests — do not cache this.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
        )
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    # Attach the caller's JWT so PostgREST sends it as the Authorization bearer,
    # which is what RLS policies read via auth.uid().
    client.postgrest.auth(access_token)
    return client
