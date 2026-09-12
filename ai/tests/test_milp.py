# pyright: reportArgumentType=false
# Ly do: file nay dung test double (FakeConnection, module respx) va dict literal
# cho model Pydantic long nhau -- Pydantic chap nhan o runtime, Pyright thi khong.
# Da xac nhan bang 173 test xanh; tat rule nay o day de khong phai be cong code test.
"""Golden tests cho src/core/milp_solver.py -- so lieu lay tu ai/seed_ai_data.sql."""

from __future__ import annotations

import pytest

from src.core.config import settings
from src.core.contracts import ProposalRanking, Supplier
from src.core.milp_solver import normalize_lower_is_better, solve_replacement_sourcing

SKU_BAT = "SKU-BAT-03"
SKU_MOT = "SKU-MOT-09"


def make_supplier(sid, name, sku, price, lead, reliability) -> Supplier:
    return Supplier(
        id=sid,
        name=name,
        provided_skus=[sku],
        historical_price={sku: [{"date": "2026-09-01", "unitPrice": price}]},
        average_lead_time_days=lead,
        reliability_score=reliability,
    )


# --------------------------------------------------------------------------
# GOLDEN #1 -- PROP-PO-2026-003 (2 nguon thay the): GM 60 diem, Tesla 51 diem
# --------------------------------------------------------------------------


@pytest.fixture
def battery_candidates() -> list[Supplier]:
    return [
        make_supplier("SUP-04", "General Motors", SKU_BAT, 9_439_500, 30, 76),
        make_supplier("SUP-06", "Tesla", SKU_BAT, 9_746_400, 26, 82),
    ]


def test_golden_two_candidate_case_scores_60_and_51(battery_candidates):
    rankings = solve_replacement_sourcing(
        sku=SKU_BAT,
        quantity=80,
        candidates=battery_candidates,
        original_unit_price=9_300_000,
        original_lead_time=27,
    )

    assert [r.rank for r in rankings] == [1, 2]
    gm, tesla = rankings

    assert (gm.supplier_id, gm.supplier_name, gm.score) == ("SUP-04", "General Motors", 60)
    assert gm.unit_price == 9_439_500
    assert gm.total_cost == 755_160_000
    assert gm.lead_time_days == 30
    assert gm.score_breakdown.normalized_cost == 1.0
    assert gm.score_breakdown.normalized_lead_time == 0.0
    assert gm.score_breakdown.supplier_reliability_score == 0.76
    assert gm.score_breakdown.cost_score_contribution == 0.45
    assert gm.score_breakdown.time_score_contribution == 0.0
    assert gm.score_breakdown.reliability_contribution == 0.152

    assert (tesla.supplier_id, tesla.score) == ("SUP-06", 51)
    assert tesla.total_cost == 779_712_000
    assert tesla.score_breakdown.normalized_cost == 0.0
    assert tesla.score_breakdown.normalized_lead_time == 1.0
    assert tesla.score_breakdown.supplier_reliability_score == 0.82
    assert tesla.score_breakdown.time_score_contribution == 0.35
    assert tesla.score_breakdown.reliability_contribution == 0.164


# --------------------------------------------------------------------------
# GOLDEN #2 -- PROP-PO-2026-011 sole-source (Lucid Motors) = 91 diem
# --------------------------------------------------------------------------


def test_golden_sole_source_lucid_motors_scores_91():
    rankings = solve_replacement_sourcing(
        sku=SKU_MOT,
        quantity=120,
        candidates=[make_supplier("SUP-02", "Lucid Motors", SKU_MOT, 10_303_200, 28, 63)],
        original_unit_price=10_494_000,  # hop dong goc voi Rivian
        original_lead_time=27,
    )

    assert len(rankings) == 1
    lucid = rankings[0]
    assert lucid.rank == 1
    assert lucid.supplier_id == "SUP-02"
    assert lucid.unit_price == 10_303_200
    assert lucid.total_cost == 1_236_384_000
    assert lucid.lead_time_days == 28
    assert lucid.score == 91
    assert lucid.score_breakdown.normalized_cost == 1.0
    assert lucid.score_breakdown.normalized_lead_time == 0.963
    assert lucid.score_breakdown.supplier_reliability_score == 0.63
    assert lucid.score_breakdown.cost_score_contribution == 0.45
    assert lucid.score_breakdown.time_score_contribution == 0.337
    assert lucid.score_breakdown.reliability_contribution == 0.126


def test_sole_source_never_divides_by_zero_without_original_reference():
    rankings = solve_replacement_sourcing(
        sku=SKU_MOT,
        quantity=10,
        candidates=[make_supplier("SUP-02", "Lucid Motors", SKU_MOT, 1_000, 10, 50)],
        original_unit_price=0,
        original_lead_time=0,
    )
    lucid = rankings[0]
    assert lucid.score_breakdown.normalized_cost == 1.0
    assert lucid.score_breakdown.normalized_lead_time == 1.0
    assert lucid.score == 90  # 100*(0.45 + 0.35 + 0.20*0.5)


