# pyright: reportArgumentType=false
# Ly do: file nay dung test double (FakeConnection, module respx) va dict literal
# cho model Pydantic long nhau -- Pydantic chap nhan o runtime, Pyright thi khong.
# Da xac nhan bang 173 test xanh; tat rule nay o day de khong phai be cong code test.
"""Test lop du lieu -- KHONG can mang (tru test danh dau `integration`).

Chay:
    .venv/bin/python -m pytest tests/test_database.py -q
    .venv/bin/python -m pytest tests/test_database.py -q -m integration   # can DB that
"""

from __future__ import annotations

import os
import re
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import pytest

from src.core.contracts import (
    HUMAN_DECIDED_PROPOSAL_STATUSES,
    HUMAN_DECIDED_STATES,
    Incident,
    IncidentState,
    IncidentStatusLabel,
    ProposalRanking,
    ProposalStatus,
    RiskBreakdown,
    ScoreBreakdown,
    SourcingProposal,
    SupplierRiskAnalysis,
)
from src.database import db_client as db
from src.database import queries as q


# --------------------------------------------------------------------------
# Fake connection / cursor -- du de chay cac helper khong can mang
# --------------------------------------------------------------------------


class FakeCursor:
    def __init__(self, results: list[Any]):
        self._results = list(results)
        self._current: Any = None
        self.executed: list[tuple[str, Any]] = []

    def execute(self, sql: str, params: Any = None) -> None:
        self.executed.append((sql, params))
        self._current = self._results.pop(0) if self._results else None

    def fetchone(self) -> Any:
        return self._current

    def fetchall(self) -> list[Any]:
        return self._current or []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *exc: Any) -> bool:
        return False


class FakeConnection:
    """Connection gia: tra ve lan luot cac ket qua da nap san."""

    def __init__(self, results: list[Any] | None = None):
        self.cursor_obj = FakeCursor(results or [])

    def cursor(self) -> FakeCursor:
        return self.cursor_obj

    @contextmanager
    def transaction(self):
        yield self


# --------------------------------------------------------------------------
# 1. queries.py -- xay dung chuoi SQL
# --------------------------------------------------------------------------


def test_open_po_query_excludes_completed_status() -> None:
    assert q.PO_STATUS_COMPLETED == "Hoàn thành"
    assert q.PO_STATUS_COMPLETED in q.PO_CLOSED_STATUSES
    # Cac trang thai co that trong DB va dang mo
    assert q.PO_STATUS_IN_TRANSIT == "Đang giao"
    assert q.PO_STATUS_LATE == "Trễ hẹn"
    for open_status in q.PO_OPEN_STATUSES:
        assert open_status not in q.PO_CLOSED_STATUSES
    sql = " ".join(q.SELECT_OPEN_PURCHASE_ORDERS.split())
    assert "FROM purchase_orders" in sql
    assert "status <> ALL(%(closed_statuses)s)" in sql


def test_purchase_order_select_lists_exact_contract_columns() -> None:
    cols = {c.strip() for c in q.PURCHASE_ORDER_COLUMNS.replace("\n", "").split(",")}
    from src.core.contracts import PurchaseOrder

    assert cols == set(PurchaseOrder.model_fields)
    assert "SELECT *" not in q.SELECT_OPEN_PURCHASE_ORDERS


def test_supplier_and_inventory_selects_match_contracts() -> None:
    from src.core.contracts import InventoryItem, Supplier

    supplier_cols = {c.strip() for c in q.SUPPLIER_COLUMNS.replace("\n", "").split(",")}
    assert supplier_cols == set(Supplier.model_fields)
    inv_cols = {c.strip() for c in q.INVENTORY_COLUMNS.replace("\n", "").split(",")}
    assert inv_cols == set(InventoryItem.model_fields)


def test_supplier_risk_columns_use_real_names() -> None:
    cols = {c.strip() for c in q.SUPPLIER_RISK_COLUMNS.replace("\n", "").split(",")}
    assert cols == set(SupplierRiskAnalysis.model_fields)
    # plan/04 §4: ten cot that
    assert "altman_z" in cols and "altman_z_score" not in cols
    assert "analyzed_at" in cols and "last_scanned_at" not in cols


def test_suppliers_for_sku_uses_jsonb_containment() -> None:
    sql = " ".join(q.SELECT_SUPPLIERS_FOR_SKU.split())
    assert "provided_skus @> jsonb_build_array(%(sku)s::text)" in sql
    alt = " ".join(q.SELECT_ALTERNATIVE_SUPPLIERS_FOR_SKU.split())
    assert "id <> %(exclude_supplier_id)s" in alt


