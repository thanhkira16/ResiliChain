"""Hop dong du lieu dung chung cho toan bo AI Engine.

Day la NGUON SU THAT DUY NHAT ve kieu du lieu giua cac agent, lop database va
integrations. Ten truong khop 1-1 voi cot Postgres (snake_case) va voi type cua
frontend (`frontend/src/types/index.ts`).
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


# --------------------------------------------------------------------------
# Enums -- chuoi tieng Viet PHAI khop tuyet doi voi frontend/src/types/index.ts.
# Sai mot dau la UI trang. Co test doi chieu o tests/test_contracts.py.
# --------------------------------------------------------------------------


class IncidentState(StrEnum):
    DETECTED = "DETECTED"
    SOURCING_BACKUP_SUPPLIERS = "SOURCING_BACKUP_SUPPLIERS"
    RFQ_SENT = "RFQ_SENT"
    QUOTES_COLLECTING = "QUOTES_COLLECTING"
    QUOTES_READY_FOR_REVIEW = "QUOTES_READY_FOR_REVIEW"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    PO_AMENDED = "PO_AMENDED"
    REJECTED = "REJECTED"
    MANUAL_HANDLING = "MANUAL_HANDLING"
    NO_QUOTES_RECEIVED = "NO_QUOTES_RECEIVED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    CANCELLED = "CANCELLED"


class IncidentStatusLabel(StrEnum):
    DETECTED = "Mới phát hiện"
    SOURCING = "Đang tìm nguồn thay thế"
    PENDING_APPROVAL = "Chờ duyệt"
    APPROVED = "Đã duyệt"
    RESOLVED = "Đã giải quyết"
    CANCELLED = "Đã hủy"
    ESCALATED = "Escalated"
    MANUAL_HANDLING = "Xử lý thủ công"


STATE_TO_LABEL: dict[IncidentState, IncidentStatusLabel] = {
    IncidentState.DETECTED: IncidentStatusLabel.DETECTED,
    IncidentState.SOURCING_BACKUP_SUPPLIERS: IncidentStatusLabel.SOURCING,
    IncidentState.RFQ_SENT: IncidentStatusLabel.SOURCING,
    IncidentState.QUOTES_COLLECTING: IncidentStatusLabel.SOURCING,
    IncidentState.QUOTES_READY_FOR_REVIEW: IncidentStatusLabel.PENDING_APPROVAL,
    IncidentState.PENDING_APPROVAL: IncidentStatusLabel.PENDING_APPROVAL,
    IncidentState.APPROVED: IncidentStatusLabel.APPROVED,
    IncidentState.PO_AMENDED: IncidentStatusLabel.APPROVED,
    IncidentState.REJECTED: IncidentStatusLabel.CANCELLED,
    IncidentState.MANUAL_HANDLING: IncidentStatusLabel.MANUAL_HANDLING,
    IncidentState.NO_QUOTES_RECEIVED: IncidentStatusLabel.MANUAL_HANDLING,
    IncidentState.ESCALATED: IncidentStatusLabel.ESCALATED,
    IncidentState.RESOLVED: IncidentStatusLabel.RESOLVED,
    IncidentState.CANCELLED: IncidentStatusLabel.CANCELLED,
}

#: Bang ghi da co quyet dinh cua con nguoi -- worker KHONG duoc ghi de (plan/04 §5).
HUMAN_DECIDED_STATES: frozenset[str] = frozenset(
    {"APPROVED", "RESOLVED", "REJECTED", "CANCELLED", "PO_AMENDED"}
)


class ProposalStatus(StrEnum):
    PENDING = "Chờ duyệt"
    APPROVED = "Đã duyệt"
    REJECTED = "Từ chối"
    AMENDED = "Sửa & Duyệt"
    COMPENSATED = "Đã hủy (Compensated)"


HUMAN_DECIDED_PROPOSAL_STATUSES: frozenset[str] = frozenset(
    {ProposalStatus.APPROVED, ProposalStatus.REJECTED, ProposalStatus.AMENDED}
)


class RiskLevel(StrEnum):
    HIGH = "CAO"
    MEDIUM = "TRUNG BÌNH"
    LOW = "THẤP"


class JobName(StrEnum):
    ORDER_RISK_SCAN = "order_risk_scan"
    SUPPLIER_RISK_SCAN = "supplier_risk_scan"


class JobStatus(StrEnum):
    # Viet HOA -- khop du lieu dang co trong ai_job_runs tren Supabase.
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


# --------------------------------------------------------------------------
# ERP rows (chi doc)
# --------------------------------------------------------------------------


class PricePoint(Strict):
    """Mot moc gia trong chuoi gia lich su cua NCC cho mot SKU."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    date: str
    unit_price: float = Field(validation_alias="unitPrice", serialization_alias="unitPrice")


