import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_scenes_room_types" AS ENUM('entrance', 'living', 'dining', 'kitchen', 'bedroom', 'kids', 'study', 'bathroom', 'balcony', 'corridor', 'stairs', 'closet', 'theater', 'leisure', 'garage', 'utility', 'other');
  CREATE TYPE "public"."enum_scenes_required_devices" AS ENUM('switch-4', 'switch-3', 'switch-2', 'switch-1', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ceiling-ap', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum_scenes_any_devices" AS ENUM('switch-4', 'switch-3', 'switch-2', 'switch-1', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ceiling-ap', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum_scenes_scope" AS ENUM('room', 'house');
  CREATE TYPE "public"."enum_scenes_chapter" AS ENUM('arrive', 'rest', 'care', 'focus', 'network');
  CREATE TYPE "public"."enum__scenes_v_version_room_types" AS ENUM('entrance', 'living', 'dining', 'kitchen', 'bedroom', 'kids', 'study', 'bathroom', 'balcony', 'corridor', 'stairs', 'closet', 'theater', 'leisure', 'garage', 'utility', 'other');
  CREATE TYPE "public"."enum__scenes_v_version_required_devices" AS ENUM('switch-4', 'switch-3', 'switch-2', 'switch-1', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ceiling-ap', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum__scenes_v_version_any_devices" AS ENUM('switch-4', 'switch-3', 'switch-2', 'switch-1', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ceiling-ap', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum__scenes_v_version_scope" AS ENUM('room', 'house');
  CREATE TYPE "public"."enum__scenes_v_version_chapter" AS ENUM('arrive', 'rest', 'care', 'focus', 'network');
  CREATE TYPE "public"."enum_proposal_templates_sections" AS ENUM('cover', 'plans', 'system', 'zones', 'scenes', 'rooms', 'investment', 'service');
  CREATE TYPE "public"."enum_proposal_templates_framework" AS ENUM('full', 'story', 'budget', 'construction');
  CREATE TYPE "public"."enum_proposal_templates_theme" AS ENUM('qixu', 'noir', 'grove', 'azure', 'terra', 'mono', 'dawn', 'jade');
  CREATE TYPE "public"."enum_proposal_templates_markers" AS ENUM('number', 'symbol');
  CREATE TYPE "public"."enum_proposal_templates_tier" AS ENUM('free', 'pro', 'team');
  CREATE TYPE "public"."enum__proposal_templates_v_version_sections" AS ENUM('cover', 'plans', 'system', 'zones', 'scenes', 'rooms', 'investment', 'service');
  CREATE TYPE "public"."enum__proposal_templates_v_version_framework" AS ENUM('full', 'story', 'budget', 'construction');
  CREATE TYPE "public"."enum__proposal_templates_v_version_theme" AS ENUM('qixu', 'noir', 'grove', 'azure', 'terra', 'mono', 'dawn', 'jade');
  CREATE TYPE "public"."enum__proposal_templates_v_version_markers" AS ENUM('number', 'symbol');
  CREATE TYPE "public"."enum__proposal_templates_v_version_tier" AS ENUM('free', 'pro', 'team');
  CREATE TYPE "public"."enum_membership_settings_enforcement" AS ENUM('soft', 'strict');
  CREATE TYPE "public"."enum__membership_settings_v_version_enforcement" AS ENUM('soft', 'strict');
  CREATE TABLE "scenes_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "scenes_room_types" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_scenes_room_types",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "scenes_required_devices" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_scenes_required_devices",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "scenes_any_devices" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_scenes_any_devices",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "scenes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"summary" varchar NOT NULL,
  	"headline" varchar,
  	"subtitle" varchar,
  	"tagline" varchar,
  	"image_id" uuid,
  	"scope" "enum_scenes_scope" DEFAULT 'room',
  	"chapter" "enum_scenes_chapter" DEFAULT 'arrive',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scenes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_scenes_v_version_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"text" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_scenes_v_version_room_types" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__scenes_v_version_room_types",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_scenes_v_version_required_devices" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__scenes_v_version_required_devices",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_scenes_v_version_any_devices" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__scenes_v_version_any_devices",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_scenes_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_enabled" boolean DEFAULT true,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_summary" varchar NOT NULL,
  	"version_headline" varchar,
  	"version_subtitle" varchar,
  	"version_tagline" varchar,
  	"version_image_id" uuid,
  	"version_scope" "enum__scenes_v_version_scope" DEFAULT 'room',
  	"version_chapter" "enum__scenes_v_version_chapter" DEFAULT 'arrive',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_scenes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "proposal_templates_sections" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_proposal_templates_sections",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "proposal_templates" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"framework" "enum_proposal_templates_framework" DEFAULT 'full' NOT NULL,
  	"theme" "enum_proposal_templates_theme" DEFAULT 'qixu',
  	"markers" "enum_proposal_templates_markers" DEFAULT 'number',
  	"tier" "enum_proposal_templates_tier" DEFAULT 'free',
  	"accent" varchar,
  	"headline" varchar,
  	"tagline" varchar,
  	"cover_image_id" uuid,
  	"enabled" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "proposal_templates_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_proposal_templates_v_version_sections" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__proposal_templates_v_version_sections",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_proposal_templates_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_description" varchar,
  	"version_framework" "enum__proposal_templates_v_version_framework" DEFAULT 'full' NOT NULL,
  	"version_theme" "enum__proposal_templates_v_version_theme" DEFAULT 'qixu',
  	"version_markers" "enum__proposal_templates_v_version_markers" DEFAULT 'number',
  	"version_tier" "enum__proposal_templates_v_version_tier" DEFAULT 'free',
  	"version_accent" varchar,
  	"version_headline" varchar,
  	"version_tagline" varchar,
  	"version_cover_image_id" uuid,
  	"version_enabled" boolean DEFAULT true,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_proposal_templates_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "membership_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"enforcement" "enum_membership_settings_enforcement" DEFAULT 'soft',
  	"upgrade_hint" varchar DEFAULT '联系服务顾问获取兑换码，在「会员与积分」页输入兑换码即可开通或续期。',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "membership_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_membership_settings_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"version_enforcement" "enum__membership_settings_v_version_enforcement" DEFAULT 'soft',
  	"version_upgrade_hint" varchar DEFAULT '联系服务顾问获取兑换码，在「会员与积分」页输入兑换码即可开通或续期。',
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_membership_settings_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "projects" ADD COLUMN "final_quote_id" uuid;
  ALTER TABLE "projects" ADD COLUMN "proposal_template" varchar;
  ALTER TABLE "_projects_v" ADD COLUMN "version_final_quote_id" uuid;
  ALTER TABLE "_projects_v" ADD COLUMN "version_proposal_template" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scenes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "proposal_templates_id" uuid;
  ALTER TABLE "scenes_steps" ADD CONSTRAINT "scenes_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes_room_types" ADD CONSTRAINT "scenes_room_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes_required_devices" ADD CONSTRAINT "scenes_required_devices_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes_any_devices" ADD CONSTRAINT "scenes_any_devices_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes" ADD CONSTRAINT "scenes_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scenes_rels" ADD CONSTRAINT "scenes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes_rels" ADD CONSTRAINT "scenes_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "scenes_rels" ADD CONSTRAINT "scenes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_version_steps" ADD CONSTRAINT "_scenes_v_version_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_scenes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_version_room_types" ADD CONSTRAINT "_scenes_v_version_room_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_scenes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_version_required_devices" ADD CONSTRAINT "_scenes_v_version_required_devices_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_scenes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_version_any_devices" ADD CONSTRAINT "_scenes_v_version_any_devices_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_scenes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v" ADD CONSTRAINT "_scenes_v_parent_id_scenes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."scenes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_scenes_v" ADD CONSTRAINT "_scenes_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_scenes_v_rels" ADD CONSTRAINT "_scenes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_scenes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_rels" ADD CONSTRAINT "_scenes_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_scenes_v_rels" ADD CONSTRAINT "_scenes_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposal_templates_sections" ADD CONSTRAINT "proposal_templates_sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposal_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposal_templates" ADD CONSTRAINT "proposal_templates_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "proposal_templates_rels" ADD CONSTRAINT "proposal_templates_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposal_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposal_templates_rels" ADD CONSTRAINT "proposal_templates_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "proposal_templates_rels" ADD CONSTRAINT "proposal_templates_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v_version_sections" ADD CONSTRAINT "_proposal_templates_v_version_sections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_proposal_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v" ADD CONSTRAINT "_proposal_templates_v_parent_id_proposal_templates_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."proposal_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v" ADD CONSTRAINT "_proposal_templates_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v_rels" ADD CONSTRAINT "_proposal_templates_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_proposal_templates_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v_rels" ADD CONSTRAINT "_proposal_templates_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_proposal_templates_v_rels" ADD CONSTRAINT "_proposal_templates_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_settings_rels" ADD CONSTRAINT "membership_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."membership_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_settings_rels" ADD CONSTRAINT "membership_settings_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "membership_settings_rels" ADD CONSTRAINT "membership_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_membership_settings_v_rels" ADD CONSTRAINT "_membership_settings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_membership_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_membership_settings_v_rels" ADD CONSTRAINT "_membership_settings_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_membership_settings_v_rels" ADD CONSTRAINT "_membership_settings_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "scenes_steps_order_idx" ON "scenes_steps" USING btree ("_order");
  CREATE INDEX "scenes_steps_parent_id_idx" ON "scenes_steps" USING btree ("_parent_id");
  CREATE INDEX "scenes_room_types_order_idx" ON "scenes_room_types" USING btree ("order");
  CREATE INDEX "scenes_room_types_parent_idx" ON "scenes_room_types" USING btree ("parent_id");
  CREATE INDEX "scenes_required_devices_order_idx" ON "scenes_required_devices" USING btree ("order");
  CREATE INDEX "scenes_required_devices_parent_idx" ON "scenes_required_devices" USING btree ("parent_id");
  CREATE INDEX "scenes_any_devices_order_idx" ON "scenes_any_devices" USING btree ("order");
  CREATE INDEX "scenes_any_devices_parent_idx" ON "scenes_any_devices" USING btree ("parent_id");
  CREATE UNIQUE INDEX "scenes_slug_idx" ON "scenes" USING btree ("slug");
  CREATE INDEX "scenes_image_idx" ON "scenes" USING btree ("image_id");
  CREATE INDEX "scenes_updated_at_idx" ON "scenes" USING btree ("updated_at");
  CREATE INDEX "scenes_created_at_idx" ON "scenes" USING btree ("created_at");
  CREATE INDEX "scenes_rels_order_idx" ON "scenes_rels" USING btree ("order");
  CREATE INDEX "scenes_rels_parent_idx" ON "scenes_rels" USING btree ("parent_id");
  CREATE INDEX "scenes_rels_path_idx" ON "scenes_rels" USING btree ("path");
  CREATE INDEX "scenes_rels_admins_id_idx" ON "scenes_rels" USING btree ("admins_id");
  CREATE INDEX "scenes_rels_users_id_idx" ON "scenes_rels" USING btree ("users_id");
  CREATE INDEX "_scenes_v_version_steps_order_idx" ON "_scenes_v_version_steps" USING btree ("_order");
  CREATE INDEX "_scenes_v_version_steps_parent_id_idx" ON "_scenes_v_version_steps" USING btree ("_parent_id");
  CREATE INDEX "_scenes_v_version_room_types_order_idx" ON "_scenes_v_version_room_types" USING btree ("order");
  CREATE INDEX "_scenes_v_version_room_types_parent_idx" ON "_scenes_v_version_room_types" USING btree ("parent_id");
  CREATE INDEX "_scenes_v_version_required_devices_order_idx" ON "_scenes_v_version_required_devices" USING btree ("order");
  CREATE INDEX "_scenes_v_version_required_devices_parent_idx" ON "_scenes_v_version_required_devices" USING btree ("parent_id");
  CREATE INDEX "_scenes_v_version_any_devices_order_idx" ON "_scenes_v_version_any_devices" USING btree ("order");
  CREATE INDEX "_scenes_v_version_any_devices_parent_idx" ON "_scenes_v_version_any_devices" USING btree ("parent_id");
  CREATE INDEX "_scenes_v_parent_idx" ON "_scenes_v" USING btree ("parent_id");
  CREATE INDEX "_scenes_v_version_version_slug_idx" ON "_scenes_v" USING btree ("version_slug");
  CREATE INDEX "_scenes_v_version_version_image_idx" ON "_scenes_v" USING btree ("version_image_id");
  CREATE INDEX "_scenes_v_version_version_updated_at_idx" ON "_scenes_v" USING btree ("version_updated_at");
  CREATE INDEX "_scenes_v_version_version_created_at_idx" ON "_scenes_v" USING btree ("version_created_at");
  CREATE INDEX "_scenes_v_created_at_idx" ON "_scenes_v" USING btree ("created_at");
  CREATE INDEX "_scenes_v_updated_at_idx" ON "_scenes_v" USING btree ("updated_at");
  CREATE INDEX "_scenes_v_rels_order_idx" ON "_scenes_v_rels" USING btree ("order");
  CREATE INDEX "_scenes_v_rels_parent_idx" ON "_scenes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_scenes_v_rels_path_idx" ON "_scenes_v_rels" USING btree ("path");
  CREATE INDEX "_scenes_v_rels_admins_id_idx" ON "_scenes_v_rels" USING btree ("admins_id");
  CREATE INDEX "_scenes_v_rels_users_id_idx" ON "_scenes_v_rels" USING btree ("users_id");
  CREATE INDEX "proposal_templates_sections_order_idx" ON "proposal_templates_sections" USING btree ("order");
  CREATE INDEX "proposal_templates_sections_parent_idx" ON "proposal_templates_sections" USING btree ("parent_id");
  CREATE UNIQUE INDEX "proposal_templates_slug_idx" ON "proposal_templates" USING btree ("slug");
  CREATE INDEX "proposal_templates_cover_image_idx" ON "proposal_templates" USING btree ("cover_image_id");
  CREATE INDEX "proposal_templates_updated_at_idx" ON "proposal_templates" USING btree ("updated_at");
  CREATE INDEX "proposal_templates_created_at_idx" ON "proposal_templates" USING btree ("created_at");
  CREATE INDEX "proposal_templates_rels_order_idx" ON "proposal_templates_rels" USING btree ("order");
  CREATE INDEX "proposal_templates_rels_parent_idx" ON "proposal_templates_rels" USING btree ("parent_id");
  CREATE INDEX "proposal_templates_rels_path_idx" ON "proposal_templates_rels" USING btree ("path");
  CREATE INDEX "proposal_templates_rels_admins_id_idx" ON "proposal_templates_rels" USING btree ("admins_id");
  CREATE INDEX "proposal_templates_rels_users_id_idx" ON "proposal_templates_rels" USING btree ("users_id");
  CREATE INDEX "_proposal_templates_v_version_sections_order_idx" ON "_proposal_templates_v_version_sections" USING btree ("order");
  CREATE INDEX "_proposal_templates_v_version_sections_parent_idx" ON "_proposal_templates_v_version_sections" USING btree ("parent_id");
  CREATE INDEX "_proposal_templates_v_parent_idx" ON "_proposal_templates_v" USING btree ("parent_id");
  CREATE INDEX "_proposal_templates_v_version_version_slug_idx" ON "_proposal_templates_v" USING btree ("version_slug");
  CREATE INDEX "_proposal_templates_v_version_version_cover_image_idx" ON "_proposal_templates_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_proposal_templates_v_version_version_updated_at_idx" ON "_proposal_templates_v" USING btree ("version_updated_at");
  CREATE INDEX "_proposal_templates_v_version_version_created_at_idx" ON "_proposal_templates_v" USING btree ("version_created_at");
  CREATE INDEX "_proposal_templates_v_created_at_idx" ON "_proposal_templates_v" USING btree ("created_at");
  CREATE INDEX "_proposal_templates_v_updated_at_idx" ON "_proposal_templates_v" USING btree ("updated_at");
  CREATE INDEX "_proposal_templates_v_rels_order_idx" ON "_proposal_templates_v_rels" USING btree ("order");
  CREATE INDEX "_proposal_templates_v_rels_parent_idx" ON "_proposal_templates_v_rels" USING btree ("parent_id");
  CREATE INDEX "_proposal_templates_v_rels_path_idx" ON "_proposal_templates_v_rels" USING btree ("path");
  CREATE INDEX "_proposal_templates_v_rels_admins_id_idx" ON "_proposal_templates_v_rels" USING btree ("admins_id");
  CREATE INDEX "_proposal_templates_v_rels_users_id_idx" ON "_proposal_templates_v_rels" USING btree ("users_id");
  CREATE INDEX "membership_settings_rels_order_idx" ON "membership_settings_rels" USING btree ("order");
  CREATE INDEX "membership_settings_rels_parent_idx" ON "membership_settings_rels" USING btree ("parent_id");
  CREATE INDEX "membership_settings_rels_path_idx" ON "membership_settings_rels" USING btree ("path");
  CREATE INDEX "membership_settings_rels_admins_id_idx" ON "membership_settings_rels" USING btree ("admins_id");
  CREATE INDEX "membership_settings_rels_users_id_idx" ON "membership_settings_rels" USING btree ("users_id");
  CREATE INDEX "_membership_settings_v_created_at_idx" ON "_membership_settings_v" USING btree ("created_at");
  CREATE INDEX "_membership_settings_v_updated_at_idx" ON "_membership_settings_v" USING btree ("updated_at");
  CREATE INDEX "_membership_settings_v_rels_order_idx" ON "_membership_settings_v_rels" USING btree ("order");
  CREATE INDEX "_membership_settings_v_rels_parent_idx" ON "_membership_settings_v_rels" USING btree ("parent_id");
  CREATE INDEX "_membership_settings_v_rels_path_idx" ON "_membership_settings_v_rels" USING btree ("path");
  CREATE INDEX "_membership_settings_v_rels_admins_id_idx" ON "_membership_settings_v_rels" USING btree ("admins_id");
  CREATE INDEX "_membership_settings_v_rels_users_id_idx" ON "_membership_settings_v_rels" USING btree ("users_id");
  ALTER TABLE "projects" ADD CONSTRAINT "projects_final_quote_id_quotes_id_fk" FOREIGN KEY ("final_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_version_final_quote_id_quotes_id_fk" FOREIGN KEY ("version_final_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scenes_fk" FOREIGN KEY ("scenes_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_proposal_templates_fk" FOREIGN KEY ("proposal_templates_id") REFERENCES "public"."proposal_templates"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_final_quote_idx" ON "projects" USING btree ("final_quote_id");
  CREATE INDEX "_projects_v_version_version_final_quote_idx" ON "_projects_v" USING btree ("version_final_quote_id");
  CREATE INDEX "payload_locked_documents_rels_scenes_id_idx" ON "payload_locked_documents_rels" USING btree ("scenes_id");
  CREATE INDEX "payload_locked_documents_rels_proposal_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("proposal_templates_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scenes_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scenes_room_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scenes_required_devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scenes_any_devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scenes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "scenes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v_version_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v_version_room_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v_version_required_devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v_version_any_devices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_scenes_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "proposal_templates_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "proposal_templates" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "proposal_templates_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposal_templates_v_version_sections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposal_templates_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_proposal_templates_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "membership_settings_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_membership_settings_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_membership_settings_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scenes_steps" CASCADE;
  DROP TABLE "scenes_room_types" CASCADE;
  DROP TABLE "scenes_required_devices" CASCADE;
  DROP TABLE "scenes_any_devices" CASCADE;
  DROP TABLE "scenes" CASCADE;
  DROP TABLE "scenes_rels" CASCADE;
  DROP TABLE "_scenes_v_version_steps" CASCADE;
  DROP TABLE "_scenes_v_version_room_types" CASCADE;
  DROP TABLE "_scenes_v_version_required_devices" CASCADE;
  DROP TABLE "_scenes_v_version_any_devices" CASCADE;
  DROP TABLE "_scenes_v" CASCADE;
  DROP TABLE "_scenes_v_rels" CASCADE;
  DROP TABLE "proposal_templates_sections" CASCADE;
  DROP TABLE "proposal_templates" CASCADE;
  DROP TABLE "proposal_templates_rels" CASCADE;
  DROP TABLE "_proposal_templates_v_version_sections" CASCADE;
  DROP TABLE "_proposal_templates_v" CASCADE;
  DROP TABLE "_proposal_templates_v_rels" CASCADE;
  DROP TABLE "membership_settings" CASCADE;
  DROP TABLE "membership_settings_rels" CASCADE;
  DROP TABLE "_membership_settings_v" CASCADE;
  DROP TABLE "_membership_settings_v_rels" CASCADE;
  ALTER TABLE "projects" DROP CONSTRAINT "projects_final_quote_id_quotes_id_fk";
  
  ALTER TABLE "_projects_v" DROP CONSTRAINT "_projects_v_version_final_quote_id_quotes_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scenes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_proposal_templates_fk";
  
  DROP INDEX "projects_final_quote_idx";
  DROP INDEX "_projects_v_version_version_final_quote_idx";
  DROP INDEX "payload_locked_documents_rels_scenes_id_idx";
  DROP INDEX "payload_locked_documents_rels_proposal_templates_id_idx";
  ALTER TABLE "projects" DROP COLUMN "final_quote_id";
  ALTER TABLE "projects" DROP COLUMN "proposal_template";
  ALTER TABLE "_projects_v" DROP COLUMN "version_final_quote_id";
  ALTER TABLE "_projects_v" DROP COLUMN "version_proposal_template";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scenes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "proposal_templates_id";
  DROP TYPE "public"."enum_scenes_room_types";
  DROP TYPE "public"."enum_scenes_required_devices";
  DROP TYPE "public"."enum_scenes_any_devices";
  DROP TYPE "public"."enum_scenes_scope";
  DROP TYPE "public"."enum_scenes_chapter";
  DROP TYPE "public"."enum__scenes_v_version_room_types";
  DROP TYPE "public"."enum__scenes_v_version_required_devices";
  DROP TYPE "public"."enum__scenes_v_version_any_devices";
  DROP TYPE "public"."enum__scenes_v_version_scope";
  DROP TYPE "public"."enum__scenes_v_version_chapter";
  DROP TYPE "public"."enum_proposal_templates_sections";
  DROP TYPE "public"."enum_proposal_templates_framework";
  DROP TYPE "public"."enum_proposal_templates_theme";
  DROP TYPE "public"."enum_proposal_templates_markers";
  DROP TYPE "public"."enum_proposal_templates_tier";
  DROP TYPE "public"."enum__proposal_templates_v_version_sections";
  DROP TYPE "public"."enum__proposal_templates_v_version_framework";
  DROP TYPE "public"."enum__proposal_templates_v_version_theme";
  DROP TYPE "public"."enum__proposal_templates_v_version_markers";
  DROP TYPE "public"."enum__proposal_templates_v_version_tier";
  DROP TYPE "public"."enum_membership_settings_enforcement";
  DROP TYPE "public"."enum__membership_settings_v_version_enforcement";`)
}
