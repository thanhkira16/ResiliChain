import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplyChainRelations1761500000001 implements MigrationInterface {
  name = 'AddSupplyChainRelations1761500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_purchase_orders_inventory_item" FOREIGN KEY ("sku") REFERENCES "inventory_items"("sku") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_incidents_purchase_order" FOREIGN KEY ("po_number") REFERENCES "purchase_orders"("po_number") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_incidents_inventory_item" FOREIGN KEY ("sku") REFERENCES "inventory_items"("sku") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_incidents_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" ADD CONSTRAINT "FK_sourcing_proposals_incident" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" ADD CONSTRAINT "FK_sourcing_proposals_purchase_order" FOREIGN KEY ("po_number") REFERENCES "purchase_orders"("po_number") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" ADD CONSTRAINT "FK_sourcing_proposals_inventory_item" FOREIGN KEY ("sku") REFERENCES "inventory_items"("sku") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipments" ADD CONSTRAINT "FK_shipments_inventory_item" FOREIGN KEY ("sku") REFERENCES "inventory_items"("sku") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" ADD CONSTRAINT "FK_shipment_tracking_points_shipment" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" ADD CONSTRAINT "FK_shipment_tracking_points_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" ADD CONSTRAINT "FK_shipment_tracking_points_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" DROP CONSTRAINT "FK_shipment_tracking_points_supplier"`);
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" DROP CONSTRAINT "FK_shipment_tracking_points_purchase_order"`);
    await queryRunner.query(`ALTER TABLE "shipment_tracking_points" DROP CONSTRAINT "FK_shipment_tracking_points_shipment"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_shipments_inventory_item"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_shipments_supplier"`);
    await queryRunner.query(`ALTER TABLE "shipments" DROP CONSTRAINT "FK_shipments_purchase_order"`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" DROP CONSTRAINT "FK_sourcing_proposals_inventory_item"`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" DROP CONSTRAINT "FK_sourcing_proposals_purchase_order"`);
    await queryRunner.query(`ALTER TABLE "sourcing_proposals" DROP CONSTRAINT "FK_sourcing_proposals_incident"`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_incidents_supplier"`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_incidents_inventory_item"`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_incidents_purchase_order"`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_purchase_orders_inventory_item"`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_purchase_orders_supplier"`);
  }
}
