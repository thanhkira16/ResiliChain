# 05. AI WORKER & HỢP ĐỒNG DỮ LIỆU TRÊN DATABASE DÙNG CHUNG

## 1. Mô Hình Tích Hợp: không có API giữa Backend và AI

Backend **không gọi AI service**. AI service là một **background worker** chạy theo lịch,
đọc dữ liệu ERP từ database dùng chung, phân tích, rồi ghi kết quả ngược lại chính database đó.
Backend chỉ `SELECT`.

```
                     ┌──────────── SUPABASE POSTGRESQL (dùng chung) ────────────┐
                     │                                                          │
   ┌──────────┐      │  ERP (Backend ghi)          AI (worker ghi)              │
   │ BACKEND  │─────►│  suppliers                  supplier_risk_analysis       │
   │   WEB    │◄─────│  inventory_items            incidents                    │
   └──────────┘SELECT│  purchase_orders            sourcing_proposals           │
                     │  shipments                  ai_job_runs                  │
                     │  shipment_tracking_points                                │
                     └───────▲──────────────────────────────┬───────────────────┘
                             │ SELECT                       │ INSERT / UPDATE
                             │                              │
                     ┌───────┴──────────────────────────────▼───────┐
                     │        AI WORKER (ai_worker.py)              │
                     │  • order_risk_scan     mỗi 5-10 phút         │
                     │  • supplier_risk_scan  1 lần/ngày            │
                     └───────────────────────▲──────────────────────┘
                                             │ GDELT · FMP · Weather
                                             │ (chỉ ở nhịp ngày)
```

Hệ quả: không còn tầng HTTP nào giữa hai bên. Không timeout, không retry, không contract DTO
phải đồng bộ hai phía — chỉ còn **hợp đồng trên bảng dữ liệu**.

---

## 2. Chốt: AI được ghi vào bảng nào

| Bảng | AI đọc | AI ghi | Ghi chú |
| :--- | :---: | :---: | :--- |
| `suppliers` | ✅ | ❌ | Master data của Backend |
| `inventory_items` | ✅ | ❌ | Tồn kho, `weekly_burn_rate` để tính ngày cạn |
| `purchase_orders` | ✅ | ⚠️ **chỉ 2 cột** | Xem mục 2.1 |
| `shipments` | ✅ | ❌ | Backend/logistics sở hữu |
| `shipment_tracking_points` | ✅ | ❌ | GPS ping — nguồn để dự báo ETA |
| `supplier_risk_analysis` | ✅ | ✅ | **AI sở hữu hoàn toàn** |
| `incidents` | ✅ | ✅ | **AI sở hữu** — trừ trường hợp ở mục 2.2 |
| `sourcing_proposals` | ✅ | ✅ | **AI sở hữu** — trừ trường hợp ở mục 2.2 |
| `ai_job_runs` | ✅ | ✅ | **AI sở hữu** |
| `users`, `refresh_tokens`, `migrations` | ❌ | ❌ | Không liên quan |

### 2.1 Hai cột duy nhất AI được ghi trong bảng của Backend

```sql
UPDATE purchase_orders
SET current_risk_score = :score,      -- numeric, nullable - điểm rủi ro trễ 0-100
    risk_breakdown     = :breakdown   -- jsonb,   nullable - 3 cấu phần + diễn giải công thức
WHERE po_number = :po;
```

Hai cột này `nullable` và không được Backend ghi, nên không tranh chấp.

**AI KHÔNG ghi `actual_or_expected_delivery_date`.** Đó là ước lượng của ERP.
ETA do AI dự báo nằm trong `incidents.risk_breakdown` (khoá `deliveryForecast`), để hai con số
đứng cạnh nhau mà đối chiếu chứ không đè lên nhau.

### 2.2 Không lật quyết định của con người

Vòng quét sau **phải bỏ qua** bản ghi đã có quyết định:

```sql
-- bỏ qua nếu đã chốt
WHERE incidents.state          NOT IN ('RESOLVED', 'REJECTED')
  AND sourcing_proposals.status NOT IN ('Đã duyệt', 'Đã từ chối')
```

Số bản ghi bị bỏ qua được ghi vào `ai_job_runs.skipped_locked` để kiểm tra lại được.

---

## 3. Hai Nhịp Chạy

| Job | Chu kỳ | Gọi API ngoài | Việc làm |
| :--- | :--- | :--- | :--- |
| `supplier_risk_scan` | **1 lần/ngày** | GDELT + FMP | Cập nhật `ssi_news`, `ssi_fin`, `g_geo`, `altman_z`, `key_events` |
| `order_risk_scan` | **5–10 phút** | không | Tính `ssi_del` → `pors_score` → dự báo ETA → `incidents` → `sourcing_proposals` |

Tách nhịp vì hai lý do: tin tức và báo cáo tài chính không đổi theo phút, và gói FMP có hạn ngạch
(CATL, LGES, Panasonic đã trả HTTP 402 — xem mục Giới hạn của báo cáo radar).

