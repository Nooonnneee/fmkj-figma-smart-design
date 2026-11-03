import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "company_settings_ai_models" ADD COLUMN "peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "off_peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "off_peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "off_peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "off_peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "off_peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "off_peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "off_peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "off_peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "ai_settings_ai_models" ADD COLUMN "off_peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "off_peak_input_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "off_peak_output_price" numeric DEFAULT 0;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN "off_peak_cached_input_price" numeric DEFAULT 0;
  ALTER TABLE "users" DROP COLUMN "login_attempts";
  ALTER TABLE "users" DROP COLUMN "lock_until";
  ALTER TABLE "_users_v" DROP COLUMN "version_login_attempts";
  ALTER TABLE "_users_v" DROP COLUMN "version_lock_until";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "login_attempts" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN "lock_until" timestamp(3) with time zone;
  ALTER TABLE "_users_v" ADD COLUMN "version_login_attempts" numeric DEFAULT 0;
  ALTER TABLE "_users_v" ADD COLUMN "version_lock_until" timestamp(3) with time zone;
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "peak_input_price";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "peak_output_price";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "peak_cached_input_price";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "off_peak_input_price";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "off_peak_output_price";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "off_peak_cached_input_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "peak_input_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "peak_output_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "peak_cached_input_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "off_peak_input_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "off_peak_output_price";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "off_peak_cached_input_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "peak_input_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "peak_output_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "peak_cached_input_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "off_peak_input_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "off_peak_output_price";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN "off_peak_cached_input_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "peak_input_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "peak_output_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "peak_cached_input_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "off_peak_input_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "off_peak_output_price";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN "off_peak_cached_input_price";`)
}
