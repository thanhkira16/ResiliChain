# pyright: reportArgumentType=false
# Ly do: file nay dung test double (FakeConnection, module respx) va dict literal
# cho model Pydantic long nhau -- Pydantic chap nhan o runtime, Pyright thi khong.
# Da xac nhan bang 173 test xanh; tat rule nay o day de khong phai be cong code test.
"""Test cho Agent 1 va Agent 6 -- phan logic thuan, khong cham DB/API."""

from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from src.agents.base import Agent, AgentResult
from src.agents.db_ingestion_agent import (
    CLOSED_PO_STATUSES,
    committed_lead_time_of,
    delay_days_of,
)
from src.agents.financial_health_agent import resolve_ticker
from src.agents.logistics_chatbox_agent import TRANSPORT_OPTIONS, fallback_draft
from src.agents.master_orchestrator import (
    ALLOWED_STATUS_LABELS,
    STATE_PROGRESS,
    advance_state,
    build_summary,
    derive_status_label,
)
from src.agents.replacement_sourcing_agent import enrich_rankings, fallback_recommendation
from src.core.contracts import (
    IncidentState,
    InventoryItem,
    LLMProposalAnalysis,
    OrderContext,
    ProposalRanking,
    PurchaseOrder,
    ScoreBreakdown,
    Supplier,
)


def make_order(**kw) -> PurchaseOrder:
    base: dict[str, Any] = dict(
        id="PO-1", po_number="PO-2026-011", supplier_id="SUP-03", supplier_name="Rivian",
        sku="SKU-MOT-09", sku_name="Enduro drive unit", quantity=120,
        unit_price=10_494_000.0, total_amount=1_259_280_000.0,
        order_date="2026-07-01", promised_delivery_date="2026-07-28",
        actual_or_expected_delivery_date="2026-08-12", status="Đang giao",
    )
    base.update(kw)
    return PurchaseOrder(**base)


def make_context(**kw) -> OrderContext:
    order = kw.pop("order", make_order())
    return OrderContext(
        order=order,
        inventory=kw.pop("inventory", InventoryItem(
            sku=order.sku, name=order.sku_name, current_stock=31,
            safety_stock=60, weekly_burn_rate=10, min_lead_time_days=20,
        )),
        supplier=kw.pop("supplier", Supplier(
            id=order.supplier_id, name=order.supplier_name,
            reliability_score=68, contact_person="Anh Minh", email="a@b.com",
        )),
        delay_days=kw.pop("delay_days", 15),
        committed_lead_time_days=kw.pop("committed_lead_time_days", 27),
        **kw,
    )


# --------------------------------------------------------------------------
# Agent 1 -- tinh so ngay tre & lead time cam ket
# --------------------------------------------------------------------------


def test_delay_days_from_expected_delivery_date() -> None:
    order = make_order(
        promised_delivery_date="2026-07-28", actual_or_expected_delivery_date="2026-08-12"
    )
    assert delay_days_of(order, today=date(2026, 8, 1)) == 15


def test_delay_days_never_negative_when_delivered_early() -> None:
    order = make_order(
        promised_delivery_date="2026-07-28",
        actual_or_expected_delivery_date="2026-07-20",
        status="Hoàn thành",
    )
    assert delay_days_of(order, today=date(2026, 9, 12)) == 0


def test_open_order_past_due_uses_today_when_erp_lags() -> None:
    """ERP chua cap nhat ngay du kien -> lay hom nay lam moc, khong bao cao tre it hon that."""
    order = make_order(
        promised_delivery_date="2026-07-28",
        actual_or_expected_delivery_date="2026-07-28",
        status="Đang giao",
    )
    assert delay_days_of(order, today=date(2026, 8, 10)) == 13


def test_closed_order_does_not_drift_with_today() -> None:
    order = make_order(
        promised_delivery_date="2026-07-28",
        actual_or_expected_delivery_date="2026-08-01",
        status="Hoàn thành",
    )
    assert "Hoàn thành" in CLOSED_PO_STATUSES
    assert delay_days_of(order, today=date(2027, 1, 1)) == 4