```bash
./venv/bin/python ai_worker.py --once                  # 1 vòng order_risk_scan rồi thoát
./venv/bin/python ai_worker.py --loop 300              # chạy nền, 5 phút/vòng
./venv/bin/python ai_worker.py --once --scan-suppliers # kèm quét lại GDELT/FMP
```

**Chỉ chạy một bản worker tại một thời điểm.** Hai tiến trình cùng chạy sẽ ghi đè nhau.

---

## 4. Hoàn Thiện Công Thức PORS

Báo cáo radar (`bao-cao-rui-ro-nha-cung-ung.html`) tự nêu ở mục giới hạn: PORS cần 4 cấu phần
nhưng báo cáo mới có `SSI_news` và `SSI_fin` (0,65 trọng số), còn `SSI_del` và `G_geo` cấp đơn hàng
"chỉ lấy được từ DB ERP nội bộ". Database dùng chung chính là DB đó, nên worker tính nốt:

```
SSI_del = 100 * (0.6 * (1 - reliability_score/100) + 0.4 * rủi_ro_thời_tiết_tuyến)
PORS    = 0.35*SSI_news + 0.30*SSI_fin + 0.20*SSI_del + 0.15*G_geo
```

`ssi_del`, `pors_score`, `risk_level` hiện đang `NULL` — đó là phần worker sẽ điền.

---

## 5. Dự Báo ETA Từ GPS Ping

Worker **không** dùng ngày giao dự kiến của Backend làm đầu vào. Nó tự dự báo từ
`shipment_tracking_points`:

```
predictedDelayDays = scheduleSlipDays    (chặng đã qua so với kế hoạch, suy từ recorded_at)
                   + weatherDelayDays    (thời tiết trên phần đường CÒN LẠI)
                   + reliabilitySlipDays (lịch sử giao hàng của NCC)
```

Ping có `speed_kmh = 0` và `recorded_at` cũ nhiều ngày nghĩa là lô hàng **đứng im** —
tín hiệu mạnh hơn nhiều so với đếm số chặng. Dữ liệu hiện tại có 5 lô như vậy,
nặng nhất là `PO-2026-003` (Ford) đứng im 12 ngày tại cảng Long Beach.

Sau đó chấm điểm theo công thức `docs/02`:

```
delayRiskScore = round(100 * (0.50*latenessFactor + 0.25*supplierReliabilityFactor
                              + 0.25*inventoryBufferFactor))
```

Vượt ngưỡng 65 thì tạo `incidents` trạng thái `PENDING_APPROVAL` và chạy MILP (`docs/03`)
sinh `sourcing_proposals`.

---

## 6. Backend Query Gì

```sql
-- Sự cố đang chờ duyệt
SELECT * FROM incidents WHERE state = 'PENDING_APPROVAL' ORDER BY delay_risk_score DESC;

-- Đề xuất thay thế của một sự cố
SELECT * FROM sourcing_proposals WHERE incident_id = $1;

-- Radar rủi ro nhà cung ứng
SELECT s.name, r.* FROM supplier_risk_analysis r
JOIN suppliers s ON s.id = r.supplier_id
ORDER BY r.pors_score DESC NULLS LAST;

-- Dữ liệu mới tới đâu, job còn sống không
SELECT * FROM ai_job_runs ORDER BY started_at DESC LIMIT 5;
```

Quản lý duyệt/từ chối thì Backend `UPDATE sourcing_proposals.status` và `incidents.state` —
worker sẽ tôn trọng và không ghi đè (mục 2.2).

---

## 7. Điểm Yếu Cần Biết Trước

**Độ trễ.** Backend tạo PO lúc 10:00, worker chạy 10:05 thì Web hiển thị "chưa phân tích"
trong 5 phút. Nếu demo cần thấy ngay: để chu kỳ 60 giây, hoặc bấm `--once` bằng tay.

**Bảng AI chưa có migration TypeORM.** `supplier_risk_analysis` và `ai_job_runs` được tạo bằng
`ai_schema.sql`. Nếu Backend bật `synchronize: true` thì có thể bị drop — cần team Backend
thêm migration tương ứng.

**Thời tiết vẫn mô phỏng.** `.env` mới có `GDELT_API_KEY` và `FMP_API_KEY`, chưa có key Weather.
Phần `weatherDelayDays` là giá trị sinh theo toạ độ, không phải dữ liệu thật — được đánh dấu
rõ trong `risk_breakdown.dataSources`.

---

## 8. File Liên Quan

| File | Vai trò |
| :--- | :--- |
| `ai_schema.sql` | DDL các bảng AI sở hữu |
| `seed_supabase.py` | Seed dữ liệu ERP + rủi ro từ báo cáo radar (`--apply`, `--reset`) |
| `report_parser.py` | Trích xuất số liệu từ `bao-cao-rui-ro-nha-cung-ung.html` |
| `db_inspect.py` | Đọc/kiểm tra database (`--table`, `--sql`, `--schema`, `--json`) |
| `ai_worker.py` | Worker chạy job (chưa viết) |
