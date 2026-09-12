#!/usr/bin/env python3
"""
EV Supply Chain Autonomy Platform - AGENT 2: News & Geopolitical Risk Agent
File: apidata/gdelt_supplier_risk.py

Nguồn dữ liệu: GDELT Cloud API v2 (https://gdeltcloud.com/api/v2)
  - GET /search   : phân giải tên nhà cung ứng -> spine_id (e_...), coverage_30d, country_iso3
  - GET /events   : sự kiện ĐÃ RÀNG BUỘC VÀO ĐÚNG THỰC THỂ qua tham số `entity=<spine_id>`,
                    kèm bộ metric do coder chấm: significance, severity_tier, systemic_importance,
                    propagation_potential, market_sensitivity, confidence, article_count.
                    `include_total=true` trả pagination.estimated_total = tổng số sự kiện trong cửa sổ.

LƯU Ý QUAN TRỌNG: KHÔNG dùng `query=` dạng văn bản tự do ("Tesla supply chain disruption") -
GDELT sẽ khớp lỏng theo từ khoá rủi ro và trả về cùng một rổ tin vĩ mô cho mọi nhà cung ứng.
Chỉ `entity=` mới ràng buộc sự kiện vào đúng doanh nghiệp.

Đầu ra: SSI_news (0-100) cho 10 nhà cung ứng đang "có vấn đề" thuộc 3 cụm linh kiện EV
        theo công thức 5.1 của DOCUMENTATION.md:
            SSI_news = w1*ToneScore + w2*VolumeImpact + w3*GeoRiskPenalty

Chạy:  python3 apidata/gdelt_supplier_risk.py
Ghi:   apidata/out/gdelt_supplier_risk.json
"""

import os
import json
import time
import threading
import urllib.request
import urllib.parse
import urllib.error
import concurrent.futures as futures
from datetime import datetime, timezone

BASE_URL = "https://gdeltcloud.com/api/v2"

# Gói free của GDELT Cloud chặn ở 30 request/phút. Mỗi nhà cung ứng tốn 3 request
# (1 /search + 2 /events), tức 10 nhà cung ứng = 30 request - chạm đúng trần.
# Vì vậy phải tự điều tiết ở phía client, nếu không API sẽ trả 429 giữa chừng.
RATE_LIMIT_RPM = 26
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
OUT_FILE = os.path.join(OUT_DIR, "gdelt_supplier_risk.json")

# Trọng số công thức 5.1 - DOCUMENTATION.md
W_TONE, W_VOLUME, W_GEO = 0.50, 0.25, 0.25

# Cửa sổ quan sát (ngày) - API chặn tối đa 30 ngày cho mỗi lần gọi
WINDOW_DAYS = 30
# Số sự kiện tối đa kéo về cho mỗi nhà cung ứng (max 100 theo API)
EVENT_LIMIT = 60

# Hệ số rủi ro địa chính trị theo quốc gia đặt cơ sở sản xuất trọng yếu (0-1).
# Dùng cho GeoRiskPenalty - GDELT không cung cấp sẵn chỉ số này.
GEO_RISK = {
    "US": 0.25, "TW": 0.90, "CN": 0.78, "JP": 0.30,
    "KR": 0.45, "DE": 0.30, "NL": 0.28, "VN": 0.40,
}

# Số sự kiện nặng nhất dùng để tính ToneScore
TOP_K_EVENTS = 8

# Nhân hệ số theo mức nghiêm trọng GDELT trả về
SEVERITY_WEIGHT = {"critical": 1.00, "high": 0.85, "moderate": 0.65, "medium": 0.65, "low": 0.45}

