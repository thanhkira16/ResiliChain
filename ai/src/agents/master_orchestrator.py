"""AGENT 6 -- Master Orchestrator Agent.

Dieu phoi 5 sub-agent bang LangGraph. Day la NOI DUY NHAT duoc ghi DB.

Hai nhip quet:
  * `order_risk_scan`     (5-10 phut): Agent 1 -> cham diem -> incident -> Agent 5/4 -> ghi
  * `supplier_risk_scan`  (1 lan/ngay): Agent 2 ‖ Agent 3 -> PORS -> supplier_risk_analysis
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, TypedDict, cast

from langgraph.graph import END, START, StateGraph

from src.agents.db_ingestion_agent import DbIngestionAgent
from src.agents.financial_health_agent import FinancialHealthAgent, resolve_ticker
from src.agents.logistics_chatbox_agent import LogisticsChatboxAgent
from src.agents.news_risk_agent import NewsRiskAgent
from src.agents.replacement_sourcing_agent import ReplacementSourcingAgent
from src.core.config import settings
from src.core.contracts import (
    Incident,
    IncidentState,
    OrderContext,
    RiskLevel,
    SourcingProposal,
    STATE_TO_LABEL,
    SupplierRiskAnalysis,
)
from src.core.formulas import pors_score, risk_level, ssi_del_from_history
from src.core.logging import get_logger
from src.core.formulas import delay_risk_score
from src.database import db_client as db

log = get_logger("agent.agent6_orchestrator")


# --------------------------------------------------------------------------
# Nhan nguyen nhan cho supplier_risk_analysis.status_label.
# Bo nhan nay do DU LIEU THAT quy dinh (6 gia tri dang co tren Supabase),
# khong duoc tu dat chuoi moi -- frontend so khop theo chuoi.
# --------------------------------------------------------------------------
LABEL_BOTH = "Cả hai trục"
LABEL_GEO = "Địa chính trị"
LABEL_DISTRESS = "Kiệt quệ"
LABEL_EXPORT = "Kiểm soát XK"
LABEL_QUALITY = "Chất lượng"
LABEL_NONE = "Không vấn đề"

ALLOWED_STATUS_LABELS = frozenset(
    {LABEL_BOTH, LABEL_GEO, LABEL_DISTRESS, LABEL_EXPORT, LABEL_QUALITY, LABEL_NONE}
)


def derive_status_label(
    ssi_news: float, ssi_fin: float, g_geo: float, altman_z: float | None
) -> str:
    """Nhan nguyen nhan chinh cua rui ro -- truc tin tuc hay truc tai chinh."""
    news_hot = ssi_news >= 60.0 or g_geo >= 70.0
    fin_hot = ssi_fin >= 60.0 or (altman_z is not None and altman_z <= 1.81)
    if news_hot and fin_hot:
        return LABEL_BOTH
    if fin_hot:
        return LABEL_DISTRESS
    if news_hot:
        return LABEL_EXPORT if g_geo >= 80.0 else LABEL_GEO
    if ssi_news >= 45.0:
        return LABEL_QUALITY
    return LABEL_NONE


#: Thu tu tien trien cua state machine. Worker chi duoc DAY TOI, khong duoc keo lui:
#: mot incident dang `PENDING_APPROVAL` (AI xong, dang cho nguoi duyet) ma bi vong quet
#: sau do dua ve `SOURCING_BACKUP_SUPPLIERS` la mat vi tri quy trinh.
STATE_PROGRESS: dict[IncidentState, int] = {
    IncidentState.DETECTED: 0,
    IncidentState.SOURCING_BACKUP_SUPPLIERS: 1,
    IncidentState.RFQ_SENT: 2,
    IncidentState.QUOTES_COLLECTING: 3,
    IncidentState.QUOTES_READY_FOR_REVIEW: 4,
    IncidentState.PENDING_APPROVAL: 5,
    IncidentState.NO_QUOTES_RECEIVED: 5,
    IncidentState.MANUAL_HANDLING: 6,
    IncidentState.ESCALATED: 6,
    IncidentState.APPROVED: 7,
    IncidentState.PO_AMENDED: 7,
    IncidentState.REJECTED: 8,
    IncidentState.RESOLVED: 8,
    IncidentState.CANCELLED: 8,
}


def advance_state(current: IncidentState | str | None, proposed: IncidentState) -> IncidentState:
    """Tra ve state moi, nhung KHONG BAO GIO lui ve truoc state hien co trong DB."""
    if current is None:
        return proposed
    try:
        existing = IncidentState(current)
    except ValueError:
        return proposed
    if STATE_PROGRESS.get(existing, 0) >= STATE_PROGRESS.get(proposed, 0):
        return existing
    return proposed


def build_summary(ctx: OrderContext, score: int, threshold: float) -> str:
    return (
        f"Đơn {ctx.order.po_number} ({ctx.order.sku_name}) từ {ctx.order.supplier_name} "
        f"trễ {ctx.delay_days} ngày, điểm rủi ro {score}/100 vượt ngưỡng {threshold:g}. "
        f"Tồn kho {ctx.inventory.current_stock}/{ctx.inventory.safety_stock} "
        f"({'DƯỚI' if ctx.inventory.current_stock < ctx.inventory.safety_stock else 'trên'} "
        "mức an toàn)."
    )


# --------------------------------------------------------------------------
# LangGraph state
# --------------------------------------------------------------------------


class ScanState(TypedDict, total=False):
    correlation_id: str
    po_number: str | None
    trigger_source: str
    contexts: list[OrderContext]
    scored: list[dict[str, Any]]
    incidents: list[Incident]
    proposals: list[SourcingProposal]
    drafts: dict[str, Any]
    risk_by_supplier: dict[str, SupplierRiskAnalysis]
    stats: dict[str, int]
    degraded: bool
    errors: list[str]


# --------------------------------------------------------------------------
# Nodes -- order_risk_scan
# --------------------------------------------------------------------------


def node_ingest(state: ScanState) -> ScanState:
    result = DbIngestionAgent().run({"po_number": state.get("po_number")})
    contexts = result.data or []
    return {
        "contexts": contexts,
        "stats": {**state.get("stats", {}), "orders_scanned": len(contexts)},
    }


def node_load_risk(state: ScanState) -> ScanState:
    """Doc radar rui ro NCC da co san trong DB (nhip ngay ghi ra, nhip 5 phut chi doc)."""
    try:
        rows = db.fetch_all_supplier_risk()
    except Exception as exc:  # noqa: BLE001
        log.warning("orchestrator.risk_unavailable", extra={"error": str(exc)[:200]})
        return {"risk_by_supplier": {}, "degraded": True}
    return {"risk_by_supplier": {r.supplier_id: r for r in rows}}


def node_score(state: ScanState) -> ScanState:
    """Cham diem rui ro tre han cho tung don. Phat tu PORS sang do tin cay NCC."""
    risk = state.get("risk_by_supplier", {})
    scored: list[dict[str, Any]] = []
    for ctx in state.get("contexts", []):
        analysis = risk.get(ctx.supplier.id)
        penalty_fin = 0.0
        penalty_news = 0.0
        if analysis is not None:
            # SSI cao = rui ro cao -> tru vao diem tin cay co so.
            penalty_fin = max(0.0, float(analysis.ssi_fin or 0.0) - 50.0) / 5.0
            penalty_news = max(0.0, float(analysis.ssi_news or 0.0) - 50.0) / 5.0

        score, breakdown = delay_risk_score(
            delay_days=ctx.delay_days,
            committed_lead_time_days=ctx.committed_lead_time_days,
            reliability_score=ctx.supplier.reliability_score,
            current_stock=ctx.inventory.current_stock,
            safety_stock=ctx.inventory.safety_stock,
            weather_delay_forecast=ctx.weather_delay_days,
            penalty_fin=penalty_fin,
            penalty_news=penalty_news,
        )
        scored.append({"context": ctx, "score": score, "breakdown": breakdown})
    return {"scored": scored}


def node_detect(state: ScanState) -> ScanState:
    """Vuot nguong -> tao Incident. Chi tao, chua ghi."""
    threshold = settings.incident_risk_threshold
    cid = state.get("correlation_id", "")
    now = datetime.now(timezone.utc)
    incidents: list[Incident] = []
    try:
        existing_states = db.fetch_open_incident_states()
    except Exception as exc:  # noqa: BLE001
        log.warning("orchestrator.incidents_unavailable", extra={"error": str(exc)[:200]})
        existing_states = {}
    for row in state.get("scored", []):
        if row["score"] <= threshold:
            continue
        ctx: OrderContext = row["context"]
        existing = existing_states.get(f"INC-{ctx.order.po_number}")
        state_value = advance_state(existing, IncidentState.DETECTED)
        incidents.append(
            Incident(
                id=f"INC-{ctx.order.po_number}",
                correlation_id=cid,
                po_number=ctx.order.po_number,
                sku=ctx.order.sku,
                sku_name=ctx.order.sku_name,
                supplier_id=ctx.order.supplier_id,
                supplier_name=ctx.order.supplier_name,
                delay_days=ctx.delay_days,
                delay_risk_score=row["score"],
                threshold_applied=threshold,
                state=state_value,
                status=STATE_TO_LABEL[state_value],
                detected_at=now.date().isoformat(),
                summary=build_summary(ctx, row["score"], threshold),
                agent2_triggered=False,
                risk_breakdown=row["breakdown"],
            )
        )
    return {"incidents": incidents}


def node_sourcing(state: ScanState) -> ScanState:
    """Voi moi incident: chay MILP + LLM sinh de xuat thay the."""
    by_po = {row["context"].order.po_number: row["context"] for row in state.get("scored", [])}
    risk = state.get("risk_by_supplier", {})
    agent = ReplacementSourcingAgent()
    proposals: list[SourcingProposal] = []
    degraded = state.get("degraded", False)

    for incident in state.get("incidents", []):
        ctx = by_po.get(incident.po_number)
        if ctx is None:
            continue
        notes = {
            sid: {
                "pors": float(a.pors_score) if a.pors_score is not None else None,
                "altman_z": float(a.altman_z) if a.altman_z is not None else None,
                "risk_level": a.risk_level.value if a.risk_level else None,
                "status_label": a.status_label,
            }
            for sid, a in risk.items()
        }
        result = agent.run(
            {
                "context": ctx,
                "incident_id": incident.id,
                "correlation_id": state.get("correlation_id", ""),
                "risk_notes": notes,
            }
        )
        degraded = degraded or result.degraded
        if result.data is not None:
            proposals.append(result.data)
            incident.state = advance_state(
                incident.state, IncidentState.SOURCING_BACKUP_SUPPLIERS
            )
            incident.status = STATE_TO_LABEL[incident.state]
        else:
            # Khong co nguon thay the -> chuyen xu ly thu cong, khong de treo.
            incident.state = advance_state(incident.state, IncidentState.MANUAL_HANDLING)
            incident.status = STATE_TO_LABEL[incident.state]
    return {"proposals": proposals, "degraded": degraded}


def node_chatbox(state: ScanState) -> ScanState:
    """Sinh ban nhap email xac minh cho moi incident (khong tu gui)."""
    by_po = {row["context"].order.po_number: row["context"] for row in state.get("scored", [])}
    agent = LogisticsChatboxAgent()
    drafts: dict[str, Any] = {}
    for incident in state.get("incidents", []):
        ctx = by_po.get(incident.po_number)
        if ctx is None:
            continue
        result = agent.run(ctx)
        if result.data is not None:
            drafts[incident.po_number] = result.data.model_dump(by_alias=True)
            incident.agent2_triggered = True
    return {"drafts": drafts}


def node_persist(state: ScanState) -> ScanState:
    """NOI DUY NHAT ghi DB. Idempotent, ton trong quyet dinh cua con nguoi."""
    stats = dict(state.get("stats", {}))
    stats.setdefault("incidents_created", 0)
    stats.setdefault("incidents_updated", 0)
    stats.setdefault("proposals_created", 0)
    stats.setdefault("skipped_locked", 0)
    errors = list(state.get("errors", []))

    for row in state.get("scored", []):
        ctx: OrderContext = row["context"]
        try:
            db.update_po_risk(ctx.order.po_number, row["score"], row["breakdown"])
        except Exception as exc:  # noqa: BLE001
            errors.append(f"update_po_risk {ctx.order.po_number}: {exc}")

    for incident in state.get("incidents", []):
        try:
            outcome = db.upsert_incident(incident)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"upsert_incident {incident.id}: {exc}")
            continue
        if outcome == "created":
            stats["incidents_created"] += 1
        elif outcome == "updated":
            stats["incidents_updated"] += 1
        else:
            stats["skipped_locked"] += 1

    for proposal in state.get("proposals", []):
        try:
            outcome = db.upsert_proposal(proposal)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"upsert_proposal {proposal.id}: {exc}")
            continue
        if outcome in ("created", "updated"):
            stats["proposals_created"] += 1
        else:
            stats["skipped_locked"] += 1

    return {"stats": stats, "errors": errors, "degraded": state.get("degraded", False) or bool(errors)}


def build_order_risk_graph():
    g = StateGraph(ScanState)
    g.add_node("ingest", node_ingest)
    g.add_node("load_risk", node_load_risk)
    g.add_node("score", node_score)
    g.add_node("detect", node_detect)
    g.add_node("sourcing", node_sourcing)
    g.add_node("chatbox", node_chatbox)
    g.add_node("persist", node_persist)

    g.add_edge(START, "ingest")
    g.add_edge("ingest", "load_risk")
    g.add_edge("load_risk", "score")
    g.add_edge("score", "detect")
    g.add_edge("detect", "sourcing")
    g.add_edge("sourcing", "chatbox")
    g.add_edge("chatbox", "persist")
    g.add_edge("persist", END)
    return g.compile()


# --------------------------------------------------------------------------
# supplier_risk_scan -- nhip 1 lan/ngay
# --------------------------------------------------------------------------


def scan_supplier_risk(correlation_id: str) -> dict[str, Any]:
    """Quet GDELT + FMP cho toan bo NCC, tinh PORS, ghi supplier_risk_analysis."""
    suppliers = db.fetch_suppliers()
    existing = {r.supplier_id: r for r in db.fetch_all_supplier_risk()}
    orders = db.fetch_open_purchase_orders()

    news_agent = NewsRiskAgent()
    fin_agent = FinancialHealthAgent()
    stats = {"suppliers_scanned": 0}
    errors: list[str] = []
    degraded = False

    for supplier in suppliers:
        prior = existing.get(supplier.id)
        ticker = resolve_ticker(supplier, prior.ticker if prior else None)

        # Agent 2 ‖ Agent 3 -- hai API doc lap, chay song song.
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_news = pool.submit(news_agent.run, supplier)
            f_fin = pool.submit(fin_agent.run, {"supplier": supplier, "ticker": ticker})
            news_result, fin_result = f_news.result(), f_fin.result()

        news = news_result.data
        fin = fin_result.data
        if news is None or fin is None:
            errors.append(f"{supplier.id}: thiếu dữ liệu rủi ro")
            degraded = True
            continue

        # API stale -> giu lai gia tri cu trong DB thay vi ghi de bang so trung tinh.
        ssi_news = float(prior.ssi_news) if news.stale and prior and prior.ssi_news is not None else news.ssi_news
        g_geo = float(prior.g_geo) if news.stale and prior and prior.g_geo is not None else news.g_geo
        ssi_fin = float(prior.ssi_fin) if fin.stale and prior and prior.ssi_fin is not None else fin.ssi_fin
        altman = float(prior.altman_z) if fin.stale and prior and prior.altman_z is not None else fin.altman_z
        degraded = degraded or news.stale or fin.stale

        supplier_orders = [o for o in orders if o.supplier_id == supplier.id]
        # `ssi_del_from_history` nhan cac CAP (delay_days, committed_lead_time_days).
        ssi_del = ssi_del_from_history(
            [(_delay_of(o), _lead_of(o)) for o in supplier_orders],
            reliability_score=supplier.reliability_score,
        )
        if ssi_del is None:
            ssi_del = float(prior.ssi_del) if prior and prior.ssi_del is not None else 50.0

        pors = pors_score(ssi_news=ssi_news, ssi_fin=ssi_fin, ssi_del=ssi_del, g_geo=g_geo)
        analysis = SupplierRiskAnalysis(
            supplier_id=supplier.id,
            ticker=ticker or (prior.ticker if prior else ""),
            ssi_news=round(ssi_news, 2),
            ssi_fin=round(ssi_fin, 2),
            g_geo=round(g_geo, 2),
            ssi_del=round(ssi_del, 2),
            altman_z=round(altman, 2) if altman is not None else None,
            pors_score=round(pors, 2),
            risk_level=risk_level(pors),
            status_label=derive_status_label(ssi_news, ssi_fin, g_geo, altman),
            events_supply_chain_30d=news.events_supply_chain_30d,
            key_events=news.key_events,
            analyzed_at=datetime.now(timezone.utc),
        )
        try:
            db.upsert_supplier_risk(analysis)
            stats["suppliers_scanned"] += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"upsert_supplier_risk {supplier.id}: {exc}")
            degraded = True

    return {"stats": stats, "errors": errors, "degraded": degraded}


def _delay_of(order) -> int:
    from src.agents.db_ingestion_agent import delay_days_of

    return delay_days_of(order)


def _lead_of(order) -> int:
    from src.agents.db_ingestion_agent import committed_lead_time_of

    return committed_lead_time_of(order)


def run_order_risk_scan(correlation_id: str, po_number: str | None = None) -> ScanState:
    graph = build_order_risk_graph()
    initial: ScanState = {
        "correlation_id": correlation_id,
        "po_number": po_number,
        "stats": {},
        "errors": [],
        "degraded": False,
    }
    return cast(ScanState, graph.invoke(initial))
