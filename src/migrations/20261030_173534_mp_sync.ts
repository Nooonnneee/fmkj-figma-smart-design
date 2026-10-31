import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mp_sessions_kind" AS ENUM('session', 'bind', 'web-ticket', 'web');
  CREATE TYPE "public"."enum__mp_sessions_v_version_kind" AS ENUM('session', 'bind', 'web-ticket', 'web');
  CREATE TABLE "wechat_accounts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"openid" varchar NOT NULL,
  	"unionid" varchar,
  	"user_id" uuid NOT NULL,
  	"nickname" varchar,
  	"last_login_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wechat_accounts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_wechat_accounts_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_openid" varchar NOT NULL,
  	"version_unionid" varchar,
  	"version_user_id" uuid NOT NULL,
  	"version_nickname" varchar,
  	"version_last_login_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_wechat_accounts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "mp_sessions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"kind" "enum_mp_sessions_kind" DEFAULT 'session' NOT NULL,
  	"user_id" uuid,
  	"openid" varchar,
  	"unionid" varchar,
  	"redirect" varchar,
  	"client" varchar,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"last_used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mp_sessions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_mp_sessions_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_token_hash" varchar NOT NULL,
  	"version_kind" "enum__mp_sessions_v_version_kind" DEFAULT 'session' NOT NULL,
  	"version_user_id" uuid,
  	"version_openid" varchar,
  	"version_unionid" varchar,
  	"version_redirect" varchar,
  	"version_client" varchar,
  	"version_expires_at" timestamp(3) with time zone NOT NULL,
  	"version_last_used_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_mp_sessions_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "wechat_accounts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mp_sessions_id" uuid;
  ALTER TABLE "wechat_accounts" ADD CONSTRAINT "wechat_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wechat_accounts_rels" ADD CONSTRAINT "wechat_accounts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wechat_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wechat_accounts_rels" ADD CONSTRAINT "wechat_accounts_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wechat_accounts_rels" ADD CONSTRAINT "wechat_accounts_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_wechat_accounts_v" ADD CONSTRAINT "_wechat_accounts_v_parent_id_wechat_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wechat_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_wechat_accounts_v" ADD CONSTRAINT "_wechat_accounts_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_wechat_accounts_v_rels" ADD CONSTRAINT "_wechat_accounts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_wechat_accounts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_wechat_accounts_v_rels" ADD CONSTRAINT "_wechat_accounts_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_wechat_accounts_v_rels" ADD CONSTRAINT "_wechat_accounts_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mp_sessions" ADD CONSTRAINT "mp_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mp_sessions_rels" ADD CONSTRAINT "mp_sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mp_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mp_sessions_rels" ADD CONSTRAINT "mp_sessions_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mp_sessions_rels" ADD CONSTRAINT "mp_sessions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mp_sessions_v" ADD CONSTRAINT "_mp_sessions_v_parent_id_mp_sessions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mp_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mp_sessions_v" ADD CONSTRAINT "_mp_sessions_v_version_user_id_users_id_fk" FOREIGN KEY ("version_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_mp_sessions_v_rels" ADD CONSTRAINT "_mp_sessions_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_mp_sessions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mp_sessions_v_rels" ADD CONSTRAINT "_mp_sessions_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_mp_sessions_v_rels" ADD CONSTRAINT "_mp_sessions_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "wechat_accounts_openid_idx" ON "wechat_accounts" USING btree ("openid");
  CREATE INDEX "wechat_accounts_unionid_idx" ON "wechat_accounts" USING btree ("unionid");
  CREATE INDEX "wechat_accounts_user_idx" ON "wechat_accounts" USING btree ("user_id");
  CREATE INDEX "wechat_accounts_updated_at_idx" ON "wechat_accounts" USING btree ("updated_at");
  CREATE INDEX "wechat_accounts_created_at_idx" ON "wechat_accounts" USING btree ("created_at");
  CREATE INDEX "wechat_accounts_rels_order_idx" ON "wechat_accounts_rels" USING btree ("order");
  CREATE INDEX "wechat_accounts_rels_parent_idx" ON "wechat_accounts_rels" USING btree ("parent_id");
  CREATE INDEX "wechat_accounts_rels_path_idx" ON "wechat_accounts_rels" USING btree ("path");
  CREATE INDEX "wechat_accounts_rels_admins_id_idx" ON "wechat_accounts_rels" USING btree ("admins_id");
  CREATE INDEX "wechat_accounts_rels_users_id_idx" ON "wechat_accounts_rels" USING btree ("users_id");
  CREATE INDEX "_wechat_accounts_v_parent_idx" ON "_wechat_accounts_v" USING btree ("parent_id");
  CREATE INDEX "_wechat_accounts_v_version_version_openid_idx" ON "_wechat_accounts_v" USING btree ("version_openid");
  CREATE INDEX "_wechat_accounts_v_version_version_unionid_idx" ON "_wechat_accounts_v" USING btree ("version_unionid");
  CREATE INDEX "_wechat_accounts_v_version_version_user_idx" ON "_wechat_accounts_v" USING btree ("version_user_id");
  CREATE INDEX "_wechat_accounts_v_version_version_updated_at_idx" ON "_wechat_accounts_v" USING btree ("version_updated_at");
  CREATE INDEX "_wechat_accounts_v_version_version_created_at_idx" ON "_wechat_accounts_v" USING btree ("version_created_at");
  CREATE INDEX "_wechat_accounts_v_created_at_idx" ON "_wechat_accounts_v" USING btree ("created_at");
  CREATE INDEX "_wechat_accounts_v_updated_at_idx" ON "_wechat_accounts_v" USING btree ("updated_at");
  CREATE INDEX "_wechat_accounts_v_rels_order_idx" ON "_wechat_accounts_v_rels" USING btree ("order");
  CREATE INDEX "_wechat_accounts_v_rels_parent_idx" ON "_wechat_accounts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_wechat_accounts_v_rels_path_idx" ON "_wechat_accounts_v_rels" USING btree ("path");
  CREATE INDEX "_wechat_accounts_v_rels_admins_id_idx" ON "_wechat_accounts_v_rels" USING btree ("admins_id");
  CREATE INDEX "_wechat_accounts_v_rels_users_id_idx" ON "_wechat_accounts_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "mp_sessions_token_hash_idx" ON "mp_sessions" USING btree ("token_hash");
  CREATE INDEX "mp_sessions_kind_idx" ON "mp_sessions" USING btree ("kind");
  CREATE INDEX "mp_sessions_user_idx" ON "mp_sessions" USING btree ("user_id");
  CREATE INDEX "mp_sessions_expires_at_idx" ON "mp_sessions" USING btree ("expires_at");
  CREATE INDEX "mp_sessions_updated_at_idx" ON "mp_sessions" USING btree ("updated_at");
  CREATE INDEX "mp_sessions_created_at_idx" ON "mp_sessions" USING btree ("created_at");
  CREATE INDEX "mp_sessions_rels_order_idx" ON "mp_sessions_rels" USING btree ("order");
  CREATE INDEX "mp_sessions_rels_parent_idx" ON "mp_sessions_rels" USING btree ("parent_id");
  CREATE INDEX "mp_sessions_rels_path_idx" ON "mp_sessions_rels" USING btree ("path");
  CREATE INDEX "mp_sessions_rels_admins_id_idx" ON "mp_sessions_rels" USING btree ("admins_id");
  CREATE INDEX "mp_sessions_rels_users_id_idx" ON "mp_sessions_rels" USING btree ("users_id");
  CREATE INDEX "_mp_sessions_v_parent_idx" ON "_mp_sessions_v" USING btree ("parent_id");
  CREATE INDEX "_mp_sessions_v_version_version_token_hash_idx" ON "_mp_sessions_v" USING btree ("version_token_hash");
  CREATE INDEX "_mp_sessions_v_version_version_kind_idx" ON "_mp_sessions_v" USING btree ("version_kind");
  CREATE INDEX "_mp_sessions_v_version_version_user_idx" ON "_mp_sessions_v" USING btree ("version_user_id");
  CREATE INDEX "_mp_sessions_v_version_version_expires_at_idx" ON "_mp_sessions_v" USING btree ("version_expires_at");
  CREATE INDEX "_mp_sessions_v_version_version_updated_at_idx" ON "_mp_sessions_v" USING btree ("version_updated_at");
  CREATE INDEX "_mp_sessions_v_version_version_created_at_idx" ON "_mp_sessions_v" USING btree ("version_created_at");
  CREATE INDEX "_mp_sessions_v_created_at_idx" ON "_mp_sessions_v" USING btree ("created_at");
  CREATE INDEX "_mp_sessions_v_updated_at_idx" ON "_mp_sessions_v" USING btree ("updated_at");
  CREATE INDEX "_mp_sessions_v_rels_order_idx" ON "_mp_sessions_v_rels" USING btree ("order");
  CREATE INDEX "_mp_sessions_v_rels_parent_idx" ON "_mp_sessions_v_rels" USING btree ("parent_id");
  CREATE INDEX "_mp_sessions_v_rels_path_idx" ON "_mp_sessions_v_rels" USING btree ("path");
  CREATE INDEX "_mp_sessions_v_rels_admins_id_idx" ON "_mp_sessions_v_rels" USING btree ("admins_id");
  CREATE INDEX "_mp_sessions_v_rels_users_id_idx" ON "_mp_sessions_v_rels" USING btree ("users_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wechat_accounts_fk" FOREIGN KEY ("wechat_accounts_id") REFERENCES "public"."wechat_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mp_sessions_fk" FOREIGN KEY ("mp_sessions_id") REFERENCES "public"."mp_sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_wechat_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("wechat_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_mp_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("mp_sessions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wechat_accounts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wechat_accounts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_wechat_accounts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_wechat_accounts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mp_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mp_sessions_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mp_sessions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_mp_sessions_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "wechat_accounts" CASCADE;
  DROP TABLE "wechat_accounts_rels" CASCADE;
  DROP TABLE "_wechat_accounts_v" CASCADE;
  DROP TABLE "_wechat_accounts_v_rels" CASCADE;
  DROP TABLE "mp_sessions" CASCADE;
  DROP TABLE "mp_sessions_rels" CASCADE;
  DROP TABLE "_mp_sessions_v" CASCADE;
  DROP TABLE "_mp_sessions_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wechat_accounts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mp_sessions_fk";
  
  DROP INDEX "payload_locked_documents_rels_wechat_accounts_id_idx";
  DROP INDEX "payload_locked_documents_rels_mp_sessions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "wechat_accounts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mp_sessions_id";
  DROP TYPE "public"."enum_mp_sessions_kind";
  DROP TYPE "public"."enum__mp_sessions_v_version_kind";`)
}
