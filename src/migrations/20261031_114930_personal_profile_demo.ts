import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "company_profile_name" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_slogan" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_phone" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_email" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_address" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_logo_id" uuid;
  ALTER TABLE "users" ADD COLUMN "company_profile_qr_code_id" uuid;
  ALTER TABLE "users" ADD COLUMN "company_profile_qr_caption" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_quote_notes" varchar;
  ALTER TABLE "users" ADD COLUMN "company_profile_contract_terms" varchar DEFAULT '1. 乙方按附件《报价明细》提供智能家居设备，并负责安装、调试和使用培训。
  2. 甲方应保证现场具备安装条件（水电、网络、装修进度等）；因现场条件导致的延期，工期相应顺延。
  3. 设备品牌、型号以附件为准；如需变更，双方协商一致后另行确认，费用多退少补。
  4. 质保期内，非人为损坏的设备故障由乙方免费维修或更换；人为损坏、不可抗力及质保期外的维修按实际成本收费。
  5. 安装调试完成后，甲方应在 3 日内组织验收；逾期未验收且已实际使用的，视为验收合格。
  6. 本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。';
  ALTER TABLE "users" ADD COLUMN "company_profile_print_product_images" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "company_profile_document_defaults" jsonb;
  ALTER TABLE "users" ADD COLUMN "company_profile_disabled_plugins" jsonb;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_name" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_slogan" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_phone" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_email" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_address" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_logo_id" uuid;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_qr_code_id" uuid;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_qr_caption" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_quote_notes" varchar;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_contract_terms" varchar DEFAULT '1. 乙方按附件《报价明细》提供智能家居设备，并负责安装、调试和使用培训。
  2. 甲方应保证现场具备安装条件（水电、网络、装修进度等）；因现场条件导致的延期，工期相应顺延。
  3. 设备品牌、型号以附件为准；如需变更，双方协商一致后另行确认，费用多退少补。
  4. 质保期内，非人为损坏的设备故障由乙方免费维修或更换；人为损坏、不可抗力及质保期外的维修按实际成本收费。
  5. 安装调试完成后，甲方应在 3 日内组织验收；逾期未验收且已实际使用的，视为验收合格。
  6. 本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。';
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_print_product_images" boolean DEFAULT true;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_document_defaults" jsonb;
  ALTER TABLE "_users_v" ADD COLUMN "version_company_profile_disabled_plugins" jsonb;
  ALTER TABLE "projects" ADD COLUMN "is_demo_template" boolean DEFAULT false;
  ALTER TABLE "_projects_v" ADD COLUMN "version_is_demo_template" boolean DEFAULT false;
  ALTER TABLE "users" ADD CONSTRAINT "users_company_profile_logo_id_media_id_fk" FOREIGN KEY ("company_profile_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_company_profile_qr_code_id_media_id_fk" FOREIGN KEY ("company_profile_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_users_v" ADD CONSTRAINT "_users_v_version_company_profile_logo_id_media_id_fk" FOREIGN KEY ("version_company_profile_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_users_v" ADD CONSTRAINT "_users_v_version_company_profile_qr_code_id_media_id_fk" FOREIGN KEY ("version_company_profile_qr_code_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_company_profile_company_profile_logo_idx" ON "users" USING btree ("company_profile_logo_id");
  CREATE INDEX "users_company_profile_company_profile_qr_code_idx" ON "users" USING btree ("company_profile_qr_code_id");
  CREATE INDEX "_users_v_version_company_profile_version_company_profile_idx" ON "_users_v" USING btree ("version_company_profile_logo_id");
  CREATE INDEX "_users_v_version_company_profile_version_company_profi_1_idx" ON "_users_v" USING btree ("version_company_profile_qr_code_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT "users_company_profile_logo_id_media_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_company_profile_qr_code_id_media_id_fk";
  
  ALTER TABLE "_users_v" DROP CONSTRAINT "_users_v_version_company_profile_logo_id_media_id_fk";
  
  ALTER TABLE "_users_v" DROP CONSTRAINT "_users_v_version_company_profile_qr_code_id_media_id_fk";
  
  DROP INDEX "users_company_profile_company_profile_logo_idx";
  DROP INDEX "users_company_profile_company_profile_qr_code_idx";
  DROP INDEX "_users_v_version_company_profile_version_company_profile_idx";
  DROP INDEX "_users_v_version_company_profile_version_company_profi_1_idx";
  ALTER TABLE "users" DROP COLUMN "company_profile_name";
  ALTER TABLE "users" DROP COLUMN "company_profile_slogan";
  ALTER TABLE "users" DROP COLUMN "company_profile_phone";
  ALTER TABLE "users" DROP COLUMN "company_profile_email";
  ALTER TABLE "users" DROP COLUMN "company_profile_address";
  ALTER TABLE "users" DROP COLUMN "company_profile_logo_id";
  ALTER TABLE "users" DROP COLUMN "company_profile_qr_code_id";
  ALTER TABLE "users" DROP COLUMN "company_profile_qr_caption";
  ALTER TABLE "users" DROP COLUMN "company_profile_quote_notes";
  ALTER TABLE "users" DROP COLUMN "company_profile_contract_terms";
  ALTER TABLE "users" DROP COLUMN "company_profile_print_product_images";
  ALTER TABLE "users" DROP COLUMN "company_profile_document_defaults";
  ALTER TABLE "users" DROP COLUMN "company_profile_disabled_plugins";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_name";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_slogan";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_phone";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_email";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_address";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_logo_id";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_qr_code_id";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_qr_caption";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_quote_notes";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_contract_terms";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_print_product_images";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_document_defaults";
  ALTER TABLE "_users_v" DROP COLUMN "version_company_profile_disabled_plugins";
  ALTER TABLE "projects" DROP COLUMN "is_demo_template";
  ALTER TABLE "_projects_v" DROP COLUMN "version_is_demo_template";`)
}
