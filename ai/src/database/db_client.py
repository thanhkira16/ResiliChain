"""Lop truy cap Postgres (Supabase) cho BikeSync AI Engine.

Nguyen tac bat buoc (plan/04 + plan/06 §3):

1. **Idempotent** -- moi ghi deu la `INSERT ... ON CONFLICT (id) DO UPDATE`.
2. **Ton trong quyet dinh cua con nguoi** -- menh de `DO UPDATE ... WHERE` loai
   tru ban ghi da duoc nguoi duyet/tu choi. Nhung ban ghi do tra ve
   `"skipped_locked"`.
3. **FK deu la ON DELETE RESTRICT** -- assert `po_number` / `sku` / `supplier_id`
   ton tai truoc khi ghi, bao loi ro rang thay vi de Postgres nem
   ForeignKeyViolation kho doc.
4. **AI chi duoc ghi `current_risk_score` + `risk_breakdown`** tren
   `purchase_orders`.
5. **`settings.dry_run`** -- khi bat, chi log SQL + params, khong ghi gi.
"""

from __future__ import annotations

import hashlib
import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Literal, Sequence, LiteralString, cast

import psycopg
from psycopg import errors as pg_errors
from psycopg.rows import DictRow, dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from src.core.config import settings
from src.core.contracts import (
    HUMAN_DECIDED_PROPOSAL_STATUSES,
    HUMAN_DECIDED_STATES,
    AiJobRun,
    Incident,
    InventoryItem,
    JobName,
    JobStatus,
    PurchaseOrder,
    RiskBreakdown,
    SourcingProposal,
    Supplier,
    SupplierRiskAnalysis,
)
from src.core.logging import get_logger
from src.database import queries as q

logger = get_logger(__name__)

UpsertResult = Literal["created", "updated", "skipped_locked"]

__all__ = [
    "MissingReferenceError",
    "UpsertResult",
    "UPSERT_INCIDENT_SQL",
    "UPSERT_PROPOSAL_SQL",
    "UPSERT_SUPPLIER_RISK_SQL",
    "advisory_lock",
    "assert_purchase_order_exists",
    "assert_sku_exists",
    "assert_supplier_exists",
    "close_pool",
    "connection",
    "fetch_alternative_suppliers_for_sku",
    "fetch_all_supplier_risk",
    "fetch_incident",
    "fetch_open_incident_states",
    "fetch_inventory_item",
    "fetch_inventory_items",
    "fetch_latest_tracking_point",
    "fetch_latest_tracking_points",
    "fetch_open_incident_for_po",
    "fetch_open_purchase_orders",
    "fetch_proposal",
    "fetch_purchase_order",
    "fetch_supplier",
    "fetch_supplier_price_history",
    "fetch_supplier_risk",
    "fetch_suppliers",
    "fetch_suppliers_for_sku",
    "finish_job_run",
    "get_pool",
    "human_decided_incident_states",
    "human_decided_proposal_statuses",
    "is_human_decided_incident_state",
    "is_human_decided_proposal_status",
    "normalize_supplier_row",
    "start_job_run",
    "transaction",
    "try_advisory_lock",
    "update_po_risk",
    "upsert_incident",
    "upsert_proposal",
    "upsert_supplier_risk",
]


class MissingReferenceError(RuntimeError):
    """Khoa ngoai tro toi ban ghi khong ton tai (FK la ON DELETE RESTRICT)."""


# --------------------------------------------------------------------------
# Connection pool
# --------------------------------------------------------------------------

_pool: ConnectionPool[psycopg.Connection[DictRow]] | None = None


def get_pool() -> ConnectionPool[psycopg.Connection[DictRow]]:
    """Tra ve pool dung chung (lazy init). An toan khi goi nhieu lan."""
    global _pool
    if _pool is None or _pool.closed:
        _pool = ConnectionPool[psycopg.Connection[DictRow]](
            conninfo=settings.dsn,
            min_size=1,
            max_size=5,
            timeout=30.0,
            max_idle=300.0,
            kwargs={"row_factory": dict_row, "application_name": "bikesync-ai"},
            open=True,
        )
        logger.info("db_pool_opened", extra={"min_size": 1, "max_size": 5})
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.close()
        logger.info("db_pool_closed")
    _pool = None



def _q(sql: str) -> LiteralString:
    """Ep kieu cau SQL ve ``LiteralString`` cho psycopg.

    An toan vi MOI cau SQL trong module nay deu ghep tu hang so o `queries.py`
    va cac danh sach trang thai hard-code trong `contracts.py` -- KHONG BAO GIO
    tu input nguoi dung. Gia tri luon di qua tham so ``%(name)s``.
    """
    return cast(LiteralString, sql)