# NIO (Z=1.06, kiệt quệ tài chính) đã bị loại khỏi danh sách: GDELT chỉ có coverage_30d=2
# và 0 sự kiện trong 30 ngày, nên không khớp được cả 2 API. AMD thay vào vì phủ tốt cả hai.
# ----------------------------------------------------------------------------------
# 10 NHÀ CUNG ỨNG "CÓ VẤN ĐỀ" - đã đối chiếu để CẢ GDELT lẫn FMP đều phủ được dữ liệu.
# (giữ nguyên danh sách này ở apidata/fmp_supplier_financials.py để 2 file chạy độc lập)
# ----------------------------------------------------------------------------------
SUPPLIER_UNIVERSE = [
    {"ticker": "LCID", "name": "Lucid Motors",              "cluster": 2,
     "hs_code": "850153", "country": "US", "role": "Drive unit & E-Motor (cấp cho Aston Martin)"},
    {"ticker": "RIVN", "name": "Rivian",                    "cluster": 2,
     "hs_code": "850153", "country": "US", "role": "Enduro drive unit & Inverter nội bộ"},
    {"ticker": "F",    "name": "Ford Motor",                "cluster": 1,
     "hs_code": "850760", "country": "US", "role": "BlueOval SK - Cell pin LFP/NCM"},
    {"ticker": "AMD",  "name": "Advanced Micro Devices",     "cluster": 3,
     "hs_code": "854231", "country": "US", "role": "Xilinx automotive FPGA & ADAS compute"},
    {"ticker": "GM",   "name": "General Motors",            "cluster": 1,
     "hs_code": "850760", "country": "US", "role": "Ultium Cells - Cell pin NCMA"},
    {"ticker": "INTC", "name": "Intel",                     "cluster": 3,
     "hs_code": "854231", "country": "US", "role": "Mobileye ADAS SoC & MCU"},
    {"ticker": "SONY", "name": "Sony Group",                "cluster": 3,
     "hs_code": "854110", "country": "JP", "role": "Cảm biến CMOS / LiDAR module"},
    {"ticker": "TSM",  "name": "TSMC",                      "cluster": 3,
     "hs_code": "854231", "country": "TW", "role": "Foundry đúc toàn bộ MCU ô tô"},
    {"ticker": "TSLA", "name": "Tesla",                      "cluster": 1,
     "hs_code": "850760", "country": "US", "role": "Cell 4680 Cylindrical & Pack"},
    {"ticker": "NVDA", "name": "Nvidia",                     "cluster": 3,
     "hs_code": "854231", "country": "US", "role": "DRIVE Orin/Thor - SoC điều khiển"},
]

# Câu truy vấn ngữ nghĩa, CHỈ áp dụng bên trong phạm vi entity đã phân giải,
# để tách riêng nhóm sự kiện mang tính đứt gãy chuỗi cung ứng.
RISK_QUERY = ("supply chain disruption, production halt, component shortage, plant fire, "
              "recall, export control, tariff, strike, capacity cut")


def load_dotenv(path=None):
    """Nạp .env ở thư mục gốc dự án mà không cần thư viện ngoài."""
    path = path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


class RateLimiter:
    """Token bucket đơn giản, chặn không cho vượt RATE_LIMIT_RPM request mỗi 60 giây."""

    def __init__(self, rpm: int):
        self.interval = 60.0 / float(rpm)
        self._lock = threading.Lock()
        self._next_slot = 0.0

    def acquire(self):
        with self._lock:
            now = time.monotonic()
            wait = max(0.0, self._next_slot - now)
            self._next_slot = max(now, self._next_slot) + self.interval
        if wait > 0:
            time.sleep(wait)


_limiter = RateLimiter(RATE_LIMIT_RPM)


def api_get(endpoint: str, params: dict, api_key: str, retries: int = 3) -> dict:
    """GET một endpoint GDELT Cloud.

    Luôn trả về dict có khoá "success". Khi thất bại, khoá "error" mô tả nguyên nhân -
    KHÔNG trả rổng im lặng, vì một lần 429 bị nuốt sẽ biến thành "0 sự kiện" và
    hạ điểm rủi ro của nhà cung ứng xuống một cách sai lệch.
    """
    url = f"{BASE_URL}/{endpoint}?" + urllib.parse.urlencode(params)
    headers = {"Authorization": f"Bearer {api_key}", "User-Agent": "EV-SupplyChain-Agent2/1.0"}
    for attempt in range(retries + 1):
        _limiter.acquire()
        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8") if exc.fp else ""
            if exc.code == 429 and attempt < retries:
                retry_after = 60
                try:
                    retry_after = int((json.loads(body).get("details") or {}).get("retry_after", 60))
                except Exception:
                    pass
                retry_after = int(exc.headers.get("Retry-After", retry_after) or retry_after)
                time.sleep(min(retry_after, 90) + 1)
                continue
            return {"success": False, "error": f"HTTP {exc.code}: {body[:160]}"}
        except Exception as exc:
            if attempt < retries:
                time.sleep(2)
                continue
            return {"success": False, "error": str(exc)}
    return {"success": False, "error": "hết số lần thử lại"}


def fetch_entity(supplier: dict, api_key: str) -> dict:
    """Tra cứu thực thể để lấy coverage_30d (mật độ đưa tin 30 ngày) và nguồn dữ liệu."""
    resp = api_get("search", {"q": supplier["name"], "limit": 5}, api_key)
    data = resp.get("data") or []
    if not data:
        return {"error": resp.get("error") or "không phân giải được thực thể"}
    best = max(data, key=lambda e: (e.get("match_score") or 0, e.get("coverage_30d") or 0))
    return {
        "entity_id": best.get("spine_id") or best.get("entity_id"),
        "entity_name": best.get("name"),
        "coverage_30d": best.get("coverage_30d") or 0,
        "country_iso3": best.get("country_iso3") or [],
        "monitorable": best.get("monitorable"),
        "sources": best.get("sources") or {},
    }


