import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { InventoryItemEntity } from './inventory-item.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';

@Entity({ name: 'sourcing_proposals' })
export class SourcingProposalEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'incident_id' })
  incidentId: string;

  @ManyToOne(() => IncidentEntity, (incident) => incident.sourcingProposals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'incident_id', referencedColumnName: 'id' })
  incident: IncidentEntity;

  @Column({ type: 'varchar', length: 100, name: 'correlation_id' })
  correlationId: string;

  @Column({ type: 'varchar', length: 50, name: 'po_number' })
  poNumber: string;

  @ManyToOne(() => PurchaseOrderEntity, (purchaseOrder) => purchaseOrder.sourcingProposals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'po_number', referencedColumnName: 'poNumber' })
  purchaseOrder: PurchaseOrderEntity;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @ManyToOne(() => InventoryItemEntity, (inventoryItem) => inventoryItem.sourcingProposals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sku', referencedColumnName: 'sku' })
  inventoryItem: InventoryItemEntity;

  @Column({ type: 'varchar', length: 255, name: 'sku_name' })
  skuName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 255, name: 'original_supplier_name' })
  originalSupplierName: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'original_unit_price' })
  originalUnitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'original_total_cost' })
  originalTotalCost: number;

  @Column({ type: 'jsonb' })
  rankings: any[];

  @Column({ type: 'int', default: 1, name: 'selected_rank' })
  selectedRank: number;

  @Column({ type: 'text' })
  recommendation: string;

  @Column({ type: 'jsonb', name: 'rejected_options_analysis' })
  rejectedOptionsAnalysis: any[];

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'total_value_vnd' })
  totalValueVND: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
