"""Open-Meteo -- du bao do tre do thoi tiet tren cac chang trung chuyen.

Refactor tu `apidata/open_meteo_weather.py` (`evaluate_weather_delay_risk`).
**Giu nguyen bang WMO_CODE_MAP va cac nguong phat (gio > 50 km/h, giat > 65 km/h,
mua ngay > 50 mm).** Khong can API key.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from src.core.contracts import WeatherDelay
from src.core.logging import get_logger
from src.integrations.http import HttpClient, HttpError

logger = get_logger(__name__)

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1"
FORECAST_URL = "https://api.open-meteo.com/v1"

CALM = "Ổn định"

#: WMO Weather Interpretation Codes (WMO 4677) -> (mo ta, so ngay tre, muc rui ro)
WMO_CODE_MAP: dict[int, tuple[str, int, str]] = {
    0: ("Trời quang", 0, "THẤP"),
    1: ("Ít mây", 0, "THẤP"),
    2: ("Mây rải rác", 0, "THẤP"),
    3: ("Nhiều mây", 0, "THẤP"),
    45: ("Sương mù", 1, "TRUNG BÌNH"),
    48: ("Sương mù băng giá", 2, "TRUNG BÌNH"),
    51: ("Mưa phun nhẹ", 0, "THẤP"),
    53: ("Mưa phun vừa", 0, "THẤP"),
    55: ("Mưa phun nặng hạt", 1, "TRUNG BÌNH"),
    61: ("Mưa nhỏ", 0, "THẤP"),
    63: ("Mưa vừa", 1, "TRUNG BÌNH"),
    65: ("Mưa to / Mưa rất to", 3, "CAO"),
    71: ("Tuyết rơi nhẹ", 2, "TRUNG BÌNH"),
    73: ("Tuyết rơi vừa", 3, "CAO"),
    75: ("Tuyết rơi rất dày", 5, "NỔI BẬT / NGUY CƠ CAO"),
    80: ("Mưa rào nhẹ", 1, "TRUNG BÌNH"),
    81: ("Mưa rào vừa", 2, "TRUNG BÌNH"),
    82: ("Mưa rào rất to", 4, "CAO"),
    95: ("Dông bão", 4, "CAO"),
    96: ("Dông bão kèm mưa đá nhẹ", 5, "NGUY CƠ CAO"),
    99: ("Dông bão kèm mưa đá nặng hạt", 7, "NGUY CƠ RẤT CAO / ĐÃ ĐÓNG CỬA"),
}

CURRENT_FIELDS = ("temperature_2m,relative_humidity_2m,precipitation,weather_code,"
                  "wind_speed_10m,wind_gusts_10m")
DAILY_FIELDS = ("weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
                "wind_speed_10m_max,wind_gusts_10m_max")

WIND_SPEED_LIMIT_KMH = 50.0
WIND_GUST_LIMIT_KMH = 65.0
WIND_DELAY_DAYS = 3
HEAVY_RAIN_MM = 50.0
HEAVY_RAIN_DELAY_DAYS = 2

_geo_client: HttpClient | None = None
_forecast_client: HttpClient | None = None


def get_geocoding_client() -> HttpClient:
    global _geo_client
    if _geo_client is None:
        _geo_client = HttpClient(GEOCODING_URL, namespace="open_meteo_geo")
    return _geo_client


def get_forecast_client() -> HttpClient:
    global _forecast_client
    if _forecast_client is None:
        # Thoi tiet doi nhanh -> cache ngan hon TTL mac dinh 6 gio.
        _forecast_client = HttpClient(FORECAST_URL, namespace="open_meteo",
                                      cache_ttl_seconds=1800)
    return _forecast_client


def reset_clients() -> None:
    global _geo_client, _forecast_client
    for client in (_geo_client, _forecast_client):
        if client is not None:
            client.close()
    _geo_client = None
    _forecast_client = None


def geocode_location(name: str) -> tuple[float, float, str] | None:
    """Tim toa do cho mot dia danh. `None` neu khong tim thay / API loi."""
    if not name or not name.strip():
        return None
    try:
        data = get_geocoding_client().get_json(
            "search", {"name": name.strip(), "count": 1, "language": "en", "format": "json"}
        ) or {}
    except HttpError as exc:
        logger.warning("geocode_failed", extra={"name": name, "error": str(exc)[:200]})
        return None
    results = data.get("results") or []
    if not results:
        return None
    top = results[0]
    display = f"{top.get('name')}, {top.get('country', '')}".strip(", ")
    return top.get("latitude"), top.get("longitude"), display


def get_weather_forecast(lat: float, lon: float) -> dict:
    """Thoi tiet hien tai + du bao 7 ngay. `{}` khi API loi."""
    try:
        return get_forecast_client().get_json(
            "forecast",
            {"latitude": lat, "longitude": lon, "current": CURRENT_FIELDS,
             "daily": DAILY_FIELDS, "timezone": "auto"},
        ) or {}
    except HttpError as exc:
        logger.warning("forecast_failed", extra={"lat": lat, "lon": lon,
                                                 "error": str(exc)[:200]})
        return {}


def weather_delay_forecast(waypoints: Iterable[Mapping[str, Any]]) -> WeatherDelay:
    """Tong hop do tre do thoi tiet tren toan bo chang trung chuyen.

    Input moi waypoint: `{"location_name"|"locationName", "latitude", "longitude"}`.
    Thieu toa do thi tu geocode theo ten.

    KHONG BAO GIO nem ngoai le. `stale=True` khi co waypoint ma khong danh gia noi
    waypoint nao -- de A6 biet 0.0 nay la "khong biet", khong phai "troi dep".
    """
    waypoints = list(waypoints or [])
    max_delay_days = 0
    worst_severity = CALM
    evaluations: list[dict[str, Any]] = []
    severe_alerts: list[str] = []

    for wp in waypoints:
        lat = wp.get("latitude")
        lon = wp.get("longitude")
        name = wp.get("location_name") or wp.get("locationName") or "Checkpoint"

        if (lat is None or lon is None) and name:
            geo = geocode_location(name)
            if geo:
                lat, lon, _ = geo
        if lat is None or lon is None:
            continue

        forecast = get_weather_forecast(lat, lon)
        if not forecast:
            continue

        current = forecast.get("current") or {}
        daily = forecast.get("daily") or {}

        wmo_code = current.get("weather_code", 0)
        wind_speed = current.get("wind_speed_10m", 0.0) or 0.0
        wind_gusts = current.get("wind_gusts_10m", 0.0) or 0.0
        precip = current.get("precipitation", 0.0) or 0.0

        weather_desc, base_delay, risk_level = WMO_CODE_MAP.get(
            wmo_code, ("Thời tiết bình thường", 0, "THẤP")
        )
        delay_days = base_delay

        # Gio > 50 km/h: cau cang phai dung, duong cao toc nguy hiem.
        if wind_speed > WIND_SPEED_LIMIT_KMH or wind_gusts > WIND_GUST_LIMIT_KMH:
            delay_days = max(delay_days, WIND_DELAY_DAYS)
            severe_alerts.append(f"Gió mạnh ({wind_speed} km/h) tại {name}")

        # Mua ngay > 50 mm: nguy co ngap / sat lo.
        daily_precip_list = daily.get("precipitation_sum") or []
        clean_precip = [p for p in daily_precip_list if isinstance(p, (int, float))]
        max_daily_precip = max(clean_precip) if clean_precip else 0.0
        if max_daily_precip > HEAVY_RAIN_MM:
            delay_days = max(delay_days, HEAVY_RAIN_DELAY_DAYS)
            severe_alerts.append(f"Mưa lớn dự báo {max_daily_precip}mm tại {name}")

        if delay_days > max_delay_days:
            max_delay_days = delay_days
            worst_severity = risk_level

        evaluations.append({
            "locationName": name,
            "latitude": lat,
            "longitude": lon,
            "wmoCode": wmo_code,
            "weatherCondition": weather_desc,
            "windSpeedKmh": wind_speed,
            "windGustsKmh": wind_gusts,
            "precipitationMm": precip,
            "maxDailyPrecipitationMm": max_daily_precip,
            "delayDays": delay_days,
            "riskLevel": risk_level,
        })

    stale = bool(waypoints) and not evaluations
    if severe_alerts:
        logger.info("weather_severe_alerts", extra={"alerts": severe_alerts})

    return WeatherDelay(
        delay_days=float(max_delay_days),
        severity=worst_severity if max_delay_days > 0 else CALM,
        detail=evaluations,
        stale=stale,
    )
