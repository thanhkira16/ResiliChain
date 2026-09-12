import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupplyChainTables1761500000000 implements MigrationInterface {
    name = 'AddSupplyChainTables1761500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Suppliers Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "suppliers" (
                "id" character varying(50) NOT NULL,
                "name" character varying(255) NOT NULL,
                "contact_person" character varying(150) NOT NULL,
                "email" character varying(150) NOT NULL,
                "phone" character varying(50) NOT NULL,
                "provided_skus" jsonb NOT NULL,
                "average_lead_time_days" integer NOT NULL,
                "historical_price" jsonb NOT NULL,
                "reliability_score" integer NOT NULL,
                "address" text NOT NULL,
                "transit_waypoints" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_suppliers" PRIMARY KEY ("id")
            )
        `);

        // 2. Inventory Items Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "inventory_items" (
                "sku" character varying(50) NOT NULL,
                "name" character varying(255) NOT NULL,
                "category" character varying(100) NOT NULL,
                "unit" character varying(50) NOT NULL,
                "current_stock" integer NOT NULL,
                "safety_stock" integer NOT NULL,
                "weekly_burn_rate" integer NOT NULL,
                "unit_price_estimate" numeric(15, 2) NOT NULL,
                "min_lead_time_days" integer NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_inventory_items" PRIMARY KEY ("sku")
            )
        `);

        // 3. Purchase Orders Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "purchase_orders" (
                "id" character varying(50) NOT NULL,
                "po_number" character varying(50) NOT NULL,
                "supplier_id" character varying(50) NOT NULL,
                "supplier_name" character varying(255) NOT NULL,
                "sku" character varying(50) NOT NULL,
                "sku_name" character varying(255) NOT NULL,
                "quantity" integer NOT NULL,
                "unit_price" numeric(15, 2) NOT NULL,
                "total_amount" numeric(15, 2) NOT NULL,
                "order_date" character varying(20) NOT NULL,
                "promised_delivery_date" character varying(20) NOT NULL,
                "actual_or_expected_delivery_date" character varying(20) NOT NULL,
                "status" character varying(50) NOT NULL,
                "current_risk_score" numeric(5, 2),
                "risk_breakdown" jsonb,
                "notes" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_purchase_orders_po_number" UNIQUE ("po_number")
            )
        `);

        // 4. Incidents Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "incidents" (
                "id" character varying(50) NOT NULL,
                "correlation_id" character varying(100) NOT NULL,
                "po_number" character varying(50) NOT NULL,
                "sku" character varying(50) NOT NULL,
                "sku_name" character varying(255) NOT NULL,
                "supplier_id" character varying(50) NOT NULL,
                "supplier_name" character varying(255) NOT NULL,
                "delay_days" integer NOT NULL,
                "delay_risk_score" numeric(5, 2) NOT NULL,
                "threshold_applied" numeric(5, 2) NOT NULL,
                "state" character varying(50) NOT NULL,
                "status" character varying(50) NOT NULL,
                "detected_at" character varying(50) NOT NULL,
                "summary" text NOT NULL,
                "agent2_triggered" boolean NOT NULL DEFAULT false,
                "risk_breakdown" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_incidents" PRIMARY KEY ("id")
            )
        `);

        // 5. Sourcing Proposals Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "sourcing_proposals" (
                "id" character varying(50) NOT NULL,
                "incident_id" character varying(50) NOT NULL,
                "correlation_id" character varying(100) NOT NULL,
                "po_number" character varying(50) NOT NULL,
                "sku" character varying(50) NOT NULL,
                "sku_name" character varying(255) NOT NULL,
                "quantity" integer NOT NULL,
                "original_supplier_name" character varying(255) NOT NULL,
                "original_unit_price" numeric(15, 2) NOT NULL,
                "original_total_cost" numeric(15, 2) NOT NULL,
                "rankings" jsonb NOT NULL,
                "selected_rank" integer NOT NULL DEFAULT 1,
                "recommendation" text NOT NULL,
                "rejected_options_analysis" jsonb NOT NULL,
                "status" character varying(50) NOT NULL,
                "total_value_vnd" numeric(15, 2) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_sourcing_proposals" PRIMARY KEY ("id")
            )
        `);

        // 6. Shipments Master Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "shipments" (
                "id" character varying(50) NOT NULL,
                "purchase_order_id" character varying(50) NOT NULL,
                "po_number" character varying(50) NOT NULL,
                "supplier_id" character varying(50) NOT NULL,
                "supplier_name" character varying(255) NOT NULL,
                "sku" character varying(50) NOT NULL,
                "sku_name" character varying(255) NOT NULL,
                "quantity" integer NOT NULL,
                "unit" character varying(50) NOT NULL DEFAULT 'chiếc',
                "destination_warehouse" jsonb NOT NULL,
                "promised_delivery_date" character varying(20) NOT NULL,
                "expected_delivery_date" character varying(20) NOT NULL,
                "delay_days" integer NOT NULL,
                "current_delay_risk_score" numeric(5, 2) NOT NULL,
                "risk_level" character varying(20) NOT NULL,
                "carrier_name" character varying(150) NOT NULL,
                "tracking_number" character varying(100) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_shipments" PRIMARY KEY ("id")
            )
        `);

        // 7. Shipment Tracking Points Table
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "shipment_tracking_points" (
                "id" character varying(50) NOT NULL,
                "shipment_id" character varying(50) NOT NULL,
                "purchase_order_id" character varying(50) NOT NULL,
                "po_number" character varying(50) NOT NULL,
                "supplier_id" character varying(50) NOT NULL,
                "supplier_name" character varying(255) NOT NULL,
                "latitude" numeric(10, 6) NOT NULL,
                "longitude" numeric(10, 6) NOT NULL,
                "location_name" character varying(255) NOT NULL,
                "recorded_at" character varying(50) NOT NULL,
                "source" character varying(50) NOT NULL,
                "speed_kmh" numeric(5, 2),
                "status_note" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_shipment_tracking_points" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "shipment_tracking_points"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "shipments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "sourcing_proposals"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
    }
}
