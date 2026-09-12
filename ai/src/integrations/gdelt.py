"""Agent 2 -- News & Geopolitical Risk. Client GDELT Cloud API v2.

Refactor tu `apidata/gdelt_supplier_risk.py`. **Thuat toan giu nguyen 100%**
(`tone_score`, `volume_impact`, `geo_risk_penalty`, trong so 0.50/0.25/0.25) --
day chi la viec boc script CLI thanh ham thuan tra ve `NewsRiskResult`.

KHONG dung `query=` van ban tu do: GDELT khop long theo tu khoa rui ro va tra ve
cung mot ro tin vi mo cho moi nha cung ung. Chi `entity=<spine_id>` moi rang buoc
su kien vao dung doanh nghiep.

Moi supplier ton 3 request (1 `/search` + 2 `/events`), nen 10 supplier = 30 request,
cham dung tran 30 req/phut cua goi free -> tu dieu tiet o `settings.gdelt_rate_limit_rpm`.
"""

from __future__ import annotations

from typing import Any, Mapping

from src.core.config import settings
from src.core.contracts import KeyEvent, NewsRiskResult, Supplier
from src.core.logging import get_logger
from src.integrations.http import HttpClient, HttpError

logger = get_logger(__name__)

BASE_URL = "https://gdeltcloud.com/api/v2"

# Trong so cong thuc 5.1 - DOCUMENTATION.md
W_TONE, W_VOLUME, W_GEO = 0.50, 0.25, 0.25

WINDOW_DAYS = 30
EVENT_LIMIT = 60
TOP_K_EVENTS = 8
MAX_KEY_EVENTS = 3

SEVERITY_WEIGHT = {"critical": 1.00, "high": 0.85, "moderate": 0.65,
                   "medium": 0.65, "low": 0.45}

#: He so rui ro dia chinh tri theo quoc gia dat nang luc san xuat trong yeu (0-1).
GEO_RISK = {
    "US": 0.25, "TW": 0.90, "CN": 0.78, "JP": 0.30,
    "KR": 0.45, "DE": 0.30, "NL": 0.28, "VN": 0.40,
}
DEFAULT_GEO_RISK = 0.35

COUNTRY_TO_ISO2 = {
    "China": "CN", "Taiwan": "TW", "United States": "US", "Japan": "JP",
    "South Korea": "KR", "Germany": "DE", "Netherlands": "NL", "Vietnam": "VN",
}

RISK_QUERY = ("supply chain disruption, production halt, component shortage, plant fire, "
              "recall, export control, tariff, strike, capacity cut")

_client: HttpClient | None = None


def get_client() -> HttpClient:
    """Client dung chung (rate limiter + circuit breaker phai la mot cho ca process)."""
    global _client
    if _client is None:
        _client = HttpClient(
            BASE_URL,
            namespace="gdelt",
            headers={"Authorization": f"Bearer {settings.gdelt_api_key}"},
            rate_limit_rpm=settings.gdelt_rate_limit_rpm,
        )
    return _client


def reset_client() -> None:
    """Dung trong test / khi doi API key."""
    global _client
    if _client is not None:
        _client.close()
    _client = None


# ---------------------------------------------------------------------------
# Tang goi API
# ---------------------------------------------------------------------------


def fetch_entity(supplier: Mapping[str, Any], client: HttpClient | None = None) -> dict:
    """Tra cuu thuc the de lay spine_id + coverage_30d (mat do dua tin 30 ngay)."""
    client = client or get_client()
    resp = client.get_json("search", {"q": supplier["name"], "limit": 5})
    data = (resp or {}).get("data") or []
    if not data:
        return {"error": "khong phan giai duoc thuc the"}
    best = max(data, key=lambda e: (e.get("match_score") or 0, e.get("coverage_30d") or 0))
    return {
        "entity_id": best.get("spine_id") or best.get("entity_id"),
        "entity_name": best.get("name"),
        "coverage_30d": best.get("coverage_30d") or 0,
        "country_iso3": best.get("country_iso3") or [],
        "monitorable": best.get("monitorable"),
        "sources": best.get("sources") or {},
    }