def _parse_events(data: list, supply_chain_scoped: bool) -> list:
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


def fetch_events(supplier: dict, entity: dict, api_key: str) -> tuple:
    """Kéo sự kiện đã ràng buộc vào đúng thực thể nhà cung ứng.

    Gọi 2 lượt trong cùng phạm vi `entity`:
      (a) toàn bộ sự kiện 30 ngày, sắp theo significance  -> nền tin tức chung
      (b) lọc ngữ nghĩa theo RISK_QUERY                   -> riêng nhóm đứt gãy chuỗi cung ứng
    """
    handle = entity.get("entity_id") or supplier["name"]
    base = {"entity": handle, "days": WINDOW_DAYS, "limit": EVENT_LIMIT,
            "sort": "significance", "include_total": "true"}

    errors = []
    all_resp = api_get("events", base, api_key)
    if all_resp.get("error"):
        errors.append(f"events: {all_resp['error']}")
    all_events = _parse_events(all_resp.get("data") or [], False)
    estimated_total = (all_resp.get("pagination") or {}).get("estimated_total") or len(all_events)

    risk_resp = api_get("events", {**base, "search": RISK_QUERY, "search_mode": "semantic"}, api_key)
    if risk_resp.get("error"):
        errors.append(f"events+search: {risk_resp['error']}")
    risk_ids = {e.get("id") for e in (risk_resp.get("data") or [])}

    for ev in all_events:
        ev["supply_chain_scoped"] = ev["id"] in risk_ids
    return all_events, estimated_total, errors


