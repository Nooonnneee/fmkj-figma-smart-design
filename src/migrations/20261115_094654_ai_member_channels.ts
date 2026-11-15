import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_company_settings_ai_models_channel_id" ADD VALUE IF NOT EXISTS 'dashscope-token-plan' BEFORE 'ark';
  ALTER TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" ADD VALUE IF NOT EXISTS 'dashscope-token-plan' BEFORE 'ark';
  ALTER TYPE "public"."enum_ai_settings_ai_models_channel_id" ADD VALUE IF NOT EXISTS 'dashscope-token-plan' BEFORE 'ark';
  ALTER TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id" ADD VALUE IF NOT EXISTS 'dashscope-token-plan' BEFORE 'ark';
  CREATE TABLE "users_company_profile_ai_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"base_url" varchar NOT NULL,
  	"api_key_cipher" varchar,
  	"api_key_hint" varchar,
  	"enabled" boolean DEFAULT true,
  	"last_checked_at" timestamp(3) with time zone,
  	"last_check_ok" boolean,
  	"last_check_error" varchar
  );
  
  CREATE TABLE "users_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_users_v_version_company_profile_ai_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"base_url" varchar NOT NULL,
  	"api_key_cipher" varchar,
  	"api_key_hint" varchar,
  	"enabled" boolean DEFAULT true,
  	"last_checked_at" timestamp(3) with time zone,
  	"last_check_ok" boolean,
  	"last_check_error" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_users_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "users_company_profile_ai_channels" ADD CONSTRAINT "users_company_profile_ai_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_texts" ADD CONSTRAINT "users_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_version_company_profile_ai_channels" ADD CONSTRAINT "_users_v_version_company_profile_ai_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_texts" ADD CONSTRAINT "_users_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_company_profile_ai_channels_order_idx" ON "users_company_profile_ai_channels" USING btree ("_order");
  CREATE INDEX "users_company_profile_ai_channels_parent_id_idx" ON "users_company_profile_ai_channels" USING btree ("_parent_id");
  CREATE INDEX "users_texts_order_parent" ON "users_texts" USING btree ("order","parent_id");
  CREATE INDEX "_users_v_version_company_profile_ai_channels_order_idx" ON "_users_v_version_company_profile_ai_channels" USING btree ("_order");
  CREATE INDEX "_users_v_version_company_profile_ai_channels_parent_id_idx" ON "_users_v_version_company_profile_ai_channels" USING btree ("_parent_id");
  CREATE INDEX "_users_v_texts_order_parent" ON "_users_v_texts" USING btree ("order","parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_company_profile_ai_channels" CASCADE;
  DROP TABLE "users_texts" CASCADE;
  DROP TABLE "_users_v_version_company_profile_ai_channels" CASCADE;
  DROP TABLE "_users_v_texts" CASCADE;
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum_company_settings_ai_models_channel_id";
  CREATE TYPE "public"."enum_company_settings_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum_company_settings_ai_models_channel_id";
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum_company_settings_ai_models_channel_id" USING "channel_id"::"public"."enum_company_settings_ai_models_channel_id";
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum__company_settings_v_version_ai_models_channel_id";
  CREATE TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum__company_settings_v_version_ai_models_channel_id";
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" USING "channel_id"::"public"."enum__company_settings_v_version_ai_models_channel_id";
  ALTER TABLE "ai_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "ai_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum_ai_settings_ai_models_channel_id";
  CREATE TYPE "public"."enum_ai_settings_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  ALTER TABLE "ai_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum_ai_settings_ai_models_channel_id";
  ALTER TABLE "ai_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum_ai_settings_ai_models_channel_id" USING "channel_id"::"public"."enum_ai_settings_ai_models_channel_id";
  ALTER TABLE "_ai_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "_ai_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id";
  CREATE TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  ALTER TABLE "_ai_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum__ai_settings_v_version_ai_models_channel_id";
  ALTER TABLE "_ai_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id" USING "channel_id"::"public"."enum__ai_settings_v_version_ai_models_channel_id";`)
}
