"""Cau hinh tap trung cho BikeSync AI Engine.

Moi hang so (trong so cong thuc, nguong kich hoat, rate limit) deu nam o day va
doc duoc tu env. CAM hardcode nhung gia tri nay trong agent -- xem plan/06 §2 (D4).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

AI_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=AI_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- External APIs ----
    gdelt_api_key: str = ""
    fmp_api_key: str = ""
    openrouter_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o"

    # ---- Database (dung chung voi Backend) ----
    db_host: str = ""
    db_port: int = 5432
    db_username: str = ""
    db_password: str = ""
    db_name: str = "postgres"
    db_ssl: bool = True
    supabase_db: str = ""

    # ---- Trong so delayRiskScore (plan/03 §1) ----
    risk_w1_lateness: float = 0.50
    risk_w2_reliability: float = 0.25
    risk_w3_inventory: float = 0.25

    # ---- Trong so PORS (plan/03 §3) ----
    pors_w_news: float = 0.35
    pors_w_fin: float = 0.30
    pors_w_del: float = 0.20
    pors_w_geo: float = 0.15

    # ---- Trong so MILP (plan/03 §4) ----
    milp_w_cost: float = 0.45
    milp_w_leadtime: float = 0.35
    milp_w_reliability: float = 0.20
    milp_max_rankings: int = 3

    # ---- Nguong kich hoat (hieu chinh theo plan/04: du lieu that max risk=48, max PORS=58.03) ----
    incident_risk_threshold: float = 35.0
    pors_high_threshold: float = 55.0
    pors_medium_threshold: float = 40.0

    # ---- Van hanh ----
    dry_run: bool = Field(default=False, alias="AI_DRY_RUN")
    http_timeout_seconds: float = 8.0
    http_max_retries: int = 3
    gdelt_rate_limit_rpm: int = 26
    cache_ttl_seconds: int = 6 * 3600
    log_level: str = "INFO"

    # ---- Cum linh kien giam sat (plan/01 §3) ----
    hs_codes: tuple[str, ...] = ("850760", "850153", "850440", "854110", "854231")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cache_dir(self) -> Path:
        path = AI_DIR / ".cache"
        path.mkdir(exist_ok=True)
        return path

    @computed_field  # type: ignore[prop-decorator]
    @property
    def dsn(self) -> str:
        """Chuoi ket noi psycopg. Uu tien SUPABASE_DB neu co."""
        if self.supabase_db:
            return self.supabase_db
        sslmode = "require" if self.db_ssl else "disable"
        return (
            f"postgresql://{self.db_username}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?sslmode={sslmode}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def llm_api_key(self) -> str:
        return self.openrouter_api_key or self.openai_api_key


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