def test_committed_lead_time_is_order_to_promise() -> None:
    assert committed_lead_time_of(make_order()) == 27


def test_committed_lead_time_falls_back_on_bad_dates() -> None:
    assert committed_lead_time_of(make_order(order_date="khong-phai-ngay"), fallback=9) == 9


def test_delay_days_handles_missing_dates() -> None:
    assert delay_days_of(make_order(promised_delivery_date="")) == 0


# --------------------------------------------------------------------------
# Agent 6 -- nhan nguyen nhan phai nam trong bo gia tri DB dang dung
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "ssi_news,ssi_fin,g_geo,altman",
    [
        (70, 70, 90, 1.0), (30, 80, 20, -4.5), (70, 30, 85, 3.0),
        (65, 30, 60, 3.0), (50, 30, 20, 3.0), (20, 20, 10, 5.0),
        (0, 0, 0, None), (100, 100, 100, None),
    ],
)
def test_status_label_always_within_allowed_set(ssi_news, ssi_fin, g_geo, altman) -> None:
    assert derive_status_label(ssi_news, ssi_fin, g_geo, altman) in ALLOWED_STATUS_LABELS


def test_distress_altman_z_forces_financial_label() -> None:
    """Altman Z <= 1.81 la vung kiet que -> phai lo ra o nhan, du tin tuc yen ang."""
    assert derive_status_label(10.0, 10.0, 10.0, 1.5) == "Kiệt quệ"


def test_both_axes_hot_gives_combined_label() -> None:
    assert derive_status_label(75.0, 75.0, 50.0, 1.0) == "Cả hai trục"


def test_summary_mentions_threshold_and_stock_position() -> None:
    text = build_summary(make_context(), 50, 35.0)
    assert "PO-2026-011" in text and "50/100" in text and "35" in text
    assert "DƯỚI" in text  # 31 < 60


# --------------------------------------------------------------------------
# Agent 5 -- LLM chi duoc sua phan dien giai, khong duoc sua so lieu MILP
# --------------------------------------------------------------------------


def make_ranking(rank: int, sid: str, score: int) -> ProposalRanking:
    return ProposalRanking(
        rank=rank, supplier_id=sid, supplier_name=f"NCC {sid}",
        unit_price=100.0, total_cost=1000.0, lead_time_days=30, score=score,
        score_breakdown=ScoreBreakdown(
            normalized_cost=1.0, normalized_lead_time=0.0, supplier_reliability_score=0.7,
            w1=0.45, w2=0.35, w3=0.20, cost_score_contribution=0.45,
            time_score_contribution=0.0, reliability_contribution=0.14,
        ),
    )


def test_llm_cannot_alter_milp_numbers() -> None:
    rankings = [make_ranking(1, "SUP-02", 91)]
    analysis = LLMProposalAnalysis(
        rankings=[{"supplierId": "SUP-02", "pros": ["rẻ"], "cons": ["Altman Z âm"],
                   "reasoning": "vì vậy"}],
        recommendation="Chọn SUP-02 có cân nhắc.",
    )
    out = enrich_rankings(rankings, analysis)
    assert out[0].pros == ["rẻ"] and out[0].cons == ["Altman Z âm"]
    # So lieu MILP giu nguyen tuyet doi
    assert out[0].score == 91
    assert out[0].rank == 1
    assert out[0].unit_price == 100.0
    assert out[0].score_breakdown.cost_score_contribution == 0.45


def test_llm_naming_unknown_supplier_is_ignored() -> None:
    rankings = [make_ranking(1, "SUP-02", 91)]
    analysis = LLMProposalAnalysis(
        rankings=[{"supplierId": "SUP-BIA-RA", "pros": ["x"], "cons": ["y"], "reasoning": "z"}],
        recommendation="r",
    )
    out = enrich_rankings(rankings, analysis)
    assert out[0].pros == [] and out[0].supplier_id == "SUP-02"


def test_fallback_recommendation_is_usable_without_llm() -> None:
    ctx = make_context()
    text = fallback_recommendation(ctx, [make_ranking(1, "SUP-02", 91)])
    assert "SUP-02" in text or "NCC SUP-02" in text
    assert "91" in text