def tone_score(events: list) -> float:
    """ToneScore (0-100): mức độ tiêu cực/nghiêm trọng của dòng tin về nhà cung ứng.

    GDELT Cloud không trả tone thô như GDELT DOC 2.0 mà trả bộ metric đã được coder chấm,
    nên ToneScore tổng hợp từ significance (nhân trọng số severity_tier), systemic_importance,
    propagation_potential và market_sensitivity. Sự kiện thuộc nhóm đứt gãy chuỗi cung ứng
    (supply_chain_scoped) được nhân thêm hệ số vì đúng trọng tâm rủi ro của bài toán.

    Lấy trung bình TOP_K_EVENTS sự kiện nặng nhất thay vì trung bình toàn bộ, để một sự cố
    nghiêm trọng không bị pha loãng bởi hàng chục tin thường.
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


def volume_impact(events: list, estimated_total: int, coverage_30d: int) -> float:
    """VolumeImpact (0-100): khối lượng & mật độ đưa tin bất thường quanh nhà cung ứng.

    estimated_total = tổng số sự kiện gắn với thực thể trong cửa sổ 30 ngày
                      (pagination.estimated_total, bật bằng include_total=true)
    coverage_30d    = mật độ đưa tin 30 ngày do /search trả về cho thực thể đó.
    """
    articles = sum(ev["article_count"] for ev in events)
    sc_events = sum(1 for ev in events if ev.get("supply_chain_scoped"))
    event_component = min(1.0, (estimated_total or 0) / 40.0)
    supply_component = min(1.0, sc_events / 12.0)
    article_component = min(1.0, articles / 90.0)
    coverage_component = min(1.0, (coverage_30d or 0) / 150.0)
    return 100.0 * (0.35 * event_component + 0.25 * supply_component
                    + 0.20 * article_component + 0.20 * coverage_component)


def geo_risk_penalty(supplier: dict, events: list) -> float:
    """GeoRiskPenalty (0-100): rủi ro địa chính trị của nước đặt năng lực sản xuất
    cộng thêm phần rủi ro của các nước thực sự xuất hiện trong sự kiện."""
    base = GEO_RISK.get(supplier["country"], 0.35)
    iso2 = {"China": "CN", "Taiwan": "TW", "United States": "US", "Japan": "JP",
            "South Korea": "KR", "Germany": "DE", "Netherlands": "NL", "Vietnam": "VN"}
    event_risks = [GEO_RISK[iso2[ev["country"]]] for ev in events
                   if ev.get("country") in iso2 and iso2[ev["country"]] in GEO_RISK]
    observed = max(event_risks) if event_risks else base
    return 100.0 * min(1.0, 0.6 * base + 0.4 * observed)


def analyse(supplier: dict, api_key: str) -> dict:
    entity = fetch_entity(supplier, api_key)
    events, estimated_total, errors = fetch_events(supplier, entity, api_key)
    if entity.get("error"):
        errors.append(f"search: {entity['error']}")

    tone = tone_score(events)
    volume = volume_impact(events, estimated_total, entity.get("coverage_30d", 0))
    geo = geo_risk_penalty(supplier, events)
    ssi_news = W_TONE * tone + W_VOLUME * volume + W_GEO * geo

    top_events = sorted(events, key=lambda e: (e.get("supply_chain_scoped", False),
                                               e["significance"]), reverse=True)[:3]
    return {
        **supplier,
        "entity": entity,
        "components": {
            "ToneScore": round(tone, 2),
            "VolumeImpact": round(volume, 2),
            "GeoRiskPenalty": round(geo, 2),
            "weights": {"w1_tone": W_TONE, "w2_volume": W_VOLUME, "w3_geo": W_GEO},
        },
        "SSI_news": round(ssi_news, 2),
        "event_count": len(events),
        "estimated_total_30d": estimated_total,
        "supply_chain_event_count": sum(1 for e in events if e.get("supply_chain_scoped")),
        "errors": errors,
        "top_events": [
            {"title": e["title"], "event_date": e["event_date"], "country": e["country"],
             "severity_tier": e["severity_tier"], "significance": round(e["significance"], 3),
             "supply_chain_scoped": e.get("supply_chain_scoped", False), "url": e["url"]}
            for e in top_events
        ],
        "events": events,
    }


def main():
    load_dotenv()
    api_key = os.environ.get("GDELT_API_KEY")
    if not api_key:
        raise SystemExit("Thiếu GDELT_API_KEY trong .env")

    print("=" * 96)
    print("AGENT 2 - NEWS & GEOPOLITICAL RISK  |  Nguồn: GDELT Cloud API v2")
    print(f"Thời điểm: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  Key: {api_key[:10]}...{api_key[-4:]}")
    print("=" * 96)

    with futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda s: analyse(s, api_key), SUPPLIER_UNIVERSE))

    results.sort(key=lambda r: r["SSI_news"], reverse=True)

    header = (f"{'#':<3}{'TICKER':<7}{'NHÀ CUNG ỨNG':<18}{'CỤM':<5}{'HS':<8}"
              f"{'TONE':>7}{'VOL':>7}{'GEO':>7}{'SSI_news':>10}{'EV30':>6}{'SC':>4}")
    print("\n" + header)
    print("-" * len(header))
    for idx, r in enumerate(results, 1):
        c = r["components"]
        print(f"{idx:<3}{r['ticker']:<7}{r['name'][:17]:<18}{r['cluster']:<5}{r['hs_code']:<8}"
              f"{c['ToneScore']:>7.1f}{c['VolumeImpact']:>7.1f}{c['GeoRiskPenalty']:>7.1f}"
              f"{r['SSI_news']:>10.2f}{r['estimated_total_30d']:>6}{r['supply_chain_event_count']:>4}")

    print("\nSỰ KIỆN RỦI RO NỔI BẬT (top 3 nhà cung ứng)")
    print("-" * 96)
    for r in results[:3]:
        print(f"\n▸ {r['ticker']} - {r['name']} (SSI_news={r['SSI_news']}) | {r['role']}")
        for ev in r["top_events"]:
            tag = "[CHUỖI CUNG ỨNG]" if ev["supply_chain_scoped"] else "[tin chung]     "
            print(f"    {tag} [{ev['event_date']}] {ev['severity_tier'].upper():<8} "
                  f"sig={ev['significance']:.3f} {(ev['country'] or '-')[:12]:<13}{ev['title'][:60]}")

    failed = [r for r in results if r["errors"]]
    if failed:
        print("\nCẢNH BÁO - số liệu dưới đây KHÔNG đầy đủ, điểm rủi ro bị hạ thấp sai lệch:")
        for r in failed:
            for err in r["errors"]:
                print(f"    {r['ticker']}: {err}")

    os.makedirs(OUT_DIR, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {"api": "GDELT Cloud API v2", "base_url": BASE_URL,
                   "endpoints": ["/search", "/events?entity=&days=30&include_total=true"],
                   "window_days": WINDOW_DAYS},
        "formula": "SSI_news = 0.50*ToneScore + 0.25*VolumeImpact + 0.25*GeoRiskPenalty",
        "supplier_count": len(results),
        "suppliers": results,
    }
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    print(f"\nĐã ghi {len(results)} nhà cung ứng -> {OUT_FILE}")


if __name__ == "__main__":
    main()
