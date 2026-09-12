import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiJobRunEntity,
  IncidentEntity,
  InventoryItemEntity,
  PurchaseOrderEntity,
  ShipmentEntity,
  ShipmentTrackingPointEntity,
  SourcingProposalEntity,
  SupplierEntity,
  SupplierRiskAnalysisEntity,
} from '../../domain/supply-chain';

@Injectable()
export class SupplyChainService {
  constructor(
    @InjectRepository(SupplierEntity) private readonly suppliers: Repository<SupplierEntity>,
    @InjectRepository(InventoryItemEntity) private readonly inventory: Repository<InventoryItemEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly purchaseOrders: Repository<PurchaseOrderEntity>,
    @InjectRepository(IncidentEntity) private readonly incidents: Repository<IncidentEntity>,
    @InjectRepository(SourcingProposalEntity) private readonly proposals: Repository<SourcingProposalEntity>,
    @InjectRepository(ShipmentEntity) private readonly shipments: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentTrackingPointEntity) private readonly trackingPoints: Repository<ShipmentTrackingPointEntity>,
    @InjectRepository(SupplierRiskAnalysisEntity) private readonly supplierRisk: Repository<SupplierRiskAnalysisEntity>,
    @InjectRepository(AiJobRunEntity) private readonly aiJobRuns: Repository<AiJobRunEntity>,
  ) {}

  findSuppliers() { return this.suppliers.find({ order: { name: 'ASC' } }); }
  findInventory() { return this.inventory.find({ order: { sku: 'ASC' } }); }
  findPurchaseOrders() { return this.purchaseOrders.find({ order: { createdAt: 'DESC' } }); }
  findIncidents() { return this.incidents.find({ order: { createdAt: 'DESC' } }); }
  findProposals() { return this.proposals.find({ order: { createdAt: 'DESC' } }); }

  // Hai bang duoi day do AI Worker so huu - Backend chi doc, khong bao gio ghi.
  findSupplierRisk() { return this.supplierRisk.find({ order: { porsScore: 'DESC' } }); }
  findAiJobRuns(limit = 50) { return this.aiJobRuns.find({ order: { startedAt: 'DESC' }, take: limit }); }

  async updatePurchaseOrder(id: string, data: Partial<PurchaseOrderEntity>) {
    return this.update(this.purchaseOrders, id, data, 'Purchase order');
  }

  async createPurchaseOrder(data: PurchaseOrderEntity) {
    const existing = await this.purchaseOrders.findOneBy({ id: data.id });
    return this.purchaseOrders.save(existing ? { ...existing, ...data } : this.purchaseOrders.create(data));
  }

  async createIncident(data: IncidentEntity) {
    const existing = await this.incidents.findOneBy({ id: data.id });
    return this.incidents.save(existing ? { ...existing, ...data } : this.incidents.create(data));
  }

  async updateIncident(id: string, data: Partial<IncidentEntity>) {
    return this.update(this.incidents, id, data, 'Incident');
  }

  async createProposal(data: SourcingProposalEntity) {
    const existing = await this.proposals.findOneBy({ id: data.id });
    return this.proposals.save(existing ? { ...existing, ...data } : this.proposals.create(data));
  }

  async updateProposal(id: string, data: Partial<SourcingProposalEntity>) {
    return this.update(this.proposals, id, data, 'Sourcing proposal');
  }

  async atRiskShipments() {
    const shipments = await this.shipments.find({ order: { updatedAt: 'DESC' } });
    const trackingPoints = await this.trackingPoints.find({ order: { recordedAt: 'DESC' } });
    const incidents = await this.incidents.find();
    return shipments.map((shipment) => {
      const routeHistory = trackingPoints
        .filter((point) => point.shipmentId === shipment.id)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      const incident = incidents.find((item) => item.poNumber === shipment.poNumber);
      return {
        ...shipment,
        shipmentId: shipment.id,
        latestTrackingPoint: routeHistory.at(-1) ?? null,
        routeHistory,
        incidentId: incident?.id,
        incidentState: incident?.state,
        lastUpdatedAt: shipment.updatedAt,
      };
    });
  }

  async recordTrackingPoint(data: ShipmentTrackingPointEntity) {
    const duplicate = await this.trackingPoints.findOneBy({
      shipmentId: data.shipmentId,
      recordedAt: data.recordedAt,
    });
    if (duplicate) return { point: duplicate, isDuplicateSkipped: true };
    const point = await this.trackingPoints.save(this.trackingPoints.create(data));
    return { point, isDuplicateSkipped: false };
  }

  private async update<T extends { id: string }>(
    repository: Repository<T>, id: string, data: Partial<T>, label: string,
  ) {
    const existing = await repository.findOneBy({ id } as never);
    if (!existing) throw new NotFoundException(`${label} ${id} was not found`);
    return repository.save({ ...existing, ...data });
  }
}
