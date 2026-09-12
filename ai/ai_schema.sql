-- =====================================================================
-- BikeSync AI Engine -- DDL cac bang do AI so huu + rang buoc toan ven.
--
-- Idempotent: chay lai bao nhieu lan cung duoc.
-- KHONG tao lai cac bang cua Backend (suppliers, inventory_items,
-- purchase_orders, shipments, incidents, sourcing_proposals) -- nhung bang
-- do thuoc TypeORM migration 1761500000000. File nay chi:
--   1. Tao 2 bang AI so huu
--   2. Bo sung 2 cot AI duoc phep ghi tren purchase_orders
--   3. Tao cac index & rang buoc chong ghi trung (plan/04 §5)
--
-- Chay: psql "$SUPABASE_DB" -f ai/ai_schema.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. supplier_risk_analysis -- radar rui ro nha cung ung (PORS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_risk_analysis (
    supplier_id              varchar(50)  PRIMARY KEY,
    ticker                   varchar(20)  NOT NULL,
    ssi_news                 numeric(6,2),
    ssi_fin                  numeric(6,2),
    g_geo                    numeric(6,2),
    ssi_del                  numeric(6,2),
    altman_z                 numeric(8,2),
    pors_score               numeric(6,2),
    risk_level               varchar(20),
    status_label             varchar(50),
    events_supply_chain_30d  integer DEFAULT 0,
    key_events               jsonb,
    analyzed_at              timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FK toi suppliers: RESTRICT -- moi supplier_id AI ghi ra phai ton tai that.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_supplier_risk_supplier'
    ) THEN
        ALTER TABLE supplier_risk_analysis
            ADD CONSTRAINT fk_supplier_risk_supplier
            FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- risk_level chi nhan 3 gia tri -- khop RiskLevel trong src/core/contracts.py
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_supplier_risk_level'
    ) THEN
        ALTER TABLE supplier_risk_analysis
            ADD CONSTRAINT ck_supplier_risk_level
            CHECK (risk_level IS NULL OR risk_level IN ('CAO', 'TRUNG BÌNH', 'THẤP'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_risk_pors
    ON supplier_risk_analysis (pors_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_supplier_risk_analyzed
    ON supplier_risk_analysis (analyzed_at DESC);

-- ---------------------------------------------------------------------
-- 2. ai_job_runs -- nhat ky moi vong quet cua worker (observability)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_job_runs (
    id                 bigserial PRIMARY KEY,
    job_name           varchar(50) NOT NULL,
    trigger_source     varchar(20) NOT NULL,
    started_at         timestamp   NOT NULL,
    finished_at        timestamp,
    duration_ms        integer,
    status             varchar(20) NOT NULL,
    orders_scanned     integer DEFAULT 0,
    suppliers_scanned  integer DEFAULT 0,
    incidents_created  integer DEFAULT 0,
    incidents_updated  integer DEFAULT 0,
    proposals_created  integer DEFAULT 0,
    skipped_locked     integer DEFAULT 0,
    message            text,
    error_detail       text
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_job_runs_status') THEN
        ALTER TABLE ai_job_runs
            ADD CONSTRAINT ck_job_runs_status
            CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_job_runs_name') THEN
        ALTER TABLE ai_job_runs
            ADD CONSTRAINT ck_job_runs_name
            CHECK (job_name IN ('order_risk_scan', 'supplier_risk_scan'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_runs_started   ON ai_job_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_name_time ON ai_job_runs (job_name, started_at DESC);

-- ---------------------------------------------------------------------
-- 3. Hai cot duy nhat AI duoc phep ghi tren bang cua Backend
-- ---------------------------------------------------------------------
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS current_risk_score numeric(5,2);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS risk_breakdown     jsonb;

-- ---------------------------------------------------------------------
-- 4. Chong worker 5 phut/lan de incident trung (plan/04 §5)
--    Moi PO chi co toi da 1 incident dang mo.
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_incidents_open_po
    ON incidents (po_number)
    WHERE state NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_incidents_supplier ON incidents (supplier_id);
CREATE INDEX IF NOT EXISTS idx_incidents_state    ON incidents (state);
CREATE INDEX IF NOT EXISTS idx_incidents_created  ON incidents (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_incident ON sourcing_proposals (incident_id);
CREATE INDEX IF NOT EXISTS idx_proposals_po       ON sourcing_proposals (po_number);
CREATE INDEX IF NOT EXISTS idx_proposals_status   ON sourcing_proposals (status);

COMMIT;
