"""PuLP MILP solver chon nha cung ung thay the (plan/03 §4).

``Score_i = round(0.45*CostScore_i + 0.35*LeadTimeScore_i + 0.20*ReliabilityScore_i)``
tren thang 0-100.

QUY TAC: pure function -- khong DB, khong HTTP, khong LLM. ``pros`` / ``cons`` /
``reasoning`` co tinh DE TRONG o day; Agent LLM (Phase 4) moi dien vao.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, cast

import pulp

from src.core.config import settings
from src.core.contracts import ProposalRanking, ScoreBreakdown, Supplier
from src.core.formulas import clamp01, round_half_up, safe_div

__all__ = ["normalize_lower_is_better", "solve_replacement_sourcing"]


def _attr(obj: Any, name: str, default: Any = None) -> Any:
    """Doc thuoc tinh tu Supplier (pydantic) hoac dict -- tien cho test/fixture."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _unit_price_of(candidate: Any, sku: str, fallback: float) -> float:
    """Gia hien hanh cua `candidate` cho `sku`.

    `Supplier.historical_price` la CHUOI GIA THEO THOI GIAN
    (`{sku: [{date, unitPrice}, ...]}`) nen phai lay moc moi nhat theo `date`.
    Van chap nhan dang gia phang (mot so) de fixture/dict goi cho gon.
    """
    latest = getattr(candidate, "latest_price", None)
    if callable(latest):
        value = latest(sku)
        if value is not None:
            return float(cast(float, value))
    else:
        prices = _attr(candidate, "historical_price", {}) or {}
        value = prices.get(sku)
        if isinstance(value, list):  # chuoi gia dang dict tho
            if value:
                newest = max(value, key=lambda p: p.get("date", ""))
                return float(newest.get("unitPrice", newest.get("unit_price", fallback)))
            value = None
        if value is not None:
            return float(value)

    value = _attr(candidate, "unit_price")
    if value is None:
        return float(fallback)
    return float(value)


def normalize_lower_is_better(
    value: float,
    minimum: float,
    maximum: float,
    original: float,
) -> float:
    """Chuan hoa mot chi tieu "cang thap cang tot" ve [0, 1].

    * Bo ung vien co bien do (``maximum > minimum``) -> min-max chuan:
      ``(maximum - value) / (maximum - minimum)``.
    * Bo ung vien KHONG co bien do -- sole-source, hoac moi ung vien bang nhau --
      thi min-max se chia cho 0. Khi do lay HOP DONG GOC lam moc so sanh:
      ``clamp(0, 1, 1 - (value - original) / original)``, tuc "bang hoac tot hon
      hop dong goc = 1.0, te hon bao nhieu phan tram thi tru bay nhieu".
    * Khong co ca moc goc (``original <= 0``) -> 1.0 (khong the phat ai ca).

    Nhanh fallback nay chinh la cach ``seed_ai_data.sql`` cham ca sole-source
    ``PROP-PO-2026-011`` (Lucid Motors): ``normalizedLeadTime = 1 - 1/27 = 0.963``.
    """
    span = maximum - minimum
    if span > 0:
        return clamp01(safe_div(maximum - value, span, 1.0))
    if original and original > 0:
        return clamp01(1.0 - safe_div(value - original, original, 0.0))
    return 1.0


