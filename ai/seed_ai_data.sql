-- ============================================================================
--  BikeSync AI Engine - SEED DỮ LIỆU AI CHO BACKEND
--  File: ai/seed_ai_data.sql
--
--  Seed đầy đủ 4 bảng phía AI để Backend/Frontend chạy end-to-end ngay,
--  trước khi AI Worker đi vào vận hành. Worker sẽ ghi đè dữ liệu này sau.
--
--  Nguyên tắc:
--   1. KHÔNG hardcode điểm số. Mọi con số dẫn xuất (risk_breakdown, delay_days,
--      ssi_del, pors_score) đều được TÍNH trong SQL từ dữ liệu ERP thật, nên
--      seed không bao giờ lệch khỏi công thức trong plan/03.
--   2. Idempotent - chạy lại nhiều lần cho cùng kết quả (ON CONFLICT DO UPDATE).
--   3. Chỉ ghi vào phạm vi AI sở hữu: 2 cột của purchase_orders + 4 bảng AI.
--
--  Chạy:  psql "$SUPABASE_DB" -f ai/seed_ai_data.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
--  THAM SỐ HIỆU CHỈNH
-- ----------------------------------------------------------------------------
--  RISK_THRESHOLD = 35
--  Điểm rủi ro cao nhất trong ERP hiện tại là 48 (PO-2026-011). Ngưỡng 65 của
--  bản mock cũ sẽ không sinh ra incident nào. 35 cho 3/9 đơn vượt ngưỡng - tỉ lệ
--  sát thực tế và đủ dữ liệu cho mọi màn hình. Chỉnh lại khi ERP có dải rộng hơn.
-- ----------------------------------------------------------------------------


-- ============================================================================
--  1. purchase_orders.risk_breakdown  (2 cột duy nhất AI được ghi)
--     delayRiskScore = 100 * (0.50*lateness + 0.25*reliability + 0.25*buffer)
-- ============================================================================
WITH calc AS (
    SELECT
        po.id,
        po.po_number,
        (po.actual_or_expected_delivery_date::date - po.promised_delivery_date::date) AS delay_days,
        (po.promised_delivery_date::date - po.order_date::date)                       AS committed_lead_days,
        s.reliability_score,
        inv.current_stock,
        inv.safety_stock
    FROM purchase_orders po
    JOIN suppliers       s   ON s.id    = po.supplier_id
    JOIN inventory_items inv ON inv.sku = po.sku
    WHERE po.status <> 'Hoàn thành'          -- đơn đã giao xong không còn rủi ro trễ
), factors AS (
    SELECT
        c.*,
        -- latenessFactor = clamp(0,1, delayDays / committedLeadTime)
        round(greatest(0, least(1, c.delay_days::numeric
              / NULLIF(c.committed_lead_days, 0))), 4)                    AS lateness_factor,
        -- supplierReliabilityFactor = clamp(0,1, 1 - reliability/100)
        round(greatest(0, least(1, 1 - c.reliability_score / 100.0)), 4)  AS reliability_factor,
        -- inventoryBufferFactor = clamp(0,1, 1 - currentStock/safetyStock)
        round(greatest(0, least(1, 1 - c.current_stock::numeric
              / NULLIF(c.safety_stock, 0))), 4)                           AS buffer_factor
    FROM calc c
), scored AS (
    SELECT
        f.*,
        round(100 * (0.50 * f.lateness_factor
                   + 0.25 * f.reliability_factor
                   + 0.25 * f.buffer_factor)) AS delay_risk_score
    FROM factors f
)
UPDATE purchase_orders po
SET current_risk_score = sc.delay_risk_score,
    risk_breakdown = jsonb_build_object(
        'latenessFactor',            sc.lateness_factor,
        'supplierReliabilityFactor', sc.reliability_factor,
        'inventoryBufferFactor',     sc.buffer_factor,
        'w1', 0.50, 'w2', 0.25, 'w3', 0.25,
        'delayDays',               sc.delay_days,
        'committedLeadTimeDays',    sc.committed_lead_days,
        'currentStock',             sc.current_stock,
        'safetyStock',              sc.safety_stock,
        'formulaExplanation', format(
            'Score = (0.50 × %s) + (0.25 × %s) + (0.25 × %s) = %s/100. Trễ %s ngày trên lead time cam kết %s ngày; tồn kho %s/%s.',
            sc.lateness_factor, sc.reliability_factor, sc.buffer_factor,
            sc.delay_risk_score, sc.delay_days, sc.committed_lead_days,
            sc.current_stock, sc.safety_stock)
    ),
    updated_at = CURRENT_TIMESTAMP
