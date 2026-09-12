#!/usr/bin/env python3
"""
EV Supply Chain Autonomy Platform - AGENT 3: Financial Health Agent
File: apidata/fmp_supplier_financials.py

Nguồn dữ liệu: Financial Modeling Prep API (https://financialmodelingprep.com/stable)
  - GET /profile                  : tên, ngành, quốc gia, vốn hóa, beta, giá & biến động
  - GET /financial-scores         : altmanZScore, piotroskiScore + các cấu phần thô
  - GET /balance-sheet-statement  : totalCurrentAssets/Liabilities, totalAssets, retainedEarnings
  - GET /income-statement         : revenue, operatingIncome (EBIT)

Đầu ra: Altman Z-Score + SSI_fin (0-100) cho đúng 10 nhà cung ứng ở
        apidata/gdelt_supplier_risk.py, theo công thức 5.2 của DOCUMENTATION.md:
            Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 0.999*X5

Chạy:  python3 apidata/fmp_supplier_financials.py
Ghi:   apidata/out/fmp_supplier_financials.json
"""

import os
import json
import time
import hashlib
import threading
import urllib.request
import urllib.parse
import urllib.error
import concurrent.futures as futures
from datetime import datetime, timezone

BASE_URL = "https://financialmodelingprep.com/stable"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
OUT_FILE = os.path.join(OUT_DIR, "fmp_supplier_financials.json")
CACHE_DIR = os.path.join(OUT_DIR, ".cache_fmp")

# Gói free của FMP giới hạn hạn ngạch THEO NGÀY (~250 request) và trả
# 429 "Limit Reach" khi cạn - không phải lỗi tạm thời, chờ lại cũng vô ích.
# Vì vậy: (1) chỉ gọi 2 endpoint/nhà cung ứng, (2) cache xuống đĩa,
# (3) không ghi đè kết quả tốt bằng một lần chạy thiếu dữ liệu.
CACHE_TTL_SECONDS = 12 * 3600
RATE_LIMIT_RPM = 45

# Hệ số Altman Z-Score bản gốc cho doanh nghiệp sản xuất niêm yết (công thức 5.2)
Z_COEFF = {"X1": 1.2, "X2": 1.4, "X3": 3.3, "X4": 0.6, "X5": 0.999}

# Ngưỡng diễn giải Altman Z chuẩn
Z_DISTRESS, Z_SAFE = 1.81, 2.99

# NIO (Z=1.06, kiệt quệ tài chính) đã bị loại khỏi danh sách: GDELT chỉ có coverage_30d=2
# và 0 sự kiện trong 30 ngày, nên không khớp được cả 2 API. AMD thay vào vì phủ tốt cả hai.
# ----------------------------------------------------------------------------------
# 10 NHÀ CUNG ỨNG "CÓ VẤN ĐỀ" - trùng khớp danh sách ở apidata/gdelt_supplier_risk.py.
# Mọi ticker dưới đây đã được xác minh là truy cập được trên gói FMP hiện tại
# (nhiều mã EV khác như ALB, BYDDY, PCRFY, NXPI, STM chỉ trả HTTP 402 Payment Required).
# ----------------------------------------------------------------------------------
SUPPLIER_UNIVERSE = [
    {"ticker": "LCID", "name": "Lucid Motors",   "cluster": 2, "hs_code": "850153", "country": "US",
     "role": "Drive unit & E-Motor (cấp cho Aston Martin)"},
    {"ticker": "RIVN", "name": "Rivian",         "cluster": 2, "hs_code": "850153", "country": "US",
     "role": "Enduro drive unit & Inverter nội bộ"},
    {"ticker": "F",    "name": "Ford Motor",     "cluster": 1, "hs_code": "850760", "country": "US",
     "role": "BlueOval SK - Cell pin LFP/NCM"},
    {"ticker": "AMD",  "name": "Advanced Micro Devices", "cluster": 3, "hs_code": "854231", "country": "US",
     "role": "Xilinx automotive FPGA & ADAS compute"},
    {"ticker": "GM",   "name": "General Motors", "cluster": 1, "hs_code": "850760", "country": "US",
     "role": "Ultium Cells - Cell pin NCMA"},
    {"ticker": "INTC", "name": "Intel",          "cluster": 3, "hs_code": "854231", "country": "US",
     "role": "Mobileye ADAS SoC & MCU"},
    {"ticker": "SONY", "name": "Sony Group",     "cluster": 3, "hs_code": "854110", "country": "JP",
     "role": "Cảm biến CMOS / LiDAR module"},
    {"ticker": "TSM",  "name": "TSMC",           "cluster": 3, "hs_code": "854231", "country": "TW",
     "role": "Foundry đúc toàn bộ MCU ô tô"},
    {"ticker": "TSLA", "name": "Tesla",          "cluster": 1, "hs_code": "850760", "country": "US",
     "role": "Cell 4680 Cylindrical & Pack"},
    {"ticker": "NVDA", "name": "Nvidia",         "cluster": 3, "hs_code": "854231", "country": "US",
     "role": "DRIVE Orin/Thor - SoC điều khiển"},
]


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
    """Token bucket, giữ nhịp gọi dưới RATE_LIMIT_RPM request mỗi 60 giây."""

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


