"""Golden tests cho src/core/formulas.py -- so lieu lay tu plan/04 §3 va seed SQL."""

from __future__ import annotations

import math

import pytest

from src.core.config import settings
from src.core.contracts import RiskLevel
from src.core.formulas import (
    altman_z,
    altman_zone,
    clamp01,
    delay_risk_score,
    inventory_buffer_factor,
    lateness_factor,
    pors_score,
    risk_level,
    round_half_up,
    safe_div,
    ssi_del_from_history,
    supplier_reliability_factor,
    z_to_ssi_fin,
)

# --------------------------------------------------------------------------
# GOLDEN #1 -- risk_breakdown mau trong plan/04 §3
#   latenessFactor 0.5556, supplierReliabilityFactor 0.32, inventoryBufferFactor 0.4833
#   delayDays 15, committedLeadTimeDays 27, currentStock 31, safetyStock 60 -> 48/100
# --------------------------------------------------------------------------

GOLDEN_RISK_INPUT = {
    "delay_days": 15,
    "committed_lead_time_days": 27,
    "current_stock": 31,
    "safety_stock": 60,
    "reliability_score": 68,  # 1 - 68/100 = 0.32
}


def test_golden_risk_breakdown_scores_48():
    score, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT)

    assert score == 48
    assert breakdown.lateness_factor == 0.5556
    assert breakdown.supplier_reliability_factor == 0.32
    assert breakdown.inventory_buffer_factor == 0.4833
    assert (breakdown.w1, breakdown.w2, breakdown.w3) == (0.50, 0.25, 0.25)
    assert breakdown.delay_days == 15
    assert breakdown.committed_lead_time_days == 27
    assert breakdown.current_stock == 31
    assert breakdown.safety_stock == 60


def test_golden_formula_explanation_matches_documented_style():
    _, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT)
    assert breakdown.formula_explanation.startswith(
        "Score = (0.50 × 0.5556) + (0.25 × 0.3200) + (0.25 × 0.4833) = 48/100."
    )
    assert "Trễ 15 ngày" in breakdown.formula_explanation
    assert "tồn kho 31/60" in breakdown.formula_explanation


def test_risk_breakdown_serialises_with_frontend_alias_keys():
    _, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT)
    payload = breakdown.model_dump(by_alias=True)
    assert set(payload) == {
        "latenessFactor",
        "supplierReliabilityFactor",
        "inventoryBufferFactor",
        "w1",
        "w2",
        "w3",
        "delayDays",
        "committedLeadTimeDays",
        "currentStock",
        "safetyStock",
        "formulaExplanation",
    }


def test_delay_risk_weights_come_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "risk_w1_lateness", 1.0)
    monkeypatch.setattr(settings, "risk_w2_reliability", 0.0)
    monkeypatch.setattr(settings, "risk_w3_inventory", 0.0)
    score, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT)
    assert score == 56  # 100 * 0.5556
    assert (breakdown.w1, breakdown.w2, breakdown.w3) == (1.0, 0.0, 0.0)


def test_delay_risk_weights_overridable_by_argument():
    score, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT, w1=1.0, w2=0.0, w3=0.0)
    assert score == 56
    assert breakdown.w1 == 1.0


def test_weather_forecast_pushes_lateness_and_annotates_explanation():
    score, breakdown = delay_risk_score(**GOLDEN_RISK_INPUT, weather_delay_forecast=3.0)
    assert breakdown.lateness_factor == round_half_up(18 / 27, 4)
    assert score > 48
    assert "thời tiết" in breakdown.formula_explanation


