# 01. TỔNG QUAN KIẾN TRÚC & HỢP ĐỒNG DỮ LIỆU (BIKESYNC AI SYSTEM)

## 1. Mô Hình Tích Hợp

**BikeSync AI Engine** là một **background worker**, không phải API service. Nó dùng chung
database PostgreSQL (Supabase) với Backend: đọc dữ liệu ERP, phân tích, ghi kết quả trở lại
cùng database đó. Backend chỉ `SELECT`, không gọi AI.

Hai nhiệm vụ cốt lõi:
1. **Đánh giá rủi ro (`Risk Assessment Engine`)** — đọc đơn hàng, tồn kho và GPS ping của lô hàng
   từ DB, làm giàu bằng tin tức địa chính trị (**GDELT**), sức khoẻ tài chính (**FMP**) và
   thời tiết tuyến (**3 Weather API**), rồi tính `incidents`.
2. **Đề xuất đối tác thay thế (`Sourcing Proposals Engine`)** — khi sự cố vượt ngưỡng, chạy
   **PuLP MILP Solver** kết hợp **OpenAI GPT-4o** xếp hạng tối đa 3 đối tác kèm giải trình
   Pros/Cons, ghi vào `sourcing_proposals`.

```
                     ┌──────────── SUPABASE POSTGRESQL (dùng chung) ────────────┐
                     │                                                          │
   ┌──────────┐      │  Backend ghi:                AI worker ghi:              │
   │ BACKEND  │─────►│  suppliers                   supplier_risk_analysis      │
   │   WEB    │◄─────│  inventory_items             incidents                   │
   └──────────┘SELECT│  purchase_orders             sourcing_proposals          │
                     │  shipments                   ai_job_runs                 │
                     │  shipment_tracking_points                                │
                     └───────▲──────────────────────────────┬───────────────────┘
                             │ SELECT                       │ INSERT / UPDATE
                     ┌───────┴──────────────────────────────▼───────┐
                     │        AI WORKER (ai_worker.py)              │
                     │  order_risk_scan      mỗi 5-10 phút          │
                     │  supplier_risk_scan   1 lần/ngày             │
                     └───────────────────────▲──────────────────────┘
                                             │ GDELT · FMP · Weather
```

Chi tiết hợp đồng ghi/đọc từng bảng: xem `docs/05_ai_worker_va_db_contract.md`.

---

## 2. Luồng Xử Lý Một Vòng Quét

```
AI WORKER                     DATABASE DÙNG CHUNG            API NGOÀI
   │                                │                            │
   │── 1. SELECT đơn chưa xong ────►│                            │
   │◄── purchase_orders + inventory │                            │
   │── 2. SELECT GPS ping ─────────►│                            │
   │◄── shipment_tracking_points    │                            │
   │                                │                            │
   │── 3. (nhịp ngày) quét rủi ro NCC ───────────────────────────►│ GDELT · FMP
   │◄── SSI_news, SSI_fin, Altman Z, key_events ─────────────────│
   │── 4. UPSERT supplier_risk_analysis ──►│                     │
   │                                │                            │
   │── 5. Dự báo ETA từ GPS ping + tính PORS + chấm điểm ────────┤
   │── 6. UPSERT incidents ────────►│                            │
   │                                │                            │
   │── 7. Nếu vượt ngưỡng: MILP + GPT-4o ───────────────────────►│ OpenAI
   │── 8. UPSERT sourcing_proposals ►│                           │
   │── 9. INSERT ai_job_runs ──────►│                            │
                                    │
                          BACKEND chỉ SELECT từ đây
```

---

## 3. Bảng Khớp Nối Field Mapping Chi Tiết (DTO Contracts)

