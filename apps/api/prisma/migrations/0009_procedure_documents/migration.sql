CREATE TABLE IF NOT EXISTS "process_discovery"."procedure_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "process_id" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "version_number" INTEGER NOT NULL DEFAULT 1,
  "rule_version" TEXT NOT NULL,
  "source_hash" TEXT NOT NULL,
  "document_owner_id" UUID,
  "approver_id" UUID,
  "approved_by_id" UUID,
  "published_by_id" UUID,
  "confidentiality_level" TEXT NOT NULL DEFAULT 'internal',
  "effective_date" TIMESTAMPTZ(6),
  "review_date" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "archived_at" TIMESTAMPTZ(6),
  "supersedes_reference" TEXT,
  "superseded_by_reference" TEXT,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "procedure_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "process_discovery"."procedure_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "procedure_id" UUID NOT NULL,
  "section_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "deterministic_content" JSONB,
  "manual_content" JSONB,
  "ai_content" JSONB,
  "source" TEXT NOT NULL DEFAULT 'deterministic',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "order" INTEGER NOT NULL,
  "comment" TEXT,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procedure_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "process_discovery"."procedure_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "process_id" UUID NOT NULL,
  "procedure_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "source_hash" TEXT NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procedure_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "process_discovery"."procedure_approvals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "procedure_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "comment" TEXT,
  "decided_by" UUID,
  "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procedure_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_documents_tenant_id_process_id_version_number_key"
  ON "process_discovery"."procedure_documents"("tenant_id", "process_id", "version_number");
CREATE INDEX IF NOT EXISTS "procedure_documents_tenant_id_process_id_status_idx"
  ON "process_discovery"."procedure_documents"("tenant_id", "process_id", "status");
CREATE INDEX IF NOT EXISTS "procedure_documents_tenant_id_reference_idx"
  ON "process_discovery"."procedure_documents"("tenant_id", "reference");

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_sections_procedure_id_section_key_key"
  ON "process_discovery"."procedure_sections"("procedure_id", "section_key");
CREATE INDEX IF NOT EXISTS "procedure_sections_tenant_id_procedure_id_order_idx"
  ON "process_discovery"."procedure_sections"("tenant_id", "procedure_id", "order");

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_versions_tenant_id_process_id_version_number_key"
  ON "process_discovery"."procedure_versions"("tenant_id", "process_id", "version_number");
CREATE INDEX IF NOT EXISTS "procedure_versions_tenant_id_process_id_created_at_idx"
  ON "process_discovery"."procedure_versions"("tenant_id", "process_id", "created_at");

CREATE INDEX IF NOT EXISTS "procedure_approvals_tenant_id_procedure_id_decided_at_idx"
  ON "process_discovery"."procedure_approvals"("tenant_id", "procedure_id", "decided_at");

ALTER TABLE "process_discovery"."procedure_documents"
  ADD CONSTRAINT "procedure_documents_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "process_discovery"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_discovery"."procedure_documents"
  ADD CONSTRAINT "procedure_documents_process_id_fkey"
  FOREIGN KEY ("process_id") REFERENCES "process_discovery"."processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "process_discovery"."procedure_sections"
  ADD CONSTRAINT "procedure_sections_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "process_discovery"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_discovery"."procedure_sections"
  ADD CONSTRAINT "procedure_sections_procedure_id_fkey"
  FOREIGN KEY ("procedure_id") REFERENCES "process_discovery"."procedure_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "process_discovery"."procedure_versions"
  ADD CONSTRAINT "procedure_versions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "process_discovery"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_discovery"."procedure_versions"
  ADD CONSTRAINT "procedure_versions_process_id_fkey"
  FOREIGN KEY ("process_id") REFERENCES "process_discovery"."processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_discovery"."procedure_versions"
  ADD CONSTRAINT "procedure_versions_procedure_id_fkey"
  FOREIGN KEY ("procedure_id") REFERENCES "process_discovery"."procedure_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "process_discovery"."procedure_approvals"
  ADD CONSTRAINT "procedure_approvals_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "process_discovery"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_discovery"."procedure_approvals"
  ADD CONSTRAINT "procedure_approvals_procedure_id_fkey"
  FOREIGN KEY ("procedure_id") REFERENCES "process_discovery"."procedure_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