def test_identical_candidates_fall_back_to_original_contract_baseline():
    """Min-max span = 0 khi moi ung vien bang nhau -> khong duoc chia cho 0."""
    candidates = [
        make_supplier("SUP-A", "A", SKU_BAT, 100, 20, 80),
        make_supplier("SUP-B", "B", SKU_BAT, 100, 20, 60),
    ]
    rankings = solve_replacement_sourcing(
        sku=SKU_BAT,
        quantity=1,
        candidates=candidates,
        original_unit_price=100,
        original_lead_time=10,
    )
    assert [r.supplier_id for r in rankings] == ["SUP-A", "SUP-B"]
    for r in rankings:
        assert r.score_breakdown.normalized_cost == 1.0
        assert r.score_breakdown.normalized_lead_time == 0.0  # tre gap doi lead goc


def test_normalize_lower_is_better_edge_cases():
    assert normalize_lower_is_better(5, 5, 10, 7) == 1.0
    assert normalize_lower_is_better(10, 5, 10, 7) == 0.0
    assert normalize_lower_is_better(7.5, 5, 10, 7) == 0.5
    assert normalize_lower_is_better(28, 28, 28, 27) == pytest.approx(0.96296, abs=1e-5)
    assert normalize_lower_is_better(28, 28, 28, 0) == 1.0  # khong co moc -> 1.0
    assert normalize_lower_is_better(999, 999, 999, 1) == 0.0  # clamp san


# --------------------------------------------------------------------------
# Rang buoc MILP, trong so tu settings, hop dong du lieu
# --------------------------------------------------------------------------


def test_selects_at_most_milp_max_rankings():
    candidates = [
        make_supplier(f"SUP-{i:02d}", f"S{i}", SKU_BAT, 100 + i * 10, 20 + i, 90 - i)
        for i in range(6)
    ]
    rankings = solve_replacement_sourcing(SKU_BAT, 10, candidates, 120, 22)
    assert len(rankings) == settings.milp_max_rankings == 3
    # MILP phai chon dung 3 ung vien co diem cao nhat
    assert [r.score for r in rankings] == sorted((r.score for r in rankings), reverse=True)
    all_scores = sorted(
        (r.score for r in solve_replacement_sourcing(SKU_BAT, 10, candidates, 120, 22, max_rankings=6)),
        reverse=True,
    )
    assert [r.score for r in rankings] == all_scores[:3]


def test_max_rankings_comes_from_settings(monkeypatch):
    candidates = [
        make_supplier(f"SUP-{i:02d}", f"S{i}", SKU_BAT, 100 + i * 10, 20 + i, 90 - i)
        for i in range(5)
    ]
    monkeypatch.setattr(settings, "milp_max_rankings", 2)
    assert len(solve_replacement_sourcing(SKU_BAT, 10, candidates, 120, 22)) == 2


def test_milp_weights_come_from_settings(monkeypatch, battery_candidates):
    monkeypatch.setattr(settings, "milp_w_cost", 0.0)
    monkeypatch.setattr(settings, "milp_w_leadtime", 1.0)
    monkeypatch.setattr(settings, "milp_w_reliability", 0.0)
    rankings = solve_replacement_sourcing(SKU_BAT, 80, battery_candidates, 9_300_000, 27)
    # Trong so chi con lead time -> Tesla (26 ngay) thang
    assert rankings[0].supplier_id == "SUP-06"
    assert rankings[0].score == 100
    assert rankings[0].score_breakdown.w1 == 0.0


def test_weights_overridable_by_argument(battery_candidates):
    rankings = solve_replacement_sourcing(
        SKU_BAT, 80, battery_candidates, 9_300_000, 27,
        w_cost=0.0, w_leadtime=1.0, w_reliability=0.0,
    )
    assert rankings[0].supplier_id == "SUP-06"


def test_empty_candidate_list_returns_empty():
    assert solve_replacement_sourcing(SKU_BAT, 10, [], 100, 20) == []


def test_pros_cons_reasoning_left_empty_for_llm_phase(battery_candidates):
    for r in solve_replacement_sourcing(SKU_BAT, 80, battery_candidates, 9_300_000, 27):
        assert r.pros == []
        assert r.cons == []
        assert r.reasoning == ""


def test_rankings_serialise_with_frontend_alias_keys(battery_candidates):
    ranking = solve_replacement_sourcing(SKU_BAT, 80, battery_candidates, 9_300_000, 27)[0]
    assert isinstance(ranking, ProposalRanking)
    payload = ranking.model_dump(by_alias=True)
    assert set(payload) == {
        "rank", "supplierId", "supplierName", "unitPrice", "totalCost",
        "leadTimeDays", "pros", "cons", "score", "scoreBreakdown", "reasoning",
    }
    assert set(payload["scoreBreakdown"]) == {
        "normalizedCost", "normalizedLeadTime", "supplierReliabilityScore",
        "w1", "w2", "w3",
        "costScoreContribution", "timeScoreContribution", "reliabilityContribution",
    }


def test_candidate_without_price_for_sku_falls_back_to_original_price():
    candidate = Supplier(id="SUP-X", name="X", average_lead_time_days=20, reliability_score=70)
    ranking = solve_replacement_sourcing(SKU_BAT, 5, [candidate], 1_000, 20)[0]
    assert ranking.unit_price == 1_000
    assert ranking.total_cost == 5_000
