"""Cac cau SQL hang so cho lop du lieu AI Engine.

Ten cot o day duoc doi chieu 1-1 voi schema THAT tren Supabase (verified
2026-09-12) va voi cac model trong `src/core/contracts.py`. Cac model dung
`extra="forbid"` nen moi cau SELECT phai liet ke tuong minh dung bo cot cua
model -- KHONG dung `SELECT *` (cac bang ERP con co `created_at`/`updated_at`
khong nam trong contract).
"""

from __future__ import annotations

from typing import Final

# --------------------------------------------------------------------------
# Cac gia tri `purchase_orders.status` co that trong DB (verified 2026-09-12):
#   'Đang giao' (7), 'Hoàn thành' (1), 'Trễ hẹn' (1)
# "Chua hoan thanh" = tat ca tru cac trang thai ket thuc duoi day.
# --------------------------------------------------------------------------
PO_STATUS_COMPLETED: Final[str] = "Hoàn thành"
PO_STATUS_IN_TRANSIT: Final[str] = "Đang giao"
PO_STATUS_LATE: Final[str] = "Trễ hẹn"

#: Trang thai coi nhu da dong -- worker khong cham diem rui ro tre nua.
PO_CLOSED_STATUSES: Final[tuple[str, ...]] = (
    PO_STATUS_COMPLETED,
    "Đã hủy",  # phong thu: chua xuat hien trong DB nhung backend co the them
)

#: Trang thai dang mo ma worker quan tam (dung khi muon loc chat hon).
PO_OPEN_STATUSES: Final[tuple[str, ...]] = (PO_STATUS_IN_TRANSIT, PO_STATUS_LATE)

PURCHASE_ORDER_COLUMNS: Final[str] = """
    id, po_number, supplier_id, supplier_name, sku, sku_name, quantity,
    unit_price, total_amount, order_date, promised_delivery_date,
    actual_or_expected_delivery_date, status, current_risk_score,
    risk_breakdown, notes
"""

SUPPLIER_COLUMNS: Final[str] = """
    id, name, contact_person, email, phone, provided_skus,
    average_lead_time_days, historical_price, reliability_score, address,
    transit_waypoints
"""

INVENTORY_COLUMNS: Final[str] = """
    sku, name, category, unit, current_stock, safety_stock, weekly_burn_rate,
    unit_price_estimate, min_lead_time_days
"""

SUPPLIER_RISK_COLUMNS: Final[str] = """
    supplier_id, ticker, ssi_news, ssi_fin, g_geo, ssi_del, altman_z,
    pors_score, risk_level, status_label, events_supply_chain_30d,
    key_events, analyzed_at
"""

# --------------------------------------------------------------------------
# purchase_orders
# --------------------------------------------------------------------------

SELECT_OPEN_PURCHASE_ORDERS: Final[str] = f"""
SELECT {PURCHASE_ORDER_COLUMNS}
FROM purchase_orders
WHERE status <> ALL(%(closed_statuses)s)
ORDER BY promised_delivery_date ASC, po_number ASC
"""

SELECT_PURCHASE_ORDER_BY_NUMBER: Final[str] = f"""
SELECT {PURCHASE_ORDER_COLUMNS}
FROM purchase_orders
WHERE po_number = %(po_number)s
"""

SELECT_ALL_PURCHASE_ORDERS: Final[str] = f"""
SELECT {PURCHASE_ORDER_COLUMNS}
FROM purchase_orders
ORDER BY po_number ASC
"""

#: AI CHI duoc ghi 2 cot nay tren purchase_orders (plan/04 §1).
UPDATE_PURCHASE_ORDER_RISK: Final[str] = """
UPDATE purchase_orders
SET current_risk_score = %(current_risk_score)s,
    risk_breakdown     = %(risk_breakdown)s,
    updated_at         = NOW()
WHERE po_number = %(po_number)s
RETURNING po_number
"""

# --------------------------------------------------------------------------
# inventory_items
# --------------------------------------------------------------------------

