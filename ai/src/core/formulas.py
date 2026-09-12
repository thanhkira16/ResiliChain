"""Dong co toan hoc thuan tuy cua BikeSync AI Engine (plan/03).

QUY TAC CUA MODULE NAY
----------------------
* KHONG DB, KHONG HTTP, KHONG file I/O. Tat ca deu la pure function.
* KHONG hardcode trong so / nguong -- doc tu ``settings``; moi ham deu cho phep
  ghi de bang tham so de test.
* Moi phep chia deu duoc chan mau so 0; moi factor deu clamp ve [0, 1].

Cac con so vang (golden numbers) trong plan/04 §3 duoc tai lap boi
``tests/test_formulas.py``. Thuat toan lam tron bam sat ``ai/seed_ai_data.sql``
(Postgres ``round()`` la half-away-from-zero, khong phai banker's rounding cua
Python) de ket qua cua worker khop tuyet doi voi du lieu seed.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from decimal import ROUND_HALF_UP, Decimal

from src.core.config import settings
from src.core.contracts import RiskBreakdown, RiskLevel

__all__ = [
    "Z_COEFF",
    "Z_DISTRESS",
    "Z_SAFE",
    "altman_z",
    "altman_z_components",
    "altman_zone",
    "clamp01",
    "delay_risk_score",
    "inventory_buffer_factor",
    "lateness_factor",
    "pors_score",
    "risk_level",
    "round_half_up",
    "safe_div",
    "ssi_del_from_history",
    "supplier_reliability_factor",
    "z_to_ssi_fin",
]


# --------------------------------------------------------------------------
# Tien ich so hoc
# --------------------------------------------------------------------------


def round_half_up(value: float, digits: int = 0) -> float:
    """Lam tron half-away-from-zero giong ``round()`` cua Postgres.

    Python dung banker's rounding (``round(0.5) == 0``) nen khong the dung truc
    tiep neu muon khop voi ``seed_ai_data.sql``.
    """
    quant = Decimal(1).scaleb(-digits)
    return float(Decimal(repr(float(value))).quantize(quant, rounding=ROUND_HALF_UP))


def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Chia co chan mau so 0 (tuong duong ``NULLIF(denominator, 0)`` trong SQL)."""
    if denominator == 0:
        return default
    return numerator / denominator


def clamp01(value: float) -> float:
    """Ep gia tri ve doan [0.0, 1.0]."""
    if value != value:  # NaN
        return 0.0
    return max(0.0, min(1.0, float(value)))


def _clamp(value: float, low: float, high: float) -> float:
    if value != value:  # NaN
        return low
    return max(low, min(high, float(value)))


# --------------------------------------------------------------------------
# 1. delayRiskScore va 3 thanh phan (plan/03 §1)
# --------------------------------------------------------------------------


def lateness_factor(
    delay_days: float,
    weather_delay_forecast: float = 0.0,
    promised_lead_time_days: float = 0.0,
) -> float:
    """``min(1, (delayDays + weatherDelayForecast) / promisedLeadTimeDays)``.

    Lead time <= 0 (du lieu ERP thieu) -> 0.0 thay vi chia cho 0.
    Ket qua luon nam trong [0, 1].
    """
    total_delay = float(delay_days) + float(weather_delay_forecast)
    if promised_lead_time_days <= 0:
        return 0.0
    return clamp01(safe_div(total_delay, float(promised_lead_time_days), 0.0))


def supplier_reliability_factor(
    reliability_score: float,
    penalty_fin: float = 0.0,
    penalty_news: float = 0.0,
) -> float:
    """``clamp(0, 1, 1 - (reliability - penaltyFin - penaltyNews) / 100)``.

    ``reliability_score`` theo thang 0-100 cua ERP. Penalty cang lon -> uy tin
    dieu chinh cang thap -> factor rui ro cang cao.
    """
    adjusted = float(reliability_score) - float(penalty_fin) - float(penalty_news)
    return clamp01(1.0 - adjusted / 100.0)


def inventory_buffer_factor(current_stock: float, safety_stock: float) -> float:
    """``clamp(0, 1, 1 - currentStock / safetyStock)``.

    ``safety_stock <= 0`` -> khong the tinh vung dem, tra ve 0.0 (khong phat).
    """
    if safety_stock <= 0:
        return 0.0
    return clamp01(1.0 - safe_div(float(current_stock), float(safety_stock), 0.0))


