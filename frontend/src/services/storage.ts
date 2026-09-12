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
};

const defaultThresholdConfig: RiskThresholdConfig = {
  leadTimeWarningDays: 3,
  leadTimeCriticalDays: 7,
  reliabilityWarningScore: 75,
  stockoutWarningDays: 14,
};

const defaultSeasonality: SeasonalityConfig = {
  q1Multiplier: 1.0,
  q2Multiplier: 1.25,
  q3Multiplier: 0.95,
  q4Multiplier: 1.15,
};

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

  getSeasonality(): SeasonalityConfig {
    return safeGet<SeasonalityConfig>(KEYS.SEASONALITY, defaultSeasonality);
  },
  saveSeasonality(config: SeasonalityConfig): void {
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
  addAuditLog(action: string, details: string, user: string = "Hệ thống AI Worker", poNumber?: string, supplierId?: string): AuditLogEntry {
    const logs = this.getAuditLogs();
    const newEntry: AuditLogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
      poNumber,
      supplierId,
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
  addNotification(title: string, message: string, type: "info" | "warning" | "danger" | "success" = "info", linkTarget?: string): AppNotification {
    const notifs = this.getNotifications();
    const newNotif: AppNotification = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      title,
      message,
      type,
      read: false,
      linkTarget,
    };
    const updated = [newNotif, ...notifs];
    this.saveNotifications(updated);
    return newNotif;
  },

  getUserRole(): UserRole {
    return safeGet<UserRole>(KEYS.USER_ROLE, "PROCUREMENT_MANAGER");
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
      timestamp: run.timestamp || new Date().toISOString(),
      agentName: run.agentName || "Agent Work",
      status: run.status || "SUCCESS",
      summary: run.summary || "",
      executionTimeMs: run.executionTimeMs || 100,
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
      poNumber: poNumber,
      riskScore: point.riskScore || 0,
      reason: point.reason || "",
    };
    this.saveRiskHistory([newPoint, ...history]);
  },

  getTrackingPoints(): ShipmentTrackingPoint[] {
    return safeGet<ShipmentTrackingPoint[]>(KEYS.TRACKING_POINTS, []);
  },
  saveTrackingPoints(points: ShipmentTrackingPoint[]): void {
    safeSet(KEYS.TRACKING_POINTS, points);
  },

  clearAllData(): void {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
  resetAll(): void {
    this.clearAllData();
  },
};
