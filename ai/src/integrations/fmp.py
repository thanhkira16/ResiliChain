"""Agent 3 -- Financial Health. Client Financial Modeling Prep (stable).

Refactor tu `apidata/fmp_supplier_financials.py`. Module nay CHI lo viec **lay 5 bien
tho** cua Altman Z (X1..X5); phan toan (`altman_z`, `z_to_ssi_fin`, `altman_zone`)
thuoc `src/core/formulas.py` do Phase 2 so huu va duoc import LAZY ben trong ham.

Han ngach FMP tinh theo NGAY (~250 request goi free) va tra 429 "Limit Reach" khi can --
KHONG phai loi tam thoi. Vi vay: (1) chi goi 2 endpoint/nha cung ung khi du du lieu,
(2) cache dia bat buoc, (3) 429/402 -> stale, khong retry vo ich.
"""

from __future__ import annotations

import inspect
from typing import Any

from src.core.config import settings
from src.core.contracts import FinancialResult
from src.core.logging import get_logger
from src.integrations.http import HttpClient, HttpError

logger = get_logger(__name__)

BASE_URL = "https://financialmodelingprep.com/stable"

# He so Altman Z-Score ban goc cho doanh nghiep san xuat niem yet (cong thuc 5.2)
Z_COEFF = {"X1": 1.2, "X2": 1.4, "X3": 3.3, "X4": 0.6, "X5": 0.999}
Z_DISTRESS, Z_SAFE = 1.81, 2.99

#: FMP rate limit goi free ~ 300 req/phut nhung nut that that su la han ngach ngay.
FMP_RATE_LIMIT_RPM = 45
#: Bao cao tai chinh doi theo quy -> cache dai hon TTL mac dinh.
FMP_CACHE_TTL_SECONDS = 12 * 3600

_client: HttpClient | None = None


def get_client() -> HttpClient:
    global _client
    if _client is None:
        _client = HttpClient(
            BASE_URL,
            namespace="fmp",
            rate_limit_rpm=FMP_RATE_LIMIT_RPM,
            cache_ttl_seconds=FMP_CACHE_TTL_SECONDS,
            # 429 = het han ngach ngay, khong phai loi tam thoi -> dung thu lai.
            retry_on_rate_limit=False,
        )
    return _client


def reset_client() -> None:
    global _client
    if _client is not None:
        _client.close()
    _client = None


# ---------------------------------------------------------------------------
# Toan hoc: uu tien src.core.formulas (Phase 2), fallback giu nguyen cong thuc goc
# ---------------------------------------------------------------------------


def _fallback_altman_z(x1: float, x2: float, x3: float, x4: float, x5: float) -> float:
    return (Z_COEFF["X1"] * x1 + Z_COEFF["X2"] * x2 + Z_COEFF["X3"] * x3
            + Z_COEFF["X4"] * x4 + Z_COEFF["X5"] * x5)


def _fallback_z_to_ssi_fin(z: float | None) -> float | None:
    """Quy Altman Z ve thang rui ro 0-100 (cang cao cang nguy hiem)."""
    if z is None:
        return None
    if z <= Z_DISTRESS:
        return round(min(100.0, 70.0 + (Z_DISTRESS - z) * 8.0), 2)
    if z >= Z_SAFE:
        return round(max(5.0, 40.0 - (z - Z_SAFE) * 3.0), 2)
    ratio = (z - Z_DISTRESS) / (Z_SAFE - Z_DISTRESS)
    return round(70.0 - ratio * 30.0, 2)


def _fallback_altman_zone(z: float | None) -> str:
    if z is None:
        return "UNKNOWN"
    if z <= Z_DISTRESS:
        return "DISTRESS"
    return "GREY" if z < Z_SAFE else "SAFE"


def _load_formulas() -> tuple[Any, Any, Any]:
    """Import lazy: `src/core/formulas.py` do Phase 2 so huu, co the chua ton tai."""
    try:
        from src.core import formulas  # type: ignore

        return (
            getattr(formulas, "altman_z", _fallback_altman_z),
            getattr(formulas, "z_to_ssi_fin", _fallback_z_to_ssi_fin),
            getattr(formulas, "altman_zone", _fallback_altman_zone),
        )
    except ImportError:
        return _fallback_altman_z, _fallback_z_to_ssi_fin, _fallback_altman_zone


def compute_z(raw: dict, altman_z_fn: Any | None = None) -> float | None:
    """Goi `altman_z` cua Phase 2, chap nhan ca 2 dang chu ky ham.

    Phase 2 nhan 7 bien tho theo keyword (`working_capital=...`); ban fallback nhan
    5 ty so X1..X5 theo vi tri. Do 2 module duoc viet song song nen o day dung
    `inspect` de chon dung dang, thay vi ep mot ben phai doi.
    """
    altman_z_fn = altman_z_fn or _load_formulas()[0]
    if altman_z_fn is None:  # khong nen xay ra: _load_formulas luon co fallback
        return None
    try:
        params = set(inspect.signature(altman_z_fn).parameters)
    except (TypeError, ValueError):  # pragma: no cover - ham C/builtin
        params = set()

    if "working_capital" in params:
        return altman_z_fn(
            working_capital=raw.get("workingCapital"),
            retained_earnings=raw.get("retainedEarnings"),
            ebit=raw.get("ebit"),
            market_cap=raw.get("marketCap"),
            revenue=raw.get("revenue"),
            total_assets=raw.get("totalAssets"),
            total_liabilities=raw.get("totalLiabilities"),
        )

    components = altman_components(raw)
    if components is None:
        return None
    return altman_z_fn(components["X1"], components["X2"], components["X3"],
                       components["X4"], components["X5"])