def delay_risk_score(
    *,
    delay_days: int,
    committed_lead_time_days: int,
    current_stock: int,
    safety_stock: int,
    reliability_score: float,
    weather_delay_forecast: float = 0.0,
    penalty_fin: float = 0.0,
    penalty_news: float = 0.0,
    w1: float | None = None,
    w2: float | None = None,
    w3: float | None = None,
) -> tuple[int, RiskBreakdown]:
    """Diem rui ro tre han 0-100 + ``RiskBreakdown`` day du de ghi xuong DB.

    ``delayRiskScore = round(100 * (w1*lateness + w2*reliability + w3*buffer))``

    Cac factor duoc lam tron 4 chu so THUOC DOI (giong ``seed_ai_data.sql``)
    TRUOC khi nhan trong so, nen diem tra ve khop tuyet doi voi du lieu seed.
    """
    w1 = settings.risk_w1_lateness if w1 is None else w1
    w2 = settings.risk_w2_reliability if w2 is None else w2
    w3 = settings.risk_w3_inventory if w3 is None else w3

    lateness = round_half_up(
        lateness_factor(delay_days, weather_delay_forecast, committed_lead_time_days), 4
    )
    reliability = round_half_up(
        supplier_reliability_factor(reliability_score, penalty_fin, penalty_news), 4
    )
    buffer = round_half_up(inventory_buffer_factor(current_stock, safety_stock), 4)

    score = int(round_half_up(100.0 * (w1 * lateness + w2 * reliability + w3 * buffer), 0))

    explanation = (
        f"Score = ({w1:.2f} × {lateness:.4f}) + ({w2:.2f} × {reliability:.4f})"
        f" + ({w3:.2f} × {buffer:.4f}) = {score}/100."
        f" Trễ {delay_days} ngày trên lead time cam kết {committed_lead_time_days} ngày;"
        f" tồn kho {current_stock}/{safety_stock}."
    )
    if weather_delay_forecast:
        explanation += f" Dự báo thời tiết cộng thêm {weather_delay_forecast:.1f} ngày."

    breakdown = RiskBreakdown(
        lateness_factor=lateness,
        supplier_reliability_factor=reliability,
        inventory_buffer_factor=buffer,
        w1=w1,
        w2=w2,
        w3=w3,
        delay_days=int(delay_days),
        committed_lead_time_days=int(committed_lead_time_days),
        current_stock=int(current_stock),
        safety_stock=int(safety_stock),
        formula_explanation=explanation,
    )
    return score, breakdown


# --------------------------------------------------------------------------
# 2. Altman Z-Score & SSI_fin (plan/03 §2)
# --------------------------------------------------------------------------

#: He so Altman Z-Score ban goc cho doanh nghiep san xuat niem yet.
Z_COEFF: dict[str, float] = {"X1": 1.2, "X2": 1.4, "X3": 3.3, "X4": 0.6, "X5": 0.999}

#: Nguong dien giai vung Altman Z chuan.
Z_DISTRESS: float = 1.81
Z_SAFE: float = 2.99


def altman_z_components(
    *,
    working_capital: float | None,
    retained_earnings: float | None,
    ebit: float | None,
    market_cap: float | None,
    revenue: float | None,
    total_assets: float | None,
    total_liabilities: float | None,
) -> dict[str, float]:
    """5 bien X1..X5 (lam tron 4 so) -- rong neu thieu mau so."""
    if not total_assets or not total_liabilities:
        return {}
    x = {
        "X1": (working_capital or 0.0) / total_assets,
        "X2": (retained_earnings or 0.0) / total_assets,
        "X3": (ebit or 0.0) / total_assets,
        "X4": (market_cap or 0.0) / total_liabilities,
        "X5": (revenue or 0.0) / total_assets,
    }
    return {k: round(v, 4) for k, v in x.items()}


def altman_z(
    *,
    working_capital: float | None,
    retained_earnings: float | None,
    ebit: float | None,
    market_cap: float | None,
    revenue: float | None,
    total_assets: float | None,
    total_liabilities: float | None,
) -> float | None:
    """``Z = 1.2X1 + 1.4X2 + 3.3X3 + 0.6X4 + 0.999X5``.

    Thuat toan giu nguyen ``apidata/fmp_supplier_financials.compute_altman_z``
    (da verify voi du lieu FMP that): thieu ``total_assets`` hoac
    ``total_liabilities`` -> ``None`` thay vi chia cho 0.
    """
    if not total_assets or not total_liabilities:
        return None
    x = {
        "X1": (working_capital or 0.0) / total_assets,
        "X2": (retained_earnings or 0.0) / total_assets,
        "X3": (ebit or 0.0) / total_assets,
        "X4": (market_cap or 0.0) / total_liabilities,
        "X5": (revenue or 0.0) / total_assets,
    }
    return sum(Z_COEFF[k] * v for k, v in x.items())


