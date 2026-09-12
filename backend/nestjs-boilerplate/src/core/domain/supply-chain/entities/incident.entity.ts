import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { InventoryItemEntity } from './inventory-item.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { SourcingProposalEntity } from './sourcing-proposal.entity';
import { SupplierEntity } from './supplier.entity';

@Entity({ name: 'incidents' })
export class IncidentEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'correlation_id' })
  correlationId: string;

  @Column({ type: 'varchar', length: 50, name: 'po_number' })
  poNumber: string;

  @ManyToOne(() => PurchaseOrderEntity, (purchaseOrder) => purchaseOrder.incidents, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'po_number', referencedColumnName: 'poNumber' })
  purchaseOrder: PurchaseOrderEntity;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @ManyToOne(() => InventoryItemEntity, (inventoryItem) => inventoryItem.incidents, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sku', referencedColumnName: 'sku' })
  inventoryItem: InventoryItemEntity;

  @Column({ type: 'varchar', length: 255, name: 'sku_name' })
  skuName: string;

  @Column({ type: 'varchar', length: 50, name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, (supplier) => supplier.incidents, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id', referencedColumnName: 'id' })
  supplier: SupplierEntity;

  @Column({ type: 'varchar', length: 255, name: 'supplier_name' })
  supplierName: string;

  @Column({ type: 'int', name: 'delay_days' })
  delayDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'delay_risk_score' })
  delayRiskScore: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'threshold_applied' })
  thresholdApplied: number;

  @Column({ type: 'varchar', length: 50 })
  state: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'varchar', length: 50, name: 'detected_at' })
  detectedAt: string;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'boolean', default: false, name: 'agent2_triggered' })
  agent2Triggered: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'risk_breakdown' })
  riskBreakdown?: any;

  @OneToMany(() => SourcingProposalEntity, (proposal) => proposal.incident)
  sourcingProposals: SourcingProposalEntity[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
