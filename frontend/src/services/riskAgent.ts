import {
  PurchaseOrder,
  Supplier,
  InventoryItem,
  RiskThresholdConfig,
  RiskBreakdown,
  RiskHistoryPoint,
} from "../types";

export interface RiskCalculationResult {
  delayDays: number;
  bufferDays: number;
  delayRiskScore: number;
  isTriggered: boolean;
  appliedThreshold: number;
  reason: string;
  breakdown: RiskBreakdown;
  riskBreakdownJson: string;
}

export function calculatePoRisk(
  po: PurchaseOrder,
  supplier?: Supplier,
  inventory?: InventoryItem,
  thresholds?: RiskThresholdConfig
): RiskCalculationResult {
  // 1. Calculate actual delay days
  const promised = new Date(po.promisedDeliveryDate).getTime();
  const actualOrExpected = new Date(po.actualOrExpectedDeliveryDate).getTime();
  const diffMs = actualOrExpected - promised;
  const delayDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  // Committed lead time (lead_time_cam_kết)
  const orderTime = new Date(po.orderDate).getTime();
  const rawLeadTime = Math.round((promised - orderTime) / (1000 * 60 * 60 * 24));
  const committedLeadTimeDays = Math.max(
    1,
    rawLeadTime > 0 ? rawLeadTime : supplier?.averageLeadTimeDays || 7
  );

  // 2. lateness_factor = min(1, số ngày trễ hiện tại / lead_time_cam_kết) (§2.3)
  const latenessFactor =
    delayDays <= 0 ? 0 : Math.min(1, delayDays / committedLeadTimeDays);

  // 3. supplier_reliability_score ∈ [0, 1] -> supplier_risk = 1 - supplier_reliability_score
  const reliabilityRaw = supplier ? supplier.reliabilityScore : 80;
  const supplierReliabilityScore = Math.max(0, Math.min(1, reliabilityRaw / 100));
  const supplierReliabilityFactor = Math.max(0, Math.min(1, 1 - supplierReliabilityScore));

  // 4. inventory_buffer_factor = 1 - (tồn_kho_hiện_tại / safety_stock_threshold) giới hạn [0, 1]
  const currentStock = inventory ? inventory.currentStock : 100;
  const safetyStock = inventory ? inventory.safetyStock : 80;
  const weeklyBurn = inventory ? inventory.weeklyBurnRate : 30;
  const dailyBurn = Math.max(1, weeklyBurn / 7);
  const bufferDays = Math.round((currentStock - safetyStock) / dailyBurn);

  let inventoryBufferFactor = 0;
  if (safetyStock > 0) {
    const ratio = currentStock / safetyStock;
    inventoryBufferFactor = Math.max(0, Math.min(1, 1 - ratio));
  } else {
    inventoryBufferFactor = currentStock <= 0 ? 1 : 0;
  }

  // 5. Weights w1, w2, w3 (cấu hình được, tổng = 1)
  const w1 = thresholds?.w1 ?? 0.5;
  const w2 = thresholds?.w2 ?? 0.25;
  const w3 = thresholds?.w3 ?? 0.25;

  // Composite delay_risk_score in [0, 100]
  let rawScore =
    (w1 * latenessFactor + w2 * supplierReliabilityFactor + w3 * inventoryBufferFactor) * 100;

  if (po.status === "Completed") {
    rawScore = 0;
  }

  const delayRiskScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  const appliedThreshold =
    thresholds?.skuOverrides?.[po.sku] || thresholds?.defaultThreshold || 70;

  const isTriggered = delayRiskScore >= appliedThreshold && po.status !== "Completed";

  const breakdown: RiskBreakdown = {
    latenessFactor: Number(latenessFactor.toFixed(3)),
    supplierReliabilityFactor: Number(supplierReliabilityFactor.toFixed(3)),
    inventoryBufferFactor: Number(inventoryBufferFactor.toFixed(3)),
    w1,
    w2,
    w3,
    delayDays,
    committedLeadTimeDays,
    currentStock,
    safetyStock,
    formulaExplanation: `Score = (${w1} × ${latenessFactor.toFixed(2)}) + (${w2} × ${supplierReliabilityFactor.toFixed(2)}) + (${w3} × ${inventoryBufferFactor.toFixed(2)}) = ${(rawScore / 100).toFixed(2)} → ${delayRiskScore}/100`,
  };

  const riskBreakdownJson = JSON.stringify({
    lateness: breakdown.latenessFactor,
    reliability: Number(supplierReliabilityScore.toFixed(2)),
    inventoryBuffer: breakdown.inventoryBufferFactor,
    w1,
    w2,
    w3,
    delayDays,
    committedLeadTimeDays,
  });

  const reason =
    delayDays > 0
      ? `Delayed by ${delayDays}/${committedLeadTimeDays} days (factor ${(latenessFactor * 100).toFixed(0)}%). Stock level: ${currentStock}/${safetyStock} units (buffer ${bufferDays} days). Risk score: ${delayRiskScore}/100.`
      : `On schedule. Safety stock level: ${currentStock} units. Risk score: ${delayRiskScore}/100.`;

  return {
    delayDays,
    bufferDays,
    delayRiskScore,
    isTriggered,
    appliedThreshold,
    reason,
    breakdown,
    riskBreakdownJson,
  };
}

export function generateCorrelationId(poNumber: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `CORR-${poNumber}-${rand}`;
}

