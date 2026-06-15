CREATE TABLE "bpmn_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "rule_version" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "bpmn_json" JSONB NOT NULL,
    "bpmn_xml" TEXT NOT NULL,
    "validation_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "blocking_issues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
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

    CONSTRAINT "bpmn_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bpmn_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "rule_version" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "validation_status" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpmn_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bpmn_models_tenant_id_process_id_generated_at_idx" ON "bpmn_models"("tenant_id", "process_id", "generated_at");
CREATE INDEX "bpmn_models_tenant_id_process_id_validation_status_idx" ON "bpmn_models"("tenant_id", "process_id", "validation_status");
CREATE INDEX "bpmn_models_tenant_id_process_id_source_hash_idx" ON "bpmn_models"("tenant_id", "process_id", "source_hash");
CREATE UNIQUE INDEX "bpmn_versions_tenant_id_process_id_version_number_key" ON "bpmn_versions"("tenant_id", "process_id", "version_number");
CREATE INDEX "bpmn_versions_tenant_id_process_id_created_at_idx" ON "bpmn_versions"("tenant_id", "process_id", "created_at");

ALTER TABLE "bpmn_models" ADD CONSTRAINT "bpmn_models_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bpmn_models" ADD CONSTRAINT "bpmn_models_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bpmn_versions" ADD CONSTRAINT "bpmn_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bpmn_versions" ADD CONSTRAINT "bpmn_versions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bpmn_versions" ADD CONSTRAINT "bpmn_versions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "bpmn_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
