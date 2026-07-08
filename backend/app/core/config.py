from typing import List, Any
import json
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ---- Supabase ----
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # ---- CORS ----
    # Comma-separated list of allowed origins in .env,
    # e.g. CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
    CORS_ORIGINS: Any = ["http://localhost:5173"]

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

    # ---- App ----
    APP_ENV: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