@contextmanager
def connection() -> Iterator[psycopg.Connection[DictRow]]:
    """Muon mot connection tu pool (autocommit theo transaction cua psycopg)."""
    with get_pool().connection() as conn:
        yield conn


@contextmanager
def transaction() -> Iterator[psycopg.Connection[DictRow]]:
    """Mot transaction tuong minh: commit khi thoat sach, rollback khi co loi."""
    with get_pool().connection() as conn:
        with conn.transaction():
            yield conn


# --------------------------------------------------------------------------
# Advisory lock -- chan worker 5 phut/lan chay chong len chinh no
# --------------------------------------------------------------------------


def advisory_lock_key(key: str | int) -> int:
    """Chuyen mot khoa dang chuoi thanh bigint on dinh cho pg_advisory_lock."""
    if isinstance(key, int):
        return key
    digest = hashlib.blake2b(key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=True)


def try_advisory_lock(key: str | int, conn: psycopg.Connection[DictRow] | None = None) -> bool:
    """`pg_try_advisory_lock` -- False neu mot tien trinh khac dang giu khoa.

    Khoa gan voi SESSION nen phai giu nguyen connection cho toi khi unlock.
    Dung `advisory_lock()` context manager cho tien.
    """
    lock_id = advisory_lock_key(key)
    if conn is not None:
        with conn.cursor() as cur:
            cur.execute(_q("SELECT pg_try_advisory_lock(%s) AS locked"), (lock_id,))
            row = cur.fetchone()
        return bool(row["locked"]) if row else False
    with connection() as own_conn:
        return try_advisory_lock(key, own_conn)


def unlock_advisory(key: str | int, conn: psycopg.Connection[DictRow]) -> bool:
    lock_id = advisory_lock_key(key)
    with conn.cursor() as cur:
        cur.execute(_q("SELECT pg_advisory_unlock(%s) AS unlocked"), (lock_id,))
        row = cur.fetchone()
    return bool(row["unlocked"]) if row else False


@contextmanager
def advisory_lock(key: str | int) -> Iterator[bool]:
    """Giu advisory lock trong suot block. Yield False neu khong lay duoc khoa.

    >>> with advisory_lock("ai_worker:order_risk_scan") as acquired:
    ...     if not acquired:
    ...         return
    """
    with connection() as conn:
        conn.autocommit = True
        acquired = try_advisory_lock(key, conn)
        logger.info(
            "advisory_lock", extra={"key": str(key), "acquired": acquired}
        )
        try:
            yield acquired
        finally:
            if acquired:
                unlock_advisory(key, conn)


# --------------------------------------------------------------------------
# Menh de "ton trong quyet dinh cua con nguoi"
# --------------------------------------------------------------------------


def _sql_str_list(values: Sequence[str]) -> str:
    """Render mot danh sach chuoi hang so thanh literal SQL (da escape nhay don).

    Chi dung cho hang so trong `contracts.py` -- khong bao gio nhan input nguoi dung.
    """
    if not values:
        raise ValueError("Danh sach trang thai khoa khong duoc rong")
    return ", ".join("'" + v.replace("'", "''") + "'" for v in values)


def human_decided_incident_states() -> tuple[str, ...]:
    return tuple(sorted(HUMAN_DECIDED_STATES))


def human_decided_proposal_statuses() -> tuple[str, ...]:
    return tuple(sorted(str(s) for s in HUMAN_DECIDED_PROPOSAL_STATUSES))


def is_human_decided_incident_state(state: str | None) -> bool:
    return str(state) in HUMAN_DECIDED_STATES if state is not None else False


def is_human_decided_proposal_status(status: str | None) -> bool:
    if status is None:
        return False
    return str(status) in {str(s) for s in HUMAN_DECIDED_PROPOSAL_STATUSES}


#: `WHERE` gan vao `ON CONFLICT (id) DO UPDATE` cua incidents (plan/04 §5).
INCIDENT_HUMAN_GUARD: str = (
    f"incidents.state NOT IN ({_sql_str_list(human_decided_incident_states())})"
)

#: `WHERE` gan vao `ON CONFLICT (id) DO UPDATE` cua sourcing_proposals.
PROPOSAL_HUMAN_GUARD: str = (
    "sourcing_proposals.status NOT IN "
    f"({_sql_str_list(human_decided_proposal_statuses())})"
)


# --------------------------------------------------------------------------
# SQL ghi
# --------------------------------------------------------------------------