def z_to_ssi_fin(z: float | None) -> float | None:
    """Quy Altman Z ve thang rui ro 0-100 (cang cao cang nguy hiem).

    Giu nguyen thuat toan da verify o ``apidata/fmp_supplier_financials.py``:
    Z <= 1.81 -> >= 70 (vung kiet que, phat them 8 diem moi don vi Z, tran 100);
    Z >= 2.99 -> <= 40 (vung an toan, san 5);
    vung xam -> noi suy tuyen tinh 70 -> 40.
    """
    if z is None:
        return None
    if z <= Z_DISTRESS:
        return round(min(100.0, 70.0 + (Z_DISTRESS - z) * 8.0), 2)
    if z >= Z_SAFE:
        return round(max(5.0, 40.0 - (z - Z_SAFE) * 3.0), 2)
    ratio = (z - Z_DISTRESS) / (Z_SAFE - Z_DISTRESS)
    return round(70.0 - ratio * 30.0, 2)


def altman_zone(z: float | None) -> str:
    """``DISTRESS`` (Z <= 1.81) / ``GREY`` / ``SAFE`` (Z >= 2.99) / ``UNKNOWN``."""
    if z is None:
        return "UNKNOWN"
    if z <= Z_DISTRESS:
        return "DISTRESS"
    return "GREY" if z < Z_SAFE else "SAFE"


# --------------------------------------------------------------------------
# 3. PORS (plan/03 §3)
# --------------------------------------------------------------------------


def pors_score(
    ssi_news: float | None,
    ssi_fin: float | None,
    ssi_del: float | None,
    g_geo: float | None,
    *,
    w_news: float | None = None,
    w_fin: float | None = None,
    w_del: float | None = None,
    w_geo: float | None = None,
) -> float:
    """``PORS = 0.35*SSI_news + 0.30*SSI_fin + 0.20*SSI_del + 0.15*G_geo``.

    Thanh phan ``None`` duoc coi la 0 (giong ``COALESCE`` trong seed SQL);
    ket qua lam tron 2 so va clamp ve [0, 100].
    """
    w_news = settings.pors_w_news if w_news is None else w_news
    w_fin = settings.pors_w_fin if w_fin is None else w_fin
    w_del = settings.pors_w_del if w_del is None else w_del
    w_geo = settings.pors_w_geo if w_geo is None else w_geo

    raw = (
        w_news * float(ssi_news or 0.0)
        + w_fin * float(ssi_fin or 0.0)
        + w_del * float(ssi_del or 0.0)
        + w_geo * float(g_geo or 0.0)
    )
    return round_half_up(_clamp(raw, 0.0, 100.0), 2)


def risk_level(
    pors: float | None,
    *,
    high_threshold: float | None = None,
    medium_threshold: float | None = None,
) -> RiskLevel:
    """Phan loai PORS -> CAO / TRUNG BINH / THAP.

    Nguong mac dinh doc tu ``settings`` (55 / 40 -- plan/04 §6 "Hieu chinh
    nguong": PORS >= 70 khong bao gio dat duoc voi du lieu that).
    """
    high = settings.pors_high_threshold if high_threshold is None else high_threshold
    medium = settings.pors_medium_threshold if medium_threshold is None else medium_threshold
    value = float(pors or 0.0)
    if value >= high:
        return RiskLevel.HIGH
    if value >= medium:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


# --------------------------------------------------------------------------
# 4. SSI_del suy tu lich su giao hang ERP
# --------------------------------------------------------------------------


def ssi_del_from_history(
    deliveries: Iterable[Sequence[float]] | Iterable[tuple[float, float]],
    *,
    reliability_score: float | None = None,
) -> float | None:
    """SSI_del (0-100, cang cao cang rui ro) suy tu lich su giao hang ERP.

    DINH NGHIA (bam sat ``seed_ai_data.sql`` muc 2 -- nguon su that)::

        SSI_del = clamp(0, 100, 100 * mean_i( delayDays_i / committedLeadTime_i ))

    Tuc la "ty le tre trung binh tinh theo do dai lead time cam ket". Mot don
    giao dung han hoac som dong gop ty le <= 0; mot don tre bang dung lead time
    cam ket dong gop 1.0 (= 100 diem rui ro). Nhin nguoc lai, ty le dung han
    (on-time ratio) cua nha cung ung cang cao thi trung binh nay cang gan 0 va
    SSI_del cang thap.

    ``deliveries``: cac cap ``(delay_days, committed_lead_time_days)``.
    Ban ghi co ``committed_lead_time_days <= 0`` bi BO QUA (tuong duong
    ``NULLIF(..., 0)`` trong SQL) thay vi chia cho 0.

    Khong con ban ghi hop le nao -> fallback ``100 - reliability_score`` (nghich
    dao uy tin ERP) neu duoc cung cap, nguoc lai ``None``.
    """
    ratios: list[float] = []
    for row in deliveries:
        delay, lead = float(row[0]), float(row[1])
        if lead <= 0:
            continue
        ratios.append(delay / lead)

    if not ratios:
        if reliability_score is None:
            return None
        return round_half_up(_clamp(100.0 - float(reliability_score), 0.0, 100.0), 2)

    mean_ratio = sum(ratios) / len(ratios)
    return round_half_up(_clamp(100.0 * mean_ratio, 0.0, 100.0), 2)
