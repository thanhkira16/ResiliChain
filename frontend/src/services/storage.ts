import {
  Supplier,
  PurchaseOrder,
  InventoryItem,
  SeasonalityConfig,
  RiskThresholdConfig,
  AuditLogEntry,
  AppNotification,
  Incident,
  RFQItem,
  SourcingProposal,
  UserRole,
  AgentRun,
  RiskHistoryPoint,
  ShipmentTrackingPoint,
  AtRiskShipmentMapItem,
  DestinationWarehouse,
} from "../types";

const KEYS = {
  SUPPLIERS: "bikesync_suppliers",
  INVENTORY: "bikesync_inventory",
  ORDERS: "bikesync_orders",
  SEASONALITY: "bikesync_seasonality",
  DEMAND_HISTORY: "bikesync_demand_history",
  THRESHOLDS: "bikesync_thresholds",
  INCIDENTS: "bikesync_incidents",
  RFQS: "bikesync_rfqs",
  PROPOSALS: "bikesync_proposals",
  AUDIT_LOGS: "bikesync_audit_logs",
  NOTIFICATIONS: "bikesync_notifications",
  USER_ROLE: "bikesync_user_role",
  ACTIVE_SUPPLIER_ID: "bikesync_active_supplier_id",
  AGENT_RUNS: "bikesync_agent_runs",
  RISK_HISTORY: "bikesync_risk_history",
  TRACKING_POINTS: "bikesync_tracking_points",
  MAP_SHIPMENTS: "bikesync_map_shipments",
  WAREHOUSES: "bikesync_warehouses",
};

const defaultWarehouses: DestinationWarehouse[] = [
  {
    id: "WH-BN-01",
    name: "Bac Ninh Assembly Plant (Destination)",
    address: "Que Vo Industrial Park, Bac Ninh",
    latitude: 21.18,
    longitude: 106.07,
  },
  {
    id: "WH-DN-02",
    name: "Da Nang Distribution Hub",
    address: "Hoa Khanh Industrial Zone, Da Nang",
    latitude: 16.05,
    longitude: 108.20,
  },
  {
    id: "WH-HCM-03",
    name: "Southern Logistics Hub - Di An",
    address: "Di An Industrial Park, Binh Duong",
    latitude: 10.90,
    longitude: 106.70,
  },
];