UPSERT_INCIDENT_SQL: str = f"""
INSERT INTO incidents (
    id, correlation_id, po_number, sku, sku_name, supplier_id, supplier_name,
    delay_days, delay_risk_score, threshold_applied, state, status,
    detected_at, summary, agent2_triggered, risk_breakdown, created_at, updated_at
) VALUES (
    %(id)s, %(correlation_id)s, %(po_number)s, %(sku)s, %(sku_name)s,
    %(supplier_id)s, %(supplier_name)s, %(delay_days)s, %(delay_risk_score)s,
    %(threshold_applied)s, %(state)s, %(status)s, %(detected_at)s, %(summary)s,
    %(agent2_triggered)s, %(risk_breakdown)s, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
    correlation_id    = EXCLUDED.correlation_id,
    po_number         = EXCLUDED.po_number,
    sku               = EXCLUDED.sku,
    sku_name          = EXCLUDED.sku_name,
    supplier_id       = EXCLUDED.supplier_id,
    supplier_name     = EXCLUDED.supplier_name,
    delay_days        = EXCLUDED.delay_days,
    delay_risk_score  = EXCLUDED.delay_risk_score,
    threshold_applied = EXCLUDED.threshold_applied,
    state             = EXCLUDED.state,
    status            = EXCLUDED.status,
    detected_at       = EXCLUDED.detected_at,
    summary           = EXCLUDED.summary,
    agent2_triggered  = EXCLUDED.agent2_triggered,
    risk_breakdown    = EXCLUDED.risk_breakdown,
    updated_at        = NOW()
WHERE {INCIDENT_HUMAN_GUARD}
RETURNING (xmax = 0) AS inserted
"""

UPSERT_PROPOSAL_SQL: str = f"""
INSERT INTO sourcing_proposals (
    id, incident_id, correlation_id, po_number, sku, sku_name, quantity,
    original_supplier_name, original_unit_price, original_total_cost, rankings,
    selected_rank, recommendation, rejected_options_analysis, status,
    total_value_vnd, created_at, updated_at
) VALUES (
    %(id)s, %(incident_id)s, %(correlation_id)s, %(po_number)s, %(sku)s,
    %(sku_name)s, %(quantity)s, %(original_supplier_name)s,
    %(original_unit_price)s, %(original_total_cost)s, %(rankings)s,
    %(selected_rank)s, %(recommendation)s, %(rejected_options_analysis)s,
    %(status)s, %(total_value_vnd)s, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
    incident_id               = EXCLUDED.incident_id,
    correlation_id            = EXCLUDED.correlation_id,
    po_number                 = EXCLUDED.po_number,
    sku                       = EXCLUDED.sku,
    sku_name                  = EXCLUDED.sku_name,
    quantity                  = EXCLUDED.quantity,
    original_supplier_name    = EXCLUDED.original_supplier_name,
    original_unit_price       = EXCLUDED.original_unit_price,
    original_total_cost       = EXCLUDED.original_total_cost,
    rankings                  = EXCLUDED.rankings,
    selected_rank             = EXCLUDED.selected_rank,
    recommendation            = EXCLUDED.recommendation,
    rejected_options_analysis = EXCLUDED.rejected_options_analysis,
    status                    = EXCLUDED.status,
    total_value_vnd           = EXCLUDED.total_value_vnd,
    updated_at                = NOW()
WHERE {PROPOSAL_HUMAN_GUARD}
RETURNING (xmax = 0) AS inserted
"""

#: PK la `supplier_id`; bang nay do AI so huu nen khong co guard con nguoi.
UPSERT_SUPPLIER_RISK_SQL: str = """
INSERT INTO supplier_risk_analysis (
    supplier_id, ticker, ssi_news, ssi_fin, g_geo, ssi_del, altman_z,
    pors_score, risk_level, status_label, events_supply_chain_30d, key_events,
    analyzed_at
) VALUES (
    %(supplier_id)s, %(ticker)s, %(ssi_news)s, %(ssi_fin)s, %(g_geo)s,
    %(ssi_del)s, %(altman_z)s, %(pors_score)s, %(risk_level)s,
    %(status_label)s, %(events_supply_chain_30d)s, %(key_events)s,
    %(analyzed_at)s
)
ON CONFLICT (supplier_id) DO UPDATE SET
    ticker                  = EXCLUDED.ticker,
    ssi_news                = EXCLUDED.ssi_news,
    ssi_fin                 = EXCLUDED.ssi_fin,
    g_geo                   = EXCLUDED.g_geo,
    ssi_del                 = EXCLUDED.ssi_del,
    altman_z                = EXCLUDED.altman_z,
    pors_score              = EXCLUDED.pors_score,
    risk_level              = EXCLUDED.risk_level,
    status_label            = EXCLUDED.status_label,
    events_supply_chain_30d = EXCLUDED.events_supply_chain_30d,
    key_events              = EXCLUDED.key_events,
    analyzed_at             = EXCLUDED.analyzed_at
RETURNING (xmax = 0) AS inserted
"""

