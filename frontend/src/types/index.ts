export type UserRole = "procurement_officer" | "supply_chain_manager" | "supplier";

export type AgentType = "RiskMonitoring" | "Negotiation" | "Forecasting";
export type AgentRunStatus = "STARTED" | "IN_PROGRESS" | "COMPLETED" | "DUPLICATE_SKIPPED";

export interface AgentRun {
  id: string;
  agentType: AgentType;
  correlationId: string;
  status: AgentRunStatus;
  resultPayloadJson?: string;
  startedAt: string;
  completedAt?: string;
}

export interface TransitWaypoint {
  orderIndex: number;
  locationName: string;
  checkpointType: "OriginWarehouse" | "TransitHub" | "TollPlaza" | "DestinationWarehouse";
  description: string;
  estimatedHoursFromOrigin?: number;
  latitude?: number;
  longitude?: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  providedSkus: string[]; // SKU IDs
  averageLeadTimeDays: number;
  historicalPrice: Record<string, number>; // skuId -> unitPrice VNĐ
  reliabilityScore: number; // 0-100
  address: string;
  transitWaypoints?: TransitWaypoint[];
}

export type POStatus = "Đang xử lý" | "Đang giao" | "Trễ hẹn" | "Hoàn thành";

export interface RiskBreakdown {
  latenessFactor: number; // [0, 1] min(1, số ngày trễ / lead_time_cam_kết)
  supplierReliabilityFactor: number; // [0, 1] 1 - reliability_score
  inventoryBufferFactor: number; // [0, 1] 1 - (tồn_kho_hiện_tại / safety_stock)
  w1: number; // trọng số lateness (mặc định 0.50)
  w2: number; // trọng số reliability (mặc định 0.25)
  w3: number; // trọng số buffer kho (mặc định 0.25)
  delayDays: number;
  committedLeadTimeDays: number;
  currentStock: number;
  safetyStock: number;
  formulaExplanation: string;
}

export interface RiskHistoryPoint {
  timestamp: string;
  score: number;
  delayDays: number;
  breakdown: RiskBreakdown;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  sku: string;
  skuName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  orderDate: string; // YYYY-MM-DD
  promisedDeliveryDate: string; // YYYY-MM-DD
  actualOrExpectedDeliveryDate: string; // YYYY-MM-DD (simulated tracking)
  status: POStatus;
  currentRiskScore?: number;
  riskScoreSource?: "MANUAL" | "CALCULATED";
  riskBreakdown?: RiskBreakdown;
  riskHistory?: RiskHistoryPoint[];
  notes?: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  safetyStock: number;
  weeklyBurnRate: number; // Tốc độ tiêu thụ trung bình/tuần
  unitPriceEstimate: number; // VNĐ
  minLeadTimeDays: number;
}

// State Machine of an Incident (SRS §3.2)
export type IncidentState =
  | "DETECTED"
  | "SOURCING_BACKUP_SUPPLIERS"
  | "RFQ_SENT"
  | "QUOTES_COLLECTING"
  | "QUOTES_READY_FOR_REVIEW"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PO_AMENDED"
  | "REJECTED"
  | "MANUAL_HANDLING"
  | "NO_QUOTES_RECEIVED"
  | "ESCALATED"
  | "RESOLVED"
  | "CANCELLED";

export interface Incident {
  id: string;
  correlationId: string;
  poNumber: string;
  sku: string;
  skuName: string;
  supplierId: string;
  supplierName: string;
  delayDays: number;
  delayRiskScore: number; // 0-100
  thresholdApplied: number;
  state: IncidentState;
  // Friendly localized label for backward compatibility
  status:
    | "Mới phát hiện"
    | "Đang tìm nguồn thay thế"
    | "Chờ duyệt"
    | "Đã duyệt"
    | "Đã giải quyết"
    | "Đã hủy"
    | "Escalated"
    | "Xử lý thủ công";
  detectedAt: string;
  resolvedAt?: string;
  summary: string;
  agent2Triggered: boolean;
  rfqSentCount?: number;
  riskBreakdown?: RiskBreakdown;
  riskBreakdownJson?: string;
  autoResolvedReason?: string;
}

