import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'logistics_conversations' })
export class LogisticsConversationEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 }) id: string;
  @Column({ type: 'varchar', length: 50, unique: true, name: 'incident_id' }) incidentId: string;
  @Column({ type: 'varchar', length: 50, name: 'purchase_order_id' }) purchaseOrderId: string;
  @Column({ type: 'varchar', length: 30, default: 'OPEN' }) status: string;
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' }) updatedAt: Date;
}
