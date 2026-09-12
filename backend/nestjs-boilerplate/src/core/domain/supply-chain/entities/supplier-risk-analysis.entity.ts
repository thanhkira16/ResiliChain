import { Entity, PrimaryColumn, Column, JoinColumn, ManyToOne } from 'typeorm';
import { SupplierEntity } from './supplier.entity';

/**
 * Radar rủi ro nhà cung ứng - bảng do AI Worker sở hữu hoàn toàn.
 * Backend chỉ SELECT, không bao giờ ghi.
 *
 * PORS = 0.35*ssiNews + 0.30*ssiFin + 0.20*ssiDel + 0.15*gGeo  (thang 0-100)
 */
@Entity({ name: 'supplier_risk_analysis' })
export class SupplierRiskAnalysisEntity {
  @PrimaryColumn({ type: 'varchar', length: 50, name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id', referencedColumnName: 'id' })
  supplier: SupplierEntity;

  /** Mã chứng khoán dùng để tra GDELT / FMP, ví dụ "TSLA". */
  @Column({ type: 'varchar', length: 20 })
  ticker: string;

  /** Rủi ro từ dòng tin tức & địa chính trị (Agent 2 - GDELT). */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, name: 'ssi_news' })
  ssiNews?: number;

  /** Rủi ro sức khoẻ tài chính, suy từ Altman Z (Agent 3 - FMP). */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, name: 'ssi_fin' })
  ssiFin?: number;

  /** Rủi ro địa chính trị theo quốc gia đặt năng lực sản xuất. */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, name: 'g_geo' })
  gGeo?: number;

  /** Rủi ro giao hàng, suy từ lịch sử trễ hạn trong purchase_orders. */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, name: 'ssi_del' })
  ssiDel?: number;

  /** Altman Z-Score. <1,81 nguy cơ phá sản; >2,99 an toàn. */
  @Column({ type: 'numeric', precision: 8, scale: 2, nullable: true, name: 'altman_z' })
  altmanZ?: number;

  /** Điểm rủi ro tổng hợp 0-100. */
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true, name: 'pors_score' })
  porsScore?: number;

  /** "CAO" (>=55) | "TRUNG BÌNH" (>=40) | "THẤP" */
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'risk_level' })
  riskLevel?: string;

  /** Nhãn mô tả ngắn, ví dụ "Kiệt quệ", "Địa chính trị". */
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'status_label' })
  statusLabel?: string;

  @Column({ type: 'int', nullable: true, name: 'events_supply_chain_30d' })
  eventsSupplyChain30d?: number;

  /** [{ date, summary }] - các sự kiện tin tức nổi bật trong 30 ngày. */
  @Column({ type: 'jsonb', nullable: true, name: 'key_events' })
  keyEvents?: Array<{ date: string; summary: string }>;

  @Column({ type: 'timestamp', name: 'analyzed_at' })
  analyzedAt: Date;
}