FROM scored sc
WHERE po.id = sc.id;


-- ============================================================================
--  2. supplier_risk_analysis - bổ sung ssi_del + pors_score + risk_level
--     PORS = 0.35*SSI_news + 0.30*SSI_fin + 0.20*SSI_del + 0.15*G_geo
--     (ssi_news / ssi_fin / g_geo / altman_z đã có sẵn từ GDELT + FMP)
-- ============================================================================
WITH delivery AS (
    -- SSI_del suy ra từ lịch sử giao hàng thật trong ERP, không cần API ngoài.
    SELECT
        po.supplier_id,
        round(greatest(0, least(100, 100.0 * avg(
            (po.actual_or_expected_delivery_date::date - po.promised_delivery_date::date)::numeric
            / NULLIF(po.promised_delivery_date::date - po.order_date::date, 0)
        ))), 2) AS ssi_del
    FROM purchase_orders po
    GROUP BY po.supplier_id
)
UPDATE supplier_risk_analysis sra
SET ssi_del = COALESCE(d.ssi_del, 100 - s.reliability_score)   -- chưa có lịch sử giao -> lấy nghịch đảo uy tín
FROM suppliers s
LEFT JOIN delivery d ON d.supplier_id = s.id
WHERE sra.supplier_id = s.id;

UPDATE supplier_risk_analysis
SET pors_score = round(0.35 * COALESCE(ssi_news, 0)
                     + 0.30 * COALESCE(ssi_fin,  0)
                     + 0.20 * COALESCE(ssi_del,  0)
                     + 0.15 * COALESCE(g_geo,    0), 2);

UPDATE supplier_risk_analysis
SET risk_level = CASE
        WHEN pors_score >= 55 THEN 'CAO'
        WHEN pors_score >= 40 THEN 'TRUNG BÌNH'
        ELSE 'THẤP'
    END;

COMMIT;


-- ============================================================================
--  3. incidents - sinh từ chính các PO vượt ngưỡng, không hardcode điểm
-- ============================================================================
BEGIN;

WITH lifecycle(po_number, state, status, detected_at, agent2_triggered) AS (
    VALUES
      -- Ba giai đoạn khác nhau của state machine, để mọi màn hình đều có dữ liệu:
      ('PO-2026-011', 'PENDING_APPROVAL',          'Chờ duyệt',                 '2026-09-12 06:10:00', TRUE),
      ('PO-2026-009', 'SOURCING_BACKUP_SUPPLIERS', 'Đang tìm nguồn thay thế',   '2026-09-12 06:10:00', TRUE),
      ('PO-2026-003', 'APPROVED',                  'Đã duyệt',                  '2026-09-11 06:10:00', TRUE)
), src AS (
    SELECT
        po.po_number, po.sku, inv.name AS sku_name,
        po.supplier_id, po.supplier_name,
        (po.risk_breakdown->>'delayDays')::int            AS delay_days,
        (po.risk_breakdown->>'committedLeadTimeDays')::int AS lead_days,
        po.current_risk_score,
        po.risk_breakdown,
        inv.current_stock, inv.safety_stock, inv.weekly_burn_rate,
        lc.state, lc.status, lc.detected_at, lc.agent2_triggered
    FROM purchase_orders po
    JOIN inventory_items inv ON inv.sku = po.sku
    JOIN lifecycle lc        ON lc.po_number = po.po_number
    WHERE po.current_risk_score >= 35
)
INSERT INTO incidents (
    id, correlation_id, po_number, sku, sku_name, supplier_id, supplier_name,
    delay_days, delay_risk_score, threshold_applied, state, status,
    detected_at, summary, agent2_triggered, risk_breakdown, created_at, updated_at)
SELECT
    'INC-' || src.po_number,
    'CORR-' || src.po_number || '-' || substr(md5(src.po_number), 1, 4),
    src.po_number, src.sku, src.sku_name, src.supplier_id, src.supplier_name,
    src.delay_days, src.current_risk_score, 35, src.state, src.status,
    src.detected_at,
    format('%s trễ %s ngày so với cam kết (lead time %s ngày). Điểm rủi ro %s/100 vượt ngưỡng 35. Tồn kho %s hiện còn %s/%s đơn vị, tiêu thụ %s/tuần — dự kiến cạn trong %s tuần nếu hàng không về.',
           src.po_number, src.delay_days, src.lead_days, src.current_risk_score,
           src.sku, src.current_stock, src.safety_stock, src.weekly_burn_rate,
           round(src.current_stock::numeric / NULLIF(src.weekly_burn_rate, 0), 1)),
    src.agent2_triggered, src.risk_breakdown,
    src.detected_at::timestamp, CURRENT_TIMESTAMP
