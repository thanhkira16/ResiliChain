import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddRiskAlertsAndLogisticsChat1761500000002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "risk_alerts" ("id" varchar(50) PRIMARY KEY, "incident_id" varchar(50) NOT NULL, "purchase_order_id" varchar(50) NOT NULL, "partner_email" varchar(150) NOT NULL, "risk_score" numeric(5,2) NOT NULL, "status" varchar(30) NOT NULL DEFAULT 'SENT', "action_token" varchar(100) NOT NULL UNIQUE, "expires_at" timestamp NOT NULL, "fake_email" jsonb NOT NULL, "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await q.query(`CREATE TABLE "logistics_conversations" ("id" varchar(50) PRIMARY KEY, "incident_id" varchar(50) NOT NULL UNIQUE, "purchase_order_id" varchar(50) NOT NULL, "status" varchar(30) NOT NULL DEFAULT 'OPEN', "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await q.query(`CREATE TABLE "logistics_messages" ("id" varchar(50) PRIMARY KEY, "conversation_id" varchar(50) NOT NULL, "sender_role" varchar(30) NOT NULL, "body" text NOT NULL, "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FK_logistics_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "logistics_conversations"("id") ON DELETE CASCADE)`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE "logistics_messages"`); await q.query(`DROP TABLE "logistics_conversations"`); await q.query(`DROP TABLE "risk_alerts"`); }
}
