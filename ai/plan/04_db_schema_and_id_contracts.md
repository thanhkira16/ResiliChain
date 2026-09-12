# 04. DATABASE SCHEMA, HỢP ĐỒNG GHI & SEED DỮ LIỆU

> **Nguồn sự thật là DATABASE ĐANG CHẠY, không phải tài liệu này.**
> `incidents`, `sourcing_proposals`, `purchase_orders` do Backend sở hữu qua TypeORM
> migration. AI Worker phải ghi theo đúng cột của Backend, không được tạo schema riêng.
> Toàn bộ số liệu dưới đây đã được verify trực tiếp trên Supabase ngày 2026-09-12.

---

## 1. QUYỀN GHI

| Bảng | AI đọc | AI ghi | Chủ sở hữu schema |
| :--- | :---: | :---: | :--- |
| `suppliers`, `inventory_items`, `shipments`, `shipment_tracking_points` | ✅ | ❌ | Backend |
| `purchase_orders` | ✅ | ⚠️ **chỉ `current_risk_score` + `risk_breakdown`** | Backend |
| `incidents` | ✅ | ✅ | **Backend** (migration `1761500000000`) |
| `sourcing_proposals` | ✅ | ✅ | **Backend** (migration `1761500000000`) |
| `supplier_risk_analysis` | ✅ | ✅ | AI |
| `ai_job_runs` | ✅ | ✅ | AI |

⚠️ `supplier_risk_analysis` và `ai_job_runs` **chưa có entity TypeORM** →
Backend hiện chưa đọc được. Cần bổ sung entity thì PORS mới hiện ra API.

---

## 2. SƠ ĐỒ KHOÁ THỰC TẾ

Liên kết **không** đi qua `order_id`/`sku_id` như bản nháp trước. Khoá thật:

```text
 purchase_orders                     suppliers                inventory_items
 ├ id            (PK)                ├ id  (PK)               ├ sku (PK)
 └ po_number     (UNIQUE) ◄──┐       └ ...                    └ ...
                             │          ▲                        ▲
      ┌──────────────────────┤          │ supplier_id            │ sku
      │ po_number            │          │                        │
 incidents ───────────────────┴──────────┴────────────────────────┘
 ├ id (PK)  "INC-<po_number>"
 └ ▲ incident_id
   │
 sourcing_proposals
 ├ id (PK)  "PROP-<po_number>"
 └ po_number ──► purchase_orders.po_number      (FK RESTRICT)
```

Cả 3 FK của `incidents` và 3 FK của `sourcing_proposals` đều là `ON DELETE RESTRICT`,
nên mọi `po_number` / `sku` / `supplier_id` AI ghi ra **phải tồn tại thật**.

---

## 3. CÁC CỘT BẮT BUỘC (`NOT NULL`) THƯỜNG BỊ BỎ SÓT

### `incidents`
`id`, `correlation_id`, `po_number`, `sku`, `sku_name`, `supplier_id`, `supplier_name`,
`delay_days`, `delay_risk_score`, `threshold_applied`, `state`, `status`, `detected_at`,
`summary`, `agent2_triggered`. Chỉ `risk_breakdown` là nullable.

`state` (tiếng Anh) và `status` (tiếng Việt) **cùng tồn tại theo thiết kế** — xem
`IncidentState` trong `frontend/src/types/index.ts`. Frontend so khớp `status` bằng
chuỗi tiếng Việt có dấu, sai một ký tự là UI trắng.

| `state` | `status` |
| :--- | :--- |
| `DETECTED` | Mới phát hiện |
| `SOURCING_BACKUP_SUPPLIERS` | Đang tìm nguồn thay thế |
| `PENDING_APPROVAL` | Chờ duyệt |
| `APPROVED` | Đã duyệt |
| `RESOLVED` | Đã giải quyết |
| `CANCELLED` | Đã hủy |
| `ESCALATED` | Escalated |
| `MANUAL_HANDLING` | Xử lý thủ công |

### `sourcing_proposals`
`id`, `incident_id`, `correlation_id`, `po_number`, `sku`, `sku_name`, `quantity` (**int**),
`original_supplier_name` (**tên, không phải id**), `original_unit_price`, `original_total_cost`,
`rankings`, `selected_rank`, `recommendation`, `rejected_options_analysis`, `status`,
`total_value_vnd`.

**Không có cột `selected_supplier_id`.** Nhà cung ứng được chọn nằm trong `rankings[]`,
trỏ tới bởi `selected_rank`. `status` hợp lệ: `Chờ duyệt`, `Đã duyệt`, `Từ chối`,
`Sửa & Duyệt`, `Đã hủy (Compensated)`.

### Schema `rankings[]` (khớp `ProposalRanking`)
```jsonc
{
  "rank": 1, "supplierId": "SUP-04", "supplierName": "General Motors",
  "unitPrice": 9439500, "totalCost": 755160000, "leadTimeDays": 30,
  "pros": ["..."], "cons": ["..."],
  "score": 60,
  "scoreBreakdown": {
    "normalizedCost": 1.0, "normalizedLeadTime": 0.0, "supplierReliabilityScore": 0.76,
    "w1": 0.45, "w2": 0.35, "w3": 0.20,
    "costScoreContribution": 0.45, "timeScoreContribution": 0.0,
    "reliabilityContribution": 0.152
  },
  "reasoning": "..."
}
```