INSERT_JOB_RUN_SQL: str = """
INSERT INTO ai_job_runs (job_name, trigger_source, started_at, status)
VALUES (%(job_name)s, %(trigger_source)s, %(started_at)s, %(status)s)
RETURNING id
"""

FINISH_JOB_RUN_SQL: str = """
UPDATE ai_job_runs SET
    finished_at       = %(finished_at)s,
    duration_ms       = %(duration_ms)s,
    status            = %(status)s,
    orders_scanned    = %(orders_scanned)s,
    suppliers_scanned = %(suppliers_scanned)s,
    incidents_created = %(incidents_created)s,
    incidents_updated = %(incidents_updated)s,
    proposals_created = %(proposals_created)s,
    skipped_locked    = %(skipped_locked)s,
    message           = %(message)s,
    error_detail      = %(error_detail)s
WHERE id = %(id)s
RETURNING id
"""


# --------------------------------------------------------------------------
# Helper chung
# --------------------------------------------------------------------------


def _log_dry_run(op: str, sql: str, params: dict[str, Any]) -> None:
    logger.info(
        "dry_run_skip_write",
        extra={
            "op": op,
            "sql": " ".join(sql.split()),
            "params": json.dumps(params, ensure_ascii=False, default=str),
        },
    )


def _exists(conn: psycopg.Connection[DictRow], sql: str, params: dict[str, Any]) -> bool:
    with conn.cursor() as cur:
        cur.execute(_q(sql), params)
        return cur.fetchone() is not None


def assert_purchase_order_exists(conn: psycopg.Connection[DictRow], po_number: str) -> None:
    if not _exists(conn, q.EXISTS_PURCHASE_ORDER, {"po_number": po_number}):
        raise MissingReferenceError(
            f"purchase_orders.po_number={po_number!r} khong ton tai "
            "(FK ON DELETE RESTRICT) -- khong the ghi ban ghi tham chieu toi no."
        )


def assert_sku_exists(conn: psycopg.Connection[DictRow], sku: str) -> None:
    if not _exists(conn, q.EXISTS_INVENTORY_ITEM, {"sku": sku}):
        raise MissingReferenceError(
            f"inventory_items.sku={sku!r} khong ton tai "
            "(FK ON DELETE RESTRICT) -- khong the ghi ban ghi tham chieu toi no."
        )


def assert_supplier_exists(conn: psycopg.Connection[DictRow], supplier_id: str) -> None:
    if not _exists(conn, q.EXISTS_SUPPLIER, {"supplier_id": supplier_id}):
        raise MissingReferenceError(
            f"suppliers.id={supplier_id!r} khong ton tai "
            "(FK ON DELETE RESTRICT) -- khong the ghi ban ghi tham chieu toi no."
        )


def assert_incident_exists(conn: psycopg.Connection[DictRow], incident_id: str) -> None:
    if not _exists(conn, q.EXISTS_INCIDENT, {"id": incident_id}):
        raise MissingReferenceError(
            f"incidents.id={incident_id!r} khong ton tai "
            "(FK ON DELETE RESTRICT) -- sourcing_proposals.incident_id tro vao khoang khong."
        )


def _execute_upsert(
    conn: psycopg.Connection[DictRow],
    sql: str,
    params: dict[str, Any],
    *,
    op: str,
) -> UpsertResult:
    """Chay upsert va dich ket qua thanh created/updated/skipped_locked.

    `RETURNING (xmax = 0)` -> True neu day la INSERT moi, False neu la UPDATE.
    Khong co dong tra ve -> menh de guard da chan (con nguoi da quyet dinh).
    """
    with conn.cursor() as cur:
        try:
            cur.execute(_q(sql), params)
        except pg_errors.ForeignKeyViolation as exc:  # pragma: no cover - defensive
            raise MissingReferenceError(
                f"{op}: vi pham khoa ngoai ON DELETE RESTRICT -- {exc}"
            ) from exc
        row = cur.fetchone()
    if row is None:
        logger.info("upsert_skipped_locked", extra={"op": op, "id": params.get("id")})
        return "skipped_locked"
    result: UpsertResult = "created" if row["inserted"] else "updated"
    logger.info("upsert_ok", extra={"op": op, "id": params.get("id"), "result": result})
    return result


def _dry_run_outcome(
    sql_exists: str, key_params: dict[str, Any], locked_check: str | None = None
) -> UpsertResult:
    """Doan ket qua trong che do dry-run bang cac truy van CHI DOC."""
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql_exists), key_params)
        row = cur.fetchone()
        if row is None:
            return "created"
        if locked_check is not None and row.get(locked_check) is not None:
            value = row[locked_check]
            if locked_check == "state" and is_human_decided_incident_state(value):
                return "skipped_locked"
            if locked_check == "status" and is_human_decided_proposal_status(value):
                return "skipped_locked"
        return "updated"