def test_fallback_recommendation_handles_no_candidate() -> None:
    assert "thủ công" in fallback_recommendation(make_context(), [])


# --------------------------------------------------------------------------
# Agent 4 -- ban nhap khong bao gio rong, va khong tu gui
# --------------------------------------------------------------------------


def test_fallback_draft_is_complete_and_uses_allowed_transport_option() -> None:
    draft = fallback_draft(make_context())
    assert draft.subject and draft.body
    assert draft.proposed_transport_option in TRANSPORT_OPTIONS
    assert draft.urgency == "Cao"  # tre 15 ngay + duoi ton kho an toan
    assert "PO-2026-011" in draft.subject


def test_fallback_draft_low_urgency_when_healthy() -> None:
    ctx = make_context(
        delay_days=2,
        inventory=InventoryItem(sku="S", name="n", current_stock=100, safety_stock=10,
                                weekly_burn_rate=5, min_lead_time_days=5),
    )
    assert fallback_draft(ctx).urgency == "Trung bình"


def test_resolve_ticker_prefers_value_from_db() -> None:
    s = Supplier(id="SUP-05", name="TSMC")
    assert resolve_ticker(s, "TSM-DB") == "TSM-DB"
    assert resolve_ticker(s) == "TSM"
    assert resolve_ticker(Supplier(id="X", name="Khong Co Trong Map")) is None


# --------------------------------------------------------------------------
# Khung Agent -- mot agent chet khong duoc lam sap vong quet
# --------------------------------------------------------------------------


class Boom(Agent[int, int]):
    name = "boom"

    def execute(self, payload: int) -> int:
        raise RuntimeError("no")


class BoomWithFallback(Boom):
    def fallback(self, payload: int, error: Exception) -> int:
        return -1


class CriticalBoom(Boom):
    critical = True


def test_non_critical_agent_degrades_instead_of_raising() -> None:
    result = Boom().run(1)
    assert isinstance(result, AgentResult)
    assert result.degraded and not result.ok and result.data is None
    assert "RuntimeError" in (result.error or "")


def test_fallback_value_marks_result_ok_but_degraded() -> None:
    result = BoomWithFallback().run(1)
    assert result.ok and result.degraded and result.data == -1


def test_critical_agent_stops_the_scan() -> None:
    with pytest.raises(RuntimeError):
        CriticalBoom().run(1)


# --------------------------------------------------------------------------
# State machine chi duoc DAY TOI, khong duoc keo lui
# --------------------------------------------------------------------------


def test_worker_never_regresses_an_incident_awaiting_approval() -> None:
    """Incident dang cho nguoi duyet ma bi vong quet sau keo ve SOURCING la mat
    vi tri quy trinh -- day la loi tung xay ra that tren DB demo."""
    assert advance_state("PENDING_APPROVAL", IncidentState.SOURCING_BACKUP_SUPPLIERS) is (
        IncidentState.PENDING_APPROVAL
    )


def test_worker_never_regresses_a_human_decision() -> None:
    assert advance_state("APPROVED", IncidentState.DETECTED) is IncidentState.APPROVED
    assert advance_state("RESOLVED", IncidentState.SOURCING_BACKUP_SUPPLIERS) is (
        IncidentState.RESOLVED
    )


def test_worker_does_advance_a_fresh_incident() -> None:
    assert advance_state("DETECTED", IncidentState.SOURCING_BACKUP_SUPPLIERS) is (
        IncidentState.SOURCING_BACKUP_SUPPLIERS
    )
    assert advance_state(None, IncidentState.DETECTED) is IncidentState.DETECTED


def test_unknown_state_in_db_does_not_crash_the_scan() -> None:
    assert advance_state("TRANG_THAI_LA", IncidentState.DETECTED) is IncidentState.DETECTED


def test_every_incident_state_has_a_progress_rank() -> None:
    for state in IncidentState:
        assert state in STATE_PROGRESS, f"thieu thu tu tien trien cho {state}"
