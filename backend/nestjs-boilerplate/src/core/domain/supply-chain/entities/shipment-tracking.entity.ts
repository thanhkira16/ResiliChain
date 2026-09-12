import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne } from 'typeorm';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { ShipmentEntity } from './shipment.entity';
import { SupplierEntity } from './supplier.entity';

@Entity({ name: 'shipment_tracking_points' })
export class ShipmentTrackingPointEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'shipment_id' })
  shipmentId: string;

  @ManyToOne(() => ShipmentEntity, (shipment) => shipment.trackingPoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipment_id', referencedColumnName: 'id' })
  shipment: ShipmentEntity;

  @Column({ type: 'varchar', length: 50, name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id', referencedColumnName: 'id' })
  purchaseOrder: PurchaseOrderEntity;

  @Column({ type: 'varchar', length: 50, name: 'po_number' })
  poNumber: string;

  @Column({ type: 'varchar', length: 50, name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, (supplier) => supplier.trackingPoints, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id', referencedColumnName: 'id' })
  supplier: SupplierEntity;

  @Column({ type: 'varchar', length: 255, name: 'supplier_name' })
  supplierName: string;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  latitude: number;

  @Column({ type: 'numeric', precision: 10, scale: 6 })
  longitude: number;

  @Column({ type: 'varchar', length: 255, name: 'location_name' })
  locationName: string;

  @Column({ type: 'varchar', length: 50, name: 'recorded_at' })
  recordedAt: string;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, name: 'speed_kmh' })
  speedKmh?: number;

  @Column({ type: 'text', nullable: true, name: 'status_note' })
  statusNote?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