export interface RFQItem {
  id: string;
  incidentId: string;
  correlationId: string;
  poNumber: string;
  sku: string;
  skuName: string;
  quantity: number;
  targetDeliveryDate: string;
  backupSupplierId: string;
  backupSupplierName: string;
  emailSubject: string;
  emailBody: string;
  termsSummary: string;
  sentAt: string;
  deadline: string; // ISO string
  status: "Đã gửi" | "Đã phản hồi" | "Hết hạn" | "Đã hủy";
  response?: SupplierQuoteResponse;
}

export interface SupplierQuoteResponse {
  respondedAt: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number; // VNĐ
  totalCost: number;
  proposedLeadTimeDays: number;
  proposedDeliveryDate: string;
  reliabilityScore: number;
  notes: string;
}

export interface RankingScoreBreakdown {
  normalizedCost: number; // [0, 1] min-max
  normalizedLeadTime: number; // [0, 1] min-max
  supplierReliabilityScore: number; // [0, 1]
  w1: number; // trọng số giá (thích ứng theo mức độ khẩn cấp của incident)
  w2: number; // trọng số thời gian
  w3: number; // trọng số uy tín
  costScoreContribution: number;
  timeScoreContribution: number;
  reliabilityContribution: number;
}

export interface ProposalRanking {
  rank: number;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  totalCost: number;
  leadTimeDays: number;
  pros: string[];
  cons: string[];
  score: number;
  scoreBreakdown?: RankingScoreBreakdown;
  reasoning: string;
}

export interface SourcingProposal {
  id: string;
  incidentId: string;
  correlationId: string;
  poNumber: string;
  sku: string;
  skuName: string;
  quantity: number;
  originalSupplierName: string;
  originalUnitPrice: number;
  originalTotalCost: number;
  rankings: ProposalRanking[];
  selectedRank: number; // Default 1, but user can edit before approving
  customAdjusted?: {
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    leadTimeDays: number;
    quantity: number;
    totalCost: number;
    reasonForAdjustment: string;
  };
  recommendation: string;
  rejectedOptionsAnalysis: Array<{
    supplierName: string;
    reason: string;
  }>;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối" | "Sửa & Duyệt" | "Đã hủy (Compensated)";
  totalValueVND: number;
  createdAt: string;
  decisionAt?: string;
  decidedByRole?: UserRole;
  decisionNotes?: string;
  escalatedToManager?: boolean;
}

export interface DemandHistoryWeek {
  week: number; // 1 to 12
  weekLabel: string;
  actualDemand: number;
  forecastDemand?: number;
}

export interface SkuDemandData {
  sku: string;
  skuName: string;
  history: DemandHistoryWeek[]; // 12 weeks
}

export interface SeasonalityConfig {
  month: number;
  monthName: string;
  factor: number; // e.g. 1.2 = +20% demand
  description: string;
}

export interface ForecastFeedbackItem {
  week: number;
  weekLabel: string;
  forecastP50: number;
  actualSales: number;
  absPercentageError: number; // MAPE single point (%)
}

