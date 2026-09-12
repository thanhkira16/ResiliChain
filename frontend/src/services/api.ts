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

function normalizeTrackingPoint(point: ShipmentTrackingPoint): ShipmentTrackingPoint {
  return {
    ...point,
    latitude: toNumber(point.latitude),
    longitude: toNumber(point.longitude),
    speedKmh: point.speedKmh === undefined || point.speedKmh === null ? undefined : toNumber(point.speedKmh),
  };
}

function normalizeMapShipment(shipment: AtRiskShipmentMapItem): AtRiskShipmentMapItem | null {
  const routeHistory = Array.isArray(shipment.routeHistory)
    ? shipment.routeHistory.map(normalizeTrackingPoint)
    : [];
  const latestTrackingPoint = shipment.latestTrackingPoint
    ? normalizeTrackingPoint(shipment.latestTrackingPoint)
    : routeHistory.at(-1);

  // A shipment without a GPS point has no safe position to render on the map.
  if (!latestTrackingPoint) return null;

  const riskLevel = String(shipment.riskLevel).toUpperCase();
  return {
    ...shipment,
    shipmentId: String(shipment.shipmentId),
    quantity: toNumber(shipment.quantity),
    delayDays: toNumber(shipment.delayDays),
    currentDelayRiskScore: toNumber(shipment.currentDelayRiskScore),
    appliedThreshold: shipment.appliedThreshold === undefined ? 70 : toNumber(shipment.appliedThreshold),
    riskLevel: riskLevel === 'HIGH' || riskLevel === 'MEDIUM' || riskLevel === 'LOW' ? riskLevel : 'LOW',
    destinationWarehouse: {
      ...shipment.destinationWarehouse,
      id: shipment.destinationWarehouse.id || `warehouse-${shipment.shipmentId}`,
      latitude: toNumber(shipment.destinationWarehouse.latitude),
      longitude: toNumber(shipment.destinationWarehouse.longitude),
    },
    latestTrackingPoint,
    routeHistory,
    lastUpdatedAt: String(shipment.lastUpdatedAt),
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
  getAtRiskShipments: async () => {
    const shipments = await request<AtRiskShipmentMapItem[]>('/supply-chain/shipments/at-risk-map');
    return shipments.map(normalizeMapShipment).filter((shipment): shipment is AtRiskShipmentMapItem => shipment !== null);
  },
  recordTrackingPoint: (value: ShipmentTrackingPoint) => request<{ point: ShipmentTrackingPoint; isDuplicateSkipped: boolean }>('/supply-chain/shipment-tracking-points', { method: 'POST', body: JSON.stringify(value) }),
};