def test_latest_tracking_point_query_is_one_row_per_shipment() -> None:
    sql = " ".join(q.SELECT_LATEST_TRACKING_POINT_PER_SHIPMENT.split())
    assert sql.startswith("SELECT DISTINCT ON (shipment_id)")
    assert "ORDER BY shipment_id, recorded_at DESC" in sql


def test_inspect_sql_builders_use_allow_list() -> None:
    assert len(q.INSPECT_TABLES) == 9
    assert set(q.INSPECT_SAMPLE_ORDER_BY) == set(q.INSPECT_TABLES)
    assert q.count_sql("suppliers") == "SELECT COUNT(*) AS n FROM suppliers"
    assert q.sample_sql("ai_job_runs") == "SELECT * FROM ai_job_runs ORDER BY id ASC LIMIT 1"
    with pytest.raises(ValueError):
        q.count_sql("suppliers; DROP TABLE suppliers")
    with pytest.raises(ValueError):
        q.sample_sql("pg_catalog.pg_user")


def test_update_po_risk_sql_touches_only_two_ai_owned_columns() -> None:
    sql = " ".join(q.UPDATE_PURCHASE_ORDER_RISK.split())
    set_clause = sql.split("SET", 1)[1].split("WHERE", 1)[0]
    assigned = set(re.findall(r"(\w+)\s*=", set_clause))
    assert assigned == {"current_risk_score", "risk_breakdown", "updated_at"}
    assert "WHERE po_number = %(po_number)s" in sql


# --------------------------------------------------------------------------
# 2. Menh de "ton trong quyet dinh cua con nguoi"
# --------------------------------------------------------------------------


def test_sql_str_list_quotes_and_escapes() -> None:
    assert db._sql_str_list(["A", "B"]) == "'A', 'B'"
    assert db._sql_str_list(["O'Brien"]) == "'O''Brien'"
    with pytest.raises(ValueError):
        db._sql_str_list([])


def test_incident_guard_lists_every_human_decided_state() -> None:
    guard = db.INCIDENT_HUMAN_GUARD
    assert guard.startswith("incidents.state NOT IN (")
    for state in HUMAN_DECIDED_STATES:
        assert f"'{state}'" in guard
    # Trang thai may van duoc ghi de
    for state in ("DETECTED", "SOURCING_BACKUP_SUPPLIERS", "PENDING_APPROVAL"):
        assert f"'{state}'" not in guard


def test_proposal_guard_uses_exact_vietnamese_strings() -> None:
    guard = db.PROPOSAL_HUMAN_GUARD
    assert guard.startswith("sourcing_proposals.status NOT IN (")
    for status in HUMAN_DECIDED_PROPOSAL_STATUSES:
        assert f"'{str(status)}'" in guard
    assert "'Đã duyệt'" in guard and "'Từ chối'" in guard and "'Sửa & Duyệt'" in guard
    # Chờ duyệt la trang thai may -> phai ghi de duoc
    assert f"'{ProposalStatus.PENDING}'" not in guard


def test_human_decision_predicates() -> None:
    assert db.is_human_decided_incident_state("APPROVED") is True
    assert db.is_human_decided_incident_state(IncidentState.RESOLVED) is True
    assert db.is_human_decided_incident_state("DETECTED") is False
    assert db.is_human_decided_incident_state(None) is False
    assert db.is_human_decided_proposal_status("Đã duyệt") is True
    assert db.is_human_decided_proposal_status(ProposalStatus.AMENDED) is True
    assert db.is_human_decided_proposal_status("Chờ duyệt") is False
    assert db.is_human_decided_proposal_status(None) is False


@pytest.mark.parametrize(
    "sql,conflict_target,guard",
    [
        (db.UPSERT_INCIDENT_SQL, "ON CONFLICT (id) DO UPDATE", db.INCIDENT_HUMAN_GUARD),
        (db.UPSERT_PROPOSAL_SQL, "ON CONFLICT (id) DO UPDATE", db.PROPOSAL_HUMAN_GUARD),
    ],
)
def test_upserts_are_idempotent_and_guarded(sql: str, conflict_target: str, guard: str) -> None:
    flat = " ".join(sql.split())
    assert conflict_target in flat
    assert f"WHERE {' '.join(guard.split())}" in flat
    assert "RETURNING (xmax = 0) AS inserted" in flat