SELECT_INVENTORY_BY_SKU: Final[str] = f"""
SELECT {INVENTORY_COLUMNS}
FROM inventory_items
WHERE sku = %(sku)s
"""

SELECT_ALL_INVENTORY: Final[str] = f"""
SELECT {INVENTORY_COLUMNS}
FROM inventory_items
ORDER BY sku ASC
"""

# --------------------------------------------------------------------------
# suppliers
# --------------------------------------------------------------------------

SELECT_ALL_SUPPLIERS: Final[str] = f"""
SELECT {SUPPLIER_COLUMNS}
FROM suppliers
ORDER BY id ASC
"""

SELECT_SUPPLIER_BY_ID: Final[str] = f"""
SELECT {SUPPLIER_COLUMNS}
FROM suppliers
WHERE id = %(supplier_id)s
"""

#: `provided_skus` la jsonb array -> dung toan tu chua `@>` voi mot mang 1 phan tu.
SELECT_SUPPLIERS_FOR_SKU: Final[str] = f"""
SELECT {SUPPLIER_COLUMNS}
FROM suppliers
WHERE provided_skus @> jsonb_build_array(%(sku)s::text)
ORDER BY reliability_score DESC, average_lead_time_days ASC, id ASC
"""

#: Nhu tren nhung loai tru NCC goc (dung cho Agent 3 -- tim nguon thay the).
SELECT_ALTERNATIVE_SUPPLIERS_FOR_SKU: Final[str] = f"""
SELECT {SUPPLIER_COLUMNS}
FROM suppliers
WHERE provided_skus @> jsonb_build_array(%(sku)s::text)
  AND id <> %(exclude_supplier_id)s
ORDER BY reliability_score DESC, average_lead_time_days ASC, id ASC
"""

# --------------------------------------------------------------------------
# shipments / shipment_tracking_points
# --------------------------------------------------------------------------

SELECT_SHIPMENTS: Final[str] = """
SELECT id, purchase_order_id, po_number, supplier_id, supplier_name, sku,
       sku_name, quantity, unit, destination_warehouse, promised_delivery_date,
       expected_delivery_date, delay_days, current_delay_risk_score, risk_level,
       carrier_name, tracking_number
FROM shipments
ORDER BY po_number ASC
"""

TRACKING_POINT_COLUMNS: Final[str] = """
    id, shipment_id, purchase_order_id, po_number, supplier_id, supplier_name,
    latitude, longitude, location_name, recorded_at, source, speed_kmh,
    status_note
"""

#: Diem tracking MOI NHAT cua tung shipment (1 dong / shipment_id).
SELECT_LATEST_TRACKING_POINT_PER_SHIPMENT: Final[str] = f"""
SELECT DISTINCT ON (shipment_id) {TRACKING_POINT_COLUMNS}
FROM shipment_tracking_points
ORDER BY shipment_id, recorded_at DESC, id DESC
"""

SELECT_LATEST_TRACKING_POINT_BY_PO: Final[str] = f"""
SELECT {TRACKING_POINT_COLUMNS}
FROM shipment_tracking_points
WHERE po_number = %(po_number)s
ORDER BY recorded_at DESC, id DESC
LIMIT 1
"""

SELECT_LATEST_TRACKING_POINT_BY_SHIPMENT: Final[str] = f"""
SELECT {TRACKING_POINT_COLUMNS}
FROM shipment_tracking_points
WHERE shipment_id = %(shipment_id)s
ORDER BY recorded_at DESC, id DESC
LIMIT 1
"""

# --------------------------------------------------------------------------
# incidents / sourcing_proposals / supplier_risk_analysis (doc)
# --------------------------------------------------------------------------

INCIDENT_COLUMNS: Final[str] = """
    id, correlation_id, po_number, sku, sku_name, supplier_id, supplier_name,
    delay_days, delay_risk_score, threshold_applied, state, status,
    detected_at, summary, agent2_triggered, risk_breakdown
"""

SELECT_INCIDENT_BY_ID: Final[str] = f"""
SELECT {INCIDENT_COLUMNS} FROM incidents WHERE id = %(id)s
"""

