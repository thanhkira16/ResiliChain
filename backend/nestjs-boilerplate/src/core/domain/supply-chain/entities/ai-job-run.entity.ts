import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Nhật ký mỗi lượt chạy của AI Worker - bảng do AI Worker sở hữu hoàn toàn.
 * Backend chỉ SELECT, không bao giờ ghi.
 */
@Entity({ name: 'ai_job_runs' })
export class AiJobRunEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** "order_risk_scan" (5-10 phút/lần) hoặc "supplier_risk_scan" (1 lần/ngày). */
  @Column({ type: 'varchar', length: 50, name: 'job_name' })
  jobName: string;

  /** Nguồn kích hoạt: "schedule" | "manual" | "seed". */
  @Column({ type: 'varchar', length: 20, name: 'trigger_source' })
  triggerSource: string;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'finished_at' })
  finishedAt?: Date;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs?: number;

  /** "RUNNING" | "SUCCESS" | "FAILED". */
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'int', nullable: true, name: 'orders_scanned' })
  ordersScanned?: number;

  @Column({ type: 'int', nullable: true, name: 'suppliers_scanned' })
  suppliersScanned?: number;

  @Column({ type: 'int', nullable: true, name: 'incidents_created' })
  incidentsCreated?: number;

  @Column({ type: 'int', nullable: true, name: 'incidents_updated' })
  incidentsUpdated?: number;

  @Column({ type: 'int', nullable: true, name: 'proposals_created' })
  proposalsCreated?: number;

  /** Số bản ghi bị bỏ qua vì đã có quyết định của con người. */
  @Column({ type: 'int', nullable: true, name: 'skipped_locked' })
  skippedLocked?: number;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'text', nullable: true, name: 'error_detail' })
  errorDetail?: string;
}
