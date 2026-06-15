ALTER TABLE "risks" ADD COLUMN "risk_family" TEXT,
ADD COLUMN "inherent_score" INTEGER,
ADD COLUMN "residual_probability" INTEGER,
ADD COLUMN "residual_impact" INTEGER,
ADD COLUMN "residual_score" INTEGER,
ADD COLUMN "existing_controls" TEXT,
ADD COLUMN "control_owner" TEXT,
ADD COLUMN "action_plan" TEXT,
ADD COLUMN "evidence_required" TEXT,
ADD COLUMN "audit_relevance" TEXT,
ADD COLUMN "court_of_accounts_relevance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "legal_or_regulatory_reference" TEXT;

CREATE TABLE "morocco_process_compliances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "is_user_facing_process" BOOLEAN NOT NULL DEFAULT false,
    "law_55_19_applicable" BOOLEAN NOT NULL DEFAULT false,
    "administrative_procedure_type" TEXT,
    "user_category" TEXT,
    "current_channel" TEXT,
    "target_channel" TEXT,
    "simplification_priority" TEXT,
    "digitalization_priority" TEXT,
    "current_processing_time_days" INTEGER,
    "target_processing_time_days" INTEGER,
    "required_documents_count" INTEGER,
    "requested_copies_count" INTEGER,
    "physical_visits_required" INTEGER,
    "fees_required" BOOLEAN,
    "legal_reference" TEXT,
    "procedure_owner_entity" TEXT,
    "public_service_portal_url" TEXT,
    "observations" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "morocco_process_compliances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_log_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID,
    "file_name" TEXT NOT NULL,
    "source_format" TEXT NOT NULL DEFAULT 'CSV',
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "column_mapping" JSONB,
    "validation_report" JSONB,
    "basic_analysis" JSONB,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_log_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_log_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "process_id" UUID,
    "case_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,
    "raw_payload" JSONB,

    CONSTRAINT "event_log_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_log_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "case_ref_id" UUID,
    "process_id" UUID,
    "case_id" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "event_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "lifecycle_transition" TEXT,
    "resource" TEXT,
    "role" TEXT,
    "department" TEXT,
    "application" TEXT,
    "cost" DECIMAL(14,2),
    "channel" TEXT,
    "status" TEXT,
    "raw_payload" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_log_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_log_attributes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "event_id" UUID,
    "case_ref_id" UUID,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "value_type" TEXT,

    CONSTRAINT "event_log_attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "process_mining_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID,
    "import_id" UUID,
    "run_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metrics" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "process_mining_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "discovered_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID,
    "run_id" UUID NOT NULL,
    "model_type" TEXT NOT NULL,
    "bpmn_xml" TEXT,
    "bpmn_json" JSONB,
    "source_model_hash" TEXT,
    "export_version" TEXT,
    "generated_at" TIMESTAMPTZ(6),
    "generated_by" UUID,
    "payload" JSONB,

    CONSTRAINT "discovered_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conformance_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID,
    "run_id" UUID NOT NULL,
    "result" JSONB,
    "score" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conformance_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bottleneck_analysis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID,
    "run_id" UUID NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bottleneck_analysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bpmn_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "bpmn_export_format" TEXT NOT NULL DEFAULT 'BPMN_2_0',
    "compatibility_targets" JSONB,
    "bpmn_xml" TEXT,
    "bpmn_json" JSONB,
    "source_model_hash" TEXT,
    "export_version" TEXT,
    "generated_at" TIMESTAMPTZ(6),
    "generated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bpmn_exports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "morocco_process_compliances_process_id_key" ON "morocco_process_compliances"("process_id");
