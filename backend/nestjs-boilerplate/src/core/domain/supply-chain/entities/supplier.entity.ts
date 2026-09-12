import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { IncidentEntity } from './incident.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { ShipmentEntity } from './shipment.entity';
import { ShipmentTrackingPointEntity } from './shipment-tracking.entity';

@Entity({ name: 'suppliers' })
export class SupplierEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 150, name: 'contact_person' })
  contactPerson: string;

  @Column({ type: 'varchar', length: 150 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  phone: string;

  @Column({ type: 'jsonb', name: 'provided_skus' })
  providedSkus: string[];

  @Column({ type: 'int', name: 'average_lead_time_days' })
  averageLeadTimeDays: number;

  @Column({ type: 'jsonb', name: 'historical_price' })
  historicalPrice: Record<string, number>;

  @Column({ type: 'int', name: 'reliability_score' })
  reliabilityScore: number;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'jsonb', nullable: true, name: 'transit_waypoints' })
  transitWaypoints?: any[];

  @OneToMany(() => PurchaseOrderEntity, (purchaseOrder) => purchaseOrder.supplier)
  purchaseOrders: PurchaseOrderEntity[];

  @OneToMany(() => IncidentEntity, (incident) => incident.supplier)
  incidents: IncidentEntity[];

  @OneToMany(() => ShipmentEntity, (shipment) => shipment.supplier)
  shipments: ShipmentEntity[];

  @OneToMany(() => ShipmentTrackingPointEntity, (trackingPoint) => trackingPoint.supplier)
  trackingPoints: ShipmentTrackingPointEntity[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
