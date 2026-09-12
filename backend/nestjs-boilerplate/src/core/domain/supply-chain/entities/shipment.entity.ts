import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { InventoryItemEntity } from './inventory-item.entity';
import { PurchaseOrderEntity } from './purchase-order.entity';
import { ShipmentTrackingPointEntity } from './shipment-tracking.entity';
import { SupplierEntity } from './supplier.entity';

@Entity({ name: 'shipments' })
export class ShipmentEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrderEntity, (purchaseOrder) => purchaseOrder.shipments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'purchase_order_id', referencedColumnName: 'id' })
  purchaseOrder: PurchaseOrderEntity;

  @Column({ type: 'varchar', length: 50, name: 'po_number' })
  poNumber: string;

  @Column({ type: 'varchar', length: 50, name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, (supplier) => supplier.shipments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id', referencedColumnName: 'id' })
  supplier: SupplierEntity;

  @Column({ type: 'varchar', length: 255, name: 'supplier_name' })
  supplierName: string;

  @Column({ type: 'varchar', length: 50 })
  sku: string;

  @ManyToOne(() => InventoryItemEntity, (inventoryItem) => inventoryItem.shipments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sku', referencedColumnName: 'sku' })
  inventoryItem: InventoryItemEntity;

  @Column({ type: 'varchar', length: 255, name: 'sku_name' })
  skuName: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'varchar', length: 50, default: 'chiếc' })
  unit: string;

  @Column({ type: 'jsonb', name: 'destination_warehouse' })
  destinationWarehouse: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };

  @Column({ type: 'varchar', length: 20, name: 'promised_delivery_date' })
  promisedDeliveryDate: string;

  @Column({ type: 'varchar', length: 20, name: 'expected_delivery_date' })
  expectedDeliveryDate: string;

  @Column({ type: 'int', name: 'delay_days' })
  delayDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'current_delay_risk_score' })
  currentDelayRiskScore: number;

  @Column({ type: 'varchar', length: 20, name: 'risk_level' })
  riskLevel: string;

  @Column({ type: 'varchar', length: 150, name: 'carrier_name' })
  carrierName: string;

  @Column({ type: 'varchar', length: 100, name: 'tracking_number' })
  trackingNumber: string;

  @OneToMany(() => ShipmentTrackingPointEntity, (trackingPoint) => trackingPoint.shipment)
  trackingPoints: ShipmentTrackingPointEntity[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', name: 'updated_at' })
  updatedAt: Date;
}
