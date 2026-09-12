"""Client cho cac API ben ngoai (GDELT, FMP, Open-Meteo, OpenRouter).

Moi client deu: httpx + tenacity retry + timeout `settings.http_timeout_seconds`
+ cache dia + rate limit + circuit breaker (xem `http.py`).

Quy uoc quan trong cho Phase 4: 3 client du lieu (`fetch_supplier_news`,
`fetch_financials`, `weather_delay_forecast`) **khong bao gio nem ngoai le** --
API chet thi tra ve ket qua `stale=True`, vi worker chay moi 5 phut phai song sot.
Rieng `structured_completion` CO nem (`LLMSchemaError`/`LLMError`): mot phan tich
LLM sai schema thi tha khong co con hon ghi rac vao `sourcing_proposals`.
"""

from src.integrations.fmp import fetch_financials
from src.integrations.gdelt import fetch_supplier_news
from src.integrations.open_meteo import weather_delay_forecast
from src.integrations.openrouter_client import (
    LLMError,
    LLMSchemaError,
    structured_completion,
)

__all__ = [
    "LLMError",
    "LLMSchemaError",
    "fetch_financials",
    "fetch_supplier_news",
    "structured_completion",
    "weather_delay_forecast",
]