### `risk_breakdown` (khớp `RiskBreakdown`)
```jsonc
{
  "latenessFactor": 0.5556, "supplierReliabilityFactor": 0.32, "inventoryBufferFactor": 0.4833,
  "w1": 0.50, "w2": 0.25, "w3": 0.25,
  "delayDays": 15, "committedLeadTimeDays": 27, "currentStock": 31, "safetyStock": 60,
  "formulaExplanation": "Score = (0.50 × 0.5556) + (0.25 × 0.3200) + (0.25 × 0.4833) = 48/100. ..."
}
```

---

## 4. SCHEMA THẬT CỦA 2 BẢNG AI

Khác bản nháp trước — đây là cột đang tồn tại trên Supabase:

```text
supplier_risk_analysis                ai_job_runs
├ supplier_id  varchar  PK, FK        ├ id                bigint PK (sequence)
├ ticker       varchar  NOT NULL      ├ job_name          varchar NOT NULL
├ ssi_news / ssi_fin / g_geo          ├ trigger_source    varchar NOT NULL
├ ssi_del  / altman_z / pors_score    ├ started_at        timestamp NOT NULL
├ risk_level / status_label           ├ finished_at / duration_ms
├ events_supply_chain_30d  int        ├ status            varchar NOT NULL
├ key_events   jsonb                  ├ orders_scanned / suppliers_scanned
└ analyzed_at  timestamp NOT NULL     ├ incidents_created / incidents_updated
                                      ├ proposals_created / skipped_locked
                                      └ message / error_detail
```

Lưu ý tên cột là `altman_z` (không phải `altman_z_score`), `analyzed_at`
(không phải `last_scanned_at`), `job_name` (không phải `job_type`).

---

## 5. RÀNG BUỘC TOÀN VẸN ĐÃ BỔ SUNG

```sql
-- Mỗi PO chỉ có tối đa 1 incident đang mở -> worker chạy 5 phút/lần không đẻ trùng
CREATE UNIQUE INDEX uq_incidents_open_po ON incidents (po_number)
    WHERE state NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED');
```
Kèm index trên `incidents(supplier_id, state, created_at)`,
`sourcing_proposals(incident_id, po_number, status)`, `ai_job_runs(started_at)`.

Mọi `INSERT` của worker phải dùng `ON CONFLICT (id) DO UPDATE`, và **bỏ qua**
bản ghi đã có quyết định của con người:
```sql
WHERE incidents.state           NOT IN ('APPROVED','RESOLVED','REJECTED','CANCELLED')
  AND sourcing_proposals.status NOT IN ('Đã duyệt','Từ chối','Sửa & Duyệt')
```

---

## 6. SEED — `ai/seed_ai_data.sql`

Chạy: `psql "$SUPABASE_DB" -f ai/seed_ai_data.sql` (idempotent, chạy lại bao nhiêu lần cũng được).

Seed **không hardcode điểm số**: `risk_breakdown`, `delay_days`, `ssi_del`, `pors_score`
đều được tính bằng SQL từ dữ liệu ERP thật, nên không thể lệch khỏi công thức ở
[03_mathematical_formulas_clean.md](03_mathematical_formulas_clean.md).

| Bảng | Sau seed | Ghi chú |
| :--- | ---: | :--- |
| `purchase_orders.risk_breakdown` | 8/9 | Đơn `Hoàn thành` để `NULL` — đã giao xong thì không còn rủi ro trễ |
| `supplier_risk_analysis` | 10/10 có `pors_score` | `ssi_del` suy từ lịch sử giao hàng ERP, không cần API |
| `incidents` | 3 | Ba `state` khác nhau để mọi màn hình đều có dữ liệu |
| `sourcing_proposals` | 2 | 1 đề xuất 2 phương án (đã duyệt), 1 đề xuất sole-source (chờ duyệt) |
| `ai_job_runs` | 3 | `trigger_source='seed'`, worker thật dùng giá trị khác |

### Hiệu chỉnh ngưỡng
- **`threshold_applied = 35`** thay vì 65. Điểm rủi ro cao nhất trong ERP hiện tại là 48,
  nên ngưỡng 65 cho ra **0 incident**. 35 cho 3/9 đơn vượt ngưỡng.
- **`PORS >= 70` không bao giờ đạt được.** PORS cao nhất sau khi đã đủ 4 thành phần là
  **58,03** (SUP-01 Ford Motor). Phân loại `risk_level` dùng ngưỡng **55 / 40**
  (CAO / TRUNG BÌNH / THẤP). Ngưỡng 70 trong plan/01 cần chỉnh lại về ~55.

### Ca dữ liệu đáng chú ý
`INC-PO-2026-011` → `PROP-PO-2026-011`: SKU-MOT-09 chỉ có **duy nhất một** nguồn thay thế
(Lucid Motors), rẻ hơn 22.896.000 VNĐ nhưng Altman Z = **-4,49** (vùng kiệt quệ).
MILP chấm 91 điểm theo tiêu chí thương mại trong khi radar rủi ro cảnh báo đỏ — đây là ca
thể hiện rõ nhất lý do phải ghép hai động cơ lại với nhau.

### Khoảng trống đã biết
`sourcing_proposals` thiếu `decision_at`, `decided_by_role`, `decision_notes`,
`escalated_to_manager` mà type `SourcingProposal` phía frontend có khai báo (optional).
Cần migration bổ sung nếu muốn lưu vết phê duyệt xuống DB.