# --------------------------------------------------------------------------
# Cac factor: clamp + chan chia 0
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("delay", "weather", "lead", "expected"),
    [
        (15, 0, 27, 15 / 27),
        (40, 0, 27, 1.0),  # clamp tran
        (-5, 0, 27, 0.0),  # giao som -> clamp san
        (10, 5, 30, 0.5),  # cong du bao thoi tiet
        (10, 0, 0, 0.0),  # chan chia 0
        (10, 0, -3, 0.0),  # lead time am -> 0
    ],
)
def test_lateness_factor(delay, weather, lead, expected):
    assert lateness_factor(delay, weather, lead) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("reliability", "pen_fin", "pen_news", "expected"),
    [
        (68, 0, 0, 0.32),
        (100, 0, 0, 0.0),
        (0, 0, 0, 1.0),
        (150, 0, 0, 0.0),  # clamp san
        (-20, 0, 0, 1.0),  # clamp tran
        (80, 10, 10, 0.4),  # penalty FMP + GDELT
        (30, 50, 50, 1.0),  # penalty qua lon -> clamp tran
    ],
)
def test_supplier_reliability_factor(reliability, pen_fin, pen_news, expected):
    assert supplier_reliability_factor(reliability, pen_fin, pen_news) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("stock", "safety", "expected"),
    [
        (31, 60, 1 - 31 / 60),
        (60, 60, 0.0),
        (0, 60, 1.0),
        (120, 60, 0.0),  # thua kho -> clamp san
        (10, 0, 0.0),  # chan chia 0
        (10, -5, 0.0),
    ],
)
def test_inventory_buffer_factor(stock, safety, expected):
    assert inventory_buffer_factor(stock, safety) == pytest.approx(expected)


def test_clamp_and_safe_div_helpers():
    assert clamp01(1.5) == 1.0
    assert clamp01(-0.2) == 0.0
    assert clamp01(math.nan) == 0.0
    assert safe_div(1, 0) == 0.0
    assert safe_div(1, 0, default=1.0) == 1.0
    assert round_half_up(0.5) == 1.0  # KHAC banker's rounding cua Python
    assert round_half_up(47.8625, 0) == 48.0


def test_delay_risk_score_survives_completely_empty_erp_row():
    score, breakdown = delay_risk_score(
        delay_days=0,
        committed_lead_time_days=0,
        current_stock=0,
        safety_stock=0,
        reliability_score=100,
    )
    assert score == 0
    assert breakdown.lateness_factor == 0.0


# --------------------------------------------------------------------------
# GOLDEN #2 -- PORS cua SUP-01 Ford Motor = 58.03 (plan/04 §6)
#   ssi_news 55.9, ssi_fin 77.7, g_geo 51.0 (apidata/out/supplier_risk_fixture.json)
#   ssi_del 37.53 suy tu lich su giao hang ERP
# --------------------------------------------------------------------------


def test_golden_pors_ford_motor_is_58_03():
    assert pors_score(55.9, 77.7, 37.53, 51.0) == 58.03


def test_golden_pors_ford_is_highest_and_classified_high():
    pors = pors_score(55.9, 77.7, 37.53, 51.0)
    assert risk_level(pors) is RiskLevel.HIGH
    assert pors < 70.0  # plan/04: nguong 70 khong bao gio dat duoc voi du lieu that


def test_pors_treats_missing_components_as_zero():
    assert pors_score(None, None, None, None) == 0.0
    assert pors_score(100, None, None, None) == 35.0


def test_pors_weights_come_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "pors_w_news", 1.0)
    monkeypatch.setattr(settings, "pors_w_fin", 0.0)
    monkeypatch.setattr(settings, "pors_w_del", 0.0)
    monkeypatch.setattr(settings, "pors_w_geo", 0.0)
    assert pors_score(55.9, 77.7, 37.53, 51.0) == 55.9


def test_pors_clamped_to_100():
    assert pors_score(200, 200, 200, 200) == 100.0


@pytest.mark.parametrize(
    ("pors", "expected"),
    [
        (58.03, RiskLevel.HIGH),
        (55.0, RiskLevel.HIGH),
        (54.99, RiskLevel.MEDIUM),
        (40.0, RiskLevel.MEDIUM),
        (39.99, RiskLevel.LOW),
        (0.0, RiskLevel.LOW),
        (None, RiskLevel.LOW),
    ],
)
def test_risk_level_thresholds_55_40(pors, expected):
    assert risk_level(pors) is expected


def test_risk_level_thresholds_come_from_settings(monkeypatch):
    assert settings.pors_high_threshold == 55.0
    assert settings.pors_medium_threshold == 40.0
    monkeypatch.setattr(settings, "pors_high_threshold", 70.0)
    monkeypatch.setattr(settings, "pors_medium_threshold", 60.0)
    assert risk_level(58.03) is RiskLevel.LOW
    assert risk_level(58.03, high_threshold=55.0, medium_threshold=40.0) is RiskLevel.HIGH


# --------------------------------------------------------------------------
# SSI_del tu lich su giao hang ERP
# --------------------------------------------------------------------------