SELECT_OPEN_INCIDENT_BY_PO: Final[str] = f"""
SELECT {INCIDENT_COLUMNS}
FROM incidents
WHERE po_number = %(po_number)s
  AND state NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED')
LIMIT 1
"""

SELECT_OPEN_INCIDENT_STATES: Final[str] = """
SELECT id, state
FROM incidents
WHERE state NOT IN ('RESOLVED', 'REJECTED', 'CANCELLED')
"""

PROPOSAL_COLUMNS: Final[str] = """
    id, incident_id, correlation_id, po_number, sku, sku_name, quantity,
    original_supplier_name, original_unit_price, original_total_cost, rankings,
    selected_rank, recommendation, rejected_options_analysis, status,
    total_value_vnd
"""

SELECT_PROPOSAL_BY_ID: Final[str] = f"""
SELECT {PROPOSAL_COLUMNS} FROM sourcing_proposals WHERE id = %(id)s
"""

SELECT_SUPPLIER_RISK_BY_ID: Final[str] = f"""
SELECT {SUPPLIER_RISK_COLUMNS}
FROM supplier_risk_analysis
WHERE supplier_id = %(supplier_id)s
"""

SELECT_ALL_SUPPLIER_RISK: Final[str] = f"""
SELECT {SUPPLIER_RISK_COLUMNS}
FROM supplier_risk_analysis
ORDER BY pors_score DESC NULLS LAST, supplier_id ASC
"""

# --------------------------------------------------------------------------
# Kiem tra ton tai (FK deu la ON DELETE RESTRICT -> phai assert truoc khi ghi)
# --------------------------------------------------------------------------

EXISTS_PURCHASE_ORDER: Final[str] = (
    "SELECT 1 FROM purchase_orders WHERE po_number = %(po_number)s LIMIT 1"
)
EXISTS_INVENTORY_ITEM: Final[str] = (
    "SELECT 1 FROM inventory_items WHERE sku = %(sku)s LIMIT 1"
)
EXISTS_SUPPLIER: Final[str] = "SELECT 1 FROM suppliers WHERE id = %(supplier_id)s LIMIT 1"
EXISTS_INCIDENT: Final[str] = "SELECT 1 FROM incidents WHERE id = %(id)s LIMIT 1"

# --------------------------------------------------------------------------
# db_inspect
# --------------------------------------------------------------------------

#: Thu tu in cua `db_inspect.py` -- 9 bang.
INSPECT_TABLES: Final[tuple[str, ...]] = (
    "suppliers",
    "inventory_items",
    "purchase_orders",
    "shipments",
    "shipment_tracking_points",
    "incidents",
    "sourcing_proposals",
    "supplier_risk_analysis",
    "ai_job_runs",
)

#: Cot dung de lay "1 dong mau" on dinh cho tung bang.
INSPECT_SAMPLE_ORDER_BY: Final[dict[str, str]] = {
    "suppliers": "id",
    "inventory_items": "sku",
    "purchase_orders": "po_number",
    "shipments": "id",
    "shipment_tracking_points": "id",
    "incidents": "id",
    "sourcing_proposals": "id",
    "supplier_risk_analysis": "supplier_id",
    "ai_job_runs": "id",
}


def count_sql(table: str) -> str:
    """SQL dem dong. `table` chi duoc lay tu `INSPECT_TABLES` (allow-list)."""
    _assert_known_table(table)
    return f"SELECT COUNT(*) AS n FROM {table}"


def sample_sql(table: str) -> str:
    """SQL lay 1 dong mau. `table` chi duoc lay tu `INSPECT_TABLES` (allow-list)."""
    _assert_known_table(table)
    order_by = INSPECT_SAMPLE_ORDER_BY[table]
    return f"SELECT * FROM {table} ORDER BY {order_by} ASC LIMIT 1"


def _assert_known_table(table: str) -> None:
    if table not in INSPECT_TABLES:
        raise ValueError(f"Bang khong nam trong allow-list db_inspect: {table!r}")
