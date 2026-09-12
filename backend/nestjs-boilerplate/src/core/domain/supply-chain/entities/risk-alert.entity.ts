import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'risk_alerts' })
export class RiskAlertEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 }) id: string;
  @Column({ type: 'varchar', length: 50, name: 'incident_id' }) incidentId: string;
  @Column({ type: 'varchar', length: 50, name: 'purchase_order_id' }) purchaseOrderId: string;
  @Column({ type: 'varchar', length: 150, name: 'partner_email' }) partnerEmail: string;
  @Column({ type: 'numeric', precision: 5, scale: 2, name: 'risk_score' }) riskScore: number;
  @Column({ type: 'varchar', length: 30, default: 'SENT' }) status: 'SENT' | 'ON_TIME' | 'DELAYED' | 'EXPIRED';
  @Column({ type: 'varchar', length: 100, unique: true, name: 'action_token' }) actionToken: string;
  @Column({ type: 'timestamp', name: 'expires_at' }) expiresAt: Date;
  @Column({ type: 'jsonb', name: 'fake_email' }) fakeEmail: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' }) updatedAt: Date;
}