FROM src
ON CONFLICT (id) DO UPDATE SET
    delay_days        = EXCLUDED.delay_days,
    delay_risk_score  = EXCLUDED.delay_risk_score,
    threshold_applied = EXCLUDED.threshold_applied,
    state             = EXCLUDED.state,
    status            = EXCLUDED.status,
    summary           = EXCLUDED.summary,
    risk_breakdown    = EXCLUDED.risk_breakdown,
    updated_at        = CURRENT_TIMESTAMP;

COMMIT;


-- ============================================================================
--  4. sourcing_proposals
--     Giá lấy từ suppliers.historical_price (mốc 2026-09-01), không bịa số.
--     Score = 0.45*normalizedCost + 0.35*normalizedLeadTime + 0.20*reliability
-- ============================================================================
BEGIN;

INSERT INTO sourcing_proposals (
    id, incident_id, correlation_id, po_number, sku, sku_name, quantity,
    original_supplier_name, original_unit_price, original_total_cost,
    rankings, selected_rank, recommendation, rejected_options_analysis,
    status, total_value_vnd, created_at, updated_at)
VALUES
-- ---------------------------------------------------------------- PROP #1 --
-- PO-2026-011 / SKU-MOT-09: chỉ tồn tại DUY NHẤT một nguồn thay thế, và nguồn
-- đó đang ở vùng kiệt quệ tài chính. Đây là ca thể hiện rõ nhất giá trị của
-- việc ghép MILP với radar rủi ro nhà cung ứng.
(
 'PROP-PO-2026-011', 'INC-PO-2026-011',
 'CORR-PO-2026-011-' || substr(md5('PO-2026-011'), 1, 4),
 'PO-2026-011', 'SKU-MOT-09', 'Enduro drive unit & inverter', 120,
 'Rivian', 10494000, 1259280000,
 '[{
    "rank": 1,
    "supplierId": "SUP-02",
    "supplierName": "Lucid Motors",
    "unitPrice": 10303200,
    "totalCost": 1236384000,
    "leadTimeDays": 28,
    "pros": [
      "Đơn giá thấp hơn hợp đồng gốc 1,82% - tiết kiệm 22.896.000 VNĐ trên toàn đơn",
      "Đã cung cấp đúng SKU-MOT-09 theo lịch sử giá, không cần kiểm định lại khuôn",
      "Lead time 28 ngày, chỉ dài hơn nguồn gốc 1 ngày"
    ],
    "cons": [
      "Uy tín giao hàng chỉ 63/100 - thấp nhất trong toàn bộ danh sách nhà cung ứng",
      "CẢNH BÁO TÀI CHÍNH: Altman Z = -4,49 (vùng kiệt quệ), SSI_fin = 100/100",
      "Là nguồn thay thế DUY NHẤT cho SKU-MOT-09 - không còn phương án dự phòng nếu thất bại"
    ],
    "score": 91,
    "scoreBreakdown": {
      "normalizedCost": 1.0,
      "normalizedLeadTime": 0.963,
      "supplierReliabilityScore": 0.63,
      "w1": 0.45, "w2": 0.35, "w3": 0.20,
      "costScoreContribution": 0.45,
      "timeScoreContribution": 0.337,
      "reliabilityContribution": 0.126
    },
    "reasoning": "Xét thuần chi phí và thời gian thì đây là phương án tốt: rẻ hơn và gần như không mất thêm ngày giao. Nhưng Agent 3 chấm Altman Z = -4,49, tức nhà cung ứng đang ở vùng kiệt quệ tài chính. Điểm 91 phản ánh tiêu chí thương mại, KHÔNG phản ánh rủi ro đối tác."
  }]'::jsonb,
 1,
 'Duyệt CÓ ĐIỀU KIỆN. Lucid Motors là nguồn thay thế duy nhất cho SKU-MOT-09 và rẻ hơn 22.896.000 VNĐ, nhưng Altman Z = -4,49 đặt họ trong vùng kiệt quệ. Khuyến nghị: (1) chia đơn 60/120 cho lần giao đầu thay vì giao trọn gói, (2) đàm phán thanh toán sau giao hàng thay vì đặt cọc, (3) song song mở hồ sơ tìm nguồn thứ hai cho SKU-MOT-09 vì hiện đang phụ thuộc sole-source. Tổng giá trị 1.236.384.000 VNĐ - vượt thẩm quyền Trưởng phòng, cần Giám đốc Chuỗi Cung Ứng phê duyệt.',
 '[{"supplierName": "SUP-01, SUP-04, SUP-06 (nhóm pin)", "reason": "Không cung cấp SKU-MOT-09. Danh mục chỉ gồm cell pin LFP/NCMA/4680, không có drive unit hay inverter."},
   {"supplierName": "SUP-05, SUP-07, SUP-08, SUP-09 (nhóm bán dẫn)", "reason": "Chỉ cung cấp SoC/MCU/FPGA, không có năng lực sản xuất cụm truyền động."},
   {"supplierName": "SUP-10 (Sony Group)", "reason": "Chỉ cung cấp SKU-SEN-12 (cảm biến hình ảnh)."}]'::jsonb,
 'Chờ duyệt', 1236384000, '2026-09-12 06:25:00', CURRENT_TIMESTAMP
),
-- ---------------------------------------------------------------- PROP #2 --
-- PO-2026-003 / SKU-BAT-03: có 2 nguồn thay thế thật, đã được duyệt.
(
 'PROP-PO-2026-003', 'INC-PO-2026-003',
 'CORR-PO-2026-003-' || substr(md5('PO-2026-003'), 1, 4),
 'PO-2026-003', 'SKU-BAT-03', 'Cell pin LFP 48V (BlueOval SK)', 80,
 'Ford Motor', 9300000, 744000000,
 '[{
    "rank": 1,
    "supplierId": "SUP-04",
    "supplierName": "General Motors",
    "unitPrice": 9439500,
    "totalCost": 755160000,
    "leadTimeDays": 30,
    "pros": [
      "Chi phí thấp nhất trong các phương án thay thế (755.160.000 VNĐ)",
      "Chênh lệch so với hợp đồng gốc chỉ 1,5% (+11.160.000 VNĐ)",
      "Altman Z = 1,21 nhưng SSI_news 55,7 - mức tin tức trung bình, không có sự kiện đứt gãy nghiêm trọng"
    ],
    "cons": [
      "Lead time 30 ngày - dài nhất trong nhóm pin, chậm hơn Tesla 4 ngày",
      "Uy tín 76/100, thấp hơn Tesla"
    ],
    "score": 60,
    "scoreBreakdown": {
      "normalizedCost": 1.0,
      "normalizedLeadTime": 0.0,
      "supplierReliabilityScore": 0.76,
      "w1": 0.45, "w2": 0.35, "w3": 0.20,
      "costScoreContribution": 0.45,
      "timeScoreContribution": 0.0,
      "reliabilityContribution": 0.152
    },
    "reasoning": "Thắng nhờ trọng số chi phí 0,45 - rẻ hơn Tesla 24.552.000 VNĐ. Đánh đổi là 4 ngày lead time. Với tồn kho SKU-BAT-03 còn 38/80 và tiêu thụ 42/tuần, 4 ngày chênh lệch vẫn nằm trong vùng an toàn."
  },
  {
    "rank": 2,
    "supplierId": "SUP-06",
    "supplierName": "Tesla",
    "unitPrice": 9746400,
    "totalCost": 779712000,
    "leadTimeDays": 26,
    "pros": [
      "Lead time ngắn nhất 26 ngày - bù đắp hàng trễ nhanh nhất",
      "Uy tín cao nhất nhóm pin: 82/100",
      "Altman Z = 15,58 (vùng an toàn), SSI_fin chỉ 5/100 - sức khoẻ tài chính tốt nhất"
    ],
    "cons": [
      "Đắt nhất: +35.712.000 VNĐ so với hợp đồng gốc (+4,8%)",
      "SSI_news 71,8 - dòng tin tiêu cực đang ở mức cao"
    ],
    "score": 51,
    "scoreBreakdown": {
      "normalizedCost": 0.0,
      "normalizedLeadTime": 1.0,
      "supplierReliabilityScore": 0.82,
      "w1": 0.45, "w2": 0.35, "w3": 0.20,
      "costScoreContribution": 0.0,
      "timeScoreContribution": 0.35,
      "reliabilityContribution": 0.164
    },
    "reasoning": "Phương án an toàn nhất về vận hành và tài chính, nhưng chi phí vượt trội khiến điểm tổng thấp hơn. Nên chọn nếu tồn kho SKU-BAT-03 tụt xuống dưới 20 đơn vị trước khi hàng về."
  }]'::jsonb,
 1,
 'Đã duyệt General Motors. Chênh lệch chi phí 11.160.000 VNĐ (+1,5%) nằm trong hạn mức dự phòng rủi ro, trong khi Tesla đắt hơn 35.712.000 VNĐ để đổi lấy 4 ngày. Với tồn kho 38/80 và tiêu thụ 42/tuần, 4 ngày đó chưa phải là khác biệt sống còn. Giữ Tesla làm phương án dự phòng nếu GM trượt lịch giao lần nữa.',
 '[{"supplierName": "SUP-02, SUP-03 (nhóm truyền động)", "reason": "Không cung cấp SKU-BAT-03. Danh mục chỉ gồm drive unit và inverter."},
   {"supplierName": "SUP-05, SUP-07, SUP-08, SUP-09, SUP-10", "reason": "Không có năng lực sản xuất cell pin - chỉ bán dẫn và cảm biến."}]'::jsonb,
 'Đã duyệt', 755160000, '2026-09-11 07:05:00', CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
    rankings                  = EXCLUDED.rankings,
    selected_rank             = EXCLUDED.selected_rank,
    recommendation            = EXCLUDED.recommendation,
    rejected_options_analysis = EXCLUDED.rejected_options_analysis,
    status                    = EXCLUDED.status,
    total_value_vnd           = EXCLUDED.total_value_vnd,
    updated_at                = CURRENT_TIMESTAMP;