def test_supplier_risk_upsert_conflicts_on_supplier_id() -> None:
    flat = " ".join(db.UPSERT_SUPPLIER_RISK_SQL.split())
    assert "ON CONFLICT (supplier_id) DO UPDATE" in flat
    assert "RETURNING (xmax = 0) AS inserted" in flat
    # Khong co guard con nguoi: bang nay do AI so huu hoan toan
    assert "NOT IN" not in flat


def test_job_run_sql_uses_real_column_names() -> None:
    assert "job_name" in db.INSERT_JOB_RUN_SQL and "job_type" not in db.INSERT_JOB_RUN_SQL
    assert "trigger_source" in db.INSERT_JOB_RUN_SQL
    assert "RETURNING id" in db.INSERT_JOB_RUN_SQL


# --------------------------------------------------------------------------
# 3. Dich ket qua upsert -> created / updated / skipped_locked
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "row,expected",
    [
        ({"inserted": True}, "created"),
        ({"inserted": False}, "updated"),
        (None, "skipped_locked"),
    ],
)
def test_execute_upsert_maps_xmax_to_result(row: Any, expected: str) -> None:
    conn = FakeConnection([row])
    assert db._execute_upsert(conn, "SQL", {"id": "X"}, op="t") == expected


# --------------------------------------------------------------------------
# 4. Assert khoa ngoai (FK ON DELETE RESTRICT)
# --------------------------------------------------------------------------


def test_fk_asserts_pass_when_row_exists() -> None:
    db.assert_purchase_order_exists(FakeConnection([{"?column?": 1}]), "PO-1")
    db.assert_sku_exists(FakeConnection([{"?column?": 1}]), "SKU-1")
    db.assert_supplier_exists(FakeConnection([{"?column?": 1}]), "SUP-1")
    db.assert_incident_exists(FakeConnection([{"?column?": 1}]), "INC-1")


@pytest.mark.parametrize(
    "fn,arg,needle",
    [
        (db.assert_purchase_order_exists, "PO-404", "purchase_orders.po_number"),
        (db.assert_sku_exists, "SKU-404", "inventory_items.sku"),
        (db.assert_supplier_exists, "SUP-404", "suppliers.id"),
        (db.assert_incident_exists, "INC-404", "incidents.id"),
    ],
)
def test_fk_asserts_raise_clear_error_when_missing(fn: Any, arg: str, needle: str) -> None:
    with pytest.raises(db.MissingReferenceError) as exc:
        fn(FakeConnection([None]), arg)
    assert needle in str(exc.value)
    assert arg in str(exc.value)


def test_upsert_incident_checks_all_three_fks_before_writing() -> None:
    incident = _sample_incident()
    # PO ton tai, SKU ton tai, NCC KHONG ton tai -> phai bao loi truoc khi INSERT
    conn = FakeConnection([{"?column?": 1}, {"?column?": 1}, None])
    with pytest.raises(db.MissingReferenceError) as exc:
        db.upsert_incident(incident, conn=conn)
    assert "suppliers.id" in str(exc.value)
    executed = [sql for sql, _ in conn.cursor_obj.executed]
    assert len(executed) == 3  # khong co cau INSERT nao duoc chay
    assert all("INSERT" not in sql for sql in executed)


def test_upsert_incident_writes_after_fk_checks_pass() -> None:
    conn = FakeConnection(
        [{"?column?": 1}, {"?column?": 1}, {"?column?": 1}, {"inserted": True}]
    )
    assert db.upsert_incident(_sample_incident(), conn=conn) == "created"
    assert "INSERT INTO incidents" in conn.cursor_obj.executed[-1][0]


def test_upsert_proposal_reports_skipped_locked_when_guard_blocks() -> None:
    conn = FakeConnection([{"?column?": 1}, {"?column?": 1}, {"?column?": 1}, None])
    assert db.upsert_proposal(_sample_proposal(), conn=conn) == "skipped_locked"


# --------------------------------------------------------------------------
# 5. Params builders (thuan, khong can DB)
# --------------------------------------------------------------------------


def test_incident_params_serialize_enums_and_jsonb() -> None:
    params = db.incident_params(_sample_incident())
    assert params["state"] == "DETECTED"
    assert params["status"] == "Mới phát hiện"
    assert params["risk_breakdown"] is not None
    payload = params["risk_breakdown"].obj
    # risk_breakdown phai dung camelCase cua frontend
    assert "latenessFactor" in payload and "formulaExplanation" in payload
    assert "lateness_factor" not in payload