def _parse_events(data: list, supply_chain_scoped: bool) -> list[dict]:
    events = []
    for ev in data:
        metrics = ev.get("metrics") or {}
        geo = ev.get("geo") or {}
        events.append({
            "id": ev.get("id"),
            "title": ev.get("title"),
            "summary": (ev.get("summary") or "")[:400],
            "event_date": ev.get("event_date"),
            "category": ev.get("category"),
            "subcategory_label": ev.get("subcategory_label"),
            "country": geo.get("country"),
            "region": geo.get("region"),
            "url": ev.get("url"),
            "significance": metrics.get("significance") or 0.0,
            "severity_tier": (metrics.get("severity_tier") or "low").lower(),
            "systemic_importance": metrics.get("systemic_importance") or 0.0,
            "propagation_potential": metrics.get("propagation_potential") or 0.0,
            "market_sensitivity": metrics.get("market_sensitivity") or 0.0,
            "confidence": metrics.get("confidence") or 0.0,
            "article_count": metrics.get("article_count") or 0,
            "supply_chain_scoped": supply_chain_scoped,
        })
    return events


def fetch_events(supplier: Mapping[str, Any], entity: Mapping[str, Any],
                 client: HttpClient | None = None) -> tuple[list[dict], int, list[str]]:
    """Keo su kien da rang buoc vao dung thuc the.

    Goi 2 luot trong cung pham vi `entity`:
      (a) toan bo su kien 30 ngay, sap theo significance -> nen tin tuc chung
      (b) loc ngu nghia theo RISK_QUERY                  -> rieng nhom dut gay chuoi cung ung
    """
    client = client or get_client()
    handle = entity.get("entity_id") or supplier["name"]
    base = {"entity": handle, "days": WINDOW_DAYS, "limit": EVENT_LIMIT,
            "sort": "significance", "include_total": "true"}

    errors: list[str] = []
    try:
        all_resp = client.get_json("events", base) or {}
    except HttpError as exc:
        errors.append(f"events: {exc}")
        all_resp = {}
    all_events = _parse_events(all_resp.get("data") or [], False)
    estimated_total = (all_resp.get("pagination") or {}).get("estimated_total") or len(all_events)

    try:
        risk_resp = client.get_json(
            "events", {**base, "search": RISK_QUERY, "search_mode": "semantic"}
        ) or {}
    except HttpError as exc:
        errors.append(f"events+search: {exc}")
        risk_resp = {}
    risk_ids = {e.get("id") for e in (risk_resp.get("data") or [])}

    for ev in all_events:
        ev["supply_chain_scoped"] = ev["id"] in risk_ids
    return all_events, estimated_total, errors


# ---------------------------------------------------------------------------
# Thuat toan cham diem -- GIU NGUYEN tu apidata/gdelt_supplier_risk.py
# ---------------------------------------------------------------------------


def tone_score(events: list[dict]) -> float:
    """ToneScore (0-100): muc do tieu cuc/nghiem trong cua dong tin ve nha cung ung.

    GDELT Cloud khong tra tone tho ma tra bo metric da duoc coder cham, nen ToneScore
    tong hop tu significance (nhan trong so severity_tier), systemic_importance,
    propagation_potential va market_sensitivity. Lay trung binh TOP_K_EVENTS su kien
    nang nhat de mot su co nghiem trong khong bi pha loang boi hang chuc tin thuong.
    """
    if not events:
        return 0.0
    scored = []
    for ev in events:
        weight = SEVERITY_WEIGHT.get(ev["severity_tier"], 0.45)
        blended = (
            0.40 * ev["significance"] * weight
            + 0.25 * ev["systemic_importance"]
            + 0.20 * ev["propagation_potential"]
            + 0.15 * ev["market_sensitivity"]
        )
        blended *= max(ev["confidence"], 0.5)
        if ev.get("supply_chain_scoped"):
            blended *= 1.35
        scored.append(blended)
    scored.sort(reverse=True)
    top = scored[:TOP_K_EVENTS]
    return min(100.0, (sum(top) / len(top)) * 210.0)


def volume_impact(events: list[dict], estimated_total: int, coverage_30d: int) -> float:
    """VolumeImpact (0-100): khoi luong & mat do dua tin bat thuong quanh nha cung ung."""
    articles = sum(ev["article_count"] for ev in events)
    sc_events = sum(1 for ev in events if ev.get("supply_chain_scoped"))
    event_component = min(1.0, (estimated_total or 0) / 40.0)
    supply_component = min(1.0, sc_events / 12.0)
    article_component = min(1.0, articles / 90.0)
    coverage_component = min(1.0, (coverage_30d or 0) / 150.0)
    return 100.0 * (0.35 * event_component + 0.25 * supply_component
                    + 0.20 * article_component + 0.20 * coverage_component)


