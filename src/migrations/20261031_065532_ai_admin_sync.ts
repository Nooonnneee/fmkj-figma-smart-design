import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_company_settings_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter');
  CREATE TYPE "public"."enum__company_settings_v_version_ai_models_channel_id" AS ENUM('deepseek', 'newapi', 'siliconflow', 'dashscope', 'ark', 'moonshot', 'zhipu', 'openrouter');
  CREATE TABLE "company_settings_ai_models" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"channel_id" "enum_company_settings_ai_models_channel_id" DEFAULT 'deepseek' NOT NULL,
  	"api_model" varchar NOT NULL,
  	"cost" numeric DEFAULT 1 NOT NULL,
  	"tag" varchar DEFAULT '工具调用',
  	"description" varchar,
  	"enabled" boolean DEFAULT true,
  	"is_default" boolean DEFAULT false,
  	"reasoning" boolean DEFAULT false
  );
  
  CREATE TABLE "_company_settings_v_version_ai_models" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"channel_id" "enum__company_settings_v_version_ai_models_channel_id" DEFAULT 'deepseek' NOT NULL,
  	"api_model" varchar NOT NULL,
  	"cost" numeric DEFAULT 1 NOT NULL,
  	"tag" varchar DEFAULT '工具调用',
  	"description" varchar,
  	"enabled" boolean DEFAULT true,
  	"is_default" boolean DEFAULT false,
  	"reasoning" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  ALTER TABLE "company_settings_ai_models" ADD CONSTRAINT "company_settings_ai_models_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."company_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_company_settings_v_version_ai_models" ADD CONSTRAINT "_company_settings_v_version_ai_models_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_company_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "company_settings_ai_models_order_idx" ON "company_settings_ai_models" USING btree ("_order");
  CREATE INDEX "company_settings_ai_models_parent_id_idx" ON "company_settings_ai_models" USING btree ("_parent_id");
  CREATE INDEX "_company_settings_v_version_ai_models_order_idx" ON "_company_settings_v_version_ai_models" USING btree ("_order");
  CREATE INDEX "_company_settings_v_version_ai_models_parent_id_idx" ON "_company_settings_v_version_ai_models" USING btree ("_parent_id");
  ALTER TABLE "company_settings" DROP COLUMN "ai_models";
  ALTER TABLE "_company_settings_v" DROP COLUMN "version_ai_models";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "company_settings_ai_models" CASCADE;
  DROP TABLE "_company_settings_v_version_ai_models" CASCADE;
  ALTER TABLE "company_settings" ADD COLUMN "ai_models" jsonb;
  ALTER TABLE "_company_settings_v" ADD COLUMN "version_ai_models" jsonb;
  DROP TYPE "public"."enum_company_settings_ai_models_channel_id";
  DROP TYPE "public"."enum__company_settings_v_version_ai_models_channel_id";`)
}