class Supplier(Strict):
    id: str
    name: str
    contact_person: str = ""
    email: str = ""
    phone: str = ""
    provided_skus: list[str] = Field(default_factory=list)
    average_lead_time_days: int = 0
    #: `suppliers.historical_price` tren DB la CHUOI GIA THEO THOI GIAN cho moi SKU,
    #: khong phai mot gia don. Dung `latest_price()` de lay gia hien hanh.
    historical_price: dict[str, list[PricePoint]] = Field(default_factory=dict)
    reliability_score: int = 0
    address: str = ""
    transit_waypoints: list[dict[str, Any]] = Field(default_factory=list)

    def latest_price(self, sku: str) -> float | None:
        """Gia moi nhat cua `sku` theo `date`. None neu NCC khong bao gia SKU nay."""
        series = self.historical_price.get(sku) or []
        if not series:
            return None
        return max(series, key=lambda p: p.date).unit_price

    def price_history(self, sku: str) -> list[PricePoint]:
        """Chuoi gia da sap xep tang dan theo ngay -- dung de ve bieu do xu huong."""
        return sorted(self.historical_price.get(sku) or [], key=lambda p: p.date)


class InventoryItem(Strict):
    sku: str
    name: str
    category: str = ""
    unit: str = ""
    current_stock: int = 0
    safety_stock: int = 0
    weekly_burn_rate: int = 0
    unit_price_estimate: float = 0.0
    min_lead_time_days: int = 0


class PurchaseOrder(Strict):
    id: str
    po_number: str
    supplier_id: str
    supplier_name: str
    sku: str
    sku_name: str
    quantity: int
    unit_price: float
    total_amount: float
    order_date: str
    promised_delivery_date: str
    actual_or_expected_delivery_date: str
    status: str
    current_risk_score: float | None = None
    risk_breakdown: dict[str, Any] | None = None
    notes: str | None = None


class OrderContext(Strict):
    """Output cua Agent 1 -- mot don hang da duoc lam giau du du lieu de cham diem."""

    order: PurchaseOrder
    inventory: InventoryItem
    supplier: Supplier
    delay_days: int
    committed_lead_time_days: int
    weather_delay_days: float = 0.0
    latest_tracking_point: dict[str, Any] | None = None


# --------------------------------------------------------------------------
# Ket qua cham diem
# --------------------------------------------------------------------------


class RiskBreakdown(Strict):
    """Khop `RiskBreakdown` cua frontend -- ghi vao purchase_orders.risk_breakdown."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)

    lateness_factor: float = Field(validation_alias="latenessFactor", serialization_alias="latenessFactor")
    supplier_reliability_factor: float = Field(validation_alias="supplierReliabilityFactor", serialization_alias="supplierReliabilityFactor")
    inventory_buffer_factor: float = Field(validation_alias="inventoryBufferFactor", serialization_alias="inventoryBufferFactor")
    w1: float
    w2: float
    w3: float
    delay_days: int = Field(validation_alias="delayDays", serialization_alias="delayDays")
    committed_lead_time_days: int = Field(validation_alias="committedLeadTimeDays", serialization_alias="committedLeadTimeDays")
    current_stock: int = Field(validation_alias="currentStock", serialization_alias="currentStock")
    safety_stock: int = Field(validation_alias="safetyStock", serialization_alias="safetyStock")
    formula_explanation: str = Field(validation_alias="formulaExplanation", serialization_alias="formulaExplanation")


class ScoreBreakdown(Strict):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)

    normalized_cost: float = Field(validation_alias="normalizedCost", serialization_alias="normalizedCost")
    normalized_lead_time: float = Field(validation_alias="normalizedLeadTime", serialization_alias="normalizedLeadTime")
    supplier_reliability_score: float = Field(validation_alias="supplierReliabilityScore", serialization_alias="supplierReliabilityScore")
    w1: float
    w2: float
    w3: float
    cost_score_contribution: float = Field(validation_alias="costScoreContribution", serialization_alias="costScoreContribution")
    time_score_contribution: float = Field(validation_alias="timeScoreContribution", serialization_alias="timeScoreContribution")
    reliability_contribution: float = Field(validation_alias="reliabilityContribution", serialization_alias="reliabilityContribution")


class ProposalRanking(Strict):
    """Khop `ProposalRanking` cua frontend -- phan tu cua sourcing_proposals.rankings[]."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)

    rank: int
    supplier_id: str = Field(validation_alias="supplierId", serialization_alias="supplierId")
    supplier_name: str = Field(validation_alias="supplierName", serialization_alias="supplierName")
    unit_price: float = Field(validation_alias="unitPrice", serialization_alias="unitPrice")
    total_cost: float = Field(validation_alias="totalCost", serialization_alias="totalCost")
    lead_time_days: int = Field(validation_alias="leadTimeDays", serialization_alias="leadTimeDays")
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    score: int
    score_breakdown: ScoreBreakdown = Field(validation_alias="scoreBreakdown", serialization_alias="scoreBreakdown")
    reasoning: str = ""