def solve_replacement_sourcing(
    sku: str,
    quantity: int,
    candidates: Sequence[Supplier | dict[str, Any]],
    original_unit_price: float,
    original_lead_time: int,
    *,
    w_cost: float | None = None,
    w_leadtime: float | None = None,
    w_reliability: float | None = None,
    max_rankings: int | None = None,
) -> list[ProposalRanking]:
    """Chon toi da ``settings.milp_max_rankings`` nha cung ung thay the tot nhat.

    Mo hinh MILP (PuLP / CBC): moi ung vien co mot bien nhi phan ``x_i``; rang
    buoc ``sum(x_i) <= max_rankings``; ham muc tieu ``max sum(Score_i * x_i)``.
    Ket qua duoc sap xep theo ``score`` giam dan va gan ``rank`` 1..N.

    Tra ve ``[]`` neu khong co ung vien nao.
    """
    w_cost = settings.milp_w_cost if w_cost is None else w_cost
    w_leadtime = settings.milp_w_leadtime if w_leadtime is None else w_leadtime
    w_reliability = settings.milp_w_reliability if w_reliability is None else w_reliability
    max_rankings = settings.milp_max_rankings if max_rankings is None else max_rankings

    if not candidates:
        return []

    quantity = int(quantity)
    original_unit_price = float(original_unit_price or 0.0)
    original_lead_time = int(original_lead_time or 0)

    prices = [_unit_price_of(c, sku, original_unit_price) for c in candidates]
    leads = [float(_attr(c, "average_lead_time_days", 0) or 0) for c in candidates]

    min_price, max_price = min(prices), max(prices)
    min_lead, max_lead = min(leads), max(leads)

    scored: list[tuple[float, ProposalRanking]] = []
    for idx, candidate in enumerate(candidates):
        unit_price = prices[idx]
        lead_time = leads[idx]

        normalized_cost = round_half_up(
            normalize_lower_is_better(unit_price, min_price, max_price, original_unit_price), 3
        )
        normalized_lead = round_half_up(
            normalize_lower_is_better(lead_time, min_lead, max_lead, float(original_lead_time)), 3
        )
        reliability = round_half_up(
            clamp01(float(_attr(candidate, "reliability_score", 0) or 0) / 100.0), 3
        )

        cost_contrib = round_half_up(w_cost * normalized_cost, 3)
        time_contrib = round_half_up(w_leadtime * normalized_lead, 3)
        reliability_contrib = round_half_up(w_reliability * reliability, 3)

        raw_score = 100.0 * (
            w_cost * normalized_cost
            + w_leadtime * normalized_lead
            + w_reliability * reliability
        )
        score = int(round_half_up(raw_score, 0))

        ranking = ProposalRanking(
            rank=0,  # gan lai sau khi MILP chon xong
            supplier_id=str(_attr(candidate, "id", "") or ""),
            supplier_name=str(_attr(candidate, "name", "") or ""),
            unit_price=unit_price,
            total_cost=unit_price * quantity,
            lead_time_days=int(lead_time),
            pros=[],
            cons=[],
            score=score,
            score_breakdown=ScoreBreakdown(
                normalized_cost=normalized_cost,
                normalized_lead_time=normalized_lead,
                supplier_reliability_score=reliability,
                w1=w_cost,
                w2=w_leadtime,
                w3=w_reliability,
                cost_score_contribution=cost_contrib,
                time_score_contribution=time_contrib,
                reliability_contribution=reliability_contrib,
            ),
            reasoning="",
        )
        scored.append((raw_score, ranking))

    # ---- MILP that: chon tap con toi da `max_rankings` ung vien toi uu ----
    problem = pulp.LpProblem("replacement_sourcing", pulp.LpMaximize)
    choose = [
        pulp.LpVariable(f"select_{idx}", cat=pulp.LpBinary) for idx in range(len(scored))
    ]
    problem += pulp.lpSum(raw * var for (raw, _), var in zip(scored, choose, strict=True))
    problem += pulp.lpSum(choose) <= max(0, int(max_rankings)), "max_rankings"
    problem += pulp.lpSum(choose) >= min(len(scored), max(0, int(max_rankings))), "min_rankings"
    problem.solve(pulp.PULP_CBC_CMD(msg=False))

    def _chosen(var) -> bool:
        value = var.value()  # PuLP tra None khi bien chua duoc gan nghiem
        return value is not None and value > 0.5

    selected = [
        ranking
        for (_, ranking), var in zip(scored, choose, strict=True)
        if _chosen(var)
    ]
    if not selected:  # solver that bai -> fallback xep hang thuan tuy
        selected = [ranking for _, ranking in scored][: max(0, int(max_rankings))]

    selected.sort(key=lambda r: (-r.score, r.total_cost, r.lead_time_days))
    for position, ranking in enumerate(selected, start=1):
        ranking.rank = position
    return selected