export interface ForecastResult {
  sku: string;
  skuName: string;
  currentStock: number;
  safetyStock: number;
  weeklyBurnRate: number;
  seasonalityFactor: number;
  incomingFromOpenPOs: number;
  projectedShortfall: number;
  modelVersion: string; // e.g. "v1.2-holtwinters-seasonal"
  inputFeaturesJson?: string;
  forecastWeeks: Array<{
    weekIndex: number;
    label: string;
    predictedDemand: number; // P50 (kịch bản trung bình)
    predictedP10: number; // P10 (kịch bản thấp)
    predictedP50: number; // P50
    predictedP90: number; // P90 (kịch bản cao)
    lowerBound: number;
    upperBound: number;
  }>;
  mape: number; // Mean Absolute Percentage Error (0-100%)
  feedbackHistory: ForecastFeedbackItem[];
  suggestedOrderQuantity: number;
  aiExplanation?: {
    explanation: string;
    keyFactors: string[];
    procurementRecommendation: string;
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  correlationId: string;
  agent: "Agent 1 (Risk Monitoring)" | "Agent 2 (Negotiation & Sourcing)" | "Agent 3 (Demand Forecasting)" | "Human (HITL)" | "System";
  action: string;
  poNumber?: string;
  supplierName?: string;
  sku?: string;
  inputSummary: string;
  outputReasoning: string;
  metadata?: Record<string, any>;
}

export interface AppNotification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success" | "escalation";
  isRead: boolean;
  correlationId?: string;
  linkTab?: string;
  proposalId?: string;
  incidentId?: string;
}

export interface RiskThresholdConfig {
  defaultThreshold: number; // 70
  autoTriggerAgent2: boolean;
  w1: number; // lateness factor weight (0.50)
  w2: number; // supplier reliability weight (0.25)
  w3: number; // inventory buffer weight (0.25)
  skuOverrides: Record<string, number>; // sku -> threshold
}

// Domain Event Contracts (SRS §2.5, §4.4)
export interface IncidentDetectedEvent {
  incidentId: string;
  purchaseOrderId: string;
  skuId: string;
  supplierId: string;
  delayRiskScore: number;
  riskBreakdownJson: string;
  detectedAt: string;
}

export interface IncidentAutoResolvedEvent {
  incidentId: string;
  purchaseOrderId: string;
  previousRiskScore: number;
  newRiskScore: number;
  reason: string;
  resolvedAt: string;
}

export interface RfqSentEvent {
  incidentId: string;
  supplierIds: string[];
  sentAt: string;
}

export interface ProposalReadyForApprovalEvent {
  incidentId: string;
  proposalId: string;
  topRankedSuppliers: string[];
  totalValueVND: number;
  readyAt: string;
}

export interface EscalationRequiredEvent {
  incidentId: string;
  reason: string;
  escalatedAt: string;
}

export interface ProcurementPlanProposedEvent {
  proposalId: string;
  skuId: string;
  forecastWeek: number;
  forecastP50: number;
  forecastP90: number;
  currentInventory: number;
  incomingFromOpenPOs: number;
  projectedShortfall: number;
  modelVersion: string;
  inputFeaturesJson: string;
}

// ----------------------------------------------------
// Shipment Tracking & Map Domain Types (SRS FR-4.3)
// ----------------------------------------------------
export type TrackingSource = "CarrierWebhook" | "ManualUpdate";

export interface DestinationWarehouse {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface ShipmentTrackingPoint {
  id: string;
  shipmentId: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  latitude: number;
  longitude: number;
  locationName: string;
  recordedAt: string; // ISO 8601 string
  source: TrackingSource;
  speedKmh?: number;
  heading?: number;
  statusNote?: string;
}

export interface AtRiskShipmentMapItem {
  shipmentId: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  sku: string;
  skuName: string;
  quantity: number;
  unit: string;
  destinationWarehouse: DestinationWarehouse;
  promisedDeliveryDate: string;
  expectedDeliveryDate: string;
  delayDays: number;
  currentDelayRiskScore: number; // Snapshot from F4 - never recalculated
  appliedThreshold: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  riskBreakdown?: RiskBreakdown; // Exact SRS 2.3 formula breakdown from F4
  incidentId?: string;
  incidentState?: IncidentState;
  carrierName: string;
  trackingNumber: string;
  latestTrackingPoint: ShipmentTrackingPoint;
  routeHistory: ShipmentTrackingPoint[];
  lastUpdatedAt: string;
}

export interface ShipmentLocationUpdatedEvent {
  shipmentId: string;
  purchaseOrderId: string;
  supplierId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  source: TrackingSource;
  currentDelayRiskScore?: number; // Snapshot from F4 - never recalculated
}
