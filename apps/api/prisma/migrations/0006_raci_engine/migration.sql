CREATE TABLE "raci_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "rule_version" TEXT NOT NULL,
    "matrix" JSONB NOT NULL,
    "activities" JSONB NOT NULL,
    "actors" JSONB NOT NULL,
    "blocking_issues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "quality_score" DECIMAL(5,2) NOT NULL,
    "validation_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source_hash" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "validated_by" UUID,
    "invalidated_at" TIMESTAMPTZ(6),
    "invalidated_by" UUID,
    "validation_comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "raci_assessments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "raci_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "rule_version" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "validation_status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raci_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "raci_assessments_tenant_id_process_id_generated_at_idx" ON "raci_assessments"("tenant_id", "process_id", "generated_at");
CREATE INDEX "raci_assessments_tenant_id_process_id_validation_status_idx" ON "raci_assessments"("tenant_id", "process_id", "validation_status");
CREATE INDEX "raci_assessments_tenant_id_process_id_source_hash_idx" ON "raci_assessments"("tenant_id", "process_id", "source_hash");
CREATE UNIQUE INDEX "raci_versions_tenant_id_process_id_version_number_key" ON "raci_versions"("tenant_id", "process_id", "version_number");
CREATE INDEX "raci_versions_tenant_id_process_id_created_at_idx" ON "raci_versions"("tenant_id", "process_id", "created_at");

ALTER TABLE "raci_assessments" ADD CONSTRAINT "raci_assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "raci_assessments" ADD CONSTRAINT "raci_assessments_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raci_versions" ADD CONSTRAINT "raci_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "raci_versions" ADD CONSTRAINT "raci_versions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raci_versions" ADD CONSTRAINT "raci_versions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "raci_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
