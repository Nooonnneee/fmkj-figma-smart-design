import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_ai_settings_ai_models_min_tier" AS ENUM('auto', 'free', 'pro', 'team');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum__ai_settings_v_version_ai_models_min_tier" AS ENUM('auto', 'free', 'pro', 'team');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_company_settings_ai_models_min_tier" AS ENUM('auto', 'free', 'pro', 'team');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum__company_settings_v_version_ai_models_min_tier" AS ENUM('auto', 'free', 'pro', 'team');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  ALTER TABLE "proposal_templates" ADD COLUMN IF NOT EXISTS "audience" varchar;
  ALTER TABLE "proposal_templates" ADD COLUMN IF NOT EXISTS "occasion" varchar;
  ALTER TABLE "_proposal_templates_v" ADD COLUMN IF NOT EXISTS "version_audience" varchar;
  ALTER TABLE "_proposal_templates_v" ADD COLUMN IF NOT EXISTS "version_occasion" varchar;

  CREATE TABLE IF NOT EXISTS "proposal_templates_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer NOT NULL,
    "parent_id" uuid NOT NULL,
    "path" varchar NOT NULL,
    "text" varchar
  );

  CREATE TABLE IF NOT EXISTS "_proposal_templates_v_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer NOT NULL,
    "parent_id" uuid NOT NULL,
    "path" varchar NOT NULL,
    "text" varchar
  );

  DO $$ BEGIN
    ALTER TABLE "proposal_templates_texts" ADD CONSTRAINT "proposal_templates_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposal_templates"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    ALTER TABLE "_proposal_templates_v_texts" ADD CONSTRAINT "_proposal_templates_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_proposal_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE INDEX IF NOT EXISTS "proposal_templates_texts_order_parent" ON "proposal_templates_texts" USING btree ("order","parent_id");
  CREATE INDEX IF NOT EXISTS "_proposal_templates_v_texts_order_parent" ON "_proposal_templates_v_texts" USING btree ("order","parent_id");

  ALTER TABLE "ai_settings_ai_models" ADD COLUMN IF NOT EXISTS "min_tier" "enum_ai_settings_ai_models_min_tier" DEFAULT 'auto';
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD COLUMN IF NOT EXISTS "min_tier" "enum__ai_settings_v_version_ai_models_min_tier" DEFAULT 'auto';
  ALTER TABLE "company_settings_ai_models" ADD COLUMN IF NOT EXISTS "min_tier" "enum_company_settings_ai_models_min_tier" DEFAULT 'auto';
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN IF NOT EXISTS "min_tier" "enum__company_settings_v_version_ai_models_min_tier" DEFAULT 'auto';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "proposal_templates_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposal_templates_v_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE IF EXISTS "proposal_templates_texts" CASCADE;
  DROP TABLE IF EXISTS "_proposal_templates_v_texts" CASCADE;
  ALTER TABLE "proposal_templates" DROP COLUMN IF EXISTS "audience";
  ALTER TABLE "proposal_templates" DROP COLUMN IF EXISTS "occasion";
  ALTER TABLE "_proposal_templates_v" DROP COLUMN IF EXISTS "version_audience";
  ALTER TABLE "_proposal_templates_v" DROP COLUMN IF EXISTS "version_occasion";
  ALTER TABLE "ai_settings_ai_models" DROP COLUMN IF EXISTS "min_tier";
  ALTER TABLE "_ai_settings_v_version_ai_models" DROP COLUMN IF EXISTS "min_tier";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN IF EXISTS "min_tier";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN IF EXISTS "min_tier";
  DROP TYPE IF EXISTS "public"."enum_ai_settings_ai_models_min_tier";
  DROP TYPE IF EXISTS "public"."enum__ai_settings_v_version_ai_models_min_tier";
  DROP TYPE IF EXISTS "public"."enum_company_settings_ai_models_min_tier";
  DROP TYPE IF EXISTS "public"."enum__company_settings_v_version_ai_models_min_tier";`)
}
