"""AGENT 3 -- Financial Health Agent.

Doc quyen truy van Financial Modeling Prep API, tinh Altman Z-Score va SSI_fin.
FMP co han ngach NGAY (khong phai theo phut) nen khi het quota, client tra ve
`stale=True` thay vi retry -- Agent 6 se giu lai `altman_z` cu trong DB.
"""

from __future__ import annotations

from src.agents.base import Agent
from src.core.contracts import FinancialResult, Supplier
from src.integrations.fmp import fetch_financials

#: Ticker du phong khi `supplier_risk_analysis.ticker` chua co (lan quet dau tien).
NAME_TO_TICKER: dict[str, str] = {
    "Ford Motor": "F",
    "Lucid Motors": "LCID",
    "Rivian": "RIVN",
    "General Motors": "GM",
    "TSMC": "TSM",
    "Tesla": "TSLA",
    "NVIDIA": "NVDA",
    "Advanced Micro Devices": "AMD",
    "Intel": "INTC",
    "Sony Group": "SONY",
}


def resolve_ticker(supplier: Supplier, known_ticker: str | None = None) -> str | None:
    """Ticker uu tien lay tu DB; neu chua co thi tra cuu theo ten NCC."""
    if known_ticker:
        return known_ticker
    return NAME_TO_TICKER.get(supplier.name)


class FinancialHealthAgent(Agent[dict, FinancialResult]):
    name = "agent3_financial_health"
    critical = False

    def execute(self, payload: dict) -> FinancialResult:
        supplier: Supplier = payload["supplier"]
        ticker = resolve_ticker(supplier, payload.get("ticker"))
        if not ticker:
            raise ValueError(f"Khong xac dinh duoc ticker cho NCC {supplier.id}")
        return fetch_financials(supplier.id, ticker)

    def fallback(self, payload: dict, error: Exception) -> FinancialResult:
        supplier: Supplier = payload["supplier"]
        return FinancialResult(
            supplier_id=supplier.id,
            ticker=resolve_ticker(supplier, payload.get("ticker")) or "",
            altman_z=None,
            ssi_fin=50.0,
            zone="UNKNOWN",
            stale=True,
        )