def _jsonb(value: Any) -> Jsonb | None:
    return None if value is None else Jsonb(value)


# --------------------------------------------------------------------------
# READ helpers
# --------------------------------------------------------------------------


def _fetch_models(sql: str, params: dict[str, Any], model: type) -> list[Any]:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql), params)
        return [model.model_validate(row) for row in cur.fetchall()]


def _fetch_one_model(sql: str, params: dict[str, Any], model: type) -> Any | None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql), params)
        row = cur.fetchone()
    return model.model_validate(row) if row else None


# --------------------------------------------------------------------------
# Chuan hoa hang du lieu ERP
# --------------------------------------------------------------------------

#: LECH HOP DONG (verified tren Supabase 2026-09-12):
#: `suppliers.historical_price` trong DB la
#:     {"SKU-BAT-03": [{"date": "2026-06-01", "unitPrice": 9021000}, ...]}
#: trong khi `contracts.Supplier.historical_price` khai bao `dict[str, float]`.
#: contracts.py la READ-ONLY doi voi lop nay, nen ta chuan hoa tai day: lay
#: `unitPrice` cua moc THOI GIAN MOI NHAT lam gia hien hanh. Lich su day du van
#: lay duoc bang `fetch_supplier_price_history()`.
def _latest_price(history: Any) -> float:
    if isinstance(history, (int, float)):
        return float(history)
    if isinstance(history, list) and history:
        newest = max(
            (h for h in history if isinstance(h, dict)),
            key=lambda h: str(h.get("date", "")),
            default=None,
        )
        if newest is not None:
            return float(newest.get("unitPrice", newest.get("unit_price", 0)) or 0)
    return 0.0


def normalize_supplier_row(row: dict[str, Any]) -> dict[str, Any]:
    """Chuan hoa cac cot jsonb nullable ve gia tri rong.

    `historical_price` giu nguyen chuoi gia theo thoi gian -- hop dong `Supplier`
    da mo rong dung ban chat du lieu, dung `Supplier.latest_price(sku)` de lay gia."""
    data = dict(row)
    if data.get("historical_price") is None:
        data["historical_price"] = {}
    data.setdefault("transit_waypoints", [])
    if data.get("transit_waypoints") is None:
        data["transit_waypoints"] = []
    return data


def _fetch_suppliers(sql: str, params: dict[str, Any]) -> list[Supplier]:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql), params)
        return [Supplier.model_validate(normalize_supplier_row(r)) for r in cur.fetchall()]


def fetch_supplier_price_history(supplier_id: str) -> dict[str, list[dict[str, Any]]]:
    """`historical_price` NGUYEN BAN (day du chuoi thoi gian) cua mot NCC."""
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q("SELECT historical_price FROM suppliers WHERE id = %(supplier_id)s"),
            {"supplier_id": supplier_id},
        )
        row = cur.fetchone()
    return dict(row["historical_price"] or {}) if row else {}


def fetch_open_purchase_orders() -> list[PurchaseOrder]:
    """Don hang chua dong (status <> 'Hoàn thành'/'Đã hủy')."""
    return _fetch_models(
        q.SELECT_OPEN_PURCHASE_ORDERS,
        {"closed_statuses": list(q.PO_CLOSED_STATUSES)},
        PurchaseOrder,
    )


def fetch_purchase_order(po_number: str) -> PurchaseOrder | None:
    return _fetch_one_model(
        q.SELECT_PURCHASE_ORDER_BY_NUMBER, {"po_number": po_number}, PurchaseOrder
    )


def fetch_inventory_item(sku: str) -> InventoryItem | None:
    return _fetch_one_model(q.SELECT_INVENTORY_BY_SKU, {"sku": sku}, InventoryItem)


def fetch_inventory_items() -> list[InventoryItem]:
    return _fetch_models(q.SELECT_ALL_INVENTORY, {}, InventoryItem)


def fetch_suppliers() -> list[Supplier]:
    return _fetch_suppliers(q.SELECT_ALL_SUPPLIERS, {})


def fetch_supplier(supplier_id: str) -> Supplier | None:
    rows = _fetch_suppliers(q.SELECT_SUPPLIER_BY_ID, {"supplier_id": supplier_id})
    return rows[0] if rows else None


def fetch_suppliers_for_sku(sku: str) -> list[Supplier]:
    """NCC co `sku` trong mang jsonb `provided_skus`."""
    return _fetch_suppliers(q.SELECT_SUPPLIERS_FOR_SKU, {"sku": sku})