def geo_risk_penalty(supplier: Mapping[str, Any], events: list[dict]) -> float:
    """GeoRiskPenalty (0-100): rui ro dia chinh tri cua nuoc dat nang luc san xuat,
    cong them phan rui ro cua cac nuoc thuc su xuat hien trong su kien."""
    base = GEO_RISK.get(str(supplier.get("country") or ""), DEFAULT_GEO_RISK)
    event_risks = [
        GEO_RISK[COUNTRY_TO_ISO2[ev["country"]]]
        for ev in events
        if ev.get("country") in COUNTRY_TO_ISO2 and COUNTRY_TO_ISO2[ev["country"]] in GEO_RISK
    ]
    observed = max(event_risks) if event_risks else base
    return 100.0 * min(1.0, 0.6 * base + 0.4 * observed)


def analyse(supplier: Mapping[str, Any], client: HttpClient | None = None) -> dict:
    """Chay het pipeline cho mot nha cung ung, tra ve dict tho (co cac cau phan)."""
    client = client or get_client()
    entity = fetch_entity(supplier, client)
    events, estimated_total, errors = fetch_events(supplier, entity, client)
    if entity.get("error"):
        errors.append(f"search: {entity['error']}")

    tone = tone_score(events)
    volume = volume_impact(events, estimated_total, entity.get("coverage_30d", 0))
    geo = geo_risk_penalty(supplier, events)
    ssi_news = W_TONE * tone + W_VOLUME * volume + W_GEO * geo

    top_events = sorted(
        events,
        key=lambda e: (e.get("supply_chain_scoped", False), e["significance"]),
        reverse=True,
    )[:MAX_KEY_EVENTS]

    return {
        "entity": entity,
        "components": {"ToneScore": round(tone, 2), "VolumeImpact": round(volume, 2),
                       "GeoRiskPenalty": round(geo, 2)},
        "ssi_news": round(ssi_news, 2),
        "g_geo": round(geo, 2),
        "event_count": len(events),
        "estimated_total_30d": estimated_total,
        "supply_chain_event_count": sum(1 for e in events if e.get("supply_chain_scoped")),
        "top_events": top_events,
        "events": events,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# API cong khai
# ---------------------------------------------------------------------------


def _as_mapping(supplier: Supplier | Mapping[str, Any]) -> dict[str, Any]:
    if isinstance(supplier, Supplier):
        return {"id": supplier.id, "name": supplier.name, "country": None}
    return dict(supplier)


def fetch_supplier_news(
    supplier: Supplier | Mapping[str, Any],
    *,
    country: str | None = None,
    client: HttpClient | None = None,
) -> NewsRiskResult:
    """Tra ve `NewsRiskResult` cho mot nha cung ung.

    KHONG BAO GIO nem ngoai le: API chet thi tra ve `stale=True` voi diem trung tinh,
    vi worker chay moi 5 phut phai song sot qua mot GDELT down.
    """
    data = _as_mapping(supplier)
    if country:
        data["country"] = country
    supplier_id = str(data.get("id") or data.get("supplier_id") or data.get("ticker") or "")

    try:
        raw = analyse(data, client)
    except Exception as exc:  # noqa: BLE001 - co y nuot: worker phai song sot
        logger.warning(
            "gdelt_unavailable",
            extra={"supplier_id": supplier_id, "error": str(exc)[:200]},
        )
        return NewsRiskResult(
            supplier_id=supplier_id,
            ssi_news=0.0,
            g_geo=round(100.0 * GEO_RISK.get(str(data.get("country") or ""), DEFAULT_GEO_RISK), 2),
            events_supply_chain_30d=0,
            key_events=[],
            stale=True,
        )

    # Mot lan 429 bi nuot se bien thanh "0 su kien" va HA diem rui ro sai lech.
    # Neu ca hai luot /events deu hong -> danh dau stale de A6 khong tin so lieu nay.
    stale = bool(raw["errors"]) and raw["event_count"] == 0
    if raw["errors"]:
        logger.warning("gdelt_partial", extra={"supplier_id": supplier_id,
                                               "errors": raw["errors"]})

    key_events = [
        KeyEvent(date=str(ev.get("event_date") or ""), summary=str(ev.get("title") or ""))
        for ev in raw["top_events"]
    ]
    return NewsRiskResult(
        supplier_id=supplier_id,
        ssi_news=raw["ssi_news"],
        g_geo=raw["g_geo"],
        events_supply_chain_30d=raw["supply_chain_event_count"],
        key_events=key_events,
        stale=stale,
    )