def test_ssi_del_is_mean_relative_lateness_times_100():
    # 15/27 va 0/30 -> mean 0.2778 -> 27.78
    assert ssi_del_from_history([(15, 27), (0, 30)]) == 27.78


def test_ssi_del_clamped_and_ignores_zero_lead_time():
    assert ssi_del_from_history([(-10, 20)]) == 0.0  # giao som -> 0
    assert ssi_del_from_history([(100, 10)]) == 100.0  # tran 100
    assert ssi_del_from_history([(5, 0), (10, 20)]) == 50.0  # bo qua lead=0


def test_ssi_del_falls_back_to_inverse_reliability_without_history():
    assert ssi_del_from_history([], reliability_score=68) == 32.0
    assert ssi_del_from_history([(5, 0)], reliability_score=68) == 32.0
    assert ssi_del_from_history([]) is None


def test_ssi_del_component_implied_by_golden_pors_of_ford():
    """Nguoc tu PORS vang 58.03 ra SSI_del ma lich su giao hang cua Ford phai cho.

    58.03 = 0.35*55.9 + 0.30*77.7 + 0.20*SSI_del + 0.15*51.0  ->  SSI_del = 37.525.
    Kiem tra rang dinh nghia ``ssi_del_from_history`` (trung binh ty le tre theo
    lead time cam ket) that su sinh ra duoc gia tri do tu lich su PO cua Ford.
    """
    implied = (58.03 - (0.35 * 55.9 + 0.30 * 77.7 + 0.15 * 51.0)) / 0.20
    assert implied == pytest.approx(37.525, abs=0.05)

    ssi_del = ssi_del_from_history([(15, 27), (3, 15)])  # (0.5556 + 0.2) / 2
    assert ssi_del == 37.78
    assert pors_score(55.9, 77.7, 37.525, 51.0) == 58.03
    assert pors_score(55.9, 77.7, 37.53, 51.0) == 58.03


# --------------------------------------------------------------------------
# Altman Z / SSI_fin -- doi chieu apidata/out/supplier_risk_fixture.json
# --------------------------------------------------------------------------

ALTMAN_ARGS = {
    "working_capital": 20_000.0,
    "retained_earnings": 10_000.0,
    "ebit": 5_000.0,
    "market_cap": 50_000.0,
    "revenue": 180_000.0,
    "total_assets": 100_000.0,
    "total_liabilities": 80_000.0,
}


def test_altman_z_matches_documented_coefficients():
    expected = 1.2 * 0.2 + 1.4 * 0.1 + 3.3 * 0.05 + 0.6 * 0.625 + 0.999 * 1.8
    assert altman_z(**ALTMAN_ARGS) == pytest.approx(expected)


def test_altman_z_guards_zero_denominators():
    assert altman_z(**{**ALTMAN_ARGS, "total_assets": 0}) is None
    assert altman_z(**{**ALTMAN_ARGS, "total_liabilities": None}) is None


@pytest.mark.parametrize(
    ("z", "zone"),
    [(-4.49, "DISTRESS"), (1.81, "DISTRESS"), (1.82, "GREY"), (2.98, "GREY"),
     (2.99, "SAFE"), (15.58, "SAFE"), (None, "UNKNOWN")],
)
def test_altman_zone_boundaries(z, zone):
    assert altman_zone(z) == zone


def test_z_to_ssi_fin_reproduces_fixture_values():
    # apidata/out/supplier_risk_fixture.json -- fixture luu SSI_fin o 1 chu so
    # thap phan (77.7 / 95.4), ham nay tra ve 2 chu so (77.68 / 95.44).
    assert z_to_ssi_fin(-4.49) == 100.0  # Lucid Motors, tran 100
    assert z_to_ssi_fin(0.85) == pytest.approx(77.7, abs=0.05)  # Ford Motor
    assert z_to_ssi_fin(-1.37) == pytest.approx(95.4, abs=0.05)  # Rivian
    assert z_to_ssi_fin(15.58) == 5.0  # Tesla, san 5
    assert z_to_ssi_fin(None) is None


def test_z_to_ssi_fin_grey_zone_is_linear_70_to_40():
    assert z_to_ssi_fin(1.81) == 70.0
    assert z_to_ssi_fin(2.99) == 40.0
    assert z_to_ssi_fin((1.81 + 2.99) / 2) == pytest.approx(55.0, abs=0.01)
