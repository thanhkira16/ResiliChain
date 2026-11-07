-- ============================================================================
--  ResiliChain - DEMO FINALIZE
--  File: ai/seed_demo_finalize.sql
--
--  Runs after ai/seed_ai_data.sql. ai/seed_ai_data.sql was written for a
--  2026-09-12 story date; this file moves its timestamps to the demo date
--  (2026-11-07) and copies the computed PO risk into shipments.
--
--  Run order:
--    just schema -> ai/seed_demo_erp.sql -> ai/scripts/load_supplier_risk.py
--    -> ai/seed_ai_data.sql -> this file
-- ============================================================================

BEGIN;

-- 1. Incidents and proposals: detected on the demo date.
UPDATE incidents SET
    detected_at = CASE po_number
        WHEN 'PO-2026-003' THEN '2026-11-06 06:10:00'
        ELSE '2026-11-07 06:10:00' END,
    created_at = CASE po_number
        WHEN 'PO-2026-003' THEN TIMESTAMP '2026-11-06 06:10:00'
        ELSE TIMESTAMP '2026-11-07 06:10:00' END
WHERE id IN ('INC-PO-2026-003', 'INC-PO-2026-009', 'INC-PO-2026-011');

UPDATE sourcing_proposals SET created_at = CASE id
        WHEN 'PROP-PO-2026-003' THEN TIMESTAMP '2026-11-06 07:05:00'
        ELSE TIMESTAMP '2026-11-07 06:25:00' END
WHERE id IN ('PROP-PO-2026-003', 'PROP-PO-2026-011');

-- 2. AI job log: 2026-09-12 -> 2026-11-07 is +56 days.
UPDATE ai_job_runs
SET started_at  = started_at  + INTERVAL '56 days',
    finished_at = finished_at + INTERVAL '56 days'
WHERE trigger_source = 'seed' AND started_at < TIMESTAMP '2026-10-01';

-- 3. Shipments: copy the score that seed_ai_data.sql computed on the PO.
UPDATE shipments s
SET current_delay_risk_score = COALESCE(po.current_risk_score, 0),
    risk_level = CASE
        WHEN COALESCE(po.current_risk_score, 0) >= 35 THEN 'HIGH'
        WHEN COALESCE(po.current_risk_score, 0) >= 20 THEN 'MEDIUM'
        ELSE 'LOW' END,
    updated_at = CURRENT_TIMESTAMP
FROM purchase_orders po
WHERE po.id = s.purchase_order_id;

COMMIT;