# ---------------------------------------------------------------------------
# Lay 5 bien tho
# ---------------------------------------------------------------------------


def _first(data: Any) -> dict:
    """FMP tra list; lay ban ghi moi nhat."""
    return data[0] if isinstance(data, list) and data else {}


def fetch_raw_inputs(ticker: str, client: HttpClient | None = None) -> tuple[dict, list[str]]:
    """Tra ve (raw, errors) voi raw chua 5 bien tho + working capital + market cap.

    `/financial-scores` da tra du 5 bien. Chi goi them 2 bao cao tai chinh khi no
    thieu, de tiet kiem han ngach theo ngay.
    """
    client = client or get_client()
    errors: list[str] = []
    key = {"apikey": settings.fmp_api_key}

    def _get(endpoint: str, params: dict) -> Any:
        # apikey nam trong query nhung KHONG duoc vao khoa cache (key doi -> cache van dung).
        try:
            return client.get_json(endpoint, {**params, **key}, cache_params=params)
        except HttpError as exc:
            if exc.status_code == 429:
                errors.append(f"{endpoint}: 429 het han ngach FMP trong ngay")
            elif exc.status_code == 402:
                errors.append(f"{endpoint}: 402 Payment Required (ticker ngoai goi hien tai)")
            else:
                errors.append(f"{endpoint}: {exc}")
            return None

    scores = _first(_get("financial-scores", {"symbol": ticker}))

    balance: dict = {}
    income: dict = {}
    needed = ("totalAssets", "totalLiabilities", "retainedEarnings", "ebit", "revenue")
    if any(scores.get(k) is None for k in needed):
        balance = _first(_get("balance-sheet-statement", {"symbol": ticker, "limit": 1}))
        income = _first(_get("income-statement", {"symbol": ticker, "limit": 1}))

    total_assets = scores.get("totalAssets") or balance.get("totalAssets") or 0
    total_liabilities = scores.get("totalLiabilities") or balance.get("totalLiabilities") or 0
    working_capital = scores.get("workingCapital")
    if working_capital is None:
        working_capital = ((balance.get("totalCurrentAssets") or 0)
                           - (balance.get("totalCurrentLiabilities") or 0))

    raw = {
        "workingCapital": working_capital,
        "totalAssets": total_assets,
        "totalLiabilities": total_liabilities,
        "retainedEarnings": (scores.get("retainedEarnings")
                             or balance.get("retainedEarnings") or 0),
        "ebit": scores.get("ebit") or income.get("operatingIncome") or 0,
        "marketCap": scores.get("marketCap") or 0,
        "revenue": scores.get("revenue") or income.get("revenue") or 0,
        "altmanZScoreReported": scores.get("altmanZScore"),
        "piotroskiScore": scores.get("piotroskiScore"),
        "fiscalDate": balance.get("date") or scores.get("date"),
    }
    return raw, errors


def altman_components(raw: dict) -> dict[str, float] | None:
    """5 bien X1..X5. `None` khi thieu totalAssets/totalLiabilities (khong chia duoc)."""
    total_assets = raw.get("totalAssets") or 0
    total_liabilities = raw.get("totalLiabilities") or 0
    if not total_assets or not total_liabilities:
        return None
    return {
        "X1": (raw.get("workingCapital") or 0) / total_assets,
        "X2": (raw.get("retainedEarnings") or 0) / total_assets,
        "X3": (raw.get("ebit") or 0) / total_assets,
        "X4": (raw.get("marketCap") or 0) / total_liabilities,
        "X5": (raw.get("revenue") or 0) / total_assets,
    }


# ---------------------------------------------------------------------------
# API cong khai
# ---------------------------------------------------------------------------


def fetch_financials(
    supplier_id: str,
    ticker: str,
    client: HttpClient | None = None,
) -> FinancialResult:
    """Tra ve `FinancialResult` (altman_z, ssi_fin, zone).

    KHONG BAO GIO nem ngoai le: API chet / het han ngach -> `stale=True`,
    `ssi_fin` trung tinh 50.0 va `zone="UNKNOWN"`.
    """
    altman_z_fn, z_to_ssi_fin_fn, altman_zone_fn = _load_formulas()

    def _stale(reason: str) -> FinancialResult:
        logger.warning("fmp_unavailable", extra={"supplier_id": supplier_id,
                                                 "ticker": ticker, "reason": reason[:200]})
        return FinancialResult(supplier_id=supplier_id, ticker=ticker, altman_z=None,
                               ssi_fin=50.0, zone="UNKNOWN", stale=True)

    try:
        raw, errors = fetch_raw_inputs(ticker, client)
    except Exception as exc:  # noqa: BLE001 - co y nuot: worker phai song sot
        return _stale(str(exc))

    z = compute_z(raw, altman_z_fn)
    if z is None:
        # Chi tin `altmanZScore` FMP tra san khi khong tu tinh lai duoc tu 5 bien tho.
        reported = raw.get("altmanZScoreReported")
        z = float(reported) if isinstance(reported, (int, float)) else None

    if z is None:
        return _stale("; ".join(errors) or "thieu totalAssets/totalLiabilities")

    ssi_fin = z_to_ssi_fin_fn(z)
    if ssi_fin is None:
        return _stale("z_to_ssi_fin tra None")

    if errors:
        logger.warning("fmp_partial", extra={"supplier_id": supplier_id, "errors": errors})

    return FinancialResult(
        supplier_id=supplier_id,
        ticker=ticker,
        altman_z=round(float(z), 3),
        ssi_fin=float(ssi_fin),
        zone=altman_zone_fn(z),
        stale=False,
    )