const defaultMapShipments: AtRiskShipmentMapItem[] = [
  {
    shipmentId: "po-3",
    purchaseOrderId: "po-3",
    poNumber: "PO-2026-003",
    supplierId: "SUP-03",
    supplierName: "Asia Hydraulic & Brakes Co., Ltd.",
    sku: "SKU-BRK-03",
    skuName: "Dual-Piston Hydraulic Disc Brake Set",
    quantity: 80,
    unit: "sets",
    promisedDeliveryDate: "2026-09-15",
    expectedDeliveryDate: "2026-09-28",
    delayDays: 13,
    currentDelayRiskScore: 66.3,
    appliedThreshold: 65,
    riskLevel: "HIGH",
    carrierName: "Express Logistics Corp",
    trackingNumber: "TRK-2026-9912",
    destinationWarehouse: defaultWarehouses[0],
    latestTrackingPoint: {
      id: "TP-PO-3-3",
      shipmentId: "po-3",
      purchaseOrderId: "po-3",
      poNumber: "PO-2026-003",
      supplierId: "SUP-03",
      supplierName: "Asia Hydraulic & Brakes Co., Ltd.",
      locationName: "Hai Phong Port (Dinh Vu Hub)",
      latitude: 20.83,
      longitude: 106.72,
      recordedAt: new Date().toISOString(),
      source: "CarrierWebhook",
      statusNote: "Vessels prohibited from setting sail due to Category 11 typhoon",
      speedKmh: 0,
    },
    routeHistory: [
      { id: "TP-PO-3-1", shipmentId: "po-3", purchaseOrderId: "po-3", poNumber: "PO-2026-003", supplierId: "SUP-03", supplierName: "Asia Hydraulic & Brakes Co., Ltd.", locationName: "Asia Brakes Warehouse (Hai Phong)", latitude: 20.86, longitude: 106.68, recordedAt: "2026-09-08T08:00:00Z", source: "CarrierWebhook", speedKmh: 45 },
      { id: "TP-PO-3-2", shipmentId: "po-3", purchaseOrderId: "po-3", poNumber: "PO-2026-003", supplierId: "SUP-03", supplierName: "Asia Hydraulic & Brakes Co., Ltd.", locationName: "Hanoi - Hai Phong Expressway", latitude: 20.90, longitude: 106.40, recordedAt: "2026-09-09T10:00:00Z", source: "CarrierWebhook", speedKmh: 75 },
      { id: "TP-PO-3-3", shipmentId: "po-3", purchaseOrderId: "po-3", poNumber: "PO-2026-003", supplierId: "SUP-03", supplierName: "Asia Hydraulic & Brakes Co., Ltd.", locationName: "Hai Phong Port (Dinh Vu Hub)", latitude: 20.83, longitude: 106.72, recordedAt: "2026-09-10T14:00:00Z", source: "CarrierWebhook", speedKmh: 0 },
    ],
    lastUpdatedAt: new Date().toISOString(),
  },
  {
    shipmentId: "po-1",
    purchaseOrderId: "po-1",
    poNumber: "PO-2026-001",
    supplierId: "SUP-01",
    supplierName: "VNJ Alloy Joint Stock Co.",
    sku: "SKU-FRM-01",
    skuName: "EV Cast Aluminum Alloy Frame",
    quantity: 50,
    unit: "frames",
    promisedDeliveryDate: "2026-09-20",
    expectedDeliveryDate: "2026-09-22",
    delayDays: 2,
    currentDelayRiskScore: 38.5,
    appliedThreshold: 65,
    riskLevel: "MEDIUM",
    carrierName: "VNJ Trans Express",
    trackingNumber: "TRK-2026-1104",
    destinationWarehouse: defaultWarehouses[0],
    latestTrackingPoint: {
      id: "TP-PO-1-2",
      shipmentId: "po-1",
      purchaseOrderId: "po-1",
      poNumber: "PO-2026-001",
      supplierId: "SUP-01",
      supplierName: "VNJ Alloy Joint Stock Co.",
      locationName: "Phu Dong Bridge Toll Plaza",
      latitude: 21.05,
      longitude: 105.92,
      recordedAt: new Date().toISOString(),
      source: "CarrierWebhook",
      speedKmh: 35,
    },
    routeHistory: [
      { id: "TP-PO-1-1", shipmentId: "po-1", purchaseOrderId: "po-1", poNumber: "PO-2026-001", supplierId: "SUP-01", supplierName: "VNJ Alloy Joint Stock Co.", locationName: "Tan Binh Industrial Zone (HCMC)", latitude: 10.80, longitude: 106.65, recordedAt: "2026-09-07T06:00:00Z", source: "CarrierWebhook", speedKmh: 50 },
      { id: "TP-PO-1-2", shipmentId: "po-1", purchaseOrderId: "po-1", poNumber: "PO-2026-001", supplierId: "SUP-01", supplierName: "VNJ Alloy Joint Stock Co.", locationName: "Phu Dong Bridge Toll Plaza", latitude: 21.05, longitude: 105.92, recordedAt: "2026-09-11T12:00:00Z", source: "CarrierWebhook", speedKmh: 35 },
    ],
    lastUpdatedAt: new Date().toISOString(),
  },
];

const defaultThresholdConfig: RiskThresholdConfig = {
  defaultThreshold: 70,
  autoTriggerAgent2: true,
  w1: 0.5,
  w2: 0.25,
  w3: 0.25,
  skuOverrides: {},
};

const defaultSeasonality: SeasonalityConfig[] = [
  { month: 1, monthName: "Jan", factor: 0.85, description: "Post-holiday slowdown" },
  { month: 2, monthName: "Feb", factor: 0.90, description: "Lunar New Year transition" },
  { month: 3, monthName: "Mar", factor: 1.05, description: "Spring cycling season launch" },
  { month: 4, monthName: "Apr", factor: 1.15, description: "Warm weather demand spike" },
  { month: 5, monthName: "May", factor: 1.20, description: "Peak summer inventory prep" },
  { month: 6, monthName: "Jun", factor: 1.25, description: "Summer sales peak" },
  { month: 7, monthName: "Jul", factor: 1.10, description: "Mid-summer steady demand" },
  { month: 8, monthName: "Aug", factor: 1.05, description: "Back-to-school commuting" },
  { month: 9, monthName: "Sep", factor: 0.95, description: "Autumn transition" },
  { month: 10, monthName: "Oct", factor: 0.90, description: "Q4 order planning" },
  { month: 11, monthName: "Nov", factor: 1.10, description: "Black Friday promotion prep" },
  { month: 12, monthName: "Dec", factor: 1.15, description: "Holiday gift demand peak" },
];

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return fallback;
  }
}

function safeSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e);
  }
}

export const StorageService = {
  getSuppliers(): Supplier[] {
    return safeGet<Supplier[]>(KEYS.SUPPLIERS, []);
  },
  saveSuppliers(items: Supplier[]): void {
    safeSet(KEYS.SUPPLIERS, items);
  },

  getInventory(): InventoryItem[] {
    return safeGet<InventoryItem[]>(KEYS.INVENTORY, []);
  },
  saveInventory(items: InventoryItem[]): void {
    safeSet(KEYS.INVENTORY, items);
  },

  getOrders(): PurchaseOrder[] {
    return safeGet<PurchaseOrder[]>(KEYS.ORDERS, []);
  },
  saveOrders(items: PurchaseOrder[]): void {
    safeSet(KEYS.ORDERS, items);
  },

  getSeasonality(): SeasonalityConfig[] {
    return safeGet<SeasonalityConfig[]>(KEYS.SEASONALITY, defaultSeasonality);
  },
  saveSeasonality(config: SeasonalityConfig[]): void {
    safeSet(KEYS.SEASONALITY, config);
  },

  getDemandHistory(): Record<string, number[]> {
    return safeGet<Record<string, number[]>>(KEYS.DEMAND_HISTORY, {});
  },
  saveDemandHistory(history: Record<string, number[]>): void {
    safeSet(KEYS.DEMAND_HISTORY, history);
  },

  getThresholds(): RiskThresholdConfig {
    return safeGet<RiskThresholdConfig>(KEYS.THRESHOLDS, defaultThresholdConfig);
  },
  saveThresholds(config: RiskThresholdConfig): void {
    safeSet(KEYS.THRESHOLDS, config);
  },

  getIncidents(): Incident[] {
    return safeGet<Incident[]>(KEYS.INCIDENTS, []);
  },
  saveIncidents(items: Incident[]): void {
    safeSet(KEYS.INCIDENTS, items);
  },

  getRfqs(): RFQItem[] {
    return safeGet<RFQItem[]>(KEYS.RFQS, []);
  },
  saveRfqs(items: RFQItem[]): void {
    safeSet(KEYS.RFQS, items);
  },

  getProposals(): SourcingProposal[] {
    return safeGet<SourcingProposal[]>(KEYS.PROPOSALS, []);
  },
  saveProposals(items: SourcingProposal[]): void {
    safeSet(KEYS.PROPOSALS, items);
  },

  getAuditLogs(): AuditLogEntry[] {
    return safeGet<AuditLogEntry[]>(KEYS.AUDIT_LOGS, []);
  },
  saveAuditLogs(items: AuditLogEntry[]): void {
    safeSet(KEYS.AUDIT_LOGS, items);
  },
  getLogs(): AuditLogEntry[] {
    return this.getAuditLogs();
  },
  saveLogs(items: AuditLogEntry[]): void {
    this.saveAuditLogs(items);
  },
  addAuditLog(inputSummary: string, outputReasoning: string, agent: AuditLogEntry["agent"] = "System", poNumber?: string, supplierName?: string, sku?: string, correlationId: string = `CORR-${Date.now()}`): AuditLogEntry {
    const logs = this.getAuditLogs();
    const newEntry: AuditLogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      correlationId,
      agent,
      action: "MANUAL_ACTION",
      inputSummary,
      outputReasoning,
      poNumber,
      supplierName,
      sku,
    };
    const updated = [newEntry, ...logs];
    this.saveAuditLogs(updated);
    return newEntry;
  },

  getNotifications(): AppNotification[] {
    return safeGet<AppNotification[]>(KEYS.NOTIFICATIONS, []);
  },
  saveNotifications(items: AppNotification[]): void {
    safeSet(KEYS.NOTIFICATIONS, items);
  },
  addNotification(title: string, message: string, type: AppNotification["type"] = "info", linkTab?: string, correlationId?: string): AppNotification {
    const notifs = this.getNotifications();
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      title,
      message,
      type,
      isRead: false,
      linkTab,
      correlationId,
    };
    const updated = [newNotif, ...notifs];
    this.saveNotifications(updated);
    return newNotif;
  },

  getUserRole(): UserRole {
    return safeGet<UserRole>(KEYS.USER_ROLE, "supply_chain_manager");
  },
  saveUserRole(role: UserRole): void {
    safeSet(KEYS.USER_ROLE, role);
  },

  getActiveSupplierId(): string {
    return safeGet<string>(KEYS.ACTIVE_SUPPLIER_ID, "SUP-01");
  },
  saveActiveSupplierId(id: string): void {
    safeSet(KEYS.ACTIVE_SUPPLIER_ID, id);
  },

  getAgentRuns(): AgentRun[] {
    return safeGet<AgentRun[]>(KEYS.AGENT_RUNS, []);
  },
  saveAgentRuns(runs: AgentRun[]): void {
    safeSet(KEYS.AGENT_RUNS, runs);
  },
  recordAgentRun(run: Partial<AgentRun>): void {
    const runs = this.getAgentRuns();
    const newRun: AgentRun = {
      id: run.id || `RUN-${Date.now()}`,
      agentType: run.agentType || "RiskMonitoring",
      correlationId: run.correlationId || `CORR-${Date.now()}`,
      status: run.status || "COMPLETED",
      resultPayloadJson: run.resultPayloadJson,
      startedAt: run.startedAt || new Date().toISOString(),
      completedAt: run.completedAt || new Date().toISOString(),
    };
    this.saveAgentRuns([newRun, ...runs]);
  },

  getRiskHistory(): RiskHistoryPoint[] {
    return safeGet<RiskHistoryPoint[]>(KEYS.RISK_HISTORY, []);
  },
  saveRiskHistory(history: RiskHistoryPoint[]): void {
    safeSet(KEYS.RISK_HISTORY, history);
  },
  appendPoRiskHistory(poNumber: string, point: Partial<RiskHistoryPoint>): void {
    const history = this.getRiskHistory();
    const newPoint: RiskHistoryPoint = {
      timestamp: point.timestamp || new Date().toISOString(),
      score: point.score ?? 0,
      delayDays: point.delayDays ?? 0,
      breakdown: point.breakdown || {
        latenessFactor: 0,
        supplierReliabilityFactor: 0,
        inventoryBufferFactor: 0,
        w1: 0.5,
        w2: 0.25,
        w3: 0.25,
        delayDays: 0,
        committedLeadTimeDays: 7,
        currentStock: 100,
        safetyStock: 80,
        formulaExplanation: "",
      },
    };
    this.saveRiskHistory([newPoint, ...history]);
  },

  getTrackingPoints(): ShipmentTrackingPoint[] {
    return safeGet<ShipmentTrackingPoint[]>(KEYS.TRACKING_POINTS, []);
  },
  saveTrackingPoints(points: ShipmentTrackingPoint[]): void {
    safeSet(KEYS.TRACKING_POINTS, points);
  },
  recordTrackingPoint(point: ShipmentTrackingPoint): { point: ShipmentTrackingPoint; isDuplicateSkipped: boolean } {
    const points = this.getTrackingPoints();
    const isDuplicate = points.some(
      (p) =>
        p.shipmentId === point.shipmentId &&
        p.recordedAt === point.recordedAt &&
        p.latitude === point.latitude &&
        p.longitude === point.longitude
    );
    if (isDuplicate) {
      return { point, isDuplicateSkipped: true };
    }
    const updated = [point, ...points];
    this.saveTrackingPoints(updated);

    const shipments = this.getAtRiskShipmentsMapData();
    const target = shipments.find((s) => s.shipmentId === point.shipmentId);
    if (target) {
      target.latestTrackingPoint = point;
      target.routeHistory = [...target.routeHistory, point];
      target.lastUpdatedAt = point.recordedAt;
      safeSet(KEYS.MAP_SHIPMENTS, shipments);
    }
    return { point, isDuplicateSkipped: false };
  },

  getWarehouses(): DestinationWarehouse[] {
    return safeGet<DestinationWarehouse[]>(KEYS.WAREHOUSES, defaultWarehouses);
  },

  getAtRiskShipmentsMapData(): AtRiskShipmentMapItem[] {
    return safeGet<AtRiskShipmentMapItem[]>(KEYS.MAP_SHIPMENTS, defaultMapShipments);
  },

  clearAllData(): void {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
  resetAll(): void {
    this.clearAllData();
  },
};
