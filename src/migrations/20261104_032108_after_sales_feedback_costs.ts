import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_service_records_type" AS ENUM('acceptance', 'inspection', 'repair', 'replacement', 'remote', 'backup');
  CREATE TYPE "public"."enum_service_records_status" AS ENUM('open', 'scheduled', 'done');
  CREATE TYPE "public"."enum_service_records_billing" AS ENUM('warranty', 'paid', 'free');
  CREATE TYPE "public"."enum__service_records_v_version_type" AS ENUM('acceptance', 'inspection', 'repair', 'replacement', 'remote', 'backup');
  CREATE TYPE "public"."enum__service_records_v_version_status" AS ENUM('open', 'scheduled', 'done');
  CREATE TYPE "public"."enum__service_records_v_version_billing" AS ENUM('warranty', 'paid', 'free');
  CREATE TYPE "public"."enum_client_feedback_decision" AS ENUM('confirm', 'revise');
  CREATE TYPE "public"."enum_client_feedback_status" AS ENUM('new', 'handled');
  CREATE TYPE "public"."enum__client_feedback_v_version_decision" AS ENUM('confirm', 'revise');
  CREATE TYPE "public"."enum__client_feedback_v_version_status" AS ENUM('new', 'handled');
  CREATE TABLE "service_records" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"project_id" uuid NOT NULL,
  	"type" "enum_service_records_type" DEFAULT 'repair' NOT NULL,
  	"service_date" timestamp(3) with time zone NOT NULL,
  	"status" "enum_service_records_status" DEFAULT 'done' NOT NULL,
  	"next_visit_at" timestamp(3) with time zone,
  	"detail" varchar,
  	"devices" varchar,
  	"billing" "enum_service_records_billing" DEFAULT 'warranty' NOT NULL,
  	"fee" numeric,
  	"technician" varchar,
  	"snapshot" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "service_records_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_service_records_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar NOT NULL,
  	"version_project_id" uuid NOT NULL,
  	"version_type" "enum__service_records_v_version_type" DEFAULT 'repair' NOT NULL,
  	"version_service_date" timestamp(3) with time zone NOT NULL,
  	"version_status" "enum__service_records_v_version_status" DEFAULT 'done' NOT NULL,
  	"version_next_visit_at" timestamp(3) with time zone,
  	"version_detail" varchar,
  	"version_devices" varchar,
  	"version_billing" "enum__service_records_v_version_billing" DEFAULT 'warranty' NOT NULL,
  	"version_fee" numeric,
  	"version_technician" varchar,
  	"version_snapshot" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_service_records_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "client_feedback" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar,
  	"project_id" uuid NOT NULL,
  	"quote_id" uuid NOT NULL,
  	"quote_title" varchar,
  	"decision" "enum_client_feedback_decision" DEFAULT 'confirm' NOT NULL,
  	"quote_total" numeric,
  	"intent_total" numeric,
  	"message" varchar,
  	"deferred_items" jsonb,
  	"signature" varchar,
  	"status" "enum_client_feedback_status" DEFAULT 'new' NOT NULL,
  	"handled_at" timestamp(3) with time zone,
  	"handled_by_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "client_feedback_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_client_feedback_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_customer_name" varchar NOT NULL,
  	"version_customer_phone" varchar,
  	"version_project_id" uuid NOT NULL,
  	"version_quote_id" uuid NOT NULL,
  	"version_quote_title" varchar,
  	"version_decision" "enum__client_feedback_v_version_decision" DEFAULT 'confirm' NOT NULL,
  	"version_quote_total" numeric,
  	"version_intent_total" numeric,
  	"version_message" varchar,
  	"version_deferred_items" jsonb,
  	"version_signature" varchar,
  	"version_status" "enum__client_feedback_v_version_status" DEFAULT 'new' NOT NULL,
  	"version_handled_at" timestamp(3) with time zone,
  	"version_handled_by_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_client_feedback_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DATA TYPE text;
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DEFAULT 'symbol'::text;
  DROP TYPE "public"."enum_proposal_templates_markers";
  CREATE TYPE "public"."enum_proposal_templates_markers" AS ENUM('symbol', 'number');
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DEFAULT 'symbol'::"public"."enum_proposal_templates_markers";
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DATA TYPE "public"."enum_proposal_templates_markers" USING "markers"::"public"."enum_proposal_templates_markers";
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DATA TYPE text;
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DEFAULT 'symbol'::text;
  DROP TYPE "public"."enum__proposal_templates_v_version_markers";
  CREATE TYPE "public"."enum__proposal_templates_v_version_markers" AS ENUM('symbol', 'number');
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DEFAULT 'symbol'::"public"."enum__proposal_templates_v_version_markers";
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DATA TYPE "public"."enum__proposal_templates_v_version_markers" USING "version_markers"::"public"."enum__proposal_templates_v_version_markers";
  ALTER TABLE "users" ADD COLUMN "company_profile_cost_settings" jsonb;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_cost_settings" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_records_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "client_feedback_id" uuid;
  ALTER TABLE "service_records" ADD CONSTRAINT "service_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_records_rels" ADD CONSTRAINT "service_records_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_records_rels" ADD CONSTRAINT "service_records_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_records_rels" ADD CONSTRAINT "service_records_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_service_records_v" ADD CONSTRAINT "_service_records_v_parent_id_service_records_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."service_records"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_records_v" ADD CONSTRAINT "_service_records_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_service_records_v_rels" ADD CONSTRAINT "_service_records_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_service_records_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_service_records_v_rels" ADD CONSTRAINT "_service_records_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_service_records_v_rels" ADD CONSTRAINT "_service_records_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_handled_by_id_users_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "client_feedback_rels" ADD CONSTRAINT "client_feedback_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."client_feedback"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "client_feedback_rels" ADD CONSTRAINT "client_feedback_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "client_feedback_rels" ADD CONSTRAINT "client_feedback_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_client_feedback_v" ADD CONSTRAINT "_client_feedback_v_parent_id_client_feedback_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."client_feedback"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_feedback_v" ADD CONSTRAINT "_client_feedback_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_feedback_v" ADD CONSTRAINT "_client_feedback_v_version_quote_id_quotes_id_fk" FOREIGN KEY ("version_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_feedback_v" ADD CONSTRAINT "_client_feedback_v_version_handled_by_id_users_id_fk" FOREIGN KEY ("version_handled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_client_feedback_v_rels" ADD CONSTRAINT "_client_feedback_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_client_feedback_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_client_feedback_v_rels" ADD CONSTRAINT "_client_feedback_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_client_feedback_v_rels" ADD CONSTRAINT "_client_feedback_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "service_records_project_idx" ON "service_records" USING btree ("project_id");
  CREATE INDEX "service_records_type_idx" ON "service_records" USING btree ("type");
  CREATE INDEX "service_records_service_date_idx" ON "service_records" USING btree ("service_date");
  CREATE INDEX "service_records_updated_at_idx" ON "service_records" USING btree ("updated_at");
  CREATE INDEX "service_records_created_at_idx" ON "service_records" USING btree ("created_at");
  CREATE INDEX "service_records_rels_order_idx" ON "service_records_rels" USING btree ("order");
  CREATE INDEX "service_records_rels_parent_idx" ON "service_records_rels" USING btree ("parent_id");
  CREATE INDEX "service_records_rels_path_idx" ON "service_records_rels" USING btree ("path");
  CREATE INDEX "service_records_rels_admins_id_idx" ON "service_records_rels" USING btree ("admins_id");
  CREATE INDEX "service_records_rels_users_id_idx" ON "service_records_rels" USING btree ("users_id");
  CREATE INDEX "_service_records_v_parent_idx" ON "_service_records_v" USING btree ("parent_id");
  CREATE INDEX "_service_records_v_version_version_project_idx" ON "_service_records_v" USING btree ("version_project_id");
  CREATE INDEX "_service_records_v_version_version_type_idx" ON "_service_records_v" USING btree ("version_type");
  CREATE INDEX "_service_records_v_version_version_service_date_idx" ON "_service_records_v" USING btree ("version_service_date");
  CREATE INDEX "_service_records_v_version_version_updated_at_idx" ON "_service_records_v" USING btree ("version_updated_at");
  CREATE INDEX "_service_records_v_version_version_created_at_idx" ON "_service_records_v" USING btree ("version_created_at");
  CREATE INDEX "_service_records_v_created_at_idx" ON "_service_records_v" USING btree ("created_at");
  CREATE INDEX "_service_records_v_updated_at_idx" ON "_service_records_v" USING btree ("updated_at");
  CREATE INDEX "_service_records_v_rels_order_idx" ON "_service_records_v_rels" USING btree ("order");
  CREATE INDEX "_service_records_v_rels_parent_idx" ON "_service_records_v_rels" USING btree ("parent_id");
  CREATE INDEX "_service_records_v_rels_path_idx" ON "_service_records_v_rels" USING btree ("path");
  CREATE INDEX "_service_records_v_rels_admins_id_idx" ON "_service_records_v_rels" USING btree ("admins_id");
  CREATE INDEX "_service_records_v_rels_users_id_idx" ON "_service_records_v_rels" USING btree ("users_id");
  CREATE INDEX "client_feedback_project_idx" ON "client_feedback" USING btree ("project_id");
  CREATE INDEX "client_feedback_quote_idx" ON "client_feedback" USING btree ("quote_id");
  CREATE INDEX "client_feedback_status_idx" ON "client_feedback" USING btree ("status");
  CREATE INDEX "client_feedback_handled_by_idx" ON "client_feedback" USING btree ("handled_by_id");
  CREATE INDEX "client_feedback_updated_at_idx" ON "client_feedback" USING btree ("updated_at");
  CREATE INDEX "client_feedback_created_at_idx" ON "client_feedback" USING btree ("created_at");
  CREATE INDEX "client_feedback_rels_order_idx" ON "client_feedback_rels" USING btree ("order");
  CREATE INDEX "client_feedback_rels_parent_idx" ON "client_feedback_rels" USING btree ("parent_id");
  CREATE INDEX "client_feedback_rels_path_idx" ON "client_feedback_rels" USING btree ("path");
  CREATE INDEX "client_feedback_rels_admins_id_idx" ON "client_feedback_rels" USING btree ("admins_id");
  CREATE INDEX "client_feedback_rels_users_id_idx" ON "client_feedback_rels" USING btree ("users_id");
  CREATE INDEX "_client_feedback_v_parent_idx" ON "_client_feedback_v" USING btree ("parent_id");
  CREATE INDEX "_client_feedback_v_version_version_project_idx" ON "_client_feedback_v" USING btree ("version_project_id");
  CREATE INDEX "_client_feedback_v_version_version_quote_idx" ON "_client_feedback_v" USING btree ("version_quote_id");
  CREATE INDEX "_client_feedback_v_version_version_status_idx" ON "_client_feedback_v" USING btree ("version_status");
  CREATE INDEX "_client_feedback_v_version_version_handled_by_idx" ON "_client_feedback_v" USING btree ("version_handled_by_id");
  CREATE INDEX "_client_feedback_v_version_version_updated_at_idx" ON "_client_feedback_v" USING btree ("version_updated_at");
  CREATE INDEX "_client_feedback_v_version_version_created_at_idx" ON "_client_feedback_v" USING btree ("version_created_at");
  CREATE INDEX "_client_feedback_v_created_at_idx" ON "_client_feedback_v" USING btree ("created_at");
  CREATE INDEX "_client_feedback_v_updated_at_idx" ON "_client_feedback_v" USING btree ("updated_at");
  CREATE INDEX "_client_feedback_v_rels_order_idx" ON "_client_feedback_v_rels" USING btree ("order");
  CREATE INDEX "_client_feedback_v_rels_parent_idx" ON "_client_feedback_v_rels" USING btree ("parent_id");
  CREATE INDEX "_client_feedback_v_rels_path_idx" ON "_client_feedback_v_rels" USING btree ("path");
  CREATE INDEX "_client_feedback_v_rels_admins_id_idx" ON "_client_feedback_v_rels" USING btree ("admins_id");
  CREATE INDEX "_client_feedback_v_rels_users_id_idx" ON "_client_feedback_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_records_fk" FOREIGN KEY ("service_records_id") REFERENCES "public"."service_records"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_client_feedback_fk" FOREIGN KEY ("client_feedback_id") REFERENCES "public"."client_feedback"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_service_records_id_idx" ON "payload_locked_documents_rels" USING btree ("service_records_id");
  CREATE INDEX "payload_locked_documents_rels_client_feedback_id_idx" ON "payload_locked_documents_rels" USING btree ("client_feedback_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "service_records" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "service_records_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_service_records_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_service_records_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "client_feedback" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "client_feedback_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_client_feedback_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_client_feedback_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "service_records" CASCADE;
  DROP TABLE "service_records_rels" CASCADE;
  DROP TABLE "_service_records_v" CASCADE;
  DROP TABLE "_service_records_v_rels" CASCADE;
  DROP TABLE "client_feedback" CASCADE;
  DROP TABLE "client_feedback_rels" CASCADE;
  DROP TABLE "_client_feedback_v" CASCADE;
  DROP TABLE "_client_feedback_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_service_records_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_client_feedback_fk";
  
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DATA TYPE text;
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DEFAULT 'number'::text;
  DROP TYPE "public"."enum_proposal_templates_markers";
  CREATE TYPE "public"."enum_proposal_templates_markers" AS ENUM('number', 'symbol');
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DEFAULT 'number'::"public"."enum_proposal_templates_markers";
  ALTER TABLE "proposal_templates" ALTER COLUMN "markers" SET DATA TYPE "public"."enum_proposal_templates_markers" USING "markers"::"public"."enum_proposal_templates_markers";
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DATA TYPE text;
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DEFAULT 'number'::text;
  DROP TYPE "public"."enum__proposal_templates_v_version_markers";
  CREATE TYPE "public"."enum__proposal_templates_v_version_markers" AS ENUM('number', 'symbol');
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DEFAULT 'number'::"public"."enum__proposal_templates_v_version_markers";
  ALTER TABLE "_proposal_templates_v" ALTER COLUMN "version_markers" SET DATA TYPE "public"."enum__proposal_templates_v_version_markers" USING "version_markers"::"public"."enum__proposal_templates_v_version_markers";
  DROP INDEX "payload_locked_documents_rels_service_records_id_idx";
  DROP INDEX "payload_locked_documents_rels_client_feedback_id_idx";
  ALTER TABLE "users" DROP COLUMN "company_profile_cost_settings";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_cost_settings";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "service_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "client_feedback_id";
  DROP TYPE "public"."enum_service_records_type";
  DROP TYPE "public"."enum_service_records_status";
  DROP TYPE "public"."enum_service_records_billing";
  DROP TYPE "public"."enum__service_records_v_version_type";
  DROP TYPE "public"."enum__service_records_v_version_status";
  DROP TYPE "public"."enum__service_records_v_version_billing";
  DROP TYPE "public"."enum_client_feedback_decision";
  DROP TYPE "public"."enum_client_feedback_status";
  DROP TYPE "public"."enum__client_feedback_v_version_decision";
  DROP TYPE "public"."enum__client_feedback_v_version_status";`)
}
