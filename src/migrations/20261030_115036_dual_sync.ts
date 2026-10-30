import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contracts_status" AS ENUM('draft', 'signed');
  CREATE TYPE "public"."enum__contracts_v_version_status" AS ENUM('draft', 'signed');
  CREATE TYPE "public"."enum_ai_messages_role" AS ENUM('user', 'assistant');
  CREATE TYPE "public"."enum__ai_messages_v_version_role" AS ENUM('user', 'assistant');
  CREATE TABLE "contracts_payments" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"percent" numeric NOT NULL,
  	"received" boolean DEFAULT false
  );
  
  CREATE TABLE "contracts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"number" varchar NOT NULL,
  	"status" "enum_contracts_status" DEFAULT 'draft' NOT NULL,
  	"signed_at" timestamp(3) with time zone,
  	"project_id" uuid NOT NULL,
  	"quote_id" uuid NOT NULL,
  	"amount" numeric NOT NULL,
  	"customer_name" varchar,
  	"customer_phone" varchar,
  	"address" varchar,
  	"duration_days" numeric,
  	"warranty_months" numeric,
  	"terms" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contracts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_contracts_v_version_payments" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"percent" numeric NOT NULL,
  	"received" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_contracts_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_number" varchar NOT NULL,
  	"version_status" "enum__contracts_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_signed_at" timestamp(3) with time zone,
  	"version_project_id" uuid NOT NULL,
  	"version_quote_id" uuid NOT NULL,
  	"version_amount" numeric NOT NULL,
  	"version_customer_name" varchar,
  	"version_customer_phone" varchar,
  	"version_address" varchar,
  	"version_duration_days" numeric,
  	"version_warranty_months" numeric,
  	"version_terms" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_contracts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "ai_conversations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"project_id" uuid,
  	"model" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_conversations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_ai_conversations_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar NOT NULL,
  	"version_owner_id" uuid NOT NULL,
  	"version_project_id" uuid,
  	"version_model" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_ai_conversations_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "ai_messages" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"conversation_id" uuid NOT NULL,
  	"owner_id" uuid NOT NULL,
  	"role" "enum_ai_messages_role" NOT NULL,
  	"content" varchar NOT NULL,
  	"model" varchar,
  	"cost" numeric,
  	"tool_calls" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_messages_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_ai_messages_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_conversation_id" uuid NOT NULL,
  	"version_owner_id" uuid NOT NULL,
  	"version_role" "enum__ai_messages_v_version_role" NOT NULL,
  	"version_content" varchar NOT NULL,
  	"version_model" varchar,
  	"version_cost" numeric,
  	"version_tool_calls" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_ai_messages_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "ai_credit_ledger" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"delta" numeric NOT NULL,
  	"balance_after" numeric,
  	"reason" varchar,
  	"model" varchar,
  	"message_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_credit_ledger_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_ai_credit_ledger_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_user_id" uuid NOT NULL,
  	"version_delta" numeric NOT NULL,
  	"version_balance_after" numeric,
  	"version_reason" varchar,
  	"version_model" varchar,
  	"version_message_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_ai_credit_ledger_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active'::text;
  DROP TYPE "public"."enum_projects_status";
  CREATE TYPE "public"."enum_projects_status" AS ENUM('active', 'archived');
  ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."enum_projects_status";
  ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE "public"."enum_projects_status" USING "status"::"public"."enum_projects_status";
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DATA TYPE text;
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DEFAULT 'active'::text;
  DROP TYPE "public"."enum__projects_v_version_status";
  CREATE TYPE "public"."enum__projects_v_version_status" AS ENUM('active', 'archived');
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DEFAULT 'active'::"public"."enum__projects_v_version_status";
  ALTER TABLE "_projects_v" ALTER COLUMN "version_status" SET DATA TYPE "public"."enum__projects_v_version_status" USING "version_status"::"public"."enum__projects_v_version_status";
  DROP INDEX "projects_stage_idx";
  DROP INDEX "_projects_v_version_version_stage_idx";
  ALTER TABLE "projects" ALTER COLUMN "customer_name" DROP NOT NULL;
  ALTER TABLE "_projects_v" ALTER COLUMN "version_customer_name" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "ai_credits" numeric DEFAULT 0;
  ALTER TABLE "_users_v" ADD COLUMN "version_ai_credits" numeric DEFAULT 0;
  ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp(3) with time zone;
  ALTER TABLE "projects" ADD COLUMN "point_count" numeric;
  ALTER TABLE "_projects_v" ADD COLUMN "version_archived_at" timestamp(3) with time zone;
  ALTER TABLE "_projects_v" ADD COLUMN "version_point_count" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contracts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_conversations_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_messages_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_credit_ledger_id" uuid;
  ALTER TABLE "company_settings" ADD COLUMN "contract_terms" varchar DEFAULT '1. 乙方按附件《报价明细》提供智能家居设备，并负责安装、调试和使用培训。
  2. 甲方应保证现场具备安装条件（水电、网络、装修进度等）；因现场条件导致的延期，工期相应顺延。
  3. 设备品牌、型号以附件为准；如需变更，双方协商一致后另行确认，费用多退少补。
  4. 质保期内，非人为损坏的设备故障由乙方免费维修或更换；人为损坏、不可抗力及质保期外的维修按实际成本收费。
  5. 安装调试完成后，甲方应在 3 日内组织验收；逾期未验收且已实际使用的，视为验收合格。
  6. 本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。';
  ALTER TABLE "company_settings" ADD COLUMN "document_defaults" jsonb;
  ALTER TABLE "company_settings" ADD COLUMN "disabled_plugins" jsonb;
  ALTER TABLE "_company_settings_v" ADD COLUMN "version_contract_terms" varchar DEFAULT '1. 乙方按附件《报价明细》提供智能家居设备，并负责安装、调试和使用培训。
  2. 甲方应保证现场具备安装条件（水电、网络、装修进度等）；因现场条件导致的延期，工期相应顺延。
  3. 设备品牌、型号以附件为准；如需变更，双方协商一致后另行确认，费用多退少补。
  4. 质保期内，非人为损坏的设备故障由乙方免费维修或更换；人为损坏、不可抗力及质保期外的维修按实际成本收费。
  5. 安装调试完成后，甲方应在 3 日内组织验收；逾期未验收且已实际使用的，视为验收合格。
  6. 本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。';
  ALTER TABLE "_company_settings_v" ADD COLUMN "version_document_defaults" jsonb;
  ALTER TABLE "_company_settings_v" ADD COLUMN "version_disabled_plugins" jsonb;
  ALTER TABLE "contracts_payments" ADD CONSTRAINT "contracts_payments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contracts" ADD CONSTRAINT "contracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contracts_rels" ADD CONSTRAINT "contracts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contracts_rels" ADD CONSTRAINT "contracts_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "contracts_rels" ADD CONSTRAINT "contracts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contracts_v_version_payments" ADD CONSTRAINT "_contracts_v_version_payments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_contracts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contracts_v" ADD CONSTRAINT "_contracts_v_parent_id_contracts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contracts_v" ADD CONSTRAINT "_contracts_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contracts_v" ADD CONSTRAINT "_contracts_v_version_quote_id_quotes_id_fk" FOREIGN KEY ("version_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_contracts_v_rels" ADD CONSTRAINT "_contracts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_contracts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contracts_v_rels" ADD CONSTRAINT "_contracts_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_contracts_v_rels" ADD CONSTRAINT "_contracts_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_conversations_rels" ADD CONSTRAINT "ai_conversations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_conversations_rels" ADD CONSTRAINT "ai_conversations_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_conversations_rels" ADD CONSTRAINT "ai_conversations_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v" ADD CONSTRAINT "_ai_conversations_v_parent_id_ai_conversations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v" ADD CONSTRAINT "_ai_conversations_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v" ADD CONSTRAINT "_ai_conversations_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v_rels" ADD CONSTRAINT "_ai_conversations_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_ai_conversations_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v_rels" ADD CONSTRAINT "_ai_conversations_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_conversations_v_rels" ADD CONSTRAINT "_ai_conversations_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_messages_rels" ADD CONSTRAINT "ai_messages_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_messages_rels" ADD CONSTRAINT "ai_messages_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_messages_rels" ADD CONSTRAINT "ai_messages_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_messages_v" ADD CONSTRAINT "_ai_messages_v_parent_id_ai_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_messages_v" ADD CONSTRAINT "_ai_messages_v_version_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("version_conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_messages_v" ADD CONSTRAINT "_ai_messages_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_messages_v_rels" ADD CONSTRAINT "_ai_messages_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_ai_messages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_messages_v_rels" ADD CONSTRAINT "_ai_messages_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_messages_v_rels" ADD CONSTRAINT "_ai_messages_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_credit_ledger_rels" ADD CONSTRAINT "ai_credit_ledger_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_credit_ledger"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_credit_ledger_rels" ADD CONSTRAINT "ai_credit_ledger_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ai_credit_ledger_rels" ADD CONSTRAINT "ai_credit_ledger_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v" ADD CONSTRAINT "_ai_credit_ledger_v_parent_id_ai_credit_ledger_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ai_credit_ledger"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v" ADD CONSTRAINT "_ai_credit_ledger_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v" ADD CONSTRAINT "_ai_credit_ledger_v_version_message_id_ai_messages_id_fk" FOREIGN KEY ("version_message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v_rels" ADD CONSTRAINT "_ai_credit_ledger_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_ai_credit_ledger_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v_rels" ADD CONSTRAINT "_ai_credit_ledger_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_ai_credit_ledger_v_rels" ADD CONSTRAINT "_ai_credit_ledger_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "contracts_payments_order_idx" ON "contracts_payments" USING btree ("_order");
  CREATE INDEX "contracts_payments_parent_id_idx" ON "contracts_payments" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "contracts_number_idx" ON "contracts" USING btree ("number");
  CREATE UNIQUE INDEX "contracts_project_idx" ON "contracts" USING btree ("project_id");
  CREATE INDEX "contracts_quote_idx" ON "contracts" USING btree ("quote_id");
  CREATE INDEX "contracts_updated_at_idx" ON "contracts" USING btree ("updated_at");
  CREATE INDEX "contracts_created_at_idx" ON "contracts" USING btree ("created_at");
  CREATE INDEX "contracts_rels_order_idx" ON "contracts_rels" USING btree ("order");
  CREATE INDEX "contracts_rels_parent_idx" ON "contracts_rels" USING btree ("parent_id");
  CREATE INDEX "contracts_rels_path_idx" ON "contracts_rels" USING btree ("path");
  CREATE INDEX "contracts_rels_admins_id_idx" ON "contracts_rels" USING btree ("admins_id");
  CREATE INDEX "contracts_rels_users_id_idx" ON "contracts_rels" USING btree ("users_id");
  CREATE INDEX "_contracts_v_version_payments_order_idx" ON "_contracts_v_version_payments" USING btree ("_order");
  CREATE INDEX "_contracts_v_version_payments_parent_id_idx" ON "_contracts_v_version_payments" USING btree ("_parent_id");
  CREATE INDEX "_contracts_v_parent_idx" ON "_contracts_v" USING btree ("parent_id");
  CREATE INDEX "_contracts_v_version_version_number_idx" ON "_contracts_v" USING btree ("version_number");
  CREATE INDEX "_contracts_v_version_version_project_idx" ON "_contracts_v" USING btree ("version_project_id");
  CREATE INDEX "_contracts_v_version_version_quote_idx" ON "_contracts_v" USING btree ("version_quote_id");
  CREATE INDEX "_contracts_v_version_version_updated_at_idx" ON "_contracts_v" USING btree ("version_updated_at");
  CREATE INDEX "_contracts_v_version_version_created_at_idx" ON "_contracts_v" USING btree ("version_created_at");
  CREATE INDEX "_contracts_v_created_at_idx" ON "_contracts_v" USING btree ("created_at");
  CREATE INDEX "_contracts_v_updated_at_idx" ON "_contracts_v" USING btree ("updated_at");
  CREATE INDEX "_contracts_v_rels_order_idx" ON "_contracts_v_rels" USING btree ("order");
  CREATE INDEX "_contracts_v_rels_parent_idx" ON "_contracts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_contracts_v_rels_path_idx" ON "_contracts_v_rels" USING btree ("path");
  CREATE INDEX "_contracts_v_rels_admins_id_idx" ON "_contracts_v_rels" USING btree ("admins_id");
  CREATE INDEX "_contracts_v_rels_users_id_idx" ON "_contracts_v_rels" USING btree ("users_id");
  CREATE INDEX "ai_conversations_owner_idx" ON "ai_conversations" USING btree ("owner_id");
  CREATE INDEX "ai_conversations_project_idx" ON "ai_conversations" USING btree ("project_id");
  CREATE INDEX "ai_conversations_updated_at_idx" ON "ai_conversations" USING btree ("updated_at");
  CREATE INDEX "ai_conversations_created_at_idx" ON "ai_conversations" USING btree ("created_at");
  CREATE INDEX "ai_conversations_rels_order_idx" ON "ai_conversations_rels" USING btree ("order");
  CREATE INDEX "ai_conversations_rels_parent_idx" ON "ai_conversations_rels" USING btree ("parent_id");
  CREATE INDEX "ai_conversations_rels_path_idx" ON "ai_conversations_rels" USING btree ("path");
  CREATE INDEX "ai_conversations_rels_admins_id_idx" ON "ai_conversations_rels" USING btree ("admins_id");
  CREATE INDEX "ai_conversations_rels_users_id_idx" ON "ai_conversations_rels" USING btree ("users_id");
  CREATE INDEX "_ai_conversations_v_parent_idx" ON "_ai_conversations_v" USING btree ("parent_id");
  CREATE INDEX "_ai_conversations_v_version_version_owner_idx" ON "_ai_conversations_v" USING btree ("version_owner_id");
  CREATE INDEX "_ai_conversations_v_version_version_project_idx" ON "_ai_conversations_v" USING btree ("version_project_id");
  CREATE INDEX "_ai_conversations_v_version_version_updated_at_idx" ON "_ai_conversations_v" USING btree ("version_updated_at");
  CREATE INDEX "_ai_conversations_v_version_version_created_at_idx" ON "_ai_conversations_v" USING btree ("version_created_at");
  CREATE INDEX "_ai_conversations_v_created_at_idx" ON "_ai_conversations_v" USING btree ("created_at");
  CREATE INDEX "_ai_conversations_v_updated_at_idx" ON "_ai_conversations_v" USING btree ("updated_at");
  CREATE INDEX "_ai_conversations_v_rels_order_idx" ON "_ai_conversations_v_rels" USING btree ("order");
  CREATE INDEX "_ai_conversations_v_rels_parent_idx" ON "_ai_conversations_v_rels" USING btree ("parent_id");
  CREATE INDEX "_ai_conversations_v_rels_path_idx" ON "_ai_conversations_v_rels" USING btree ("path");
  CREATE INDEX "_ai_conversations_v_rels_admins_id_idx" ON "_ai_conversations_v_rels" USING btree ("admins_id");
  CREATE INDEX "_ai_conversations_v_rels_users_id_idx" ON "_ai_conversations_v_rels" USING btree ("users_id");
  CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");
  CREATE INDEX "ai_messages_owner_idx" ON "ai_messages" USING btree ("owner_id");
  CREATE INDEX "ai_messages_updated_at_idx" ON "ai_messages" USING btree ("updated_at");
  CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages" USING btree ("created_at");
  CREATE INDEX "ai_messages_rels_order_idx" ON "ai_messages_rels" USING btree ("order");
  CREATE INDEX "ai_messages_rels_parent_idx" ON "ai_messages_rels" USING btree ("parent_id");
  CREATE INDEX "ai_messages_rels_path_idx" ON "ai_messages_rels" USING btree ("path");
  CREATE INDEX "ai_messages_rels_admins_id_idx" ON "ai_messages_rels" USING btree ("admins_id");
  CREATE INDEX "ai_messages_rels_users_id_idx" ON "ai_messages_rels" USING btree ("users_id");
  CREATE INDEX "_ai_messages_v_parent_idx" ON "_ai_messages_v" USING btree ("parent_id");
  CREATE INDEX "_ai_messages_v_version_version_conversation_idx" ON "_ai_messages_v" USING btree ("version_conversation_id");
  CREATE INDEX "_ai_messages_v_version_version_owner_idx" ON "_ai_messages_v" USING btree ("version_owner_id");
  CREATE INDEX "_ai_messages_v_version_version_updated_at_idx" ON "_ai_messages_v" USING btree ("version_updated_at");
  CREATE INDEX "_ai_messages_v_version_version_created_at_idx" ON "_ai_messages_v" USING btree ("version_created_at");
  CREATE INDEX "_ai_messages_v_created_at_idx" ON "_ai_messages_v" USING btree ("created_at");
  CREATE INDEX "_ai_messages_v_updated_at_idx" ON "_ai_messages_v" USING btree ("updated_at");
  CREATE INDEX "_ai_messages_v_rels_order_idx" ON "_ai_messages_v_rels" USING btree ("order");
  CREATE INDEX "_ai_messages_v_rels_parent_idx" ON "_ai_messages_v_rels" USING btree ("parent_id");
  CREATE INDEX "_ai_messages_v_rels_path_idx" ON "_ai_messages_v_rels" USING btree ("path");
  CREATE INDEX "_ai_messages_v_rels_admins_id_idx" ON "_ai_messages_v_rels" USING btree ("admins_id");
  CREATE INDEX "_ai_messages_v_rels_users_id_idx" ON "_ai_messages_v_rels" USING btree ("users_id");
  CREATE INDEX "ai_credit_ledger_user_idx" ON "ai_credit_ledger" USING btree ("user_id");
  CREATE INDEX "ai_credit_ledger_message_idx" ON "ai_credit_ledger" USING btree ("message_id");
  CREATE INDEX "ai_credit_ledger_updated_at_idx" ON "ai_credit_ledger" USING btree ("updated_at");
  CREATE INDEX "ai_credit_ledger_created_at_idx" ON "ai_credit_ledger" USING btree ("created_at");
  CREATE INDEX "ai_credit_ledger_rels_order_idx" ON "ai_credit_ledger_rels" USING btree ("order");
  CREATE INDEX "ai_credit_ledger_rels_parent_idx" ON "ai_credit_ledger_rels" USING btree ("parent_id");
  CREATE INDEX "ai_credit_ledger_rels_path_idx" ON "ai_credit_ledger_rels" USING btree ("path");
  CREATE INDEX "ai_credit_ledger_rels_admins_id_idx" ON "ai_credit_ledger_rels" USING btree ("admins_id");
  CREATE INDEX "ai_credit_ledger_rels_users_id_idx" ON "ai_credit_ledger_rels" USING btree ("users_id");
  CREATE INDEX "_ai_credit_ledger_v_parent_idx" ON "_ai_credit_ledger_v" USING btree ("parent_id");
  CREATE INDEX "_ai_credit_ledger_v_version_version_user_idx" ON "_ai_credit_ledger_v" USING btree ("version_user_id");
  CREATE INDEX "_ai_credit_ledger_v_version_version_message_idx" ON "_ai_credit_ledger_v" USING btree ("version_message_id");
  CREATE INDEX "_ai_credit_ledger_v_version_version_updated_at_idx" ON "_ai_credit_ledger_v" USING btree ("version_updated_at");
  CREATE INDEX "_ai_credit_ledger_v_version_version_created_at_idx" ON "_ai_credit_ledger_v" USING btree ("version_created_at");
  CREATE INDEX "_ai_credit_ledger_v_created_at_idx" ON "_ai_credit_ledger_v" USING btree ("created_at");
  CREATE INDEX "_ai_credit_ledger_v_updated_at_idx" ON "_ai_credit_ledger_v" USING btree ("updated_at");
  CREATE INDEX "_ai_credit_ledger_v_rels_order_idx" ON "_ai_credit_ledger_v_rels" USING btree ("order");
  CREATE INDEX "_ai_credit_ledger_v_rels_parent_idx" ON "_ai_credit_ledger_v_rels" USING btree ("parent_id");
  CREATE INDEX "_ai_credit_ledger_v_rels_path_idx" ON "_ai_credit_ledger_v_rels" USING btree ("path");
  CREATE INDEX "_ai_credit_ledger_v_rels_admins_id_idx" ON "_ai_credit_ledger_v_rels" USING btree ("admins_id");
  CREATE INDEX "_ai_credit_ledger_v_rels_users_id_idx" ON "_ai_credit_ledger_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contracts_fk" FOREIGN KEY ("contracts_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_conversations_fk" FOREIGN KEY ("ai_conversations_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_messages_fk" FOREIGN KEY ("ai_messages_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_credit_ledger_fk" FOREIGN KEY ("ai_credit_ledger_id") REFERENCES "public"."ai_credit_ledger"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contracts_id_idx" ON "payload_locked_documents_rels" USING btree ("contracts_id");
  CREATE INDEX "payload_locked_documents_rels_ai_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_conversations_id");
  CREATE INDEX "payload_locked_documents_rels_ai_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_messages_id");
  CREATE INDEX "payload_locked_documents_rels_ai_credit_ledger_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_credit_ledger_id");
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "_users_v" DROP COLUMN "version_role";
  ALTER TABLE "projects" DROP COLUMN "stage";
  ALTER TABLE "projects" DROP COLUMN "risk_level";
  ALTER TABLE "projects" DROP COLUMN "waiting_on";
  ALTER TABLE "projects" DROP COLUMN "risk_note";
  ALTER TABLE "projects" DROP COLUMN "next_action";
  ALTER TABLE "projects" DROP COLUMN "next_action_due_at";
  ALTER TABLE "_projects_v" DROP COLUMN "version_stage";
  ALTER TABLE "_projects_v" DROP COLUMN "version_risk_level";
  ALTER TABLE "_projects_v" DROP COLUMN "version_waiting_on";
  ALTER TABLE "_projects_v" DROP COLUMN "version_risk_note";
  ALTER TABLE "_projects_v" DROP COLUMN "version_next_action";
  ALTER TABLE "_projects_v" DROP COLUMN "version_next_action_due_at";
  ALTER TABLE "media" DROP COLUMN "prefix";
  ALTER TABLE "media" DROP COLUMN "_objectkey";
  ALTER TABLE "_media_v" DROP COLUMN "version_prefix";
  ALTER TABLE "_media_v" DROP COLUMN "version__objectkey";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum__users_v_version_role";
  DROP TYPE "public"."enum_projects_stage";
  DROP TYPE "public"."enum_projects_risk_level";
  DROP TYPE "public"."enum_projects_waiting_on";
  DROP TYPE "public"."enum__projects_v_version_stage";
  DROP TYPE "public"."enum__projects_v_version_risk_level";
  DROP TYPE "public"."enum__projects_v_version_waiting_on";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'manager', 'designer', 'sales', 'viewer');
  CREATE TYPE "public"."enum__users_v_version_role" AS ENUM('admin', 'manager', 'designer', 'sales', 'viewer');
  CREATE TYPE "public"."enum_projects_stage" AS ENUM('new', 'measure', 'proposal', 'contract', 'install', 'acceptance', 'aftercare');
  CREATE TYPE "public"."enum_projects_risk_level" AS ENUM('normal', 'watch', 'blocked');
  CREATE TYPE "public"."enum_projects_waiting_on" AS ENUM('none', 'customer', 'internal', 'vendor');
  CREATE TYPE "public"."enum__projects_v_version_stage" AS ENUM('new', 'measure', 'proposal', 'contract', 'install', 'acceptance', 'aftercare');
  CREATE TYPE "public"."enum__projects_v_version_risk_level" AS ENUM('normal', 'watch', 'blocked');
  CREATE TYPE "public"."enum__projects_v_version_waiting_on" AS ENUM('none', 'customer', 'internal', 'vendor');
  ALTER TYPE "public"."enum_projects_status" ADD VALUE 'paused' BEFORE 'archived';
  ALTER TYPE "public"."enum_projects_status" ADD VALUE 'canceled' BEFORE 'archived';
  ALTER TYPE "public"."enum__projects_v_version_status" ADD VALUE 'paused' BEFORE 'archived';
  ALTER TYPE "public"."enum__projects_v_version_status" ADD VALUE 'canceled' BEFORE 'archived';
  ALTER TABLE "contracts_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contracts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contracts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contracts_v_version_payments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contracts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_contracts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_conversations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_conversations_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_conversations_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_conversations_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_messages_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_messages_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_messages_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_credit_ledger" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_credit_ledger_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_credit_ledger_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_ai_credit_ledger_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contracts_payments" CASCADE;
  DROP TABLE "contracts" CASCADE;
  DROP TABLE "contracts_rels" CASCADE;
  DROP TABLE "_contracts_v_version_payments" CASCADE;
  DROP TABLE "_contracts_v" CASCADE;
  DROP TABLE "_contracts_v_rels" CASCADE;
  DROP TABLE "ai_conversations" CASCADE;
  DROP TABLE "ai_conversations_rels" CASCADE;
  DROP TABLE "_ai_conversations_v" CASCADE;
  DROP TABLE "_ai_conversations_v_rels" CASCADE;
  DROP TABLE "ai_messages" CASCADE;
  DROP TABLE "ai_messages_rels" CASCADE;
  DROP TABLE "_ai_messages_v" CASCADE;
  DROP TABLE "_ai_messages_v_rels" CASCADE;
  DROP TABLE "ai_credit_ledger" CASCADE;
  DROP TABLE "ai_credit_ledger_rels" CASCADE;
  DROP TABLE "_ai_credit_ledger_v" CASCADE;
  DROP TABLE "_ai_credit_ledger_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contracts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_conversations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_messages_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_credit_ledger_fk";
  
  DROP INDEX "payload_locked_documents_rels_contracts_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_conversations_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_messages_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_credit_ledger_id_idx";
  ALTER TABLE "projects" ALTER COLUMN "customer_name" SET NOT NULL;
  ALTER TABLE "_projects_v" ALTER COLUMN "version_customer_name" SET NOT NULL;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'sales' NOT NULL;
  ALTER TABLE "_users_v" ADD COLUMN "version_role" "enum__users_v_version_role" DEFAULT 'sales' NOT NULL;
  ALTER TABLE "projects" ADD COLUMN "stage" "enum_projects_stage" DEFAULT 'new' NOT NULL;
  ALTER TABLE "projects" ADD COLUMN "risk_level" "enum_projects_risk_level" DEFAULT 'normal';
  ALTER TABLE "projects" ADD COLUMN "waiting_on" "enum_projects_waiting_on" DEFAULT 'none';
  ALTER TABLE "projects" ADD COLUMN "risk_note" varchar;
  ALTER TABLE "projects" ADD COLUMN "next_action" varchar;
  ALTER TABLE "projects" ADD COLUMN "next_action_due_at" timestamp(3) with time zone;
  ALTER TABLE "_projects_v" ADD COLUMN "version_stage" "enum__projects_v_version_stage" DEFAULT 'new' NOT NULL;
  ALTER TABLE "_projects_v" ADD COLUMN "version_risk_level" "enum__projects_v_version_risk_level" DEFAULT 'normal';
  ALTER TABLE "_projects_v" ADD COLUMN "version_waiting_on" "enum__projects_v_version_waiting_on" DEFAULT 'none';
  ALTER TABLE "_projects_v" ADD COLUMN "version_risk_note" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_next_action" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_next_action_due_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT '';
  ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "_media_v" ADD COLUMN "version_prefix" varchar DEFAULT '';
  ALTER TABLE "_media_v" ADD COLUMN "version__objectkey" varchar;
  CREATE INDEX "projects_stage_idx" ON "projects" USING btree ("stage");
  CREATE INDEX "_projects_v_version_version_stage_idx" ON "_projects_v" USING btree ("version_stage");
  ALTER TABLE "users" DROP COLUMN "ai_credits";
  ALTER TABLE "_users_v" DROP COLUMN "version_ai_credits";
  ALTER TABLE "projects" DROP COLUMN "archived_at";
  ALTER TABLE "projects" DROP COLUMN "point_count";
  ALTER TABLE "_projects_v" DROP COLUMN "version_archived_at";
  ALTER TABLE "_projects_v" DROP COLUMN "version_point_count";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contracts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_conversations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_messages_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_credit_ledger_id";
  ALTER TABLE "company_settings" DROP COLUMN "contract_terms";
  ALTER TABLE "company_settings" DROP COLUMN "document_defaults";
  ALTER TABLE "company_settings" DROP COLUMN "disabled_plugins";
  ALTER TABLE "_company_settings_v" DROP COLUMN "version_contract_terms";
  ALTER TABLE "_company_settings_v" DROP COLUMN "version_document_defaults";
  ALTER TABLE "_company_settings_v" DROP COLUMN "version_disabled_plugins";
  DROP TYPE "public"."enum_contracts_status";
  DROP TYPE "public"."enum__contracts_v_version_status";
  DROP TYPE "public"."enum_ai_messages_role";
  DROP TYPE "public"."enum__ai_messages_v_version_role";`)
}
