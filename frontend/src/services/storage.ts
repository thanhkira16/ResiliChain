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
import {
  initialSuppliers,
  initialInventory,
  initialPurchaseOrders,
  initialSeasonality,
  initialHistoricalDemand,
  initialThresholdConfig,
  initialIncidents,
  initialRfqs,
  initialProposals,
  initialAuditLogs,
  initialNotifications,
  destinationWarehouses,
  initialShipmentTrackingPoints,
} from "../data/mockData";

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
    const cached = safeGet<Supplier[]>(KEYS.SUPPLIERS, initialSuppliers);
    return cached.map((sup) => {
      if (!sup.transitWaypoints || sup.transitWaypoints.length === 0) {
        const mock = initialSuppliers.find((s) => s.id === sup.id);
        if (mock?.transitWaypoints) {
          return { ...sup, transitWaypoints: mock.transitWaypoints };
        }
      }
      return sup;
    });
  },
  saveSuppliers(items: Supplier[]): void {
    safeSet(KEYS.SUPPLIERS, items);
  },

  getInventory(): InventoryItem[] {
    return safeGet(KEYS.INVENTORY, initialInventory);
  },
  saveInventory(items: InventoryItem[]): void {
    safeSet(KEYS.INVENTORY, items);
  },

  getOrders(): PurchaseOrder[] {
    return safeGet(KEYS.ORDERS, initialPurchaseOrders);
  },
  saveOrders(items: PurchaseOrder[]): void {
    safeSet(KEYS.ORDERS, items);
  },

  getSeasonality(): SeasonalityConfig[] {
    return safeGet(KEYS.SEASONALITY, initialSeasonality);
  },
  saveSeasonality(items: SeasonalityConfig[]): void {
    safeSet(KEYS.SEASONALITY, items);
  },

  getDemandHistory(): Record<string, number[]> {
    return safeGet(KEYS.DEMAND_HISTORY, initialHistoricalDemand);
  },
  saveDemandHistory(items: Record<string, number[]>): void {
    safeSet(KEYS.DEMAND_HISTORY, items);
  },

  getThresholdConfig(): RiskThresholdConfig {
    return safeGet(KEYS.THRESHOLDS, initialThresholdConfig);
  },
  saveThresholdConfig(cfg: RiskThresholdConfig): void {
    safeSet(KEYS.THRESHOLDS, cfg);
  },
  getThresholds(): RiskThresholdConfig {
    return this.getThresholdConfig();
  },
  saveThresholds(cfg: RiskThresholdConfig): void {
    this.saveThresholdConfig(cfg);
  },

  getIncidents(): Incident[] {
    return safeGet(KEYS.INCIDENTS, initialIncidents);
  },
  saveIncidents(items: Incident[]): void {
    safeSet(KEYS.INCIDENTS, items);
  },

  getRfqs(): RFQItem[] {
    return safeGet(KEYS.RFQS, initialRfqs);
  },
  saveRfqs(items: RFQItem[]): void {
    safeSet(KEYS.RFQS, items);
  },

  getProposals(): SourcingProposal[] {
    return safeGet(KEYS.PROPOSALS, initialProposals);
  },
  saveProposals(items: SourcingProposal[]): void {
    safeSet(KEYS.PROPOSALS, items);
  },

  getAuditLogs(): AuditLogEntry[] {
    return safeGet(KEYS.AUDIT_LOGS, initialAuditLogs);
  },
  saveLogs(items: AuditLogEntry[]): void {
    safeSet(KEYS.AUDIT_LOGS, items);
  },
  getLogs(): AuditLogEntry[] {
    return this.getAuditLogs();
  },
  appendAuditLog(entry: AuditLogEntry): AuditLogEntry[] {
    const existing = this.getAuditLogs();
    const updated = [entry, ...existing];
    safeSet(KEYS.AUDIT_LOGS, updated);
    return updated;
  },

  getNotifications(): AppNotification[] {
    return safeGet(KEYS.NOTIFICATIONS, initialNotifications);
  },
  saveNotifications(items: AppNotification[]): void {
    safeSet(KEYS.NOTIFICATIONS, items);
  },

  getUserRole(): UserRole {
    return safeGet(KEYS.USER_ROLE, "supply_chain_manager");
  },
  saveUserRole(role: UserRole): void {
    safeSet(KEYS.USER_ROLE, role);
  },

  getActiveSupplierId(): string {
    return safeGet(KEYS.ACTIVE_SUPPLIER_ID, "SUP-05");
  },
  saveActiveSupplierId(id: string): void {
    safeSet(KEYS.ACTIVE_SUPPLIER_ID, id);
  },

  getAgentRuns(): AgentRun[] {
    return safeGet(KEYS.AGENT_RUNS, []);
  },
  saveAgentRuns(runs: AgentRun[]): void {
    safeSet(KEYS.AGENT_RUNS, runs);
  },
  recordAgentRun(run: AgentRun): void {
    const runs = this.getAgentRuns();
    // Idempotency: avoid duplicate key (agentType, correlationId)
    const existingIdx = runs.findIndex(
      (r) => r.agentType === run.agentType && r.correlationId === run.correlationId
    );
    if (existingIdx >= 0) {
      runs[existingIdx] = run;
    } else {
      runs.unshift(run);
    }
    safeSet(KEYS.AGENT_RUNS, runs.slice(0, 100));
  },

  getPoRiskHistory(poNumber: string): RiskHistoryPoint[] {
    const all = safeGet<Record<string, RiskHistoryPoint[]>>(KEYS.RISK_HISTORY, {});
    return all[poNumber] || [];
  },
  appendPoRiskHistory(poNumber: string, point: RiskHistoryPoint): void {
    const all = safeGet<Record<string, RiskHistoryPoint[]>>(KEYS.RISK_HISTORY, {});
    const existing = all[poNumber] || [];
    all[poNumber] = [...existing, point].slice(-30);
    safeSet(KEYS.RISK_HISTORY, all);
  },

  getWarehouses(): DestinationWarehouse[] {
    return destinationWarehouses;
  },

  getTrackingPoints(): ShipmentTrackingPoint[] {
    return safeGet<ShipmentTrackingPoint[]>(KEYS.TRACKING_POINTS, initialShipmentTrackingPoints);
  },

  saveTrackingPoints(points: ShipmentTrackingPoint[]): void {
    safeSet(KEYS.TRACKING_POINTS, points);
  },

  /**
   * Ghi nhận checkpoint tracking mới từ Carrier Webhook hoặc cập nhật thủ công.
   * Đảm bảo tính Idempotency: Kiểm tra ràng buộc duy nhất (shipmentId + recordedAt).
   */
  recordTrackingPoint(point: ShipmentTrackingPoint): { success: boolean; isDuplicateSkipped: boolean } {
    const points = this.getTrackingPoints();
    const isDuplicate = points.some(
      (p) => p.shipmentId === point.shipmentId && p.recordedAt === point.recordedAt
    );

    if (isDuplicate) {
      return { success: true, isDuplicateSkipped: true };
    }

    points.push(point);
    this.saveTrackingPoints(points);
    return { success: true, isDuplicateSkipped: false };
  },

  /**
   * Read-Only CQRS Projection phục vụ Shipment Tracking Map (SRS FR-4.3).
   * TUYỆT ĐỐI KHÔNG TÍNH LẠI DELAY RISK SCORE: Đọc trực tiếp snapshot điểm số và breakdown
   * từ Agent F4 (Risk Monitoring) đã tính và lưu trữ.
   */
  getAtRiskShipmentsMapData(): AtRiskShipmentMapItem[] {
    const orders = this.getOrders();
    const incidents = this.getIncidents();
    const allTrackingPoints = this.getTrackingPoints();
    const warehouses = this.getWarehouses();

    // Map các đơn hàng đang vận chuyển / đang mở
    const openOrders = orders.filter((o) => o.status !== "Hoàn thành" && o.status !== "Đã hủy");

    const result: AtRiskShipmentMapItem[] = [];

    for (const po of openOrders) {
      // Tìm incident tương ứng từ F4 nếu có
      const inc = incidents.find((i) => i.poNumber === po.poNumber);

      // Snapshot điểm rủi ro: Lấy trực tiếp từ F4 snapshot (KHÔNG TÍNH LẠI)
      const currentDelayRiskScore = inc ? inc.riskScore : (po.currentRiskScore ?? 0);
      const appliedThreshold = inc ? inc.appliedThreshold : 70;

      // Xác định mức độ rủi ro (để tô màu marker: Đỏ >= 70, Vàng 40-69, Xanh < 40)
      let riskLevel: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (currentDelayRiskScore >= 70) {
        riskLevel = "HIGH";
      } else if (currentDelayRiskScore >= 40) {
        riskLevel = "MEDIUM";
      }

      // Xác định kho đích phù hợp
      let warehouse = warehouses[0]; // Bắc Ninh default
      if (po.supplierId === "SUP-02" || po.supplierId === "SUP-03" || po.supplierId === "SUP-04") {
        warehouse = warehouses[1]; // Sóng Thần Bình Dương
      } else if (po.supplierId === "SUP-05") {
        warehouse = warehouses[2]; // Đà Nẵng
      }

      // Lấy lịch sử tracking points của đơn hàng này
      const routeHistory = allTrackingPoints
        .filter((p) => p.poNumber === po.poNumber)
        .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

      // Điểm tracking mới nhất
      const latestTrackingPoint = routeHistory[routeHistory.length - 1] || {
        id: `TRK-GEN-${po.poNumber}`,
        shipmentId: `SHIP-${po.poNumber}`,
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        latitude: warehouse.latitude + 0.05,
        longitude: warehouse.longitude - 0.08,
        locationName: `Khu vực tiếp cận ${warehouse.name}`,
        recordedAt: new Date().toISOString(),
        source: "CarrierWebhook" as const,
        speedKmh: 40,
        statusNote: "Đang lưu thông trên tuyến",
      };

      // Tái dùng breakdown từ F4 (SRS §2.3)
      const riskBreakdown = inc?.riskBreakdown || po.riskBreakdown;

      // Carrier name & tracking number
      const carrierMap: Record<string, { carrier: string; trackingNo: string }> = {
        "PO-2026-003": { carrier: "Vận tải Đa phương thức Á Châu", trackingNo: "ACL-882109" },
        "PO-2026-007": { carrier: "Vinalines Logistics Miền Bắc", trackingNo: "VNL-EXP-992144" },
        "PO-2026-008": { carrier: "Đường sắt Bắc Nam - Ga Yên Viên", trackingNo: "VN-RAIL-33201" },
        "PO-2026-006": { carrier: "Mekong Freight Lines", trackingNo: "MKG-LOG-55102" },
        "PO-2026-004": { carrier: "Viettel Post Logistics", trackingNo: "VTP-FAST-77123" },
        "PO-2026-005": { carrier: "Giao Hàng Nhanh Express", trackingNo: "GHN-PRO-10294" },
      };

      const carrierInfo = carrierMap[po.poNumber] || {
        carrier: "Đơn vị vận tải liên tỉnh Vinalink",
        trackingNo: `VN-EXP-${po.poNumber.slice(-3)}`,
      };

      const daysDiff = Math.max(
        0,
        Math.round(
          (new Date(po.actualOrExpectedDeliveryDate).getTime() -
            new Date(po.promisedDeliveryDate).getTime()) /
            (1000 * 3600 * 24)
        )
      );

      result.push({
        shipmentId: `SHIP-${po.poNumber}`,
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        sku: po.sku,
        skuName: po.skuName,
        quantity: po.quantity,
        unit: "bộ",
        destinationWarehouse: warehouse,
        promisedDeliveryDate: po.promisedDeliveryDate,
        expectedDeliveryDate: po.actualOrExpectedDeliveryDate,
        delayDays: daysDiff,
        currentDelayRiskScore,
        appliedThreshold,
        riskLevel,
        riskBreakdown,
        incidentId: inc?.id,
        incidentState: inc?.status,
        carrierName: carrierInfo.carrier,
        trackingNumber: carrierInfo.trackingNo,
        latestTrackingPoint,
        routeHistory: routeHistory.length > 0 ? routeHistory : [latestTrackingPoint],
        lastUpdatedAt: latestTrackingPoint.recordedAt,
      });
    }

    return result;
  },

  resetAll(): void {
    this.resetAllToMockData();
  },

  resetAllToMockData(): void {
    safeSet(KEYS.SUPPLIERS, initialSuppliers);
    safeSet(KEYS.INVENTORY, initialInventory);
    safeSet(KEYS.ORDERS, initialPurchaseOrders);
    safeSet(KEYS.SEASONALITY, initialSeasonality);
    safeSet(KEYS.DEMAND_HISTORY, initialHistoricalDemand);
    safeSet(KEYS.THRESHOLDS, initialThresholdConfig);
    safeSet(KEYS.INCIDENTS, initialIncidents);
    safeSet(KEYS.RFQS, initialRfqs);
    safeSet(KEYS.PROPOSALS, initialProposals);
    safeSet(KEYS.AUDIT_LOGS, initialAuditLogs);
    safeSet(KEYS.NOTIFICATIONS, initialNotifications);
    safeSet(KEYS.USER_ROLE, "supply_chain_manager");
    safeSet(KEYS.ACTIVE_SUPPLIER_ID, "SUP-05");
    safeSet(KEYS.TRACKING_POINTS, initialShipmentTrackingPoints);
  },
};
