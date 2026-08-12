from typing import List, Any
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ---- Supabase ----
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # Anon (public) key — used for per-request, user-scoped clients that run
    # under Row Level Security. The service-role key above bypasses RLS.
    SUPABASE_ANON_KEY: str = ""

    # ---- CORS ----
    # Comma-separated list of allowed origins in .env,
    # e.g. CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
    CORS_ORIGINS: Any = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            # If it's empty, return default local frontend port
            if not v.strip():
                return ["http://localhost:5173"]
            
            # Check if it looks like a JSON array
            if v.strip().startswith("[") and v.strip().endswith("]"):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            
            # Otherwise, parse as comma-separated values
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        
        if isinstance(v, (list, tuple)):
            return list(v)
            
        return ["http://localhost:5173"]

    # Regex alternative to the fixed list above, for origins whose hostname is
    # not known ahead of time. The motivating case is Vercel: every preview
    # deployment gets its own domain (my-app-git-<branch>-<scope>.vercel.app),
    # so no static list can cover them. Empty => disabled (production default;
    # only the explicit CORS_ORIGINS list is honoured).
    #
    # Anchor any value you set. A bare "vercel\.app" is a substring match, and
    # CORSMiddleware would then accept https://vercel.app.evil.com.
    # e.g. CORS_ORIGIN_REGEX=https://my-app-git-[a-z0-9-]+-myscope\.vercel\.app
    CORS_ORIGIN_REGEX: str = ""

    # ---- App ----
    APP_ENV: str = "development"


settings = Settings()