def fetch_alternative_suppliers_for_sku(sku: str, exclude_supplier_id: str) -> list[Supplier]:
    return _fetch_suppliers(
        q.SELECT_ALTERNATIVE_SUPPLIERS_FOR_SKU,
        {"sku": sku, "exclude_supplier_id": exclude_supplier_id},
    )


def fetch_latest_tracking_points() -> dict[str, dict[str, Any]]:
    """Diem tracking moi nhat cho tung `shipment_id`."""
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(q.SELECT_LATEST_TRACKING_POINT_PER_SHIPMENT))
        return {row["shipment_id"]: dict(row) for row in cur.fetchall()}


def fetch_latest_tracking_point(
    *, po_number: str | None = None, shipment_id: str | None = None
) -> dict[str, Any] | None:
    if (po_number is None) == (shipment_id is None):
        raise ValueError("Truyen dung mot trong hai: po_number HOAC shipment_id")
    sql = (
        q.SELECT_LATEST_TRACKING_POINT_BY_PO
        if po_number is not None
        else q.SELECT_LATEST_TRACKING_POINT_BY_SHIPMENT
    )
    params = {"po_number": po_number} if po_number is not None else {"shipment_id": shipment_id}
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql), params)
        row = cur.fetchone()
    return dict(row) if row else None


def fetch_open_incident_states() -> dict[str, str]:
    """Map `incident_id -> state` cua cac incident CHUA dong.

    Dung de worker khong keo lui state machine (xem `advance_state`).
    """
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(q.SELECT_OPEN_INCIDENT_STATES))
        return {row["id"]: row["state"] for row in cur.fetchall()}


def fetch_incident(incident_id: str) -> Incident | None:
    return _fetch_one_model(q.SELECT_INCIDENT_BY_ID, {"id": incident_id}, Incident)


def fetch_open_incident_for_po(po_number: str) -> Incident | None:
    return _fetch_one_model(
        q.SELECT_OPEN_INCIDENT_BY_PO, {"po_number": po_number}, Incident
    )


def fetch_proposal(proposal_id: str) -> SourcingProposal | None:
    return _fetch_one_model(q.SELECT_PROPOSAL_BY_ID, {"id": proposal_id}, SourcingProposal)


def fetch_supplier_risk(supplier_id: str) -> SupplierRiskAnalysis | None:
    return _fetch_one_model(
        q.SELECT_SUPPLIER_RISK_BY_ID, {"supplier_id": supplier_id}, SupplierRiskAnalysis
    )


def fetch_all_supplier_risk() -> list[SupplierRiskAnalysis]:
    return _fetch_models(q.SELECT_ALL_SUPPLIER_RISK, {}, SupplierRiskAnalysis)


# --------------------------------------------------------------------------
# Params builders (pure -- test duoc khong can DB)
# --------------------------------------------------------------------------


def incident_params(incident: Incident) -> dict[str, Any]:
    breakdown = (
        incident.risk_breakdown.model_dump(by_alias=True)
        if incident.risk_breakdown is not None
        else None
    )
    return {
        "id": incident.id,
        "correlation_id": incident.correlation_id,
        "po_number": incident.po_number,
        "sku": incident.sku,
        "sku_name": incident.sku_name,
        "supplier_id": incident.supplier_id,
        "supplier_name": incident.supplier_name,
        "delay_days": incident.delay_days,
        "delay_risk_score": incident.delay_risk_score,
        "threshold_applied": incident.threshold_applied,
        "state": str(incident.state),
        "status": str(incident.status),
        "detected_at": incident.detected_at,
        "summary": incident.summary,
        "agent2_triggered": incident.agent2_triggered,
        "risk_breakdown": _jsonb(breakdown),
    }


def proposal_params(proposal: SourcingProposal) -> dict[str, Any]:
    rankings = [r.model_dump(by_alias=True) for r in proposal.rankings]
    return {
        "id": proposal.id,
        "incident_id": proposal.incident_id,
        "correlation_id": proposal.correlation_id,
        "po_number": proposal.po_number,
        "sku": proposal.sku,
        "sku_name": proposal.sku_name,
        "quantity": proposal.quantity,
        "original_supplier_name": proposal.original_supplier_name,
        "original_unit_price": proposal.original_unit_price,
        "original_total_cost": proposal.original_total_cost,
        "rankings": Jsonb(rankings),
        "selected_rank": proposal.selected_rank,
        "recommendation": proposal.recommendation,
        "rejected_options_analysis": Jsonb(proposal.rejected_options_analysis),
        "status": str(proposal.status),
        "total_value_vnd": proposal.total_value_vnd,
    }