### 3.1 `PurchaseOrderDto` (`GET /api/orders`)
| Trường Backend | Kiểu Dữ Liệu | Bắt Buộc | Mô Tả & Sử Dụng Trong AI Engine |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Bắt buộc | ID duy nhất định danh đơn hàng (ví dụ: `"po-3"`) |
| `poNumber` | `string` | Bắt buộc | Mã PO thương mại (ví dụ: `"PO-2026-003"`) |
| `supplierId` | `string` | Bắt buộc | Mã nhà cung cấp (ví dụ: `"SUP-03"`) |
| `supplierName` | `string` | Bắt buộc | Tên đầy đủ nhà cung cấp |
| `sku` | `string` | Bắt buộc | Mã linh kiện (ví dụ: `"SKU-BRK-03"`) |
| `skuName` | `string` | Bắt buộc | Tên mô tả linh kiện |
| `quantity` | `number` | Bắt buộc | Số lượng đơn vị đặt hàng |
| `unitPrice` | `number` | Bắt buộc | Đơn giá sản phẩm (VNĐ) |
| `totalAmount` | `number` | Bắt buộc | Tổng tiền đơn hàng (`quantity * unitPrice`) |
| `orderDate` | `string` | Bắt buộc | Ngày phát hành PO (`YYYY-MM-DD`) |
| `promisedDeliveryDate` | `string` | Bắt buộc | Ngày cam kết giao hàng theo hợp đồng |
| `actualOrExpectedDeliveryDate` | `string` | Bắt buộc | Ngày dự kiến thực tế giao hàng (được AI cập nhật thêm trễ do thời tiết) |
| `status` | `string` | Bắt buộc | Trạng thái: `"Đang xử lý"` \| `"Đang giao"` \| `"Trễ hẹn"` \| `"Hoàn thành"` |
| `currentRiskScore` | `number` | Tùy chọn | Điểm số rủi ro trễ hạn từ `0` đến `100` |
| `riskBreakdown` | `RiskBreakdownDto` | Tùy chọn | Bảng phân tách các chỉ số tính toán rủi ro của AI Engine |

### 3.2 `SupplierDto` & `TransitWaypointDto` (`GET /api/suppliers`)
| Trường Backend | Kiểu Dữ Liệu | Mô Tả & Tích Hợp AI |
| :--- | :--- | :--- |
| `providedSkus` | `Array<string>` | Danh sách các mã SKU nhà cung ứng có khả năng sản xuất |
| `averageLeadTimeDays` | `number` | Thời gian giao hàng trung bình (ngày) |
| `reliabilityScore` | `number` | Điểm số uy tín lịch sử ($0 - 100$) |
| `transitWaypoints` | `Array<TransitWaypointDto>` | Danh sách các điểm dừng GPS (`latitude`, `longitude`) để 3 Weather APIs quét thời tiết |

---

## 4. Hợp Đồng Dữ Liệu Thay Cho API Schema

Không còn request/response JSON giữa Backend và AI. Các DTO ở mục 3 giờ tương ứng
trực tiếp với cột trong database dùng chung:

| DTO cũ | Bảng | Ai ghi |
| :--- | :--- | :--- |
| `PurchaseOrderDto` | `purchase_orders` | Backend (AI chỉ ghi `current_risk_score`, `risk_breakdown`) |
| `SupplierDto` | `suppliers` | Backend |
| `TransitWaypointDto` | `suppliers.transit_waypoints` (jsonb) + `shipment_tracking_points` | Backend |
| `IncidentDto` | `incidents` | **AI** |
| `RiskBreakdownDto` | `incidents.risk_breakdown` (jsonb) | **AI** |
| `SourcingProposalDto` | `sourcing_proposals` | **AI** |
| `ProposalRankingDto` | `sourcing_proposals.rankings` (jsonb) | **AI** |
| — (mới) | `supplier_risk_analysis` | **AI** |
| — (mới) | `ai_job_runs` | **AI** |

Ranh giới ghi chi tiết, quy tắc không ghi đè quyết định của người duyệt, và các câu query
mẫu cho Backend: xem `docs/05_ai_worker_va_db_contract.md`.
