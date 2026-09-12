"""
Open-Meteo Weather & Geocoding Integration Module
--------------------------------------------------
Free & open-source weather data integration (No API key required).
- Geocoding API: https://geocoding-api.open-meteo.com/v1/search
- Weather Forecast API: https://api.open-meteo.com/v1/forecast
"""

import urllib.request
import urllib.parse
import json
import logging
from typing import Dict, List, Optional, Tuple, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# WMO Weather Interpretation Codes (WMO 4677) mapping to risk descriptions & delay penalties
WMO_CODE_MAP = {
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
    99: ("Dông bão kèm mưa đá nặng hạt", 7, "NGUY CƠ RẤT CAO / ĐÃ ĐÓNG CỬA")
}


def geocode_location(name: str) -> Optional[Tuple[float, float, str]]:
    """
    Search coordinates (lat, lon) for a location name using Open-Meteo Geocoding API.
    Returns: (latitude, longitude, formatted_name) or None if not found.
    """
    if not name or not name.strip():
        return None
        
    query_str = urllib.parse.urlencode({"name": name.strip(), "count": 1, "language": "en", "format": "json"})
    url = f"https://geocoding-api.open-meteo.com/v1/search?{query_str}"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BikeSync-AI-Worker/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if "results" in data and len(data["results"]) > 0:
                top = data["results"][0]
                lat = top.get("latitude")
                lon = top.get("longitude")
                display_name = f"{top.get('name')}, {top.get('country', '')}".strip(", ")
                logger.info(f"Geocoded '{name}' -> {lat}, {lon} ({display_name})")
                return (lat, lon, display_name)
    except Exception as e:
        logger.error(f"Geocoding error for '{name}': {e}")
    return None


def get_weather_forecast(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch current & 7-day forecast weather from Open-Meteo Weather API.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max",
        "timezone": "auto"
    }
    query_str = urllib.parse.urlencode(params)
    url = f"https://api.open-meteo.com/v1/forecast?{query_str}"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BikeSync-AI-Worker/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Open-Meteo weather fetch error for ({lat}, {lon}): {e}")
        return {}


def evaluate_weather_delay_risk(waypoints: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Evaluate total weather delay forecast (in days) across supply chain transit waypoints.
    
    Input format for waypoints:
    [
        {"location_name": "Kho Á Châu", "latitude": 10.762622, "longitude": 106.660172},
        {"location_name": "Trạm Thân Cửu Nghĩa", "latitude": 10.365000, "longitude": 106.315000}
    ]
    """
    max_delay_days = 0
    waypoint_evaluations = []
    severe_alerts = []

    for wp in waypoints:
        lat = wp.get("latitude")
        lon = wp.get("longitude")
        name = wp.get("location_name") or wp.get("locationName") or "Checkpoint"

        # Auto-geocode if coordinates missing
        if (lat is None or lon is None) and name:
            geo_res = geocode_location(name)
            if geo_res:
                lat, lon, _ = geo_res

        if lat is None or lon is None:
            continue

        forecast = get_weather_forecast(lat, lon)
        if not forecast:
            continue

        current = forecast.get("current", {})
        daily = forecast.get("daily", {})

        wmo_code = current.get("weather_code", 0)
        wind_speed = current.get("wind_speed_10m", 0.0)
        wind_gusts = current.get("wind_gusts_10m", 0.0)
        precip = current.get("precipitation", 0.0)

        # Lookup WMO code impact
        weather_desc, base_delay, risk_level = WMO_CODE_MAP.get(wmo_code, ("Thời tiết bình thường", 0, "THẤP"))
        delay_days = base_delay

        # Wind speed penalty (> 50 km/h: crane shutdown risk at port / highway danger)
        if wind_speed > 50.0 or wind_gusts > 65.0:
            delay_days = max(delay_days, 3)
            severe_alerts.append(f"Gió mạnh ({wind_speed} km/h) tại {name}")

        # Heavy daily rain penalty (> 50mm: flooding / landslide risk)
        daily_precip_list = daily.get("precipitation_sum", [])
        max_daily_precip = max(daily_precip_list) if daily_precip_list else 0.0
        if max_daily_precip > 50.0:
            delay_days = max(delay_days, 2)
            severe_alerts.append(f"Mưa lớn dự báo {max_daily_precip}mm tại {name}")

        if delay_days > max_delay_days:
            max_delay_days = delay_days

        waypoint_evaluations.append({
            "locationName": name,
            "latitude": lat,
            "longitude": lon,
            "wmoCode": wmo_code,
            "weatherCondition": weather_desc,
            "windSpeedKmh": wind_speed,
            "windGustsKmh": wind_gusts,
            "precipitationMm": precip,
            "delayDays": delay_days,
            "riskLevel": risk_level
        })

    return {
        "weatherDelayForecastDays": max_delay_days,
        "dataSource": "Open-Meteo Weather & Geocoding API (Free)",
        "severeAlerts": severe_alerts,
        "waypointEvaluations": waypoint_evaluations
    }


if __name__ == "__main__":
    print("=== Testing Open-Meteo Geocoding API ===")
    test_loc = "Long Beach"
    res = geocode_location(test_loc)
    print(f"Geocode result for '{test_loc}': {res}")

    print("\n=== Testing Open-Meteo Weather Risk Evaluation ===")
    sample_waypoints = [
        {"location_name": "Cảng Long Beach", "latitude": 33.7701, "longitude": -118.1937},
        {"location_name": "Kho Cát Lái", "latitude": 10.7769, "longitude": 106.7820}
    ]
    eval_result = evaluate_weather_delay_risk(sample_waypoints)
    print(json.dumps(eval_result, indent=2, ensure_ascii=False))
