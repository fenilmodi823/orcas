from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All backend configuration in one place. Never scatter os.getenv calls."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://orcas:orcas@postgres:5432/orcas"

    # CORS — the simulation is never public, so this stays localhost-only.
    cors_allow_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    nasa_api_key: str = ""


settings = Settings()
