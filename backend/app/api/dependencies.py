"""
Shared FastAPI dependencies — injected via Depends().
"""
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.services.supabase_client import (
    get_supabase_client,
    get_anon_client,
    build_user_client,
)


def get_db() -> Client:
    """
    Yield the **service-role** Supabase client (bypasses RLS).

    Reserved for operations that are genuinely not scoped to a single user.
    Do NOT use this to serve a user's request — use ``get_user_db`` so Row
    Level Security is enforced.
    """
    return get_supabase_client()


def _extract_bearer_token(authorization: Optional[str]) -> str:
    """Pull the raw JWT out of an ``Authorization: Bearer <token>`` header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()


def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    Verify the caller's Supabase JWT and return their identity.

    Raises 401 if the header is missing, malformed, or the token is
    invalid/expired. Returns ``{"id", "email", "token"}``.
    """
    token = _extract_bearer_token(authorization)
    try:
        user_response = get_anon_client().auth.get_user(token)
    except Exception:
        # Any verification failure (network, invalid signature, etc.) is a 401.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = getattr(user_response, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"id": user.id, "email": getattr(user, "email", None), "token": token}


def get_user_db(user: dict = Depends(get_current_user)) -> Client:
    """
    Yield a per-request Supabase client authenticated as the calling user.

    Every query it makes runs under RLS as that user, so a request for another
    user's row simply returns no data. Depends on ``get_current_user``; when a
    route depends on both, FastAPI's per-request dependency cache verifies the
    token only once.
    """
    return build_user_client(user["token"])
