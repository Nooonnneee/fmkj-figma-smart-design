import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_collaborators_role" AS ENUM('read', 'edit');
  CREATE TYPE "public"."enum__projects_v_version_collaborators_role" AS ENUM('read', 'edit');
  CREATE TABLE "projects_collaborators" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" uuid NOT NULL,
  	"role" "enum_projects_collaborators_role" DEFAULT 'read' NOT NULL,
  	"joined_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_projects_v_version_collaborators" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"role" "enum__projects_v_version_collaborators_role" DEFAULT 'read' NOT NULL,
  	"joined_at" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  ALTER TABLE "projects" ADD COLUMN "share_config" jsonb;
  ALTER TABLE "_projects_v" ADD COLUMN "version_share_config" jsonb;
  ALTER TABLE "company_settings" ADD COLUMN "ai_models" jsonb;
  ALTER TABLE "_company_settings_v" ADD COLUMN "version_ai_models" jsonb;
  ALTER TABLE "projects_collaborators" ADD CONSTRAINT "projects_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_collaborators" ADD CONSTRAINT "projects_collaborators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_version_collaborators" ADD CONSTRAINT "_projects_v_version_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_version_collaborators" ADD CONSTRAINT "_projects_v_version_collaborators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_collaborators_order_idx" ON "projects_collaborators" USING btree ("_order");
  CREATE INDEX "projects_collaborators_parent_id_idx" ON "projects_collaborators" USING btree ("_parent_id");
  CREATE INDEX "projects_collaborators_user_idx" ON "projects_collaborators" USING btree ("user_id");
  CREATE INDEX "_projects_v_version_collaborators_order_idx" ON "_projects_v_version_collaborators" USING btree ("_order");
  CREATE INDEX "_projects_v_version_collaborators_parent_id_idx" ON "_projects_v_version_collaborators" USING btree ("_parent_id");
  CREATE INDEX "_projects_v_version_collaborators_user_idx" ON "_projects_v_version_collaborators" USING btree ("user_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "projects_collaborators" CASCADE;
  DROP TABLE "_projects_v_version_collaborators" CASCADE;
  ALTER TABLE "projects" DROP COLUMN "share_config";
  ALTER TABLE "_projects_v" DROP COLUMN "version_share_config";
  ALTER TABLE "company_settings" DROP COLUMN "ai_models";
  ALTER TABLE "_company_settings_v" DROP COLUMN "version_ai_models";
  DROP TYPE "public"."enum_projects_collaborators_role";
  DROP TYPE "public"."enum__projects_v_version_collaborators_role";`)
}
