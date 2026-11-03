import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ai_settings_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  CREATE TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter', 'custom');
  ALTER TYPE "public"."enum_quotes_items_device_type" ADD VALUE 'ceiling-ap' BEFORE 'ap-node';
  ALTER TYPE "public"."enum__quotes_v_version_items_device_type" ADD VALUE 'ceiling-ap' BEFORE 'ap-node';
  ALTER TYPE "public"."enum_products_device_type" ADD VALUE 'ceiling-ap' BEFORE 'ap-node';
  ALTER TYPE "public"."enum__products_v_version_device_type" ADD VALUE 'ceiling-ap' BEFORE 'ap-node';
  ALTER TYPE "public"."enum_company_settings_ai_models_channel_id" ADD VALUE 'custom';
  ALTER TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" ADD VALUE 'custom';
  CREATE TABLE "ai_settings_custom_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar,
  	"api_key_env" varchar NOT NULL,
  	"base_url" varchar NOT NULL
  );
  
  CREATE TABLE "ai_settings_ai_models" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"channel_id" "enum_ai_settings_ai_models_channel_id" DEFAULT 'deepseek' NOT NULL,
  	"custom_channel" varchar,
  	"api_model" varchar NOT NULL,
  	"cost" numeric DEFAULT 1 NOT NULL,
  	"tag" varchar DEFAULT '工具调用',
  	"description" varchar,
  	"enabled" boolean DEFAULT true,
  	"is_default" boolean DEFAULT false,
  	"reasoning" boolean DEFAULT false
  );
  
  CREATE TABLE "ai_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ai_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_ai_settings_v_version_custom_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar,
  	"api_key_env" varchar NOT NULL,
  	"base_url" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ai_settings_v_version_ai_models" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"channel_id" "enum__ai_settings_v_version_ai_models_channel_id" DEFAULT 'deepseek' NOT NULL,
  	"custom_channel" varchar,
  	"api_model" varchar NOT NULL,
  	"cost" numeric DEFAULT 1 NOT NULL,
  	"tag" varchar DEFAULT '工具调用',
  	"description" varchar,
  	"enabled" boolean DEFAULT true,
  	"is_default" boolean DEFAULT false,
  	"reasoning" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_ai_settings_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_ai_settings_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "company_settings_ai_models" ADD COLUMN "custom_channel" varchar;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD COLUMN "custom_channel" varchar;
  ALTER TABLE "ai_settings_custom_channels" ADD CONSTRAINT "ai_settings_custom_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_ai_models" ADD CONSTRAINT "ai_settings_ai_models_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_rels" ADD CONSTRAINT "ai_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_rels" ADD CONSTRAINT "ai_settings_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_settings_rels" ADD CONSTRAINT "ai_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_settings_v_version_custom_channels" ADD CONSTRAINT "_ai_settings_v_version_custom_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ai_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_settings_v_version_ai_models" ADD CONSTRAINT "_ai_settings_v_version_ai_models_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_ai_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_settings_v_rels" ADD CONSTRAINT "_ai_settings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_ai_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_settings_v_rels" ADD CONSTRAINT "_ai_settings_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_settings_v_rels" ADD CONSTRAINT "_ai_settings_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "ai_settings_custom_channels_order_idx" ON "ai_settings_custom_channels" USING btree ("_order");
  CREATE INDEX "ai_settings_custom_channels_parent_id_idx" ON "ai_settings_custom_channels" USING btree ("_parent_id");
  CREATE INDEX "ai_settings_ai_models_order_idx" ON "ai_settings_ai_models" USING btree ("_order");
  CREATE INDEX "ai_settings_ai_models_parent_id_idx" ON "ai_settings_ai_models" USING btree ("_parent_id");
  CREATE INDEX "ai_settings_rels_order_idx" ON "ai_settings_rels" USING btree ("order");
  CREATE INDEX "ai_settings_rels_parent_idx" ON "ai_settings_rels" USING btree ("parent_id");
  CREATE INDEX "ai_settings_rels_path_idx" ON "ai_settings_rels" USING btree ("path");
  CREATE INDEX "ai_settings_rels_admins_id_idx" ON "ai_settings_rels" USING btree ("admins_id");
  CREATE INDEX "ai_settings_rels_users_id_idx" ON "ai_settings_rels" USING btree ("users_id");
  CREATE INDEX "_ai_settings_v_version_custom_channels_order_idx" ON "_ai_settings_v_version_custom_channels" USING btree ("_order");
  CREATE INDEX "_ai_settings_v_version_custom_channels_parent_id_idx" ON "_ai_settings_v_version_custom_channels" USING btree ("_parent_id");
  CREATE INDEX "_ai_settings_v_version_ai_models_order_idx" ON "_ai_settings_v_version_ai_models" USING btree ("_order");
  CREATE INDEX "_ai_settings_v_version_ai_models_parent_id_idx" ON "_ai_settings_v_version_ai_models" USING btree ("_parent_id");
  CREATE INDEX "_ai_settings_v_created_at_idx" ON "_ai_settings_v" USING btree ("created_at");
  CREATE INDEX "_ai_settings_v_updated_at_idx" ON "_ai_settings_v" USING btree ("updated_at");
  CREATE INDEX "_ai_settings_v_rels_order_idx" ON "_ai_settings_v_rels" USING btree ("order");
  CREATE INDEX "_ai_settings_v_rels_parent_idx" ON "_ai_settings_v_rels" USING btree ("parent_id");
  CREATE INDEX "_ai_settings_v_rels_path_idx" ON "_ai_settings_v_rels" USING btree ("path");
  CREATE INDEX "_ai_settings_v_rels_admins_id_idx" ON "_ai_settings_v_rels" USING btree ("admins_id");
  CREATE INDEX "_ai_settings_v_rels_users_id_idx" ON "_ai_settings_v_rels" USING btree ("users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "ai_settings_custom_channels" CASCADE;
  DROP TABLE "ai_settings_ai_models" CASCADE;
  DROP TABLE "ai_settings" CASCADE;
  DROP TABLE "ai_settings_rels" CASCADE;
  DROP TABLE "_ai_settings_v_version_custom_channels" CASCADE;
  DROP TABLE "_ai_settings_v_version_ai_models" CASCADE;
  DROP TABLE "_ai_settings_v" CASCADE;
  DROP TABLE "_ai_settings_v_rels" CASCADE;
  ALTER TABLE "quotes_items" ALTER COLUMN "device_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_quotes_items_device_type";
  CREATE TYPE "public"."enum_quotes_items_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  ALTER TABLE "quotes_items" ALTER COLUMN "device_type" SET DATA TYPE "public"."enum_quotes_items_device_type" USING "device_type"::"public"."enum_quotes_items_device_type";
  ALTER TABLE "_quotes_v_version_items" ALTER COLUMN "device_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__quotes_v_version_items_device_type";
  CREATE TYPE "public"."enum__quotes_v_version_items_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  ALTER TABLE "_quotes_v_version_items" ALTER COLUMN "device_type" SET DATA TYPE "public"."enum__quotes_v_version_items_device_type" USING "device_type"::"public"."enum__quotes_v_version_items_device_type";
  ALTER TABLE "products" ALTER COLUMN "device_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_products_device_type";
  CREATE TYPE "public"."enum_products_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  ALTER TABLE "products" ALTER COLUMN "device_type" SET DATA TYPE "public"."enum_products_device_type" USING "device_type"::"public"."enum_products_device_type";
  ALTER TABLE "_products_v" ALTER COLUMN "version_device_type" SET DATA TYPE text;
  DROP TYPE "public"."enum__products_v_version_device_type";
  CREATE TYPE "public"."enum__products_v_version_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  ALTER TABLE "_products_v" ALTER COLUMN "version_device_type" SET DATA TYPE "public"."enum__products_v_version_device_type" USING "version_device_type"::"public"."enum__products_v_version_device_type";
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum_company_settings_ai_models_channel_id";
  CREATE TYPE "public"."enum_company_settings_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter');
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum_company_settings_ai_models_channel_id";
  ALTER TABLE "company_settings_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum_company_settings_ai_models_channel_id" USING "channel_id"::"public"."enum_company_settings_ai_models_channel_id";
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE text;
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::text;
  DROP TYPE "public"."enum__company_settings_v_version_ai_models_channel_id";
  CREATE TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter');
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DEFAULT 'deepseek'::"public"."enum__company_settings_v_version_ai_models_channel_id";
  ALTER TABLE "_company_settings_v_version_ai_models" ALTER COLUMN "channel_id" SET DATA TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" USING "channel_id"::"public"."enum__company_settings_v_version_ai_models_channel_id";
  ALTER TABLE "company_settings_ai_models" DROP COLUMN "custom_channel";
  ALTER TABLE "_company_settings_v_version_ai_models" DROP COLUMN "custom_channel";
  DROP TYPE "public"."enum_ai_settings_ai_models_channel_id";
  DROP TYPE "public"."enum__ai_settings_v_version_ai_models_channel_id";`)
}
