"""AGENT 2 -- News & Geopolitical Risk Agent.

Doc quyen truy van GDELT Cloud API v2. Tra ve SSI_news + G_geo + key_events.
Khong ghi DB (Agent 6 lo viec do) va khong bao gio lam sap vong quet:
GDELT chet -> tra ket qua `stale=True` de Agent 6 dung gia tri cu trong DB.
"""

from __future__ import annotations

from src.agents.base import Agent
from src.core.contracts import NewsRiskResult, Supplier
from src.integrations.gdelt import fetch_supplier_news


class NewsRiskAgent(Agent[Supplier, NewsRiskResult]):
    name = "agent2_news_risk"
    critical = False

    def execute(self, payload: Supplier) -> NewsRiskResult:
        return fetch_supplier_news(payload)

    def fallback(self, payload: Supplier, error: Exception) -> NewsRiskResult:
        """GDELT chet hoan toan -> diem trung tinh, danh dau stale."""
        return NewsRiskResult(
            supplier_id=payload.id, ssi_news=50.0, g_geo=50.0, stale=True
        )
