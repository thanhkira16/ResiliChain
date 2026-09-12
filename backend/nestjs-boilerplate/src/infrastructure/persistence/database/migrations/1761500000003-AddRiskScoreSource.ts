import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddRiskScoreSource1761500000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "purchase_orders" ADD COLUMN "risk_score_source" varchar(20) NOT NULL DEFAULT 'CALCULATED'`); }
  async down(q: QueryRunner): Promise<void> { await q.query(`ALTER TABLE "purchase_orders" DROP COLUMN "risk_score_source"`); }
}