def _cache_path(endpoint: str, params: dict) -> str:
    key = hashlib.sha256(f"{endpoint}?{sorted(params.items())}".encode("utf-8")).hexdigest()[:20]
    return os.path.join(CACHE_DIR, f"{endpoint.replace('/', '_')}_{key}.json")


def api_get(endpoint: str, params: dict, api_key: str, retries: int = 1):
    """GET một endpoint FMP, ưu tiên cache đĩa. Trả về (data, error_message).

    Hạn ngạch FMP tính theo ngày nên cache là bắt buộc: mỗi lần chạy lại mà không có
    cache sẽ tiêu tốn thêm 20 request trong tổng số ~250 request/ngày.
    """
    path = _cache_path(endpoint, params)
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL_SECONDS:
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return json.load(fh), None
        except Exception:
            pass

    query = urllib.parse.urlencode({**params, "apikey": api_key})
    url = f"{BASE_URL}/{endpoint}?{query}"
    for attempt in range(retries + 1):
        _limiter.acquire()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "EV-SupplyChain-Agent3/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh)
            return data, None
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8") if exc.fp else ""
            if exc.code == 429:
                return None, "429 hết hạn ngạch FMP trong ngày (gói free ~250 request/ngày)"
            if exc.code == 402:
                return None, "402 Payment Required (ticker ngoài gói FMP hiện tại)"
            if attempt < retries:
                time.sleep(2)
                continue
            return None, f"HTTP {exc.code}: {body[:120]}"
        except Exception as exc:
            if attempt < retries:
                time.sleep(2)
                continue
            return None, str(exc)
    return None, "hết số lần thử lại"


def first(data):
    """FMP trả list; lấy bản ghi mới nhất."""
    return data[0] if isinstance(data, list) and data else {}


def compute_altman_z(scores: dict, balance: dict, income: dict):
    """Tính lại Z từ 5 biến thô để có thể truy vết, thay vì tin tuyệt đối vào altmanZScore."""
    total_assets = scores.get("totalAssets") or balance.get("totalAssets") or 0
    total_liab = scores.get("totalLiabilities") or balance.get("totalLiabilities") or 0
    if not total_assets or not total_liab:
        return None, {}

    working_capital = scores.get("workingCapital")
    if working_capital is None:
        working_capital = (balance.get("totalCurrentAssets") or 0) - (balance.get("totalCurrentLiabilities") or 0)

    x = {
        "X1": working_capital / total_assets,
        "X2": (scores.get("retainedEarnings") or balance.get("retainedEarnings") or 0) / total_assets,
        "X3": (scores.get("ebit") or income.get("operatingIncome") or 0) / total_assets,
        "X4": (scores.get("marketCap") or 0) / total_liab,
        "X5": (scores.get("revenue") or income.get("revenue") or 0) / total_assets,
    }
    z = sum(Z_COEFF[k] * v for k, v in x.items())
    return z, {k: round(v, 4) for k, v in x.items()}