COMMIT;


-- ============================================================================
--  5. ai_job_runs - nhật ký để Streamlit / backend dựng được timeline
-- ============================================================================
BEGIN;

DELETE FROM ai_job_runs WHERE trigger_source = 'seed';

INSERT INTO ai_job_runs (
    job_name, trigger_source, started_at, finished_at, duration_ms, status,
    orders_scanned, suppliers_scanned, incidents_created, incidents_updated,
    proposals_created, skipped_locked, message)
VALUES
 ('supplier_risk_scan', 'seed', '2026-09-12 05:17:30', '2026-09-12 05:17:44', 14163, 'SUCCESS',
  0, 10, 0, 0, 0, 0,
  'Quét GDELT Cloud v2 + FMP cho 10 nhà cung ứng. Tính SSI_news, SSI_fin, G_geo, Altman Z. SSI_del suy từ lịch sử giao hàng ERP. PORS cao nhất: SUP-01 Ford Motor.'),
 ('order_risk_scan',    'seed', '2026-09-11 06:09:51', '2026-09-11 06:10:04', 12880, 'SUCCESS',
  9, 0, 1, 0, 1, 0,
  'Quét 9 đơn hàng. PO-2026-003 vượt ngưỡng 35 (điểm 38) -> tạo INC-PO-2026-003 và PROP-PO-2026-003.'),
 ('order_risk_scan',    'seed', '2026-09-12 06:09:47', '2026-09-12 06:10:11', 23470, 'SUCCESS',
  9, 0, 2, 1, 1, 1,
  'Quét 9 đơn hàng. PO-2026-011 (48) và PO-2026-009 (46) vượt ngưỡng 35. Bỏ qua 1 bản ghi đã có quyết định của con người (INC-PO-2026-003 đã duyệt).');

COMMIT;


-- ============================================================================
--  6. RÀNG BUỘC TOÀN VẸN
--     Không có các index này, worker chạy mỗi 5 phút sẽ đẻ incident trùng.
-- ============================================================================
BEGIN;

-- Mỗi PO chỉ được có TỐI ĐA 1 incident đang mở tại một thời điểm.
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_open_po
    ON incidents (po_number)
    WHERE state NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED');

-- Index cho các đường truy vấn nóng của worker và backend.
CREATE INDEX IF NOT EXISTS idx_incidents_supplier   ON incidents (supplier_id);
CREATE INDEX IF NOT EXISTS idx_incidents_state      ON incidents (state);
CREATE INDEX IF NOT EXISTS idx_incidents_created    ON incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_incident   ON sourcing_proposals (incident_id);
CREATE INDEX IF NOT EXISTS idx_proposals_po         ON sourcing_proposals (po_number);
CREATE INDEX IF NOT EXISTS idx_proposals_status     ON sourcing_proposals (status);
CREATE INDEX IF NOT EXISTS idx_job_runs_started     ON ai_job_runs (started_at DESC);

COMMIT;