def supplier_risk_params(analysis: SupplierRiskAnalysis) -> dict[str, Any]:
    return {
        "supplier_id": analysis.supplier_id,
        "ticker": analysis.ticker,
        "ssi_news": analysis.ssi_news,
        "ssi_fin": analysis.ssi_fin,
        "g_geo": analysis.g_geo,
        "ssi_del": analysis.ssi_del,
        "altman_z": analysis.altman_z,
        "pors_score": analysis.pors_score,
        "risk_level": str(analysis.risk_level) if analysis.risk_level else None,
        "status_label": analysis.status_label,
        "events_supply_chain_30d": analysis.events_supply_chain_30d,
        "key_events": Jsonb([e.model_dump() for e in analysis.key_events]),
        "analyzed_at": analysis.analyzed_at,
    }


# --------------------------------------------------------------------------
# WRITE helpers
# --------------------------------------------------------------------------


def upsert_incident(
    incident: Incident, conn: psycopg.Connection[DictRow] | None = None
) -> UpsertResult:
    """Ghi/cap nhat mot incident. Bo qua neu con nguoi da quyet dinh."""
    params = incident_params(incident)
    if settings.dry_run:
        _log_dry_run("upsert_incident", UPSERT_INCIDENT_SQL, params)
        return _dry_run_outcome(
            "SELECT state FROM incidents WHERE id = %(id)s",
            {"id": incident.id},
            locked_check="state",
        )

    def _run(c: psycopg.Connection[DictRow]) -> UpsertResult:
        assert_purchase_order_exists(c, incident.po_number)
        assert_sku_exists(c, incident.sku)
        assert_supplier_exists(c, incident.supplier_id)
        try:
            return _execute_upsert(c, UPSERT_INCIDENT_SQL, params, op="upsert_incident")
        except pg_errors.UniqueViolation as exc:
            raise RuntimeError(
                f"PO {incident.po_number!r} da co mot incident khac dang mo "
                f"(unique index uq_incidents_open_po). id dang ghi: {incident.id!r}."
            ) from exc

    if conn is not None:
        return _run(conn)
    with transaction() as own:
        return _run(own)


def upsert_proposal(
    proposal: SourcingProposal, conn: psycopg.Connection[DictRow] | None = None
) -> UpsertResult:
    """Ghi/cap nhat mot sourcing proposal. Bo qua neu con nguoi da quyet dinh."""
    params = proposal_params(proposal)
    if settings.dry_run:
        _log_dry_run("upsert_proposal", UPSERT_PROPOSAL_SQL, params)
        return _dry_run_outcome(
            "SELECT status FROM sourcing_proposals WHERE id = %(id)s",
            {"id": proposal.id},
            locked_check="status",
        )

    def _run(c: psycopg.Connection[DictRow]) -> UpsertResult:
        assert_purchase_order_exists(c, proposal.po_number)
        assert_sku_exists(c, proposal.sku)
        assert_incident_exists(c, proposal.incident_id)
        return _execute_upsert(c, UPSERT_PROPOSAL_SQL, params, op="upsert_proposal")

    if conn is not None:
        return _run(conn)
    with transaction() as own:
        return _run(own)


def upsert_supplier_risk(
    analysis: SupplierRiskAnalysis, conn: psycopg.Connection[DictRow] | None = None
) -> UpsertResult:
    """Ghi/cap nhat PORS cua mot NCC (PK = supplier_id)."""
    params = supplier_risk_params(analysis)
    if settings.dry_run:
        _log_dry_run("upsert_supplier_risk", UPSERT_SUPPLIER_RISK_SQL, params)
        return _dry_run_outcome(
            "SELECT supplier_id FROM supplier_risk_analysis WHERE supplier_id = %(supplier_id)s",
            {"supplier_id": analysis.supplier_id},
        )

    def _run(c: psycopg.Connection[DictRow]) -> UpsertResult:
        assert_supplier_exists(c, analysis.supplier_id)
        return _execute_upsert(
            c, UPSERT_SUPPLIER_RISK_SQL, params, op="upsert_supplier_risk"
        )

    if conn is not None:
        return _run(conn)
    with transaction() as own:
        return _run(own)


