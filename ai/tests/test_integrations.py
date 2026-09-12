# pyright: reportArgumentType=false
# Ly do: file nay dung test double (FakeConnection, module respx) va dict literal
# cho model Pydantic long nhau -- Pydantic chap nhan o runtime, Pyright thi khong.
# Da xac nhan bang 173 test xanh; tat rule nay o day de khong phai be cong code test.
"""Test offline cho `src/integrations/*` -- KHONG cham mang, KHONG dot quota.

Fixture that lay tu `apidata/out/gdelt_supplier_risk.json` (phan hoi GDELT that da
duoc chay ngay 2026-09-12). Test GDELT dung so SSI_news da ghi trong file do lam
"golden value": neu ai do sua thuat toan da verify, test se do.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
from pydantic import BaseModel, Field

from src.core.config import settings
from src.core.contracts import FinancialResult, NewsRiskResult, WeatherDelay
from src.integrations import fmp, gdelt, open_meteo, openrouter_client
from src.integrations.http import (
    CircuitBreaker,
    CircuitOpenError,
    DiskCache,
    HttpClient,
    HttpError,
    RateLimiter,
)
from src.integrations.openrouter_client import LLMSchemaError

AI_DIR = Path(__file__).resolve().parents[1]
GDELT_OUT = AI_DIR / "apidata" / "out" / "gdelt_supplier_risk.json"
RISK_FIXTURE = AI_DIR / "apidata" / "out" / "supplier_risk_fixture.json"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated_cache(tmp_path, monkeypatch):
    """Moi test mot thu muc cache rieng -> khong co cache hit ngoai y muon.

    Dong thoi vo hieu hoa RateLimiter: 26 rpm nghia la 2,3 giay/request, bo test
    offline se mat hang phut chi de ngoi cho mot cai sleep khong con y nghia.
    """
    monkeypatch.setattr(DiskCache, "__init__", _patched_cache_init(tmp_path), raising=True)
    monkeypatch.setattr(RateLimiter, "acquire", lambda self: None, raising=True)
    yield
    gdelt.reset_client()
    fmp.reset_client()
    open_meteo.reset_clients()
    openrouter_client.reset_client()


def _patched_cache_init(tmp_path):
    original = DiskCache.__init__

    def _init(self, namespace, ttl_seconds=None, directory=None):
        original(self, namespace, ttl_seconds=ttl_seconds,
                 directory=directory or (tmp_path / "cache" / namespace))

    return _init


@pytest.fixture(scope="session")
def gdelt_recorded() -> dict:
    return json.loads(GDELT_OUT.read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def gdelt_supplier(gdelt_recorded) -> dict:
    """Lay nha cung ung co nhieu su kien chuoi cung ung nhat lam mau."""
    return max(gdelt_recorded["suppliers"],
               key=lambda s: (s["supply_chain_event_count"], s["event_count"]))


def _raw_search_response(supplier: dict) -> dict:
    """Dung lai phan hoi tho cua GET /search tu ket qua da ghi."""
    entity = supplier["entity"]
    return {
        "success": True,
        "data": [{
            "spine_id": entity["entity_id"],
            "name": entity["entity_name"],
            "match_score": 0.99,
            "coverage_30d": entity["coverage_30d"],
            "country_iso3": entity["country_iso3"],
            "monitorable": entity["monitorable"],
            "sources": entity["sources"],
        }],
    }


def _raw_event(ev: dict) -> dict:
    return {
        "id": ev["id"],
        "title": ev["title"],
        "summary": ev["summary"],
        "event_date": ev["event_date"],
        "category": ev["category"],
        "subcategory_label": ev["subcategory_label"],
        "url": ev["url"],
        "geo": {"country": ev["country"], "region": ev["region"]},
        "metrics": {
            "significance": ev["significance"],
            "severity_tier": ev["severity_tier"],
            "systemic_importance": ev["systemic_importance"],
            "propagation_potential": ev["propagation_potential"],
            "market_sensitivity": ev["market_sensitivity"],
            "confidence": ev["confidence"],
            "article_count": ev["article_count"],
        },
    }


def _mount_gdelt(router: respx.Router, supplier: dict) -> None:
    events = supplier["events"]
    all_body = {
        "success": True,
        "data": [_raw_event(e) for e in events],
        "pagination": {"estimated_total": supplier["estimated_total_30d"]},
    }
    risk_body = {
        "success": True,
        "data": [_raw_event(e) for e in events if e["supply_chain_scoped"]],
        "pagination": {"estimated_total": supplier["supply_chain_event_count"]},
    }

    router.get(f"{gdelt.BASE_URL}/search").mock(
        return_value=httpx.Response(200, json=_raw_search_response(supplier))
    )

    def _events_handler(request: httpx.Request) -> httpx.Response:
        if "search" in request.url.params:
            return httpx.Response(200, json=risk_body)
        return httpx.Response(200, json=all_body)

    router.get(f"{gdelt.BASE_URL}/events").mock(side_effect=_events_handler)


# ---------------------------------------------------------------------------
# http.py
# ---------------------------------------------------------------------------


class TestHttpLayer:
    @respx.mock
    def test_retries_on_5xx_then_succeeds(self):
        route = respx.get("https://example.test/api/ping").mock(
            side_effect=[
                httpx.Response(503, text="unavailable"),
                httpx.Response(200, json={"ok": True}),
            ]
        )
        with HttpClient("https://example.test/api", namespace="t_retry") as client:
            assert client.get_json("ping") == {"ok": True}
        assert route.call_count == 2

    @respx.mock
    def test_does_not_retry_on_4xx(self):
        route = respx.get("https://example.test/api/nope").mock(
            return_value=httpx.Response(404, text="not found")
        )
        with HttpClient("https://example.test/api", namespace="t_404") as client:
            with pytest.raises(HttpError) as excinfo:
                client.get_json("nope")
        assert excinfo.value.status_code == 404
        assert route.call_count == 1, "4xx la loi cua ta, thu lai chi dot quota"

    @respx.mock
    def test_retries_exhausted_raises(self):
        route = respx.get("https://example.test/api/down").mock(
            return_value=httpx.Response(500, text="boom")
        )
        with HttpClient("https://example.test/api", namespace="t_500",
                        max_retries=3) as client:
            with pytest.raises(HttpError):
                client.get_json("down")
        assert route.call_count == 3

    @respx.mock
    def test_cache_hit_avoids_second_request(self):
        route = respx.get("https://example.test/api/cached").mock(
            return_value=httpx.Response(200, json={"n": 1})
        )
        with HttpClient("https://example.test/api", namespace="t_cache",
                        cache_ttl_seconds=3600) as client:
            first = client.get_json("cached", {"symbol": "TSLA"})
            second = client.get_json("cached", {"symbol": "TSLA"})
        assert first == second == {"n": 1}
        assert route.call_count == 1, "lan 2 phai lay tu cache dia"

    @respx.mock
    def test_cache_key_separates_params(self):
        route = respx.get("https://example.test/api/cached").mock(
            return_value=httpx.Response(200, json={"n": 1})
        )
        with HttpClient("https://example.test/api", namespace="t_cache2",
                        cache_ttl_seconds=3600) as client:
            client.get_json("cached", {"symbol": "TSLA"})
            client.get_json("cached", {"symbol": "GM"})
        assert route.call_count == 2

    @respx.mock
    def test_circuit_breaker_opens_after_failures(self):
        route = respx.get("https://example.test/api/dead").mock(
            return_value=httpx.Response(500, text="dead")
        )
        with HttpClient("https://example.test/api", namespace="t_cb", max_retries=1,
                        failure_threshold=2) as client:
            for _ in range(2):
                with pytest.raises(HttpError):
                    client.get_json("dead")
            assert route.call_count == 2
            with pytest.raises(CircuitOpenError):
                client.get_json("dead")
            assert route.call_count == 2, "cau dao mo -> khong goi mang nua"

    def test_circuit_breaker_half_opens_after_reset(self):
        breaker = CircuitBreaker(failure_threshold=1, reset_seconds=0.0, name="t")
        breaker.record_failure()
        assert breaker.is_open is False
        breaker.record_success()
        assert breaker.is_open is False

    def test_rate_limiter_spaces_calls(self, monkeypatch):
        monkeypatch.undo()  # bo autouse patch de do nhip that
        limiter = RateLimiter(rpm=6000)  # 10ms/slot -> nhanh nhung van do duoc
        import time as _t

        start = _t.monotonic()
        for _ in range(5):
            limiter.acquire()
        assert _t.monotonic() - start >= 0.03

    def test_rate_limiter_zero_rpm_is_noop(self, monkeypatch):
        monkeypatch.undo()
        RateLimiter(rpm=0).acquire()


# ---------------------------------------------------------------------------
# gdelt.py
# ---------------------------------------------------------------------------


class TestGdelt:
    @respx.mock
    def test_happy_path_reproduces_recorded_score(self, gdelt_supplier):
        _mount_gdelt(respx, gdelt_supplier)
        result = gdelt.fetch_supplier_news(
            {"id": f"SUP-{gdelt_supplier['ticker']}", "name": gdelt_supplier["name"],
             "country": gdelt_supplier["country"]}
        )
        assert isinstance(result, NewsRiskResult)
        assert result.stale is False
        assert result.ssi_news == pytest.approx(gdelt_supplier["SSI_news"], abs=0.01)
        assert result.g_geo == pytest.approx(
            gdelt_supplier["components"]["GeoRiskPenalty"], abs=0.01
        )
        assert result.events_supply_chain_30d == gdelt_supplier["supply_chain_event_count"]
        assert 1 <= len(result.key_events) <= gdelt.MAX_KEY_EVENTS
        assert all(e.summary for e in result.key_events)

    @respx.mock
    def test_components_match_recorded_values_for_every_supplier(self, gdelt_recorded):
        """Doi chieu tung cau phan cho ca 10 nha cung ung da ghi."""
        for supplier in gdelt_recorded["suppliers"]:
            events = supplier["events"]
            tone = gdelt.tone_score(events)
            volume = gdelt.volume_impact(events, supplier["estimated_total_30d"],
                                         supplier["entity"]["coverage_30d"])
            geo = gdelt.geo_risk_penalty(supplier, events)
            comp = supplier["components"]
            assert tone == pytest.approx(comp["ToneScore"], abs=0.01), supplier["ticker"]
            assert volume == pytest.approx(comp["VolumeImpact"], abs=0.01), supplier["ticker"]
            assert geo == pytest.approx(comp["GeoRiskPenalty"], abs=0.01), supplier["ticker"]

    def test_tone_score_empty_events(self):
        assert gdelt.tone_score([]) == 0.0

    @respx.mock
    def test_stale_on_total_api_failure(self):
        respx.get(f"{gdelt.BASE_URL}/search").mock(
            return_value=httpx.Response(500, text="gdelt down")
        )
        respx.get(f"{gdelt.BASE_URL}/events").mock(
            return_value=httpx.Response(500, text="gdelt down")
        )
        result = gdelt.fetch_supplier_news(
            {"id": "SUP-TSM", "name": "TSMC", "country": "TW"}
        )
        assert result.stale is True
        assert result.ssi_news == 0.0
        assert result.g_geo == pytest.approx(90.0, abs=0.01), "van giu duoc rui ro dia ly tinh"
        assert result.key_events == []

    @respx.mock
    def test_stale_when_entity_resolves_but_events_die(self, gdelt_supplier):
        respx.get(f"{gdelt.BASE_URL}/search").mock(
            return_value=httpx.Response(200, json=_raw_search_response(gdelt_supplier))
        )
        respx.get(f"{gdelt.BASE_URL}/events").mock(
            return_value=httpx.Response(503, text="rate limited")
        )
        result = gdelt.fetch_supplier_news(
            {"id": "SUP-X", "name": gdelt_supplier["name"],
             "country": gdelt_supplier["country"]}
        )
        assert result.stale is True
        assert result.events_supply_chain_30d == 0

    @respx.mock
    def test_uses_entity_spine_id_not_free_text(self, gdelt_supplier):
        _mount_gdelt(respx, gdelt_supplier)
        gdelt.fetch_supplier_news({"id": "SUP-X", "name": gdelt_supplier["name"],
                                   "country": gdelt_supplier["country"]})
        event_calls = [c.request for c in respx.calls if c.request.url.path.endswith("/events")]
        assert event_calls, "phai goi /events"
        for req in event_calls:
            assert req.url.params["entity"] == gdelt_supplier["entity"]["entity_id"]
            assert "query" not in req.url.params

    @respx.mock
    def test_three_requests_per_supplier(self, gdelt_supplier):
        _mount_gdelt(respx, gdelt_supplier)
        gdelt.fetch_supplier_news({"id": "SUP-X", "name": gdelt_supplier["name"],
                                   "country": gdelt_supplier["country"]})
        assert len(respx.calls) == 3, "1 /search + 2 /events - dung ngan sach quota"

    @respx.mock
    def test_retries_gdelt_429_because_it_is_per_minute(self):
        """Nguoc voi FMP: 429 cua GDELT la tran 30 req/phut -> thu lai la dung."""
        route = respx.get(f"{gdelt.BASE_URL}/search").mock(side_effect=[
            httpx.Response(429, json={"details": {"retry_after": 1}}),
            httpx.Response(200, json=_raw_search_response({
                "entity": {"entity_id": "e_1", "entity_name": "X", "coverage_30d": 10,
                           "country_iso3": ["USA"], "monitorable": True, "sources": {}}})),
        ])
        respx.get(f"{gdelt.BASE_URL}/events").mock(
            return_value=httpx.Response(200, json={"data": [], "pagination": {}})
        )
        gdelt.fetch_supplier_news({"id": "SUP-X", "name": "X", "country": "US"})
        assert route.call_count == 2

    def test_geo_risk_penalty_unknown_country_uses_default(self):
        assert gdelt.geo_risk_penalty({"country": "ZZ"}, []) == pytest.approx(35.0)


# ---------------------------------------------------------------------------
# fmp.py
# ---------------------------------------------------------------------------


def _fmp_scores(**overrides: Any) -> list[dict]:
    """Bo 5 bien tho cua Tesla (FY2024) -- Z ~ 3.0, vung SAFE."""
    base = {
        "symbol": "TSLA",
        "altmanZScore": 9.9,
        "piotroskiScore": 7,
        "workingCapital": 36_000_000_000,
        "totalAssets": 122_070_000_000,
        "totalLiabilities": 48_390_000_000,
        "retainedEarnings": 32_070_000_000,
        "ebit": 7_076_000_000,
        "marketCap": 800_000_000_000,
        "revenue": 97_690_000_000,
    }
    base.update(overrides)
    return [base]


class TestFmp:
    @respx.mock
    def test_happy_path(self):
        route = respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(200, json=_fmp_scores())
        )
        result = fmp.fetch_financials("SUP-TSLA", "TSLA")
        assert isinstance(result, FinancialResult)
        assert result.stale is False
        assert result.supplier_id == "SUP-TSLA" and result.ticker == "TSLA"
        assert result.zone in {"DISTRESS", "GREY", "SAFE"}
        assert 0.0 <= result.ssi_fin <= 100.0
        assert route.call_count == 1, "du du lieu -> khong goi them bao cao tai chinh"

        # doi chieu voi cong thuc goc 1.2X1+1.4X2+3.3X3+0.6X4+0.999X5
        raw = _fmp_scores()[0]
        ta, tl = raw["totalAssets"], raw["totalLiabilities"]
        expected = (1.2 * raw["workingCapital"] / ta + 1.4 * raw["retainedEarnings"] / ta
                    + 3.3 * raw["ebit"] / ta + 0.6 * raw["marketCap"] / tl
                    + 0.999 * raw["revenue"] / ta)
        assert result.altman_z == pytest.approx(round(expected, 3), abs=0.001)

    @respx.mock
    def test_distress_zone_maps_to_high_ssi_fin(self):
        """Lucid trong fixture that: Z=-4.49 -> SSI_fin=100 (kiet que)."""
        respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(200, json=_fmp_scores(
                symbol="LCID", workingCapital=3_000_000_000, totalAssets=15_000_000_000,
                totalLiabilities=9_000_000_000, retainedEarnings=-22_000_000_000,
                ebit=-3_000_000_000, marketCap=6_000_000_000, revenue=800_000_000,
            ))
        )
        result = fmp.fetch_financials("SUP-LCID", "LCID")
        assert result.zone == "DISTRESS"
        assert result.ssi_fin >= 70.0, "vung kiet que phai du kich hoat nguong PORS"
        assert result.stale is False

    @respx.mock
    def test_falls_back_to_statements_when_scores_incomplete(self):
        scores = respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(200, json=[{
                "symbol": "GM", "marketCap": 55_000_000_000, "workingCapital": None,
                "altmanZScore": 1.4,
            }])
        )
        balance = respx.get(f"{fmp.BASE_URL}/balance-sheet-statement").mock(
            return_value=httpx.Response(200, json=[{
                "date": "2025-12-31", "totalCurrentAssets": 90_000_000_000,
                "totalCurrentLiabilities": 85_000_000_000,
                "totalAssets": 280_000_000_000, "totalLiabilities": 216_000_000_000,
                "retainedEarnings": 40_000_000_000,
            }])
        )
        income = respx.get(f"{fmp.BASE_URL}/income-statement").mock(
            return_value=httpx.Response(200, json=[{
                "revenue": 187_000_000_000, "operatingIncome": 12_000_000_000,
            }])
        )
        result = fmp.fetch_financials("SUP-GM", "GM")
        assert scores.called and balance.called and income.called
        assert result.stale is False
        assert result.altman_z is not None

    @respx.mock
    def test_stale_on_quota_exhausted_429(self):
        route = respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(429, json={"message": "Limit Reach"})
        )
        result = fmp.fetch_financials("SUP-TSM", "TSM")
        assert result.stale is True
        assert result.altman_z is None
        assert result.ssi_fin == 50.0
        assert result.zone == "UNKNOWN"
        assert route.call_count == 1, "429 cua FMP = het han ngach ngay, thu lai vo ich"

    @respx.mock
    def test_stale_on_402_payment_required(self):
        respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(402, text="Payment Required")
        )
        respx.get(f"{fmp.BASE_URL}/balance-sheet-statement").mock(
            return_value=httpx.Response(402, text="Payment Required")
        )
        respx.get(f"{fmp.BASE_URL}/income-statement").mock(
            return_value=httpx.Response(402, text="Payment Required")
        )
        result = fmp.fetch_financials("SUP-ALB", "ALB")
        assert result.stale is True and result.zone == "UNKNOWN"

    @respx.mock
    def test_api_key_not_part_of_cache_key(self, monkeypatch):
        """Doi API key khong duoc lam hong cache -- neu khong se dot lai ca han ngach."""
        route = respx.get(f"{fmp.BASE_URL}/financial-scores").mock(
            return_value=httpx.Response(200, json=_fmp_scores())
        )
        client = HttpClient(fmp.BASE_URL, namespace="fmp_key", cache_ttl_seconds=3600)
        monkeypatch.setattr(settings, "fmp_api_key", "KEY-A")
        fmp.fetch_financials("SUP-TSLA", "TSLA", client)
        monkeypatch.setattr(settings, "fmp_api_key", "KEY-B")
        fmp.fetch_financials("SUP-TSLA", "TSLA", client)
        client.close()
        assert route.call_count == 1

    def test_altman_components_none_without_totals(self):
        assert fmp.altman_components({"totalAssets": 0, "totalLiabilities": 10}) is None

    def test_z_to_ssi_fin_boundaries(self):
        assert fmp._fallback_z_to_ssi_fin(1.81) == 70.0
        assert fmp._fallback_z_to_ssi_fin(2.99) == 40.0
        assert fmp._fallback_z_to_ssi_fin(None) is None
        assert fmp._fallback_z_to_ssi_fin(-20.0) == 100.0
        assert fmp._fallback_altman_zone(1.0) == "DISTRESS"
        assert fmp._fallback_altman_zone(2.5) == "GREY"
        assert fmp._fallback_altman_zone(5.0) == "SAFE"

    def test_matches_recorded_fixture_ssi_fin(self):
        """SSI_fin trong `supplier_risk_fixture.json` phai tai tao duoc tu altman_z."""
        data = json.loads(RISK_FIXTURE.read_text(encoding="utf-8"))
        for supplier in data["suppliers"]:
            scores = supplier["scores"]
            assert fmp._fallback_z_to_ssi_fin(scores["altman_z"]) == pytest.approx(
                scores["ssi_fin"], abs=0.1
            ), supplier["ticker"]


# ---------------------------------------------------------------------------
# open_meteo.py
# ---------------------------------------------------------------------------


def _forecast(weather_code: int, wind: float = 5.0, gust: float = 8.0,
              precip_sum: list | None = None) -> dict:
    return {
        "current": {"temperature_2m": 28.0, "relative_humidity_2m": 80,
                    "precipitation": 0.2, "weather_code": weather_code,
                    "wind_speed_10m": wind, "wind_gusts_10m": gust},
        "daily": {"precipitation_sum": precip_sum if precip_sum is not None else [1.0, 2.0]},
    }


class TestOpenMeteo:
    @respx.mock
    def test_happy_path_calm_weather(self):
        respx.get(f"{open_meteo.FORECAST_URL}/forecast").mock(
            return_value=httpx.Response(200, json=_forecast(1))
        )
        result = open_meteo.weather_delay_forecast([
            {"location_name": "Cảng Long Beach", "latitude": 33.7701, "longitude": -118.1937},
        ])
        assert isinstance(result, WeatherDelay)
        assert result.delay_days == 0.0
        assert result.severity == open_meteo.CALM
        assert result.stale is False
        assert result.detail[0]["locationName"] == "Cảng Long Beach"

    @respx.mock
    def test_takes_max_delay_across_waypoints(self):
        responses = [
            httpx.Response(200, json=_forecast(1)),
            httpx.Response(200, json=_forecast(99)),  # dong bao + mua da nang -> 7 ngay
        ]
        respx.get(f"{open_meteo.FORECAST_URL}/forecast").mock(side_effect=responses)
        result = open_meteo.weather_delay_forecast([
            {"location_name": "A", "latitude": 1.0, "longitude": 1.0},
            {"location_name": "B", "latitude": 2.0, "longitude": 2.0},
        ])
        assert result.delay_days == 7.0
        assert result.severity == "NGUY CƠ RẤT CAO / ĐÃ ĐÓNG CỬA"

    @respx.mock
    def test_wind_and_rain_penalties(self):
        respx.get(f"{open_meteo.FORECAST_URL}/forecast").mock(
            return_value=httpx.Response(200, json=_forecast(0, wind=62.0,
                                                           precip_sum=[80.0, 3.0]))
        )
        result = open_meteo.weather_delay_forecast(
            [{"location_name": "Cát Lái", "latitude": 10.77, "longitude": 106.78}]
        )
        assert result.delay_days == 3.0, "gio > 50km/h phat 3 ngay, nang hon mua lon 2 ngay"
        assert result.detail[0]["maxDailyPrecipitationMm"] == 80.0

    @respx.mock
    def test_geocodes_when_coordinates_missing(self):
        geo = respx.get(f"{open_meteo.GEOCODING_URL}/search").mock(
            return_value=httpx.Response(200, json={"results": [
                {"latitude": 10.76, "longitude": 106.66, "name": "Ho Chi Minh City",
                 "country": "Vietnam"}
            ]})
        )
        respx.get(f"{open_meteo.FORECAST_URL}/forecast").mock(
            return_value=httpx.Response(200, json=_forecast(65))
        )
        result = open_meteo.weather_delay_forecast([{"location_name": "Ho Chi Minh City"}])
        assert geo.called
        assert result.delay_days == 3.0
        assert result.detail[0]["latitude"] == 10.76

    @respx.mock
    def test_stale_when_all_waypoints_fail(self):
        respx.get(f"{open_meteo.FORECAST_URL}/forecast").mock(
            return_value=httpx.Response(500, text="down")
        )
        result = open_meteo.weather_delay_forecast(
            [{"location_name": "A", "latitude": 1.0, "longitude": 1.0}]
        )
        assert result.stale is True
        assert result.delay_days == 0.0

    def test_empty_waypoints_not_stale(self):
        result = open_meteo.weather_delay_forecast([])
        assert result.stale is False and result.delay_days == 0.0


# ---------------------------------------------------------------------------
# openrouter_client.py
# ---------------------------------------------------------------------------


class Assessment(BaseModel):
    supplier: str = Field(min_length=1)
    status: str = Field(min_length=1)
    risk_score: int = Field(ge=0, le=100)


def _chat_response(content: str, total_tokens: int = 120) -> dict:
    return {
        "id": "gen-test",
        "model": settings.openrouter_model,
        "choices": [{"index": 0, "finish_reason": "stop",
                     "message": {"role": "assistant", "content": content}}],
        "usage": {"prompt_tokens": 80, "completion_tokens": total_tokens - 80,
                  "total_tokens": total_tokens},
    }


LLM_URL = f"{settings.openai_base_url.rstrip('/')}/chat/completions"


class TestOpenRouter:
    @respx.mock
    def test_happy_path_returns_validated_model(self):
        route = respx.post(LLM_URL).mock(return_value=httpx.Response(
            200, json=_chat_response(
                '{"supplier": "Mekong Dynamics", "status": "OK", "risk_score": 22}')
        ))
        result = openrouter_client.structured_completion("Danh gia nha cung ung", Assessment)
        assert isinstance(result, Assessment)
        assert result.supplier == "Mekong Dynamics" and result.risk_score == 22
        assert route.call_count == 1

        body = json.loads(route.calls[0].request.content)
        assert body["model"] == settings.openrouter_model, "model phai duoc ghim tu config"
        assert body["response_format"]["type"] == "json_schema"

    @respx.mock
    def test_strips_markdown_code_fence(self):
        respx.post(LLM_URL).mock(return_value=httpx.Response(200, json=_chat_response(
            '```json\n{"supplier": "A", "status": "OK", "risk_score": 5}\n```'
        )))
        assert openrouter_client.structured_completion("x", Assessment).supplier == "A"

    @respx.mock
    def test_retries_once_with_validation_error_fed_back(self):
        route = respx.post(LLM_URL).mock(side_effect=[
            httpx.Response(200, json=_chat_response(
                '{"supplier": "A", "status": "OK", "risk_score": 999}')),  # ngoai khoang
            httpx.Response(200, json=_chat_response(
                '{"supplier": "A", "status": "OK", "risk_score": 42}')),
        ])
        result = openrouter_client.structured_completion("x", Assessment)
        assert result.risk_score == 42
        assert route.call_count == 2

        retry_body = json.loads(route.calls[1].request.content)
        roles = [m["role"] for m in retry_body["messages"]]
        assert roles == ["system", "user", "assistant", "user"]
        assert "risk_score" in retry_body["messages"][-1]["content"], \
            "loi validate phai duoc nhoi nguoc vao prompt"

    @respx.mock
    def test_raises_llm_schema_error_after_second_failure(self):
        route = respx.post(LLM_URL).mock(return_value=httpx.Response(
            200, json=_chat_response('{"supplier": "A"}')  # thieu truong bat buoc
        ))
        with pytest.raises(LLMSchemaError) as excinfo:
            openrouter_client.structured_completion("x", Assessment)
        assert route.call_count == 2
        assert "status" in excinfo.value.validation_error
        assert excinfo.value.raw_content

    @respx.mock
    def test_raises_llm_schema_error_on_non_json_prose(self):
        respx.post(LLM_URL).mock(return_value=httpx.Response(
            200, json=_chat_response("Xin loi, toi khong the tra loi.")
        ))
        with pytest.raises(LLMSchemaError):
            openrouter_client.structured_completion("x", Assessment)

    @respx.mock
    def test_never_returns_unvalidated_json(self):
        """Du JSON hop le ve cu phap nhung sai kieu -> van phai no, khong duoc tra dict."""
        respx.post(LLM_URL).mock(return_value=httpx.Response(
            200, json=_chat_response('{"supplier": 1, "status": null, "risk_score": "abc"}')
        ))
        with pytest.raises(LLMSchemaError):
            openrouter_client.structured_completion("x", Assessment)

    @respx.mock
    def test_api_error_raises_llm_error(self):
        respx.post(LLM_URL).mock(return_value=httpx.Response(401, text="no credit"))
        with pytest.raises(openrouter_client.LLMError):
            openrouter_client.structured_completion("x", Assessment)
