ALTER TABLE "process_discovery"."completeness_assessments"
  ADD COLUMN "section_details" JSONB,
  ADD COLUMN "recommendations" JSONB,
  ADD COLUMN "can_submit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "quality_status" TEXT,
  ADD COLUMN "calculated_by" UUID,
  ADD COLUMN "source_lock_version" INTEGER,
  ADD COLUMN "snapshot_hash" TEXT;