def test_proposal_params_serialize_rankings_with_camel_case() -> None:
    params = db.proposal_params(_sample_proposal())
    rankings = params["rankings"].obj
    assert rankings[0]["supplierId"] == "SUP-04"
    assert set(rankings[0]["scoreBreakdown"]) == {
        "normalizedCost",
        "normalizedLeadTime",
        "supplierReliabilityScore",
        "w1",
        "w2",
        "w3",
        "costScoreContribution",
        "timeScoreContribution",
        "reliabilityContribution",
    }
    assert params["status"] == "Chờ duyệt"


def test_supplier_risk_params_use_real_column_names() -> None:
    analysis = SupplierRiskAnalysis(
        supplier_id="SUP-01",
        ticker="F",
        ssi_news=55.9,
        ssi_fin=77.7,
        g_geo=51.0,
        ssi_del=37.5,
        altman_z=0.85,
        pors_score=58.03,
        analyzed_at=datetime(2026, 9, 12, 5, 17, 44),
    )
    params = db.supplier_risk_params(analysis)
    assert set(params) == set(SupplierRiskAnalysis.model_fields)
    assert params["altman_z"] == 0.85
    assert isinstance(params["analyzed_at"], datetime)


# --------------------------------------------------------------------------
# 6. Advisory lock + dry-run
# --------------------------------------------------------------------------


def test_advisory_lock_key_is_stable_signed_bigint() -> None:
    key = db.advisory_lock_key("ai_worker:order_risk_scan")
    assert key == db.advisory_lock_key("ai_worker:order_risk_scan")
    assert -(2**63) <= key < 2**63
    assert db.advisory_lock_key("a") != db.advisory_lock_key("b")
    assert db.advisory_lock_key(42) == 42


def test_try_advisory_lock_calls_pg_try_advisory_lock() -> None:
    conn = FakeConnection([{"locked": True}])
    assert db.try_advisory_lock("k", conn) is True
    sql, params = conn.cursor_obj.executed[0]
    assert "pg_try_advisory_lock" in sql
    assert params == (db.advisory_lock_key("k"),)


def test_try_advisory_lock_false_when_held() -> None:
    assert db.try_advisory_lock("k", FakeConnection([{"locked": False}])) is False


def test_dry_run_writes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(db.settings, "dry_run", True)

    def _boom(*_a: Any, **_k: Any):
        raise AssertionError("dry_run van cho phep mo connection!")

    monkeypatch.setattr(db, "connection", _boom)
    monkeypatch.setattr(db, "transaction", _boom)
    assert db.update_po_risk("PO-2026-003", 38.0, None) is True
    assert db.start_job_run("order_risk_scan", "cron") == 0
    assert db.finish_job_run(0, orders_scanned=8) is True


# --------------------------------------------------------------------------
# 7. Chuan hoa hang suppliers (cot jsonb nullable)
# --------------------------------------------------------------------------


def test_normalize_supplier_row_preserves_price_history() -> None:
    """Chuoi gia phai duoc GIU NGUYEN -- `Supplier.latest_price()` moi la noi
    rut ra gia hien hanh. Lam phang o day se mat lich su gia."""
    row = {
        "id": "SUP-01",
        "historical_price": {
            "SKU-BAT-03": [
                {"date": "2026-06-01", "unitPrice": 9021000},
                {"date": "2026-09-01", "unitPrice": 9746400},
            ]
        },
        "transit_waypoints": None,
    }
    out = db.normalize_supplier_row(row)
    assert out["historical_price"] == row["historical_price"]
    assert out["transit_waypoints"] == []


def test_normalize_supplier_row_defaults_null_price_history() -> None:
    out = db.normalize_supplier_row({"historical_price": None})
    assert out["historical_price"] == {}


def test_supplier_latest_price_picks_newest_date() -> None:
    from src.core.contracts import Supplier

    s = Supplier(
        id="SUP-01",
        name="Ford Motor",
        historical_price={
            "SKU-BAT-03": [
                {"date": "2026-09-01", "unitPrice": 9746400},
                {"date": "2026-06-01", "unitPrice": 9021000},
            ]
        },
    )
    assert s.latest_price("SKU-BAT-03") == 9746400.0
    assert s.latest_price("SKU-KHONG-CO") is None
    assert [p.date for p in s.price_history("SKU-BAT-03")] == ["2026-06-01", "2026-09-01"]


# --------------------------------------------------------------------------
# Fixtures du lieu
# --------------------------------------------------------------------------


def _sample_risk_breakdown() -> RiskBreakdown:
    return RiskBreakdown(
        lateness_factor=0.5556,
        supplier_reliability_factor=0.32,
        inventory_buffer_factor=0.4833,
        w1=0.50,
        w2=0.25,
        w3=0.25,
        delay_days=15,
        committed_lead_time_days=27,
        current_stock=31,
        safety_stock=60,
        formula_explanation="Score = 48/100",
    )


