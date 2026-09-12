import {
  AtRiskShipmentMapItem,
  Incident,
  InventoryItem,
  PurchaseOrder,
  SourcingProposal,
  Supplier,
  ShipmentTrackingPoint,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

type ApiEnvelope<T> = { data: T };

function isApiEnvelope<T>(payload: T | ApiEnvelope<T>): payload is ApiEnvelope<T> {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
}

const toNumber = (value: unknown): number => Number(value);

function normalizeSupplier(supplier: Supplier): Supplier {
  const historicalPrice = Object.fromEntries(
    Object.entries(supplier.historicalPrice ?? {}).map(([sku, value]) => {
      if (Array.isArray(value)) {
        const latest = value.at(-1) as { unitPrice?: unknown } | undefined;
        return [sku, toNumber(latest?.unitPrice)];
      }
      return [sku, toNumber(value)];
    }),
  );
  return { ...supplier, averageLeadTimeDays: toNumber(supplier.averageLeadTimeDays), reliabilityScore: toNumber(supplier.reliabilityScore), historicalPrice };
}

function normalizePurchaseOrder(order: PurchaseOrder): PurchaseOrder {
  return {
    ...order,
    quantity: toNumber(order.quantity), unitPrice: toNumber(order.unitPrice), totalAmount: toNumber(order.totalAmount),
    currentRiskScore: order.currentRiskScore === undefined || order.currentRiskScore === null ? undefined : toNumber(order.currentRiskScore),
  };
}

function normalizeInventory(item: InventoryItem): InventoryItem {
  return {
    ...item,
    currentStock: toNumber(item.currentStock), safetyStock: toNumber(item.safetyStock), weeklyBurnRate: toNumber(item.weeklyBurnRate),
    unitPriceEstimate: toNumber(item.unitPriceEstimate), minLeadTimeDays: toNumber(item.minLeadTimeDays),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  const payload = (await response.json()) as ApiEnvelope<T> | T;
  return isApiEnvelope(payload) ? payload.data : payload;
}

export const SupplyChainApi = {
  getSuppliers: async () => (await request<Supplier[]>('/supply-chain/suppliers')).map(normalizeSupplier),
  getInventory: async () => (await request<InventoryItem[]>('/supply-chain/inventory')).map(normalizeInventory),
  getPurchaseOrders: async () => (await request<PurchaseOrder[]>('/supply-chain/purchase-orders')).map(normalizePurchaseOrder),
  createPurchaseOrder: (value: PurchaseOrder) => request<PurchaseOrder>('/supply-chain/purchase-orders', { method: 'POST', body: JSON.stringify(value) }),
  updatePurchaseOrder: (id: string, value: Partial<PurchaseOrder>) => request<PurchaseOrder>(`/supply-chain/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  getIncidents: () => request<Incident[]>('/supply-chain/incidents'),
  saveIncident: (value: Incident) => request<Incident>('/supply-chain/incidents', { method: 'POST', body: JSON.stringify(value) }),
  updateIncident: (id: string, value: Partial<Incident>) => request<Incident>(`/supply-chain/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  getProposals: () => request<SourcingProposal[]>('/supply-chain/sourcing-proposals'),
  saveProposal: (value: SourcingProposal) => request<SourcingProposal>('/supply-chain/sourcing-proposals', { method: 'POST', body: JSON.stringify(value) }),
  updateProposal: (id: string, value: Partial<SourcingProposal>) => request<SourcingProposal>(`/supply-chain/sourcing-proposals/${id}`, { method: 'PATCH', body: JSON.stringify(value) }),
  getAtRiskShipments: () => request<AtRiskShipmentMapItem[]>('/supply-chain/shipments/at-risk-map'),
  evaluateRiskAlert: (value: { incidentId: string; purchaseOrderId: string; riskScore: number }) => request<{ triggered: boolean }>('/supply-chain/risk-alerts/evaluate', { method: 'POST', body: JSON.stringify(value) }),
  syncHighRiskOrders: () => request<unknown[]>('/supply-chain/risk-alerts/sync', { method: 'POST' }),
  getSupplierRiskAnalysis: () => request<Array<{ supplierId: string; supplierName: string; porsScore: number | string; riskLevel: string; statusLabel: string; analyzedAt: string }>>('/supply-chain/supplier-risk-analysis'),
  setManualRiskScore: (id: string, riskScore: number) => request<PurchaseOrder>(`/supply-chain/purchase-orders/${id}/manual-risk-score`, { method: 'PATCH', body: JSON.stringify({ riskScore }) }),
  confirmPartnerDelivery: (token: string, response: 'on-time' | 'delayed') => request<{ redirectTo: string | null }>(`/supply-chain/partner-confirmations/${token}/${response}`, { method: 'POST' }),
  getLogisticsMessages: (incidentId: string) => request<Array<{ id: string; senderRole: string; body: string; createdAt: string }>>(`/supply-chain/incidents/${incidentId}/logistics-messages`),
  sendLogisticsMessage: (incidentId: string, body: string, senderRole: 'PARTNER' | 'PROCUREMENT') => request<{ id: string; senderRole: string; body: string; createdAt: string }>(`/supply-chain/incidents/${incidentId}/logistics-messages`, { method: 'POST', body: JSON.stringify({ body, senderRole }) }),
  recordTrackingPoint: (value: ShipmentTrackingPoint) => request<{ point: ShipmentTrackingPoint; isDuplicateSkipped: boolean }>('/supply-chain/shipment-tracking-points', { method: 'POST', body: JSON.stringify(value) }),
};
