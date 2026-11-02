import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'manager', 'designer', 'sales', 'viewer');
  CREATE TYPE "public"."enum_users_status" AS ENUM('active', 'disabled');
  CREATE TYPE "public"."enum__users_v_version_role" AS ENUM('admin', 'manager', 'designer', 'sales', 'viewer');
  CREATE TYPE "public"."enum__users_v_version_status" AS ENUM('active', 'disabled');
  CREATE TYPE "public"."enum_projects_stage" AS ENUM('new', 'measure', 'proposal', 'contract', 'install', 'acceptance', 'aftercare');
  CREATE TYPE "public"."enum_projects_status" AS ENUM('active', 'paused', 'canceled', 'archived');
  CREATE TYPE "public"."enum_projects_platform" AS ENUM('米家', 'Aqara Home', 'Apple Home', '华为鸿蒙智家', 'KNX', 'Control4', '网络/弱电', '待定');
  CREATE TYPE "public"."enum_projects_risk_level" AS ENUM('normal', 'watch', 'blocked');
  CREATE TYPE "public"."enum_projects_waiting_on" AS ENUM('none', 'customer', 'internal', 'vendor');
  CREATE TYPE "public"."enum__projects_v_version_stage" AS ENUM('new', 'measure', 'proposal', 'contract', 'install', 'acceptance', 'aftercare');
  CREATE TYPE "public"."enum__projects_v_version_status" AS ENUM('active', 'paused', 'canceled', 'archived');
  CREATE TYPE "public"."enum__projects_v_version_platform" AS ENUM('米家', 'Aqara Home', 'Apple Home', '华为鸿蒙智家', 'KNX', 'Control4', '网络/弱电', '待定');
  CREATE TYPE "public"."enum__projects_v_version_risk_level" AS ENUM('normal', 'watch', 'blocked');
  CREATE TYPE "public"."enum__projects_v_version_waiting_on" AS ENUM('none', 'customer', 'internal', 'vendor');
  CREATE TYPE "public"."enum_quotes_items_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum_quotes_status" AS ENUM('draft', 'sent', 'accepted');
  CREATE TYPE "public"."enum__quotes_v_version_items_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum__quotes_v_version_status" AS ENUM('draft', 'sent', 'accepted');
  CREATE TYPE "public"."enum_products_platforms" AS ENUM('Apple Home', '米家', '华为', '涂鸦', 'Matter', 'KNX', '通用');
  CREATE TYPE "public"."enum_products_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum_products_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum__products_v_version_platforms" AS ENUM('Apple Home', '米家', '华为', '涂鸦', 'Matter', 'KNX', '通用');
  CREATE TYPE "public"."enum__products_v_version_device_type" AS ENUM('switch-1', 'switch-2', 'switch-3', 'switch-4', 'socket-usb', 'socket-double', 'socket', 'spotlight', 'track-light', 'downlight', 'ceiling-light', 'pendant-light', 'wall-light', 'panel-light', 'light-strip', 'other-light', 'motion-sensor', 'smoke-sensor', 'water-sensor', 'temp-sensor', 'contact-sensor', 'smart-lock', 'doorbell', 'camera', 'curtain-track', 'speaker', 'touch-panel', 'gateway', 'ac-router', 'ap-node', 'network-panel', 'vrf-controller', 'other');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_payload_llm_instructions_entity_type" AS ENUM('collection', 'global');
  CREATE TABLE "admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "admins" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "admins_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"role" "enum_users_role" DEFAULT 'sales' NOT NULL,
  	"status" "enum_users_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_users_v_version_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_uuid" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "_users_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_phone" varchar,
  	"version_role" "enum__users_v_version_role" DEFAULT 'sales' NOT NULL,
  	"version_status" "enum__users_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_email" varchar NOT NULL,
  	"version_reset_password_token" varchar,
  	"version_reset_password_expiration" timestamp(3) with time zone,
  	"version_salt" varchar,
  	"version_hash" varchar,
  	"version_reset_password_requested_at" timestamp(3) with time zone,
  	"version_login_attempts" numeric DEFAULT 0,
  	"version_lock_until" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_users_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "projects" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar,
  	"community" varchar,
  	"address" varchar,
  	"stage" "enum_projects_stage" DEFAULT 'new' NOT NULL,
  	"status" "enum_projects_status" DEFAULT 'active' NOT NULL,
  	"owner_id" uuid,
  	"platform" "enum_projects_platform",
  	"budget" numeric,
  	"risk_level" "enum_projects_risk_level" DEFAULT 'normal',
  	"waiting_on" "enum_projects_waiting_on" DEFAULT 'none',
  	"risk_note" varchar,
  	"next_action" varchar,
  	"next_action_due_at" timestamp(3) with time zone,
  	"notes" varchar,
  	"point_map" jsonb,
  	"default_products" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_projects_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_customer_name" varchar NOT NULL,
  	"version_customer_phone" varchar,
  	"version_community" varchar,
  	"version_address" varchar,
  	"version_stage" "enum__projects_v_version_stage" DEFAULT 'new' NOT NULL,
  	"version_status" "enum__projects_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_owner_id" uuid,
  	"version_platform" "enum__projects_v_version_platform",
  	"version_budget" numeric,
  	"version_risk_level" "enum__projects_v_version_risk_level" DEFAULT 'normal',
  	"version_waiting_on" "enum__projects_v_version_waiting_on" DEFAULT 'none',
  	"version_risk_note" varchar,
  	"version_next_action" varchar,
  	"version_next_action_due_at" timestamp(3) with time zone,
  	"version_notes" varchar,
  	"version_point_map" jsonb,
  	"version_default_products" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_projects_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "quotes_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" uuid,
  	"device_type" "enum_quotes_items_device_type",
  	"image_id" uuid,
  	"name" varchar NOT NULL,
  	"sku" varchar,
  	"unit" varchar,
  	"price" numeric NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL
  );
  
  CREATE TABLE "quotes_fees" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"amount" numeric NOT NULL
  );
  
  CREATE TABLE "quotes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"project_id" uuid NOT NULL,
  	"status" "enum_quotes_status" DEFAULT 'draft' NOT NULL,
  	"discount" numeric DEFAULT 0,
  	"notes" varchar,
  	"product_total" numeric,
  	"fee_total" numeric,
  	"total" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quotes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_quotes_v_version_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"product_id" uuid,
  	"device_type" "enum__quotes_v_version_items_device_type",
  	"image_id" uuid,
  	"name" varchar NOT NULL,
  	"sku" varchar,
  	"unit" varchar,
  	"price" numeric NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quotes_v_version_fees" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"amount" numeric NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_quotes_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar NOT NULL,
  	"version_project_id" uuid NOT NULL,
  	"version_status" "enum__quotes_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_discount" numeric DEFAULT 0,
  	"version_notes" varchar,
  	"version_product_total" numeric,
  	"version_fee_total" numeric,
  	"version_total" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_quotes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "products_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_products_platforms",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"sku" varchar NOT NULL,
  	"device_type" "enum_products_device_type",
  	"brand_id" uuid NOT NULL,
  	"category_id" uuid,
  	"image_id" uuid,
  	"description" varchar,
  	"price" numeric NOT NULL,
  	"cost" numeric,
  	"unit" varchar DEFAULT '个' NOT NULL,
  	"stock" numeric DEFAULT 0,
  	"status" "enum_products_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_products_v_version_platforms" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__products_v_version_platforms",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );
  
  CREATE TABLE "_products_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_sku" varchar NOT NULL,
  	"version_device_type" "enum__products_v_version_device_type",
  	"version_brand_id" uuid NOT NULL,
  	"version_category_id" uuid,
  	"version_image_id" uuid,
  	"version_description" varchar,
  	"version_price" numeric NOT NULL,
  	"version_cost" numeric,
  	"version_unit" varchar DEFAULT '个' NOT NULL,
  	"version_stock" numeric DEFAULT 0,
  	"version_status" "enum__products_v_version_status" DEFAULT 'active' NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_products_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "brands" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brands_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_brands_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_logo_id" uuid,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_brands_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "categories" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_categories_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar NOT NULL,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_categories_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar NOT NULL,
  	"_h_folders_id" uuid,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"original_filename" varchar,
  	"original_url" varchar,
  	"original_mime_type" varchar,
  	"original_filesize" numeric,
  	"original_width" numeric,
  	"original_height" numeric,
  	"original_prefix" varchar,
  	"original__objectkey" varchar,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" uuid,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_media_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_alt" varchar NOT NULL,
  	"version__h_folders_id" uuid,
  	"version_prefix" varchar DEFAULT '',
  	"version__objectkey" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_url" varchar,
  	"version_thumbnail_u_r_l" varchar,
  	"version_filename" varchar,
  	"version_mime_type" varchar,
  	"version_filesize" numeric,
  	"version_width" numeric,
  	"version_height" numeric,
  	"version_original_filename" varchar,
  	"version_original_url" varchar,
  	"version_original_mime_type" varchar,
  	"version_original_filesize" numeric,
  	"version_original_width" numeric,
  	"version_original_height" numeric,
  	"version_original_prefix" varchar,
  	"version_original__objectkey" varchar,
  	"version_focal_x" numeric,
  	"version_focal_y" numeric,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_media_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" uuid,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "folders" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_h_folders_id" uuid,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "folders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_folders_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version__h_folders_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_folders_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "tags" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"_h_tags_id" uuid,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_tags_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version__h_tags_id" uuid,
  	"version_name" varchar NOT NULL,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_tags_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "payload_kv" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid,
  	"projects_id" uuid,
  	"quotes_id" uuid,
  	"products_id" uuid,
  	"brands_id" uuid,
  	"categories_id" uuid,
  	"media_id" uuid,
  	"folders_id" uuid,
  	"tags_id" uuid
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_llm_instructions" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"entity_slug" varchar NOT NULL,
  	"entity_type" "enum_payload_llm_instructions_entity_type" NOT NULL,
  	"additional_instructions" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_llm_instructions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "company_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar DEFAULT 'FMKJ 智能家居' NOT NULL,
  	"slogan" varchar DEFAULT '全屋智能方案 · 设计 · 安装 · 售后',
  	"phone" varchar,
  	"email" varchar,
  	"address" varchar,
  	"logo_id" uuid,
  	"qr_code_id" uuid,
  	"qr_caption" varchar DEFAULT '扫码添加微信',
  	"quote_notes" varchar,
  	"print_product_images" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "company_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  CREATE TABLE "_company_settings_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"version_name" varchar DEFAULT 'FMKJ 智能家居' NOT NULL,
  	"version_slogan" varchar DEFAULT '全屋智能方案 · 设计 · 安装 · 售后',
  	"version_phone" varchar,
  	"version_email" varchar,
  	"version_address" varchar,
  	"version_logo_id" uuid,
  	"version_qr_code_id" uuid,
  	"version_qr_caption" varchar DEFAULT '扫码添加微信',
  	"version_quote_notes" varchar,
  	"version_print_product_images" boolean DEFAULT true,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_company_settings_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );
  
  ALTER TABLE "admins_sessions" ADD CONSTRAINT "admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins_rels" ADD CONSTRAINT "admins_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins_rels" ADD CONSTRAINT "admins_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins_rels" ADD CONSTRAINT "admins_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_version_sessions" ADD CONSTRAINT "_users_v_version_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v" ADD CONSTRAINT "_users_v_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_users_v_rels" ADD CONSTRAINT "_users_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_users_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_rels" ADD CONSTRAINT "_users_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_users_v_rels" ADD CONSTRAINT "_users_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_parent_id_projects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v" ADD CONSTRAINT "_projects_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_projects_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_projects_v_rels" ADD CONSTRAINT "_projects_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_items" ADD CONSTRAINT "quotes_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes_items" ADD CONSTRAINT "quotes_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes_items" ADD CONSTRAINT "quotes_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_fees" ADD CONSTRAINT "quotes_fees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quotes_rels" ADD CONSTRAINT "quotes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_rels" ADD CONSTRAINT "quotes_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quotes_rels" ADD CONSTRAINT "quotes_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_items" ADD CONSTRAINT "_quotes_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_items" ADD CONSTRAINT "_quotes_v_version_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_items" ADD CONSTRAINT "_quotes_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quotes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v_version_fees" ADD CONSTRAINT "_quotes_v_version_fees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_quotes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v" ADD CONSTRAINT "_quotes_v_parent_id_quotes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v" ADD CONSTRAINT "_quotes_v_version_project_id_projects_id_fk" FOREIGN KEY ("version_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_quotes_v_rels" ADD CONSTRAINT "_quotes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_quotes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v_rels" ADD CONSTRAINT "_quotes_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_quotes_v_rels" ADD CONSTRAINT "_quotes_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_platforms" ADD CONSTRAINT "products_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_texts" ADD CONSTRAINT "products_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_platforms" ADD CONSTRAINT "_products_v_version_platforms_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_brand_id_brands_id_fk" FOREIGN KEY ("version_brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_texts" ADD CONSTRAINT "_products_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brands_rels" ADD CONSTRAINT "brands_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_rels" ADD CONSTRAINT "brands_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brands_rels" ADD CONSTRAINT "brands_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_brands_v" ADD CONSTRAINT "_brands_v_parent_id_brands_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_brands_v" ADD CONSTRAINT "_brands_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_brands_v_rels" ADD CONSTRAINT "_brands_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_brands_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_brands_v_rels" ADD CONSTRAINT "_brands_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_brands_v_rels" ADD CONSTRAINT "_brands_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v_rels" ADD CONSTRAINT "_categories_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media__h_folders_id_folders_id_fk" FOREIGN KEY ("_h_folders_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_media_v" ADD CONSTRAINT "_media_v_parent_id_media_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_media_v" ADD CONSTRAINT "_media_v_version__h_folders_id_folders_id_fk" FOREIGN KEY ("version__h_folders_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_media_v_rels" ADD CONSTRAINT "_media_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_media_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_media_v_rels" ADD CONSTRAINT "_media_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_media_v_rels" ADD CONSTRAINT "_media_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_media_v_rels" ADD CONSTRAINT "_media_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "folders" ADD CONSTRAINT "folders__h_folders_id_folders_id_fk" FOREIGN KEY ("_h_folders_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "folders_rels" ADD CONSTRAINT "folders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "folders_rels" ADD CONSTRAINT "folders_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "folders_rels" ADD CONSTRAINT "folders_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_folders_v" ADD CONSTRAINT "_folders_v_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_folders_v" ADD CONSTRAINT "_folders_v_version__h_folders_id_folders_id_fk" FOREIGN KEY ("version__h_folders_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_folders_v_rels" ADD CONSTRAINT "_folders_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_folders_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_folders_v_rels" ADD CONSTRAINT "_folders_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_folders_v_rels" ADD CONSTRAINT "_folders_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags__h_tags_id_tags_id_fk" FOREIGN KEY ("_h_tags_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_rels" ADD CONSTRAINT "tags_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tags_v" ADD CONSTRAINT "_tags_v_parent_id_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tags_v" ADD CONSTRAINT "_tags_v_version__h_tags_id_tags_id_fk" FOREIGN KEY ("version__h_tags_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tags_v_rels" ADD CONSTRAINT "_tags_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tags_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tags_v_rels" ADD CONSTRAINT "_tags_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tags_v_rels" ADD CONSTRAINT "_tags_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quotes_fk" FOREIGN KEY ("quotes_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_folders_fk" FOREIGN KEY ("folders_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_llm_instructions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_llm_instructions_rels" ADD CONSTRAINT "payload_llm_instructions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_qr_code_id_media_id_fk" FOREIGN KEY ("qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "company_settings_rels" ADD CONSTRAINT "company_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."company_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "company_settings_rels" ADD CONSTRAINT "company_settings_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "company_settings_rels" ADD CONSTRAINT "company_settings_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_company_settings_v" ADD CONSTRAINT "_company_settings_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_company_settings_v" ADD CONSTRAINT "_company_settings_v_version_qr_code_id_media_id_fk" FOREIGN KEY ("version_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_company_settings_v_rels" ADD CONSTRAINT "_company_settings_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_company_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_company_settings_v_rels" ADD CONSTRAINT "_company_settings_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_company_settings_v_rels" ADD CONSTRAINT "_company_settings_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admins_sessions_order_idx" ON "admins_sessions" USING btree ("_order");
  CREATE INDEX "admins_sessions_parent_id_idx" ON "admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");
  CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");
  CREATE INDEX "admins_rels_order_idx" ON "admins_rels" USING btree ("order");
  CREATE INDEX "admins_rels_parent_idx" ON "admins_rels" USING btree ("parent_id");
  CREATE INDEX "admins_rels_path_idx" ON "admins_rels" USING btree ("path");
  CREATE INDEX "admins_rels_admins_id_idx" ON "admins_rels" USING btree ("admins_id");
  CREATE INDEX "admins_rels_users_id_idx" ON "admins_rels" USING btree ("users_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_admins_id_idx" ON "users_rels" USING btree ("admins_id");
  CREATE INDEX "users_rels_users_id_idx" ON "users_rels" USING btree ("users_id");
  CREATE INDEX "_users_v_version_sessions_order_idx" ON "_users_v_version_sessions" USING btree ("_order");
  CREATE INDEX "_users_v_version_sessions_parent_id_idx" ON "_users_v_version_sessions" USING btree ("_parent_id");
  CREATE INDEX "_users_v_parent_idx" ON "_users_v" USING btree ("parent_id");
  CREATE INDEX "_users_v_version_version_updated_at_idx" ON "_users_v" USING btree ("version_updated_at");
  CREATE INDEX "_users_v_version_version_created_at_idx" ON "_users_v" USING btree ("version_created_at");
  CREATE INDEX "_users_v_version_version_email_idx" ON "_users_v" USING btree ("version_email");
  CREATE INDEX "_users_v_created_at_idx" ON "_users_v" USING btree ("created_at");
  CREATE INDEX "_users_v_updated_at_idx" ON "_users_v" USING btree ("updated_at");
  CREATE INDEX "_users_v_rels_order_idx" ON "_users_v_rels" USING btree ("order");
  CREATE INDEX "_users_v_rels_parent_idx" ON "_users_v_rels" USING btree ("parent_id");
  CREATE INDEX "_users_v_rels_path_idx" ON "_users_v_rels" USING btree ("path");
  CREATE INDEX "_users_v_rels_admins_id_idx" ON "_users_v_rels" USING btree ("admins_id");
  CREATE INDEX "_users_v_rels_users_id_idx" ON "_users_v_rels" USING btree ("users_id");
  CREATE INDEX "projects_stage_idx" ON "projects" USING btree ("stage");
  CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");
  CREATE INDEX "projects_owner_idx" ON "projects" USING btree ("owner_id");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_admins_id_idx" ON "projects_rels" USING btree ("admins_id");
  CREATE INDEX "projects_rels_users_id_idx" ON "projects_rels" USING btree ("users_id");
  CREATE INDEX "_projects_v_parent_idx" ON "_projects_v" USING btree ("parent_id");
  CREATE INDEX "_projects_v_version_version_stage_idx" ON "_projects_v" USING btree ("version_stage");
  CREATE INDEX "_projects_v_version_version_status_idx" ON "_projects_v" USING btree ("version_status");
  CREATE INDEX "_projects_v_version_version_owner_idx" ON "_projects_v" USING btree ("version_owner_id");
  CREATE INDEX "_projects_v_version_version_updated_at_idx" ON "_projects_v" USING btree ("version_updated_at");
  CREATE INDEX "_projects_v_version_version_created_at_idx" ON "_projects_v" USING btree ("version_created_at");
  CREATE INDEX "_projects_v_created_at_idx" ON "_projects_v" USING btree ("created_at");
  CREATE INDEX "_projects_v_updated_at_idx" ON "_projects_v" USING btree ("updated_at");
  CREATE INDEX "_projects_v_rels_order_idx" ON "_projects_v_rels" USING btree ("order");
  CREATE INDEX "_projects_v_rels_parent_idx" ON "_projects_v_rels" USING btree ("parent_id");
  CREATE INDEX "_projects_v_rels_path_idx" ON "_projects_v_rels" USING btree ("path");
  CREATE INDEX "_projects_v_rels_admins_id_idx" ON "_projects_v_rels" USING btree ("admins_id");
  CREATE INDEX "_projects_v_rels_users_id_idx" ON "_projects_v_rels" USING btree ("users_id");
  CREATE INDEX "quotes_items_order_idx" ON "quotes_items" USING btree ("_order");
  CREATE INDEX "quotes_items_parent_id_idx" ON "quotes_items" USING btree ("_parent_id");
  CREATE INDEX "quotes_items_product_idx" ON "quotes_items" USING btree ("product_id");
  CREATE INDEX "quotes_items_image_idx" ON "quotes_items" USING btree ("image_id");
  CREATE INDEX "quotes_fees_order_idx" ON "quotes_fees" USING btree ("_order");
  CREATE INDEX "quotes_fees_parent_id_idx" ON "quotes_fees" USING btree ("_parent_id");
  CREATE INDEX "quotes_project_idx" ON "quotes" USING btree ("project_id");
  CREATE INDEX "quotes_updated_at_idx" ON "quotes" USING btree ("updated_at");
  CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");
  CREATE INDEX "quotes_rels_order_idx" ON "quotes_rels" USING btree ("order");
  CREATE INDEX "quotes_rels_parent_idx" ON "quotes_rels" USING btree ("parent_id");
  CREATE INDEX "quotes_rels_path_idx" ON "quotes_rels" USING btree ("path");
  CREATE INDEX "quotes_rels_admins_id_idx" ON "quotes_rels" USING btree ("admins_id");
  CREATE INDEX "quotes_rels_users_id_idx" ON "quotes_rels" USING btree ("users_id");
  CREATE INDEX "_quotes_v_version_items_order_idx" ON "_quotes_v_version_items" USING btree ("_order");
  CREATE INDEX "_quotes_v_version_items_parent_id_idx" ON "_quotes_v_version_items" USING btree ("_parent_id");
  CREATE INDEX "_quotes_v_version_items_product_idx" ON "_quotes_v_version_items" USING btree ("product_id");
  CREATE INDEX "_quotes_v_version_items_image_idx" ON "_quotes_v_version_items" USING btree ("image_id");
  CREATE INDEX "_quotes_v_version_fees_order_idx" ON "_quotes_v_version_fees" USING btree ("_order");
  CREATE INDEX "_quotes_v_version_fees_parent_id_idx" ON "_quotes_v_version_fees" USING btree ("_parent_id");
  CREATE INDEX "_quotes_v_parent_idx" ON "_quotes_v" USING btree ("parent_id");
  CREATE INDEX "_quotes_v_version_version_project_idx" ON "_quotes_v" USING btree ("version_project_id");
  CREATE INDEX "_quotes_v_version_version_updated_at_idx" ON "_quotes_v" USING btree ("version_updated_at");
  CREATE INDEX "_quotes_v_version_version_created_at_idx" ON "_quotes_v" USING btree ("version_created_at");
  CREATE INDEX "_quotes_v_created_at_idx" ON "_quotes_v" USING btree ("created_at");
  CREATE INDEX "_quotes_v_updated_at_idx" ON "_quotes_v" USING btree ("updated_at");
  CREATE INDEX "_quotes_v_rels_order_idx" ON "_quotes_v_rels" USING btree ("order");
  CREATE INDEX "_quotes_v_rels_parent_idx" ON "_quotes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_quotes_v_rels_path_idx" ON "_quotes_v_rels" USING btree ("path");
  CREATE INDEX "_quotes_v_rels_admins_id_idx" ON "_quotes_v_rels" USING btree ("admins_id");
  CREATE INDEX "_quotes_v_rels_users_id_idx" ON "_quotes_v_rels" USING btree ("users_id");
  CREATE INDEX "products_platforms_order_idx" ON "products_platforms" USING btree ("order");
  CREATE INDEX "products_platforms_parent_idx" ON "products_platforms" USING btree ("parent_id");
  CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE INDEX "products_device_type_idx" ON "products" USING btree ("device_type");
  CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_image_idx" ON "products" USING btree ("image_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_texts_order_parent" ON "products_texts" USING btree ("order","parent_id");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_admins_id_idx" ON "products_rels" USING btree ("admins_id");
  CREATE INDEX "products_rels_users_id_idx" ON "products_rels" USING btree ("users_id");
  CREATE INDEX "_products_v_version_platforms_order_idx" ON "_products_v_version_platforms" USING btree ("order");
  CREATE INDEX "_products_v_version_platforms_parent_idx" ON "_products_v_version_platforms" USING btree ("parent_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_sku_idx" ON "_products_v" USING btree ("version_sku");
  CREATE INDEX "_products_v_version_version_device_type_idx" ON "_products_v" USING btree ("version_device_type");
  CREATE INDEX "_products_v_version_version_brand_idx" ON "_products_v" USING btree ("version_brand_id");
  CREATE INDEX "_products_v_version_version_category_idx" ON "_products_v" USING btree ("version_category_id");
  CREATE INDEX "_products_v_version_version_image_idx" ON "_products_v" USING btree ("version_image_id");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_texts_order_parent" ON "_products_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_admins_id_idx" ON "_products_v_rels" USING btree ("admins_id");
  CREATE INDEX "_products_v_rels_users_id_idx" ON "_products_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_logo_idx" ON "brands" USING btree ("logo_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE INDEX "brands_rels_order_idx" ON "brands_rels" USING btree ("order");
  CREATE INDEX "brands_rels_parent_idx" ON "brands_rels" USING btree ("parent_id");
  CREATE INDEX "brands_rels_path_idx" ON "brands_rels" USING btree ("path");
  CREATE INDEX "brands_rels_admins_id_idx" ON "brands_rels" USING btree ("admins_id");
  CREATE INDEX "brands_rels_users_id_idx" ON "brands_rels" USING btree ("users_id");
  CREATE INDEX "_brands_v_parent_idx" ON "_brands_v" USING btree ("parent_id");
  CREATE INDEX "_brands_v_version_version_slug_idx" ON "_brands_v" USING btree ("version_slug");
  CREATE INDEX "_brands_v_version_version_logo_idx" ON "_brands_v" USING btree ("version_logo_id");
  CREATE INDEX "_brands_v_version_version_updated_at_idx" ON "_brands_v" USING btree ("version_updated_at");
  CREATE INDEX "_brands_v_version_version_created_at_idx" ON "_brands_v" USING btree ("version_created_at");
  CREATE INDEX "_brands_v_created_at_idx" ON "_brands_v" USING btree ("created_at");
  CREATE INDEX "_brands_v_updated_at_idx" ON "_brands_v" USING btree ("updated_at");
  CREATE INDEX "_brands_v_rels_order_idx" ON "_brands_v_rels" USING btree ("order");
  CREATE INDEX "_brands_v_rels_parent_idx" ON "_brands_v_rels" USING btree ("parent_id");
  CREATE INDEX "_brands_v_rels_path_idx" ON "_brands_v_rels" USING btree ("path");
  CREATE INDEX "_brands_v_rels_admins_id_idx" ON "_brands_v_rels" USING btree ("admins_id");
  CREATE INDEX "_brands_v_rels_users_id_idx" ON "_brands_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_rels_order_idx" ON "categories_rels" USING btree ("order");
  CREATE INDEX "categories_rels_parent_idx" ON "categories_rels" USING btree ("parent_id");
  CREATE INDEX "categories_rels_path_idx" ON "categories_rels" USING btree ("path");
  CREATE INDEX "categories_rels_admins_id_idx" ON "categories_rels" USING btree ("admins_id");
  CREATE INDEX "categories_rels_users_id_idx" ON "categories_rels" USING btree ("users_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v" USING btree ("version_slug");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_rels_order_idx" ON "_categories_v_rels" USING btree ("order");
  CREATE INDEX "_categories_v_rels_parent_idx" ON "_categories_v_rels" USING btree ("parent_id");
  CREATE INDEX "_categories_v_rels_path_idx" ON "_categories_v_rels" USING btree ("path");
  CREATE INDEX "_categories_v_rels_admins_id_idx" ON "_categories_v_rels" USING btree ("admins_id");
  CREATE INDEX "_categories_v_rels_users_id_idx" ON "_categories_v_rels" USING btree ("users_id");
  CREATE INDEX "media__h_folders_idx" ON "media" USING btree ("_h_folders_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_original_original_filename_idx" ON "media" USING btree ("original_filename");
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_tags_id_idx" ON "media_rels" USING btree ("tags_id");
  CREATE INDEX "media_rels_admins_id_idx" ON "media_rels" USING btree ("admins_id");
  CREATE INDEX "media_rels_users_id_idx" ON "media_rels" USING btree ("users_id");
  CREATE INDEX "_media_v_parent_idx" ON "_media_v" USING btree ("parent_id");
  CREATE INDEX "_media_v_version_version__h_folders_idx" ON "_media_v" USING btree ("version__h_folders_id");
  CREATE INDEX "_media_v_version_version_updated_at_idx" ON "_media_v" USING btree ("version_updated_at");
  CREATE INDEX "_media_v_version_version_created_at_idx" ON "_media_v" USING btree ("version_created_at");
  CREATE INDEX "_media_v_version_version_filename_idx" ON "_media_v" USING btree ("version_filename");
  CREATE INDEX "_media_v_version_original_version_original_filename_idx" ON "_media_v" USING btree ("version_original_filename");
  CREATE INDEX "_media_v_created_at_idx" ON "_media_v" USING btree ("created_at");
  CREATE INDEX "_media_v_updated_at_idx" ON "_media_v" USING btree ("updated_at");
  CREATE INDEX "_media_v_rels_order_idx" ON "_media_v_rels" USING btree ("order");
  CREATE INDEX "_media_v_rels_parent_idx" ON "_media_v_rels" USING btree ("parent_id");
  CREATE INDEX "_media_v_rels_path_idx" ON "_media_v_rels" USING btree ("path");
  CREATE INDEX "_media_v_rels_tags_id_idx" ON "_media_v_rels" USING btree ("tags_id");
  CREATE INDEX "_media_v_rels_admins_id_idx" ON "_media_v_rels" USING btree ("admins_id");
  CREATE INDEX "_media_v_rels_users_id_idx" ON "_media_v_rels" USING btree ("users_id");
  CREATE INDEX "folders__h_folders_idx" ON "folders" USING btree ("_h_folders_id");
  CREATE INDEX "folders_updated_at_idx" ON "folders" USING btree ("updated_at");
  CREATE INDEX "folders_created_at_idx" ON "folders" USING btree ("created_at");
  CREATE INDEX "folders_rels_order_idx" ON "folders_rels" USING btree ("order");
  CREATE INDEX "folders_rels_parent_idx" ON "folders_rels" USING btree ("parent_id");
  CREATE INDEX "folders_rels_path_idx" ON "folders_rels" USING btree ("path");
  CREATE INDEX "folders_rels_admins_id_idx" ON "folders_rels" USING btree ("admins_id");
  CREATE INDEX "folders_rels_users_id_idx" ON "folders_rels" USING btree ("users_id");
  CREATE INDEX "_folders_v_parent_idx" ON "_folders_v" USING btree ("parent_id");
  CREATE INDEX "_folders_v_version_version__h_folders_idx" ON "_folders_v" USING btree ("version__h_folders_id");
  CREATE INDEX "_folders_v_version_version_updated_at_idx" ON "_folders_v" USING btree ("version_updated_at");
  CREATE INDEX "_folders_v_version_version_created_at_idx" ON "_folders_v" USING btree ("version_created_at");
  CREATE INDEX "_folders_v_created_at_idx" ON "_folders_v" USING btree ("created_at");
  CREATE INDEX "_folders_v_updated_at_idx" ON "_folders_v" USING btree ("updated_at");
  CREATE INDEX "_folders_v_rels_order_idx" ON "_folders_v_rels" USING btree ("order");
  CREATE INDEX "_folders_v_rels_parent_idx" ON "_folders_v_rels" USING btree ("parent_id");
  CREATE INDEX "_folders_v_rels_path_idx" ON "_folders_v_rels" USING btree ("path");
  CREATE INDEX "_folders_v_rels_admins_id_idx" ON "_folders_v_rels" USING btree ("admins_id");
  CREATE INDEX "_folders_v_rels_users_id_idx" ON "_folders_v_rels" USING btree ("users_id");
  CREATE INDEX "tags__h_tags_idx" ON "tags" USING btree ("_h_tags_id");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "tags_rels_order_idx" ON "tags_rels" USING btree ("order");
  CREATE INDEX "tags_rels_parent_idx" ON "tags_rels" USING btree ("parent_id");
  CREATE INDEX "tags_rels_path_idx" ON "tags_rels" USING btree ("path");
  CREATE INDEX "tags_rels_admins_id_idx" ON "tags_rels" USING btree ("admins_id");
  CREATE INDEX "tags_rels_users_id_idx" ON "tags_rels" USING btree ("users_id");
  CREATE INDEX "_tags_v_parent_idx" ON "_tags_v" USING btree ("parent_id");
  CREATE INDEX "_tags_v_version_version__h_tags_idx" ON "_tags_v" USING btree ("version__h_tags_id");
  CREATE INDEX "_tags_v_version_version_updated_at_idx" ON "_tags_v" USING btree ("version_updated_at");
  CREATE INDEX "_tags_v_version_version_created_at_idx" ON "_tags_v" USING btree ("version_created_at");
  CREATE INDEX "_tags_v_created_at_idx" ON "_tags_v" USING btree ("created_at");
  CREATE INDEX "_tags_v_updated_at_idx" ON "_tags_v" USING btree ("updated_at");
  CREATE INDEX "_tags_v_rels_order_idx" ON "_tags_v_rels" USING btree ("order");
  CREATE INDEX "_tags_v_rels_parent_idx" ON "_tags_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tags_v_rels_path_idx" ON "_tags_v_rels" USING btree ("path");
  CREATE INDEX "_tags_v_rels_admins_id_idx" ON "_tags_v_rels" USING btree ("admins_id");
  CREATE INDEX "_tags_v_rels_users_id_idx" ON "_tags_v_rels" USING btree ("users_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_admins_id_idx" ON "payload_locked_documents_rels" USING btree ("admins_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_quotes_id_idx" ON "payload_locked_documents_rels" USING btree ("quotes_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("folders_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admins_id_idx" ON "payload_preferences_rels" USING btree ("admins_id");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "payload_llm_instructions_entity_slug_idx" ON "payload_llm_instructions" USING btree ("entity_slug");
  CREATE INDEX "payload_llm_instructions_updated_at_idx" ON "payload_llm_instructions" USING btree ("updated_at");
  CREATE INDEX "payload_llm_instructions_created_at_idx" ON "payload_llm_instructions" USING btree ("created_at");
  CREATE INDEX "payload_llm_instructions_rels_order_idx" ON "payload_llm_instructions_rels" USING btree ("order");
  CREATE INDEX "payload_llm_instructions_rels_parent_idx" ON "payload_llm_instructions_rels" USING btree ("parent_id");
  CREATE INDEX "payload_llm_instructions_rels_path_idx" ON "payload_llm_instructions_rels" USING btree ("path");
  CREATE INDEX "payload_llm_instructions_rels_admins_id_idx" ON "payload_llm_instructions_rels" USING btree ("admins_id");
  CREATE INDEX "payload_llm_instructions_rels_users_id_idx" ON "payload_llm_instructions_rels" USING btree ("users_id");
  CREATE INDEX "company_settings_logo_idx" ON "company_settings" USING btree ("logo_id");
  CREATE INDEX "company_settings_qr_code_idx" ON "company_settings" USING btree ("qr_code_id");
  CREATE INDEX "company_settings_rels_order_idx" ON "company_settings_rels" USING btree ("order");
  CREATE INDEX "company_settings_rels_parent_idx" ON "company_settings_rels" USING btree ("parent_id");
  CREATE INDEX "company_settings_rels_path_idx" ON "company_settings_rels" USING btree ("path");
  CREATE INDEX "company_settings_rels_admins_id_idx" ON "company_settings_rels" USING btree ("admins_id");
  CREATE INDEX "company_settings_rels_users_id_idx" ON "company_settings_rels" USING btree ("users_id");
  CREATE INDEX "_company_settings_v_version_version_logo_idx" ON "_company_settings_v" USING btree ("version_logo_id");
  CREATE INDEX "_company_settings_v_version_version_qr_code_idx" ON "_company_settings_v" USING btree ("version_qr_code_id");
  CREATE INDEX "_company_settings_v_created_at_idx" ON "_company_settings_v" USING btree ("created_at");
  CREATE INDEX "_company_settings_v_updated_at_idx" ON "_company_settings_v" USING btree ("updated_at");
  CREATE INDEX "_company_settings_v_rels_order_idx" ON "_company_settings_v_rels" USING btree ("order");
  CREATE INDEX "_company_settings_v_rels_parent_idx" ON "_company_settings_v_rels" USING btree ("parent_id");
  CREATE INDEX "_company_settings_v_rels_path_idx" ON "_company_settings_v_rels" USING btree ("path");
  CREATE INDEX "_company_settings_v_rels_admins_id_idx" ON "_company_settings_v_rels" USING btree ("admins_id");
  CREATE INDEX "_company_settings_v_rels_users_id_idx" ON "_company_settings_v_rels" USING btree ("users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "admins_sessions" CASCADE;
  DROP TABLE "admins" CASCADE;
  DROP TABLE "admins_rels" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "_users_v_version_sessions" CASCADE;
  DROP TABLE "_users_v" CASCADE;
  DROP TABLE "_users_v_rels" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "projects_rels" CASCADE;
  DROP TABLE "_projects_v" CASCADE;
  DROP TABLE "_projects_v_rels" CASCADE;
  DROP TABLE "quotes_items" CASCADE;
  DROP TABLE "quotes_fees" CASCADE;
  DROP TABLE "quotes" CASCADE;
  DROP TABLE "quotes_rels" CASCADE;
  DROP TABLE "_quotes_v_version_items" CASCADE;
  DROP TABLE "_quotes_v_version_fees" CASCADE;
  DROP TABLE "_quotes_v" CASCADE;
  DROP TABLE "_quotes_v_rels" CASCADE;
  DROP TABLE "products_platforms" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_texts" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_version_platforms" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_texts" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "brands_rels" CASCADE;
  DROP TABLE "_brands_v" CASCADE;
  DROP TABLE "_brands_v_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_rels" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "_categories_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "_media_v" CASCADE;
  DROP TABLE "_media_v_rels" CASCADE;
  DROP TABLE "folders" CASCADE;
  DROP TABLE "folders_rels" CASCADE;
  DROP TABLE "_folders_v" CASCADE;
  DROP TABLE "_folders_v_rels" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_rels" CASCADE;
  DROP TABLE "_tags_v" CASCADE;
  DROP TABLE "_tags_v_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "payload_llm_instructions" CASCADE;
  DROP TABLE "payload_llm_instructions_rels" CASCADE;
  DROP TABLE "company_settings" CASCADE;
  DROP TABLE "company_settings_rels" CASCADE;
  DROP TABLE "_company_settings_v" CASCADE;
  DROP TABLE "_company_settings_v_rels" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_status";
  DROP TYPE "public"."enum__users_v_version_role";
  DROP TYPE "public"."enum__users_v_version_status";
  DROP TYPE "public"."enum_projects_stage";
  DROP TYPE "public"."enum_projects_status";
  DROP TYPE "public"."enum_projects_platform";
  DROP TYPE "public"."enum_projects_risk_level";
  DROP TYPE "public"."enum_projects_waiting_on";
  DROP TYPE "public"."enum__projects_v_version_stage";
  DROP TYPE "public"."enum__projects_v_version_status";
  DROP TYPE "public"."enum__projects_v_version_platform";
  DROP TYPE "public"."enum__projects_v_version_risk_level";
  DROP TYPE "public"."enum__projects_v_version_waiting_on";
  DROP TYPE "public"."enum_quotes_items_device_type";
  DROP TYPE "public"."enum_quotes_status";
  DROP TYPE "public"."enum__quotes_v_version_items_device_type";
  DROP TYPE "public"."enum__quotes_v_version_status";
  DROP TYPE "public"."enum_products_platforms";
  DROP TYPE "public"."enum_products_device_type";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum__products_v_version_platforms";
  DROP TYPE "public"."enum__products_v_version_device_type";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum_payload_llm_instructions_entity_type";`)
}