class LLMRankingEnrichment(Strict):
    """Schema BAT BUOC cho structured output cua OpenRouter (plan/06 §3.5)."""

    supplier_id: str = Field(validation_alias="supplierId", serialization_alias="supplierId")
    pros: list[str] = Field(min_length=1, max_length=5)
    cons: list[str] = Field(min_length=1, max_length=5)
    reasoning: str = Field(min_length=1)


class LLMProposalAnalysis(Strict):
    rankings: list[LLMRankingEnrichment] = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    rejected_options_analysis: list[dict[str, Any]] = Field(
        default_factory=list, validation_alias="rejectedOptionsAnalysis", serialization_alias="rejectedOptionsAnalysis"
    )


# --------------------------------------------------------------------------
# Integrations
# --------------------------------------------------------------------------


class KeyEvent(Strict):
    date: str
    summary: str


class NewsRiskResult(Strict):
    supplier_id: str
    ssi_news: float
    g_geo: float
    events_supply_chain_30d: int = 0
    key_events: list[KeyEvent] = Field(default_factory=list)
    stale: bool = False


class FinancialResult(Strict):
    supplier_id: str
    ticker: str
    altman_z: float | None = None
    ssi_fin: float
    zone: str = ""
    stale: bool = False


class WeatherDelay(Strict):
    delay_days: float = 0.0
    severity: str = "Ổn định"
    detail: list[dict[str, Any]] = Field(default_factory=list)
    stale: bool = False


# --------------------------------------------------------------------------
# AI-owned rows (ghi)
# --------------------------------------------------------------------------


class SupplierRiskAnalysis(Strict):
    supplier_id: str
    ticker: str
    ssi_news: float | None = None
    ssi_fin: float | None = None
    g_geo: float | None = None
    ssi_del: float | None = None
    altman_z: float | None = None
    pors_score: float | None = None
    risk_level: RiskLevel | None = None
    status_label: str | None = None
    events_supply_chain_30d: int | None = None
    key_events: list[KeyEvent] = Field(default_factory=list)
    analyzed_at: datetime


class Incident(Strict):
    id: str
    correlation_id: str
    po_number: str
    sku: str
    sku_name: str
    supplier_id: str
    supplier_name: str
    delay_days: int
    delay_risk_score: float
    threshold_applied: float
    state: IncidentState
    status: IncidentStatusLabel
    detected_at: str
    summary: str
    agent2_triggered: bool = False
    risk_breakdown: RiskBreakdown | None = None


class SourcingProposal(Strict):
    id: str
    incident_id: str
    correlation_id: str
    po_number: str
    sku: str
    sku_name: str
    quantity: int
    original_supplier_name: str
    original_unit_price: float
    original_total_cost: float
    rankings: list[ProposalRanking]
    selected_rank: int = 1
    recommendation: str
    rejected_options_analysis: list[dict[str, Any]] = Field(default_factory=list)
    status: ProposalStatus = ProposalStatus.PENDING
    total_value_vnd: float


class AiJobRun(Strict):
    id: int | None = None
    job_name: JobName
    trigger_source: str
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    status: JobStatus = JobStatus.RUNNING
    orders_scanned: int = 0
    suppliers_scanned: int = 0
    incidents_created: int = 0
    incidents_updated: int = 0
    proposals_created: int = 0
    skipped_locked: int = 0
    message: str | None = None
    error_detail: str | None = None
