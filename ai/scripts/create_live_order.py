"""Create one demo purchase order grounded in TODAY's live risk signals, then scan it.

Instead of a hand-written scenario, this script asks the live data sources which
supplier is most exposed right now and builds a realistic in-transit order for it:

  1. (optional --refresh-risk) supplier_risk_scan: GDELT news + FMP Altman Z -> PORS
  2. Open-Meteo forecast on every supplier's transit waypoints (live, no key)
  3. Rank every supplier/SKU by the risk score the engine itself would give a
     fresh order today (delay_risk_score: live weather + PORS penalties + stock)
  4. Insert purchase_orders + shipments + shipment_tracking_points for the top
     supplier. The shipment is placed at the waypoint where the weather is worst
     right now, so the map and the risk score tell the same story.
  5. order_risk_scan on that PO (incident, MILP sourcing, email draft if above
     the threshold) and copy the score onto the shipment.

Every number written to the order comes from an API response or the ERP master
data. The evidence is stored in purchase_orders.notes with a [LIVE-SCAN] tag.

Usage:
    .venv/bin/python scripts/create_live_order.py                 # rank + create + scan
    .venv/bin/python scripts/create_live_order.py --refresh-risk  # re-pull GDELT + FMP first
    .venv/bin/python scripts/create_live_order.py --dry-run       # rank only, write nothing
    .venv/bin/python scripts/create_live_order.py --supplier SUP-05
    .venv/bin/python scripts/create_live_order.py --replace       # drop earlier live orders first
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

from psycopg.types.json import Jsonb  # noqa: E402

from src.core.contracts import InventoryItem, JobName, Supplier, SupplierRiskAnalysis  # noqa: E402
from src.core.config import settings  # noqa: E402
from src.core.formulas import delay_risk_score  # noqa: E402
from src.core.logging import setup_logging  # noqa: E402
from src.database import db_client as db  # noqa: E402
from src.integrations.open_meteo import weather_delay_forecast  # noqa: E402

LIVE_TAG = "[LIVE-SCAN"
PREP_DAYS = 2  # factory packing + export customs before the first leg
WEEKS_OF_COVER = 4

WAREHOUSES = {
    "WH-BD": {"id": "WH-BD", "name": "Kho ResiliChain Bình Dương",
              "address": "VSIP 1, Thuận An, Bình Dương",
              "latitude": 10.9310, "longitude": 106.7130},
    "WH-HP": {"id": "WH-HP", "name": "Kho ResiliChain Hải Phòng",
              "address": "KCN Đình Vũ, Hải An, Hải Phòng",
              "latitude": 20.8410, "longitude": 106.7700},
}


@dataclass
class Candidate:
    supplier: Supplier
    item: InventoryItem
    risk: SupplierRiskAnalysis | None
    weather_days: float
    weather_detail: list[dict[str, Any]]
    score: int = 0

    @property
    def pors(self) -> float:
        return float(self.risk.pors_score) if self.risk and self.risk.pors_score is not None else 50.0

    def worst_waypoint(self) -> dict[str, Any] | None:
        hit = [d for d in self.weather_detail if d.get("delayDays", 0) > 0]
        if not hit:
            return None
        return max(hit, key=lambda d: (d["delayDays"], d.get("windGustsKmh") or 0))


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------


def rank_candidates(only_supplier: str | None) -> list[Candidate]:
    suppliers = db.fetch_suppliers()
    inventory = {i.sku: i for i in db.fetch_inventory_items()}
    risk = {r.supplier_id: r for r in db.fetch_all_supplier_risk()}

    out: list[Candidate] = []
    for s in suppliers:
        if only_supplier and s.id != only_supplier:
            continue
        forecast = weather_delay_forecast(s.transit_waypoints)
        for sku in s.provided_skus:
            item = inventory.get(sku)
            if item is None:
                continue
            c = Candidate(s, item, risk.get(s.id), forecast.delay_days, forecast.detail)
            c.score = predicted_score(c)
            out.append(c)
    return sorted(out, key=lambda c: (c.score, c.weather_days, c.pors), reverse=True)


def lead_time_of(c: Candidate) -> int:
    return max(c.supplier.average_lead_time_days, c.item.min_lead_time_days or 0, 7)


def predicted_score(c: Candidate) -> int:
    """Same inputs and penalties as master_orchestrator.node_score, for a new order."""
    a = c.risk
    penalty_fin = max(0.0, float(a.ssi_fin or 0.0) - 50.0) / 5.0 if a else 0.0
    penalty_news = max(0.0, float(a.ssi_news or 0.0) - 50.0) / 5.0 if a else 0.0
    score, _ = delay_risk_score(
        delay_days=0,
        committed_lead_time_days=lead_time_of(c),
        reliability_score=c.supplier.reliability_score,
        current_stock=c.item.current_stock,
        safety_stock=c.item.safety_stock,
        weather_delay_forecast=c.weather_days,
        penalty_fin=penalty_fin,
        penalty_news=penalty_news,
    )
    return score


def print_ranking(cands: list[Candidate]) -> None:
    print(f"\nLIVE RANKING  (predicted delay_risk_score, incident threshold {settings.incident_risk_threshold:g})")
    print(f"{'supplier':<26}{'sku':<12}{'PORS':>6}{'label':>16}{'wx d':>6}{'stock':>10}{'score':>7}")
    for c in cands:
        label = (c.risk.status_label if c.risk else "-") or "-"
        print(f"{c.supplier.name[:25]:<26}{c.item.sku:<12}{c.pors:>6.1f}{label:>16}"
              f"{c.weather_days:>6.1f}{c.item.current_stock:>5}/{c.item.safety_stock:<4}{c.score:>7}")


# ---------------------------------------------------------------------------
# Order construction
# ---------------------------------------------------------------------------


def next_po_number(conn) -> tuple[str, str]:
    rows = conn.execute("SELECT po_number FROM purchase_orders WHERE po_number LIKE 'PO-2026-%'").fetchall()
    used = [int(r["po_number"].rsplit("-", 1)[1]) for r in rows if r["po_number"].rsplit("-", 1)[1].isdigit()]
    n = max(used, default=0) + 1
    return f"PO-2026-{n:03d}", f"PO-ID-{n:03d}"


def build_evidence(c: Candidate, today: date) -> str:
    parts = [f"{LIVE_TAG} {today.isoformat()}] Đơn tạo từ tín hiệu rủi ro thời gian thực."]
    worst = c.worst_waypoint()
    if worst:
        parts.append(
            f"Thời tiết (Open-Meteo): {worst['weatherCondition']}, gió {worst['windSpeedKmh']} km/h, "
            f"giật {worst['windGustsKmh']} km/h, mưa ngày tối đa {worst['maxDailyPrecipitationMm']} mm "
            f"tại {worst['locationName']} -> dự báo trễ +{worst['delayDays']} ngày."
        )
    else:
        parts.append("Thời tiết (Open-Meteo): toàn tuyến ổn định.")
    if c.risk:
        events = c.risk.key_events or []
        if not c.risk.events_supply_chain_30d:
            parts.append("Tin tức (GDELT): không có sự kiện gián đoạn chuỗi cung ứng trong 30 ngày.")
        elif events:
            ev = events[0]
            summary = ev.summary if hasattr(ev, "summary") else ev.get("summary")
            when = ev.date if hasattr(ev, "date") else ev.get("date")
            parts.append(f"Tin tức (GDELT, {c.risk.events_supply_chain_30d or 0} sự kiện chuỗi cung ứng/30 ngày): "
                         f"{when} - {summary}.")
        z = f"{float(c.risk.altman_z):.2f}" if c.risk.altman_z is not None else "n/a"
        parts.append(f"Tài chính (FMP): Altman Z = {z}. PORS = {c.pors:.1f} ({c.risk.status_label}).")
    parts.append(
        f"Tồn kho {c.item.current_stock}/{c.item.safety_stock} {c.item.unit}, "
        f"tiêu thụ {c.item.weekly_burn_rate}/tuần."
    )
    return " ".join(parts)


def plan_order(c: Candidate, today: date) -> dict[str, Any]:
    wps = sorted(c.supplier.transit_waypoints, key=lambda w: w.get("orderIndex") or 0)
    worst = c.worst_waypoint()
    # Shipment position now: at the worst-weather waypoint, else the middle transit hub.
    if worst:
        pos = next(i for i, w in enumerate(wps) if w.get("locationName") == worst["locationName"])
    else:
        pos = max(1, len(wps) // 2)
    hours_to_pos = float(wps[pos].get("estimatedHoursFromOrigin") or 0)
    departure = datetime.now(timezone.utc) - timedelta(hours=hours_to_pos + 6)
    order_date = departure.date() - timedelta(days=PREP_DAYS)

    promised = order_date + timedelta(days=lead_time_of(c))
    if promised <= today:  # short air lanes: keep the order not-yet-due
        promised = today + timedelta(days=2)
    weather_days = math.ceil(c.weather_days)
    # The ERP date stays on the commitment: the weather delay is a FORECAST and the
    # scan adds it via Open-Meteo. Writing it here too would count it twice.
    # The carrier ETA on the shipment does show it.
    eta = promised + timedelta(days=weather_days)

    gap = max(0, c.item.safety_stock - c.item.current_stock)
    quantity = int(math.ceil((gap + WEEKS_OF_COVER * c.item.weekly_burn_rate) / 10.0) * 10)
    price = c.supplier.latest_price(c.item.sku) or float(c.item.unit_price_estimate or 0)

    track = []
    for i, w in enumerate(wps[: pos + 1]):
        at = departure + timedelta(hours=float(w.get("estimatedHoursFromOrigin") or 0))
        note = w.get("description") or ""
        if i == pos:
            at = datetime.now(timezone.utc) - timedelta(minutes=20)
            note = (f"{worst['weatherCondition']}, gió giật {worst['windGustsKmh']} km/h - "
                    f"tạm dừng chờ thời tiết, dự kiến trễ {weather_days} ngày."
                    if worst else "Đúng lịch.")
        track.append({"seq": i + 1, "lat": w["latitude"], "lng": w["longitude"],
                      "loc": w.get("locationName"), "at": at,
                      "src": "CarrierWebhook" if i < pos else "ManualUpdate",
                      "speed": 0.0, "note": note})

    last_name = (wps[-1].get("locationName") or "") if wps else ""
    warehouse = WAREHOUSES["WH-BD"] if "Bình Dương" in last_name else WAREHOUSES["WH-HP"]
    return {
        "order_date": order_date, "promised": promised, "eta": eta,
        "status": "Đang giao",
        "quantity": quantity, "unit_price": price, "track": track, "warehouse": warehouse,
        "position": wps[pos].get("locationName") if wps else "-",
    }


def carrier_for(conn, supplier_id: str) -> str:
    row = conn.execute(
        "SELECT carrier_name FROM shipments WHERE supplier_id = %s AND carrier_name IS NOT NULL LIMIT 1",
        (supplier_id,),
    ).fetchone()
    return row["carrier_name"] if row else "Maersk Line"


def remove_previous_live_orders(conn) -> list[str]:
    pos = [r["po_number"] for r in conn.execute(
        "SELECT po_number FROM purchase_orders WHERE notes LIKE %s", (LIVE_TAG + "%",)).fetchall()]
    if not pos:
        return []
    incident_ids = [f"INC-{p}" for p in pos]
    conn.execute("DELETE FROM logistics_conversations WHERE incident_id = ANY(%s)", (incident_ids,))
    conn.execute("DELETE FROM risk_alerts WHERE incident_id = ANY(%s)", (incident_ids,))
    conn.execute("DELETE FROM sourcing_proposals WHERE po_number = ANY(%s)", (pos,))
    conn.execute("DELETE FROM incidents WHERE po_number = ANY(%s)", (pos,))
    conn.execute("DELETE FROM shipments WHERE po_number = ANY(%s)", (pos,))  # cascades tracking points
    conn.execute("DELETE FROM purchase_orders WHERE po_number = ANY(%s)", (pos,))
    return pos


def insert_order(c: Candidate, plan: dict[str, Any], notes: str, replace: bool) -> str:
    with db.transaction() as conn:
        if replace:
            removed = remove_previous_live_orders(conn)
            if removed:
                print(f"removed earlier live orders: {', '.join(removed)}")
        po_number, po_id = next_po_number(conn)
        carrier = carrier_for(conn, c.supplier.id)
        conn.execute(
            """INSERT INTO purchase_orders (id, po_number, supplier_id, supplier_name, sku, sku_name,
                   quantity, unit_price, total_amount, order_date, promised_delivery_date,
                   actual_or_expected_delivery_date, status, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (po_id, po_number, c.supplier.id, c.supplier.name, c.item.sku, c.item.name,
             plan["quantity"], plan["unit_price"], plan["quantity"] * plan["unit_price"],
             plan["order_date"], plan["promised"], plan["promised"], plan["status"], notes),
        )
        shipment_id = f"SHP-{po_number}"
        conn.execute(
            """INSERT INTO shipments (id, purchase_order_id, po_number, supplier_id, supplier_name, sku,
                   sku_name, quantity, unit, destination_warehouse, promised_delivery_date,
                   expected_delivery_date, delay_days, current_delay_risk_score, risk_level,
                   carrier_name, tracking_number)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,'LOW',%s,%s)""",
            (shipment_id, po_id, po_number, c.supplier.id, c.supplier.name, c.item.sku, c.item.name,
             plan["quantity"], c.item.unit, Jsonb(plan["warehouse"]), plan["promised"], plan["eta"],
             (plan["eta"] - plan["promised"]).days, carrier,
             f"LIVE{date.today():%y%m%d}{po_number[-3:]}"),
        )
        for t in plan["track"]:
            conn.execute(
                """INSERT INTO shipment_tracking_points (id, shipment_id, purchase_order_id, po_number,
                       supplier_id, supplier_name, latitude, longitude, location_name, recorded_at,
                       source, speed_kmh, status_note)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (f"TRK-{po_number}-{t['seq']:02d}", shipment_id, po_id, po_number, c.supplier.id,
                 c.supplier.name, t["lat"], t["lng"], t["loc"], t["at"], t["src"], t["speed"], t["note"]),
            )
    return po_number


def sync_shipment_risk(po_number: str) -> None:
    with db.transaction() as conn:
        conn.execute(
            """UPDATE shipments s
               SET current_delay_risk_score = COALESCE(po.current_risk_score, 0),
                   risk_level = CASE WHEN COALESCE(po.current_risk_score, 0) >= 35 THEN 'HIGH'
                                     WHEN COALESCE(po.current_risk_score, 0) >= 20 THEN 'MEDIUM'
                                     ELSE 'LOW' END,
                   updated_at = CURRENT_TIMESTAMP
               FROM purchase_orders po
               WHERE po.id = s.purchase_order_id AND po.po_number = %s""",
            (po_number,),
        )


def report(po_number: str) -> None:
    with db.connection() as conn:
        po = conn.execute(
            "SELECT current_risk_score, risk_breakdown FROM purchase_orders WHERE po_number = %s",
            (po_number,)).fetchone()
        inc = conn.execute("SELECT id, state, delay_risk_score, summary FROM incidents WHERE po_number = %s",
                           (po_number,)).fetchone()
        prop = conn.execute("SELECT id, recommendation FROM sourcing_proposals WHERE po_number = %s",
                            (po_number,)).fetchone()
    print(f"\nRESULT {po_number}: risk score {po['current_risk_score'] if po else '-'}")
    if po and po["risk_breakdown"]:
        print("  " + str(po["risk_breakdown"].get("formulaExplanation")
                         or po["risk_breakdown"].get("formula_explanation", "")))
    if inc:
        print(f"  incident {inc['id']} [{inc['state']}] {inc['summary']}")
    else:
        print("  no incident (score at or below threshold)")
    if prop:
        print(f"  proposal {prop['id']}: {(prop['recommendation'] or '')[:300]}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh-risk", action="store_true", help="run live GDELT + FMP supplier scan first")
    ap.add_argument("--supplier", help="force a supplier id instead of the top-ranked one")
    ap.add_argument("--replace", action="store_true", help="delete earlier [LIVE-SCAN] orders first")
    ap.add_argument("--dry-run", action="store_true", help="rank and print the plan, write nothing")
    args = ap.parse_args()
    setup_logging("WARNING")

    try:
        if args.refresh_risk and not args.dry_run:
            from ai_worker import run_once  # noqa: PLC0415

            print("supplier_risk_scan (GDELT + FMP, live)...")
            r = run_once(JobName.SUPPLIER_RISK_SCAN, "live_demo")
            print(f"  {r['status']} {r.get('stats')}")

        cands = rank_candidates(args.supplier)
        if not cands:
            print("no candidate supplier/SKU found")
            return 1
        print_ranking(cands)

        top = cands[0]
        today = date.today()
        plan = plan_order(top, today)
        notes = build_evidence(top, today)
        print(f"\nPICK {top.supplier.id} {top.supplier.name} / {top.item.sku} {top.item.name} "
              f"(predicted score {top.score})")
        print(f"  {plan['quantity']} {top.item.unit} x {plan['unit_price']:,.0f} VND, "
              f"order {plan['order_date']}, promised {plan['promised']}, carrier ETA {plan['eta']}, "
              f"now at {plan['position']}")
        print(f"  notes: {notes}")
        if args.dry_run:
            return 0

        po_number = insert_order(top, plan, notes, args.replace)
        print(f"\ncreated {po_number}; running order_risk_scan...")
        from ai_worker import run_once  # noqa: PLC0415

        r = run_once(JobName.ORDER_RISK_SCAN, "live_demo", po_number)
        print(f"  {r['status']} {r.get('stats')} {r.get('errors') or ''}")
        sync_shipment_risk(po_number)
        report(po_number)
        return 0
    finally:
        db.close_pool()


if __name__ == "__main__":
    raise SystemExit(main())
