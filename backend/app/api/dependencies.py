"""
Shared FastAPI dependencies — injected via Depends().
"""
from app.services.supabase_client import get_supabase_client
from supabase import Client


def get_db() -> Client:
    """Yield a Supabase client instance for each request."""
    return get_supabase_client()
