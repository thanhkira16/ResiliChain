import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeletePhoneNumberToUsers1761236994643
  implements MigrationInterface
{
  name = 'DeletePhoneNumberToUsers1761236994643';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phoneNumber"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phoneNumber" character varying(15) NOT NULL`,
    );
  }
}
