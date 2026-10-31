import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_membership_tier" AS ENUM('free', 'pro', 'team');
  CREATE TYPE "public"."enum__users_v_version_membership_tier" AS ENUM('free', 'pro', 'team');
  CREATE TYPE "public"."enum_redemption_codes_grant_tier" AS ENUM('none', 'pro', 'team');
  CREATE TYPE "public"."enum_redemption_codes_status" AS ENUM('active', 'disabled');
  CREATE TYPE "public"."enum__redemption_codes_v_version_grant_tier" AS ENUM('none', 'pro', 'team');
  CREATE TYPE "public"."enum__redemption_codes_v_version_status" AS ENUM('active', 'disabled');
  CREATE TABLE "redemption_codes_redeemed_by" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" uuid NOT NULL,
  	"redeemed_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "redemption_codes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"code" varchar NOT NULL,
  	"label" varchar,
  	"grant_tier" "enum_redemption_codes_grant_tier" DEFAULT 'none' NOT NULL,
  	"duration_days" numeric DEFAULT 30 NOT NULL,
  	"credits" numeric DEFAULT 100 NOT NULL,
  	"max_uses" numeric DEFAULT 1 NOT NULL,
  	"used_count" numeric DEFAULT 0,
  	"status" "enum_redemption_codes_status" DEFAULT 'active' NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redemption_codes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_redemption_codes_v_version_redeemed_by" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"redeemed_at" timestamp(3) with time zone NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_redemption_codes_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_code" varchar NOT NULL,
  	"version_label" varchar,
  	"version_grant_tier" "enum__redemption_codes_v_version_grant_tier" DEFAULT 'none' NOT NULL,
  	"version_duration_days" numeric DEFAULT 30 NOT NULL,
  	"version_credits" numeric DEFAULT 100 NOT NULL,
  	"version_max_uses" numeric DEFAULT 1 NOT NULL,
  	"version_used_count" numeric DEFAULT 0,
  	"version_status" "enum__redemption_codes_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_expires_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_redemption_codes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "users" ALTER COLUMN "ai_credits" SET DEFAULT 20;
  ALTER TABLE "_users_v" ALTER COLUMN "version_ai_credits" SET DEFAULT 20;
  ALTER TABLE "users" ADD COLUMN "membership_tier" "enum_users_membership_tier" DEFAULT 'free' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "membership_expires_at" timestamp(3) with time zone;
  ALTER TABLE "_users_v" ADD COLUMN "version_membership_tier" "enum__users_v_version_membership_tier" DEFAULT 'free' NOT NULL;
  ALTER TABLE "_users_v" ADD COLUMN "version_membership_expires_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "redemption_codes_id" uuid;
  ALTER TABLE "redemption_codes_redeemed_by" ADD CONSTRAINT "redemption_codes_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "redemption_codes_redeemed_by" ADD CONSTRAINT "redemption_codes_redeemed_by_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."redemption_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redemption_codes_rels" ADD CONSTRAINT "redemption_codes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redemption_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redemption_codes_rels" ADD CONSTRAINT "redemption_codes_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redemption_codes_rels" ADD CONSTRAINT "redemption_codes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v_version_redeemed_by" ADD CONSTRAINT "_redemption_codes_v_version_redeemed_by_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v_version_redeemed_by" ADD CONSTRAINT "_redemption_codes_v_version_redeemed_by_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_redemption_codes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v" ADD CONSTRAINT "_redemption_codes_v_parent_id_redemption_codes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redemption_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v_rels" ADD CONSTRAINT "_redemption_codes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_redemption_codes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v_rels" ADD CONSTRAINT "_redemption_codes_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_redemption_codes_v_rels" ADD CONSTRAINT "_redemption_codes_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "redemption_codes_redeemed_by_order_idx" ON "redemption_codes_redeemed_by" USING btree ("_order");
  CREATE INDEX "redemption_codes_redeemed_by_parent_id_idx" ON "redemption_codes_redeemed_by" USING btree ("_parent_id");
  CREATE INDEX "redemption_codes_redeemed_by_user_idx" ON "redemption_codes_redeemed_by" USING btree ("user_id");
  CREATE UNIQUE INDEX "redemption_codes_code_idx" ON "redemption_codes" USING btree ("code");
  CREATE INDEX "redemption_codes_updated_at_idx" ON "redemption_codes" USING btree ("updated_at");
  CREATE INDEX "redemption_codes_created_at_idx" ON "redemption_codes" USING btree ("created_at");
  CREATE INDEX "redemption_codes_rels_order_idx" ON "redemption_codes_rels" USING btree ("order");
  CREATE INDEX "redemption_codes_rels_parent_idx" ON "redemption_codes_rels" USING btree ("parent_id");
  CREATE INDEX "redemption_codes_rels_path_idx" ON "redemption_codes_rels" USING btree ("path");
  CREATE INDEX "redemption_codes_rels_admins_id_idx" ON "redemption_codes_rels" USING btree ("admins_id");
  CREATE INDEX "redemption_codes_rels_users_id_idx" ON "redemption_codes_rels" USING btree ("users_id");
  CREATE INDEX "_redemption_codes_v_version_redeemed_by_order_idx" ON "_redemption_codes_v_version_redeemed_by" USING btree ("_order");
  CREATE INDEX "_redemption_codes_v_version_redeemed_by_parent_id_idx" ON "_redemption_codes_v_version_redeemed_by" USING btree ("_parent_id");
  CREATE INDEX "_redemption_codes_v_version_redeemed_by_user_idx" ON "_redemption_codes_v_version_redeemed_by" USING btree ("user_id");
  CREATE INDEX "_redemption_codes_v_parent_idx" ON "_redemption_codes_v" USING btree ("parent_id");
  CREATE INDEX "_redemption_codes_v_version_version_code_idx" ON "_redemption_codes_v" USING btree ("version_code");
  CREATE INDEX "_redemption_codes_v_version_version_updated_at_idx" ON "_redemption_codes_v" USING btree ("version_updated_at");
  CREATE INDEX "_redemption_codes_v_version_version_created_at_idx" ON "_redemption_codes_v" USING btree ("version_created_at");
  CREATE INDEX "_redemption_codes_v_created_at_idx" ON "_redemption_codes_v" USING btree ("created_at");
  CREATE INDEX "_redemption_codes_v_updated_at_idx" ON "_redemption_codes_v" USING btree ("updated_at");
  CREATE INDEX "_redemption_codes_v_rels_order_idx" ON "_redemption_codes_v_rels" USING btree ("order");
  CREATE INDEX "_redemption_codes_v_rels_parent_idx" ON "_redemption_codes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_redemption_codes_v_rels_path_idx" ON "_redemption_codes_v_rels" USING btree ("path");
  CREATE INDEX "_redemption_codes_v_rels_admins_id_idx" ON "_redemption_codes_v_rels" USING btree ("admins_id");
  CREATE INDEX "_redemption_codes_v_rels_users_id_idx" ON "_redemption_codes_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redemption_codes_fk" FOREIGN KEY ("redemption_codes_id") REFERENCES "public"."redemption_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_redemption_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("redemption_codes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "redemption_codes_redeemed_by" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "redemption_codes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "redemption_codes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_redemption_codes_v_version_redeemed_by" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_redemption_codes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_redemption_codes_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "redemption_codes_redeemed_by" CASCADE;
  DROP TABLE "redemption_codes" CASCADE;
  DROP TABLE "redemption_codes_rels" CASCADE;
  DROP TABLE "_redemption_codes_v_version_redeemed_by" CASCADE;
  DROP TABLE "_redemption_codes_v" CASCADE;
  DROP TABLE "_redemption_codes_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_redemption_codes_fk";
  
  DROP INDEX "payload_locked_documents_rels_redemption_codes_id_idx";
  ALTER TABLE "users" ALTER COLUMN "ai_credits" SET DEFAULT 0;
  ALTER TABLE "_users_v" ALTER COLUMN "version_ai_credits" SET DEFAULT 0;
  ALTER TABLE "users" DROP COLUMN "membership_tier";
  ALTER TABLE "users" DROP COLUMN "membership_expires_at";
  ALTER TABLE "_users_v" DROP COLUMN "version_membership_tier";
  ALTER TABLE "_users_v" DROP COLUMN "version_membership_expires_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "redemption_codes_id";
  DROP TYPE "public"."enum_users_membership_tier";
  DROP TYPE "public"."enum__users_v_version_membership_tier";
  DROP TYPE "public"."enum_redemption_codes_grant_tier";
  DROP TYPE "public"."enum_redemption_codes_status";
  DROP TYPE "public"."enum__redemption_codes_v_version_grant_tier";
  DROP TYPE "public"."enum__redemption_codes_v_version_status";`)
}
