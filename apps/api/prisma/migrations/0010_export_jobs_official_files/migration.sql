ALTER TYPE "process_discovery"."ExportJobStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "process_discovery"."ExportFormat" ADD VALUE IF NOT EXISTS 'CSV';

ALTER TABLE "process_discovery"."export_jobs"
  ADD COLUMN IF NOT EXISTS "direction_id" UUID,
  ADD COLUMN IF NOT EXISTS "file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "size" BIGINT,
  ADD COLUMN IF NOT EXISTS "checksum" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "export_jobs_tenant_id_direction_id_idx"
  ON "process_discovery"."export_jobs"("tenant_id", "direction_id");
CREATE INDEX IF NOT EXISTS "export_jobs_tenant_id_export_type_format_idx"
  ON "process_discovery"."export_jobs"("tenant_id", "export_type", "format");
