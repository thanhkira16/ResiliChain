import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import {
  AiJobRunEntity,
  IncidentEntity,
  InventoryItemEntity,
  PurchaseOrderEntity,
  ShipmentEntity,
  ShipmentTrackingPointEntity,
  SourcingProposalEntity,
  SupplierEntity,
  RiskAlertEntity,
  LogisticsConversationEntity,
  LogisticsMessageEntity,
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
    @InjectRepository(RiskAlertEntity) private readonly riskAlerts: Repository<RiskAlertEntity>,
    @InjectRepository(LogisticsConversationEntity) private readonly conversations: Repository<LogisticsConversationEntity>,
    @InjectRepository(LogisticsMessageEntity) private readonly messages: Repository<LogisticsMessageEntity>,
    @InjectRepository(SupplierRiskAnalysisEntity) private readonly supplierRisk: Repository<SupplierRiskAnalysisEntity>,
    @InjectRepository(AiJobRunEntity) private readonly aiJobRuns: Repository<AiJobRunEntity>,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  findSuppliers() { return this.suppliers.find({ order: { name: 'ASC' } }); }
  findInventory() { return this.inventory.find({ order: { sku: 'ASC' } }); }
  findPurchaseOrders() { return this.purchaseOrders.find({ order: { createdAt: 'DESC' } }); }
  findIncidents() { return this.incidents.find({ order: { createdAt: 'DESC' } }); }
  findProposals() { return this.proposals.find({ order: { createdAt: 'DESC' } }); }
  findRiskAlerts() { return this.riskAlerts.find({ order: { createdAt: 'DESC' } }); }
  async supplierRiskAnalysis() {
    return this.dataSource.query(`SELECT DISTINCT ON (r.supplier_id) r.supplier_id AS "supplierId", s.name AS "supplierName", r.pors_score AS "porsScore", r.risk_level AS "riskLevel", r.status_label AS "statusLabel", r.analyzed_at AS "analyzedAt" FROM supplier_risk_analysis r JOIN suppliers s ON s.id = r.supplier_id ORDER BY r.supplier_id, r.analyzed_at DESC`);
  }
  async setManualRiskScore(id: string, riskScore: number) { return this.updatePurchaseOrder(id, { currentRiskScore: riskScore, riskScoreSource: 'MANUAL' }); }
  async syncHighRiskOrders() {
    const orders = await this.purchaseOrders.find(); const results: unknown[] = [];
    for (const po of orders.filter((item) => Number(item.currentRiskScore) >= 60)) {
      let incident = await this.incidents.findOneBy({ poNumber: po.poNumber });
      if (!incident) incident = await this.incidents.save(this.incidents.create({ id: `INC-RISK-${Date.now()}-${Math.floor(Math.random()*1000)}`, correlationId: `RISK-${po.poNumber}`, poNumber: po.poNumber, sku: po.sku, skuName: po.skuName, supplierId: po.supplierId, supplierName: po.supplierName, delayDays: 0, delayRiskScore: Number(po.currentRiskScore), thresholdApplied: 60, state: 'DETECTED', status: 'Má»›i phÃ¡t hiá»‡n', detectedAt: new Date().toISOString(), summary: `PO ${po.poNumber} has risk score ${po.currentRiskScore}/100.`, agent2Triggered: false }));
      results.push(await this.evaluateRiskAlert({ incidentId: incident.id, purchaseOrderId: po.id, riskScore: Number(po.currentRiskScore) }));
    }
    return results;
  }

  async evaluateRiskAlert(data: { incidentId: string; purchaseOrderId: string; riskScore: number }) {
    if (Number(data.riskScore) < 60) return { triggered: false };
    const existing = await this.riskAlerts.findOneBy({ incidentId: data.incidentId });
    if (existing) return { triggered: true, alert: existing, duplicate: true };
    const incident = await this.incidents.findOneBy({ id: data.incidentId });
    const po = await this.purchaseOrders.findOneBy({ id: data.purchaseOrderId });
    if (!incident || !po) throw new NotFoundException('Incident or purchase order was not found');
    const supplier = await this.suppliers.findOneBy({ id: po.supplierId });
    if (!supplier) throw new NotFoundException('Partner was not found');
    const token = randomUUID(); const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const email = { to: supplier.email, subject: `[BikeSync] Xác nhận tiến độ ${po.poNumber}`, onTimeUrl: `${frontendUrl}/partner-confirmation/${token}/on-time`, delayedUrl: `${frontendUrl}/partner-confirmation/${token}/delayed`, expiresAt };
    let alert = await this.riskAlerts.save(this.riskAlerts.create({ id: `RAL-${Date.now()}`, incidentId: incident.id, purchaseOrderId: po.id, partnerEmail: supplier.email, riskScore: Number(data.riskScore), actionToken: token, expiresAt, status: 'SENT', fakeEmail: email }));
    try {
      const host = this.config.get<string>('SMTP_HOST'); const user = this.config.get<string>('SMTP_USER'); const password = this.config.get<string>('SMTP_PASSWORD');
      if (!host || !user || !password) throw new Error('SMTP is not configured');
      const transporter = nodemailer.createTransport({ host, port: Number(this.config.get<string>('SMTP_PORT') || 587), secure: Number(this.config.get<string>('SMTP_PORT') || 587) === 465, auth: { user, pass: password } });
      await transporter.sendMail({ from: this.config.get<string>('SMTP_FROM') || user, to: supplier.email, subject: email.subject, html: `<p>PO <b>${po.poNumber}</b> có điểm rủi ro <b>${data.riskScore}/100</b>. Vui lòng phản hồi trong 24 giờ.</p><p><a href="${email.onTimeUrl}">Xác nhận vẫn đúng hẹn</a> &nbsp; <a href="${email.delayedUrl}">Xác nhận trễ hẹn</a></p>` });
      alert = await this.riskAlerts.save({ ...alert, fakeEmail: { ...email, delivery: 'SMTP_SENT', sentAt: new Date().toISOString() } });
    } catch (error) { alert = await this.riskAlerts.save({ ...alert, fakeEmail: { ...email, delivery: 'FAKE_FALLBACK', error: error instanceof Error ? error.message : 'SMTP failed' } }); }
    return { triggered: true, alert };
  }

  async confirmDelivery(token: string, response: 'ON_TIME' | 'DELAYED') {
    const alert = await this.riskAlerts.findOneBy({ actionToken: token });
    if (!alert) throw new NotFoundException('Confirmation link was not found');
    if (alert.expiresAt < new Date()) return this.riskAlerts.save({ ...alert, status: 'EXPIRED' });
    const status = response === 'ON_TIME' ? 'ON_TIME' : 'DELAYED';
    const saved = await this.riskAlerts.save({ ...alert, status });
    if (response === 'ON_TIME') await this.updatePurchaseOrder(alert.purchaseOrderId, { notes: 'Partner confirmed the committed delivery date within SLA.' });
    if (response === 'DELAYED') await this.updateIncident(alert.incidentId, { state: 'MANUAL_HANDLING', status: 'Xá»­ lÃ½ thá»§ cÃ´ng' });
    return { alert: saved, redirectTo: response === 'DELAYED' ? `/incidents/${alert.incidentId}?delayConfirmed=true` : null };
  }

  async openConversation(incidentId: string) {
    const alert = await this.riskAlerts.findOneBy({ incidentId });
    if (!alert) throw new NotFoundException('Risk alert was not found');
    let conversation = await this.conversations.findOneBy({ incidentId });
    if (!conversation) conversation = await this.conversations.save(this.conversations.create({ id: `CON-${Date.now()}`, incidentId, purchaseOrderId: alert.purchaseOrderId, status: 'OPEN' }));
    return conversation;
  }
  async messagesFor(incidentId: string) { const c = await this.openConversation(incidentId); return this.messages.find({ where: { conversationId: c.id }, order: { createdAt: 'ASC' } }); }
  async sendLogisticsMessage(incidentId: string, body: string, senderRole: 'PARTNER' | 'PROCUREMENT') { const c = await this.openConversation(incidentId); const prefix = '[Logistics coordination] '; return this.messages.save(this.messages.create({ id: `MSG-${Date.now()}-${Math.floor(Math.random()*1000)}`, conversationId: c.id, senderRole, body: body.startsWith(prefix) ? body : `${prefix}${body}` })); }
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