def z_to_ssi_fin(z):
    """Quy Altman Z về thang rủi ro 0-100 (càng cao càng nguy hiểm).

    Z <= 1.81 -> vùng kiệt quệ (>= 70, đủ kích hoạt ngưỡng PORS của mục 5.3)
    Z >= 2.99 -> vùng an toàn
    """
    if z is None:
        return None
    if z <= Z_DISTRESS:
        # Z âm sâu bị phạt nặng thêm nhưng vẫn chặn trần ở 100
        return round(min(100.0, 70.0 + (Z_DISTRESS - z) * 8.0), 2)
    if z >= Z_SAFE:
        return round(max(5.0, 40.0 - (z - Z_SAFE) * 3.0), 2)
    # Vùng xám: nội suy tuyến tính 70 -> 40
    ratio = (z - Z_DISTRESS) / (Z_SAFE - Z_DISTRESS)
    return round(70.0 - ratio * 30.0, 2)


def zone(z):
    if z is None:
        return "UNKNOWN"
    if z <= Z_DISTRESS:
        return "DISTRESS"
    return "GREY" if z < Z_SAFE else "SAFE"


def analyse(supplier: dict, api_key: str) -> dict:
    ticker = supplier["ticker"]
    errors = {}

    profile_raw, err = api_get("profile", {"symbol": ticker}, api_key)
    if err:
        errors["profile"] = err
    profile = first(profile_raw)

    scores_raw, err = api_get("financial-scores", {"symbol": ticker}, api_key)
    if err:
        errors["financial-scores"] = err
    scores = first(scores_raw)

    # /financial-scores đã trả đủ 5 biến của Altman Z (workingCapital, totalAssets,
    # totalLiabilities, retainedEarnings, ebit, marketCap, revenue). Chỉ gọi thêm
    # 2 báo cáo tài chính khi nó thiếu, để tiết kiệm hạn ngạch theo ngày.
    balance, income = {}, {}
    needed = ("totalAssets", "totalLiabilities", "retainedEarnings", "ebit", "revenue")
    if any(scores.get(k) is None for k in needed):
        balance_raw, err = api_get("balance-sheet-statement", {"symbol": ticker, "limit": 1}, api_key)
        if err:
            errors["balance-sheet-statement"] = err
        balance = first(balance_raw)

        income_raw, err = api_get("income-statement", {"symbol": ticker, "limit": 1}, api_key)
        if err:
            errors["income-statement"] = err
        income = first(income_raw)

    z_computed, x_vars = compute_altman_z(scores, balance, income)
    z_reported = scores.get("altmanZScore")
    z_final = z_computed if z_computed is not None else z_reported

    return {
        **supplier,
        "company_name": profile.get("companyName") or supplier["name"],
        "exchange": profile.get("exchange"),
        "sector": profile.get("sector"),
        "industry": profile.get("industry"),
        "hq_country": profile.get("country") or supplier["country"],
        "market_cap": profile.get("marketCap"),
        "price": profile.get("price"),
        "change_percentage": profile.get("changePercentage"),
        "beta": profile.get("beta"),
        "fiscal_period": {"date": balance.get("date"), "fiscalYear": balance.get("fiscalYear"),
                          "period": balance.get("period"),
                          "currency": balance.get("reportedCurrency") or scores.get("reportedCurrency")},
        "altman_z_components": x_vars,
        "altman_z_computed": round(z_final, 3) if z_final is not None else None,
        "altman_z_reported": round(z_reported, 3) if isinstance(z_reported, (int, float)) else None,
        "piotroski_score": scores.get("piotroskiScore"),
        "zone": zone(z_final),
        "SSI_fin": z_to_ssi_fin(z_final),
        "raw_financials": {
            "workingCapital": scores.get("workingCapital"),
            "totalAssets": scores.get("totalAssets") or balance.get("totalAssets"),
            "totalLiabilities": scores.get("totalLiabilities") or balance.get("totalLiabilities"),
            "retainedEarnings": scores.get("retainedEarnings") or balance.get("retainedEarnings"),
            "ebit": scores.get("ebit") or income.get("operatingIncome"),
            "revenue": scores.get("revenue") or income.get("revenue"),
        },
        "errors": errors,
    }


