import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { InventoryItemEntity } from './inventory-item.entity';
import { ShipmentEntity } from './shipment.entity';
import { SourcingProposalEntity } from './sourcing-proposal.entity';
import { SupplierEntity } from './supplier.entity';

@Entity({ name: 'purchase_orders' })
export class PurchaseOrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'po_number' })
  poNumber: string;

  @Column({ type: 'varchar', length: 50, name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, (supplier) => supplier.purchaseOrders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id', referencedColumnName: 'id' })
  supplier: SupplierEntity;

  @Column({ type: 'varchar', length: 255, name: 'supplier_name' })
  supplierName: string;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @ManyToOne(() => InventoryItemEntity, (inventoryItem) => inventoryItem.purchaseOrders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sku', referencedColumnName: 'sku' })
  inventoryItem: InventoryItemEntity;

  @Column({ type: 'varchar', length: 255, name: 'sku_name' })
  skuName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'varchar', length: 20, name: 'order_date' })
  orderDate: string;

  @Column({ type: 'varchar', length: 20, name: 'promised_delivery_date' })
  promisedDeliveryDate: string;

  @Column({ type: 'varchar', length: 20, name: 'actual_or_expected_delivery_date' })
  actualOrExpectedDeliveryDate: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, name: 'current_risk_score' })
  currentRiskScore?: number;

  @Column({ type: 'varchar', length: 20, default: 'CALCULATED', name: 'risk_score_source' })
  riskScoreSource: 'MANUAL' | 'CALCULATED';

  @Column({ type: 'jsonb', nullable: true, name: 'risk_breakdown' })
  riskBreakdown?: any;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => IncidentEntity, (incident) => incident.purchaseOrder)
  incidents: IncidentEntity[];

  @OneToMany(() => SourcingProposalEntity, (proposal) => proposal.purchaseOrder)
  sourcingProposals: SourcingProposalEntity[];

  @OneToMany(() => ShipmentEntity, (shipment) => shipment.purchaseOrder)
  shipments: ShipmentEntity[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