def _sample_incident(state: IncidentState = IncidentState.DETECTED) -> Incident:
    return Incident(
        id="INC-PO-TEST-001",
        correlation_id="CORR-TEST",
        po_number="PO-TEST-001",
        sku="SKU-TEST",
        sku_name="Test SKU",
        supplier_id="SUP-TEST",
        supplier_name="Test Supplier",
        delay_days=15,
        delay_risk_score=48.0,
        threshold_applied=35.0,
        state=state,
        status=IncidentStatusLabel.DETECTED,
        detected_at="2026-09-12 06:00:00",
        summary="Test",
        agent2_triggered=False,
        risk_breakdown=_sample_risk_breakdown(),
    )


def _sample_proposal() -> SourcingProposal:
    ranking = ProposalRanking(
        rank=1,
        supplier_id="SUP-04",
        supplier_name="General Motors",
        unit_price=9439500,
        total_cost=755160000,
        lead_time_days=30,
        pros=["re"],
        cons=["cham"],
        score=60,
        score_breakdown=ScoreBreakdown(
            normalized_cost=1.0,
            normalized_lead_time=0.0,
            supplier_reliability_score=0.76,
            w1=0.45,
            w2=0.35,
            w3=0.20,
            cost_score_contribution=0.45,
            time_score_contribution=0.0,
            reliability_contribution=0.152,
        ),
        reasoning="ok",
    )
    return SourcingProposal(
        id="PROP-PO-TEST-001",
        incident_id="INC-PO-TEST-001",
        correlation_id="CORR-TEST",
        po_number="PO-TEST-001",
        sku="SKU-TEST",
        sku_name="Test SKU",
        quantity=80,
        original_supplier_name="Test Supplier",
        original_unit_price=9300000,
        original_total_cost=744000000,
        rankings=[ranking],
        selected_rank=1,
        recommendation="Chon GM",
        rejected_options_analysis=[],
        status=ProposalStatus.PENDING,
        total_value_vnd=755160000,
    )


# --------------------------------------------------------------------------
# Integration (can Supabase that) -- chay trong transaction roi ROLLBACK
# --------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("AI_INTEGRATION_TESTS") != "1",
    reason="Can Supabase that. Bat bang AI_INTEGRATION_TESTS=1.",
)
def test_integration_roundtrip_rolls_back() -> None:
    """Doc du lieu that + ghi thu trong transaction roi rollback (khong de lai dau vet)."""
    orders = db.fetch_open_purchase_orders()
    assert orders, "DB that phai co it nhat 1 don chua hoan thanh"
    assert all(o.status != q.PO_STATUS_COMPLETED for o in orders)

    order = orders[0]
    inventory = db.fetch_inventory_item(order.sku)
    supplier = db.fetch_supplier(order.supplier_id)
    assert inventory is not None and supplier is not None

    incident = Incident(
        id=f"INC-{order.po_number}-PYTEST",
        correlation_id="CORR-PYTEST",
        po_number=order.po_number,
        sku=order.sku,
        sku_name=order.sku_name,
        supplier_id=order.supplier_id,
        supplier_name=order.supplier_name,
        delay_days=1,
        delay_risk_score=1.0,
        threshold_applied=35.0,
        # RESOLVED nam ngoai partial unique index `uq_incidents_open_po`
        # -> khong dung do incident that dang mo cua PO nay.
        state=IncidentState.RESOLVED,
        status=IncidentStatusLabel.RESOLVED,
        detected_at="2026-01-01 00:00:00",
        summary="pytest rollback",
        agent2_triggered=False,
        risk_breakdown=_sample_risk_breakdown(),
    )

    conn = db.get_pool().getconn()
    try:
        conn.autocommit = False
        result = db.upsert_incident(incident, conn=conn)
        assert result in {"created", "updated", "skipped_locked"}
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM incidents WHERE id = %s", (incident.id,))
            row = cur.fetchone()
            assert row is not None and row["n"] >= 0
        # FK sai -> loi ro rang
        bad = incident.model_copy(update={"po_number": "PO-KHONG-TON-TAI"})
        with pytest.raises(db.MissingReferenceError):
            db.upsert_incident(bad, conn=conn)
    finally:
        conn.rollback()
        db.get_pool().putconn(conn)

    with db.connection() as check, check.cursor() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM incidents WHERE id = %s", (incident.id,))
        row = cur.fetchone()
        assert row is not None and row["n"] == 0, "Transaction test khong duoc de lai du lieu"
