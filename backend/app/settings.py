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

    # CelesTrak GP feed — the canonical ingestion source (Data-Strategy.md
    # §6). "active" is CelesTrak's own group name, not a project invention.
    celestrak_base_url: str = "https://celestrak.org/NORAD/elements/gp.php"
    celestrak_group: str = "active"
    # CelesTrak is a free service run by one person — identify ourselves.
    celestrak_user_agent: str = "ORCAS-conjunction-assessment/0.1 (local research project)"

    # Local host default (uv run from backend/); docker-compose overrides via
    # ML_MODEL_PATH to the container mount at /app/ml_models/....
    ml_model_path: str = "../ml_models/object_classifier.joblib"

    # Same pattern as ml_model_path — data/ is a repo-root sibling of
    # backend/, not inside it, so containers need an explicit mount +
    # override (DATA_SAMPLE_DIR -> /app/data/sample).
    data_sample_dir: str = "../data/sample"

    # Generated artifacts — same host/container split as data_sample_dir.
    # Both are gitignored; regenerated on schedule, never committed.
    snapshot_dir: str = "../data/snapshot"
    archive_dir: str = "../data/archive"

    # Data-Strategy.md §7: latest element_set per object is kept forever;
    # anything older is archived to Parquet and dropped from Postgres.
    retention_days: int = 90


settings = Settings()
