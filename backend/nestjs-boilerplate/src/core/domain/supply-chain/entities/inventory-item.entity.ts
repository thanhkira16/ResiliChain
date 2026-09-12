import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { ShipmentEntity } from './shipment.entity';
import { SourcingProposalEntity } from './sourcing-proposal.entity';

@Entity({ name: 'inventory_items' })
export class InventoryItemEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  sku: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'int', name: 'current_stock' })
  currentStock: number;

  @Column({ type: 'int', name: 'safety_stock' })
  safetyStock: number;

  @Column({ type: 'int', name: 'weekly_burn_rate' })
  weeklyBurnRate: number;

  @Column({ type: 'numeric', precision: 15, scale: 2, name: 'unit_price_estimate' })
  unitPriceEstimate: number;

  @Column({ type: 'int', name: 'min_lead_time_days' })
  minLeadTimeDays: number;

  @OneToMany(() => PurchaseOrderEntity, (purchaseOrder) => purchaseOrder.inventoryItem)
  purchaseOrders: PurchaseOrderEntity[];

  @OneToMany(() => IncidentEntity, (incident) => incident.inventoryItem)
  incidents: IncidentEntity[];

  @OneToMany(() => SourcingProposalEntity, (proposal) => proposal.inventoryItem)
  sourcingProposals: SourcingProposalEntity[];

  @OneToMany(() => ShipmentEntity, (shipment) => shipment.inventoryItem)
  shipments: ShipmentEntity[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