def main():
    load_dotenv()
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        raise SystemExit("Thiếu FMP_API_KEY trong .env")

    print("=" * 100)
    print("AGENT 3 - FINANCIAL HEALTH  |  Nguồn: Financial Modeling Prep API")
    print(f"Thời điểm: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  |  Key: {api_key[:6]}...{api_key[-4:]}")
    print("=" * 100)

    with futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda s: analyse(s, api_key), SUPPLIER_UNIVERSE))

    # Nhà cung ứng "có vấn đề" nhất xếp trước
    results.sort(key=lambda r: (r["SSI_fin"] is None, -(r["SSI_fin"] or 0)))

    header = (f"{'#':<3}{'TICKER':<7}{'CÔNG TY':<22}{'CỤM':<5}{'HS':<8}"
              f"{'MKT CAP':>13}{'Altman Z':>10}{'VÙNG':>10}{'SSI_fin':>9}")
    print("\n" + header)
    print("-" * len(header))
    for idx, r in enumerate(results, 1):
        cap = f"${r['market_cap']/1e9:,.1f}B" if isinstance(r.get("market_cap"), (int, float)) else "N/A"
        z = f"{r['altman_z_computed']:.2f}" if r["altman_z_computed"] is not None else "N/A"
        ssi = f"{r['SSI_fin']:.1f}" if r["SSI_fin"] is not None else "N/A"
        print(f"{idx:<3}{r['ticker']:<7}{(r['company_name'] or '')[:21]:<22}{r['cluster']:<5}{r['hs_code']:<8}"
              f"{cap:>13}{z:>10}{r['zone']:>10}{ssi:>9}")

    print("\nCẤU PHẦN ALTMAN Z (X1..X5) CỦA 3 NHÀ CUNG ỨNG RỦI RO NHẤT")
    print("-" * 100)
    for r in results[:3]:
        x = r["altman_z_components"]
        print(f"\n▸ {r['ticker']} - {r['company_name']} | {r['role']}")
        print(f"    Kỳ báo cáo: {r['fiscal_period']['date']} ({r['fiscal_period']['period']} "
              f"{r['fiscal_period']['fiscalYear']}, {r['fiscal_period']['currency']})")
        if x:
            print(f"    X1(WC/TA)={x['X1']}  X2(RE/TA)={x['X2']}  X3(EBIT/TA)={x['X3']}  "
                  f"X4(MVE/TL)={x['X4']}  X5(Rev/TA)={x['X5']}")
        print(f"    Z = {r['altman_z_computed']} -> {r['zone']} | SSI_fin = {r['SSI_fin']} "
              f"| Piotroski = {r['piotroski_score']}")

    failed = [r for r in results if r["errors"]]
    if failed:
        print("\nCẢNH BÁO - endpoint không truy cập được:")
        for r in failed:
            print(f"    {r['ticker']}: {r['errors']}")

    os.makedirs(OUT_DIR, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {"api": "Financial Modeling Prep (stable)", "base_url": BASE_URL,
                   "endpoints": ["/profile", "/financial-scores",
                                 "/balance-sheet-statement (dự phòng)",
                                 "/income-statement (dự phòng)"],
                   "cache_ttl_seconds": CACHE_TTL_SECONDS},
        "formula": "Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 0.999*X5",
        "thresholds": {"distress": Z_DISTRESS, "safe": Z_SAFE},
        "supplier_count": len(results),
        "suppliers": results,
    }
    # Một lần chạy bị 429 giữa chừng sẽ cho Altman Z = None cho phần lớn nhà cung ứng.
    # Không để nó ghi đè lên kết quả đầy đủ của lần chạy trước.
    target = OUT_FILE
    if failed and os.path.exists(OUT_FILE):
        try:
            with open(OUT_FILE, "r", encoding="utf-8") as fh:
                previous = json.load(fh)
            prev_failed = sum(1 for x in previous.get("suppliers", []) if x.get("errors"))
            if prev_failed < len(failed):
                target = OUT_FILE.replace(".json", ".partial.json")
                print(f"\nLần chạy này thiếu dữ liệu hơn lần trước ({len(failed)} vs {prev_failed} lỗi)"
                      f" - giữ nguyên {os.path.basename(OUT_FILE)}.")
        except Exception:
            pass

    with open(target, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
    print(f"\nĐã ghi {len(results)} nhà cung ứng -> {target}")


if __name__ == "__main__":
    main()
