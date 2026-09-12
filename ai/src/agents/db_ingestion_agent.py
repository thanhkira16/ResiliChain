"""AGENT 1 -- Enterprise DB Ingestion Agent.

Doc ERP tu Supabase va lam giau thanh `OrderContext` cho Agent 6 cham diem.
Agent nay KHONG goi API ngoai va KHONG ghi DB -- chi doc va ghep du lieu.

Pham vi giam sat: 3 cum linh kien cot loi EV (plan/01 §3).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from src.agents.base import Agent
from src.core.contracts import InventoryItem, OrderContext, PurchaseOrder, Supplier
from src.database import db_client as db

#: Don da dong -- khong con rui ro tre han.
CLOSED_PO_STATUSES = frozenset({"Hoàn thành", "Đã hủy"})


def _parse_date(value: str | date | datetime | None) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def delay_days_of(order: PurchaseOrder, today: date | None = None) -> int:
    """So ngay tre = (ngay giao thuc te/du kien) - (ngay cam ket).

    Neu don chua giao va da qua han thi lay HOM NAY lam moc, vi ERP co the
    chua cap nhat `actual_or_expected_delivery_date`. Khong bao gio am.
    """
    promised = _parse_date(order.promised_delivery_date)
    if promised is None:
        return 0
    actual = _parse_date(order.actual_or_expected_delivery_date) or promised
    reference = actual
    if order.status not in CLOSED_PO_STATUSES:
        today = today or date.today()
        reference = max(actual, today) if today > promised else actual
    return max(0, (reference - promised).days)


def committed_lead_time_of(order: PurchaseOrder, fallback: int = 1) -> int:
    """Lead time cam ket = ngay cam ket giao - ngay dat hang."""
    ordered = _parse_date(order.order_date)
    promised = _parse_date(order.promised_delivery_date)
    if ordered is None or promised is None:
        return fallback
    return max(1, (promised - ordered).days)


class DbIngestionAgent(Agent[dict[str, Any] | None, list[OrderContext]]):
    """Doc don hang chua hoan thanh + ton kho + NCC + GPS ping gan nhat."""

    name = "agent1_db_ingestion"
    #: Khong co du lieu ERP thi ca vong quet vo nghia -> phai dung han.
    critical = True

    def execute(self, payload: dict[str, Any] | None = None) -> list[OrderContext]:
        payload = payload or {}
        only_po: str | None = payload.get("po_number")
        today: date | None = payload.get("today")

        orders: list[PurchaseOrder] = db.fetch_open_purchase_orders()
        if only_po:
            orders = [o for o in orders if o.po_number == only_po]

        inventory: dict[str, InventoryItem] = {
            item.sku: item for item in db.fetch_inventory_items()
        }
        suppliers: dict[str, Supplier] = {s.id: s for s in db.fetch_suppliers()}
        tracking: dict[str, dict[str, Any]] = db.fetch_latest_tracking_points()

        contexts: list[OrderContext] = []
        for order in orders:
            item = inventory.get(order.sku)
            supplier = suppliers.get(order.supplier_id)
            if item is None or supplier is None:
                # FK la ON DELETE RESTRICT nen truong hop nay gan nhu khong xay ra,
                # nhung neu xay ra thi bo qua don do con hon cham diem sai.
                self.log.warning(
                    "order.skipped_missing_master_data",
                    extra={
                        "po_number": order.po_number,
                        "has_inventory": item is not None,
                        "has_supplier": supplier is not None,
                    },
                )
                continue

            contexts.append(
                OrderContext(
                    order=order,
                    inventory=item,
                    supplier=supplier,
                    delay_days=delay_days_of(order, today),
                    committed_lead_time_days=committed_lead_time_of(
                        order, fallback=item.min_lead_time_days or 1
                    ),
                    weather_delay_days=0.0,  # Agent 6 bom vao sau khi goi Open-Meteo
                    latest_tracking_point=tracking.get(order.po_number),
                )
            )

        self.log.info(
            "ingestion.done",
            extra={"orders_scanned": len(contexts), "orders_open": len(orders)},
        )
        return contexts