def update_po_risk(
    po_number: str,
    score: float | None,
    risk_breakdown: RiskBreakdown | dict[str, Any] | None,
    conn: psycopg.Connection[DictRow] | None = None,
) -> bool:
    """Cap nhat DUY NHAT `current_risk_score` + `risk_breakdown` cua mot PO.

    Tra ve True neu co dong duoc cap nhat.
    """
    payload: dict[str, Any] | None
    if isinstance(risk_breakdown, RiskBreakdown):
        payload = risk_breakdown.model_dump(by_alias=True)
    else:
        payload = risk_breakdown
    params = {
        "po_number": po_number,
        "current_risk_score": score,
        "risk_breakdown": _jsonb(payload),
    }
    if settings.dry_run:
        _log_dry_run("update_po_risk", q.UPDATE_PURCHASE_ORDER_RISK, params)
        return True

    def _run(c: psycopg.Connection[DictRow]) -> bool:
        assert_purchase_order_exists(c, po_number)
        with c.cursor() as cur:
            cur.execute(_q(q.UPDATE_PURCHASE_ORDER_RISK), params)
            updated = cur.fetchone() is not None
        logger.info("update_po_risk", extra={"po_number": po_number, "updated": updated})
        return updated

    if conn is not None:
        return _run(conn)
    with transaction() as own:
        return _run(own)


# --------------------------------------------------------------------------
# ai_job_runs
# --------------------------------------------------------------------------


def start_job_run(
    job_name: JobName | str,
    trigger_source: str,
    started_at: datetime | None = None,
) -> int:
    """Mo mot dong `ai_job_runs` (status='running'). Tra ve id.

    Trong dry-run tra ve 0 (sentinel) -- `finish_job_run(0, ...)` se la no-op.
    """
    params = {
        "job_name": str(job_name),
        "trigger_source": trigger_source,
        "started_at": started_at or datetime.now(timezone.utc).replace(tzinfo=None),
        "status": str(JobStatus.RUNNING),
    }
    if settings.dry_run:
        _log_dry_run("start_job_run", INSERT_JOB_RUN_SQL, params)
        return 0
    with transaction() as conn, conn.cursor() as cur:
        cur.execute(_q(INSERT_JOB_RUN_SQL), params)
        row = cur.fetchone()
    if row is None:  # RETURNING id luon co dong, tru khi INSERT bi chan
        raise RuntimeError("start_job_run: INSERT khong tra ve id")
    job_id = int(row["id"])
    logger.info("job_run_started", extra={"job_run_id": job_id, **params})
    return job_id


def finish_job_run(
    job_run_id: int,
    *,
    status: JobStatus | str = JobStatus.SUCCESS,
    orders_scanned: int = 0,
    suppliers_scanned: int = 0,
    incidents_created: int = 0,
    incidents_updated: int = 0,
    proposals_created: int = 0,
    skipped_locked: int = 0,
    message: str | None = None,
    error_detail: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> bool:
    """Dong mot dong `ai_job_runs`, tinh `duration_ms` neu biet `started_at`."""
    finished = finished_at or datetime.now(timezone.utc).replace(tzinfo=None)
    duration_ms: int | None = None
    if started_at is not None:
        duration_ms = max(0, int((finished - started_at).total_seconds() * 1000))
    params = {
        "id": job_run_id,
        "finished_at": finished,
        "duration_ms": duration_ms,
        "status": str(status),
        "orders_scanned": orders_scanned,
        "suppliers_scanned": suppliers_scanned,
        "incidents_created": incidents_created,
        "incidents_updated": incidents_updated,
        "proposals_created": proposals_created,
        "skipped_locked": skipped_locked,
        "message": message,
        "error_detail": error_detail,
    }
    if settings.dry_run or job_run_id == 0:
        _log_dry_run("finish_job_run", FINISH_JOB_RUN_SQL, params)
        return True
    with transaction() as conn, conn.cursor() as cur:
        if duration_ms is None:
            cur.execute(_q("SELECT started_at FROM ai_job_runs WHERE id = %(id)s"), {"id": job_run_id}
            )
            row = cur.fetchone()
            if row is not None and row["started_at"] is not None:
                params["duration_ms"] = max(
                    0, int((finished - row["started_at"]).total_seconds() * 1000)
                )
        cur.execute(_q(FINISH_JOB_RUN_SQL), params)
        ok = cur.fetchone() is not None
    logger.info("job_run_finished", extra={"job_run_id": job_run_id, "status": str(status)})
    return ok


def fetch_job_run(job_run_id: int) -> AiJobRun | None:
    sql = """
    SELECT id, job_name, trigger_source, started_at, finished_at, duration_ms,
           status, orders_scanned, suppliers_scanned, incidents_created,
           incidents_updated, proposals_created, skipped_locked, message,
           error_detail
    FROM ai_job_runs WHERE id = %(id)s
    """
    with connection() as conn, conn.cursor() as cur:
        cur.execute(_q(sql), {"id": job_run_id})
        row = cur.fetchone()
    if row is None:
        return None
    cleaned = {k: (0 if v is None and k.endswith(("_scanned", "_created", "_updated", "_locked")) else v) for k, v in row.items()}
    return AiJobRun.model_validate(cleaned)