CREATE INDEX "morocco_process_compliances_tenant_id_is_user_facing_process_idx" ON "morocco_process_compliances"("tenant_id", "is_user_facing_process");
CREATE INDEX "morocco_process_compliances_tenant_id_law_55_19_applicable_idx" ON "morocco_process_compliances"("tenant_id", "law_55_19_applicable");
CREATE INDEX "morocco_process_compliances_tenant_id_simplification_priority_idx" ON "morocco_process_compliances"("tenant_id", "simplification_priority");
CREATE INDEX "morocco_process_compliances_tenant_id_digitalization_priority_idx" ON "morocco_process_compliances"("tenant_id", "digitalization_priority");
CREATE INDEX "event_log_imports_tenant_id_process_id_created_at_idx" ON "event_log_imports"("tenant_id", "process_id", "created_at");
CREATE INDEX "event_log_imports_tenant_id_status_idx" ON "event_log_imports"("tenant_id", "status");
CREATE UNIQUE INDEX "event_log_cases_tenant_id_import_id_case_id_key" ON "event_log_cases"("tenant_id", "import_id", "case_id");
CREATE INDEX "event_log_cases_tenant_id_process_id_idx" ON "event_log_cases"("tenant_id", "process_id");
CREATE INDEX "event_log_events_tenant_id_import_id_case_id_event_timestamp_idx" ON "event_log_events"("tenant_id", "import_id", "case_id", "event_timestamp");
CREATE INDEX "event_log_events_tenant_id_process_id_activity_name_idx" ON "event_log_events"("tenant_id", "process_id", "activity_name");
CREATE INDEX "event_log_attributes_tenant_id_import_id_name_idx" ON "event_log_attributes"("tenant_id", "import_id", "name");
CREATE INDEX "process_mining_runs_tenant_id_process_id_created_at_idx" ON "process_mining_runs"("tenant_id", "process_id", "created_at");
CREATE INDEX "process_mining_runs_tenant_id_import_id_idx" ON "process_mining_runs"("tenant_id", "import_id");
CREATE INDEX "discovered_models_tenant_id_process_id_idx" ON "discovered_models"("tenant_id", "process_id");
CREATE INDEX "discovered_models_tenant_id_run_id_idx" ON "discovered_models"("tenant_id", "run_id");
CREATE INDEX "conformance_checks_tenant_id_process_id_idx" ON "conformance_checks"("tenant_id", "process_id");
CREATE INDEX "conformance_checks_tenant_id_run_id_idx" ON "conformance_checks"("tenant_id", "run_id");
CREATE INDEX "bottleneck_analysis_tenant_id_process_id_idx" ON "bottleneck_analysis"("tenant_id", "process_id");
CREATE INDEX "bottleneck_analysis_tenant_id_run_id_idx" ON "bottleneck_analysis"("tenant_id", "run_id");
CREATE INDEX "bpmn_exports_tenant_id_process_id_created_at_idx" ON "bpmn_exports"("tenant_id", "process_id", "created_at");

ALTER TABLE "morocco_process_compliances" ADD CONSTRAINT "morocco_process_compliances_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "morocco_process_compliances" ADD CONSTRAINT "morocco_process_compliances_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_log_imports" ADD CONSTRAINT "event_log_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_log_imports" ADD CONSTRAINT "event_log_imports_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_log_cases" ADD CONSTRAINT "event_log_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_log_cases" ADD CONSTRAINT "event_log_cases_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "event_log_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_log_cases" ADD CONSTRAINT "event_log_cases_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_log_events" ADD CONSTRAINT "event_log_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_log_events" ADD CONSTRAINT "event_log_events_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "event_log_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_log_events" ADD CONSTRAINT "event_log_events_case_ref_id_fkey" FOREIGN KEY ("case_ref_id") REFERENCES "event_log_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_log_events" ADD CONSTRAINT "event_log_events_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_log_attributes" ADD CONSTRAINT "event_log_attributes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_log_attributes" ADD CONSTRAINT "event_log_attributes_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "event_log_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_log_attributes" ADD CONSTRAINT "event_log_attributes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_log_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_log_attributes" ADD CONSTRAINT "event_log_attributes_case_ref_id_fkey" FOREIGN KEY ("case_ref_id") REFERENCES "event_log_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "process_mining_runs" ADD CONSTRAINT "process_mining_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "process_mining_runs" ADD CONSTRAINT "process_mining_runs_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "process_mining_runs" ADD CONSTRAINT "process_mining_runs_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "event_log_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discovered_models" ADD CONSTRAINT "discovered_models_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discovered_models" ADD CONSTRAINT "discovered_models_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "discovered_models" ADD CONSTRAINT "discovered_models_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "process_mining_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conformance_checks" ADD CONSTRAINT "conformance_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conformance_checks" ADD CONSTRAINT "conformance_checks_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conformance_checks" ADD CONSTRAINT "conformance_checks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "process_mining_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bottleneck_analysis" ADD CONSTRAINT "bottleneck_analysis_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bottleneck_analysis" ADD CONSTRAINT "bottleneck_analysis_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bottleneck_analysis" ADD CONSTRAINT "bottleneck_analysis_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "process_mining_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bpmn_exports" ADD CONSTRAINT "bpmn_exports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bpmn_exports" ADD CONSTRAINT "bpmn_exports_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
