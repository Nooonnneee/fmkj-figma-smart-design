import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quotes_items" ADD COLUMN "short_name" varchar;
  ALTER TABLE "_quotes_v_version_items" ADD COLUMN "short_name" varchar;
  ALTER TABLE "products" ADD COLUMN "short_name" varchar;
  ALTER TABLE "_products_v" ADD COLUMN "version_short_name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quotes_items" DROP COLUMN "short_name";
  ALTER TABLE "_quotes_v_version_items" DROP COLUMN "short_name";
  ALTER TABLE "products" DROP COLUMN "short_name";
  ALTER TABLE "_products_v" DROP COLUMN "version_short_name";`)
}
