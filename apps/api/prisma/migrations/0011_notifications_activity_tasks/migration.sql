-- Extend in-app notification events for Lot 15.
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'INVITATION_RECEIVED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'DIRECTION_ASSIGNED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'REFERENT_REMINDED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCESS_READY_FOR_REVIEW';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCESS_SUBMITTED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_STARTED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCESS_RESUBMITTED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCESS_APPROVED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCESS_PUBLISHED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'PROCEDURE_PUBLISHED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'EXPORT_COMPLETED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'EXPORT_FAILED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'COMMENT_CREATED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'MENTION_CREATED';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'MOROCCO_COMPLIANCE_ALERT';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'QUALITY_BLOCKING_ISSUE';
ALTER TYPE "process_discovery"."NotificationType" ADD VALUE IF NOT EXISTS 'DEADLINE_APPROACHING';

ALTER TABLE "process_discovery"."notifications"
ADD COLUMN "recipient_membership_id" UUID,
ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'info',
ADD COLUMN "action_url" TEXT,
ADD COLUMN "resource_type" TEXT,
ADD COLUMN "resource_id" UUID,
ADD COLUMN "expires_at" TIMESTAMPTZ(6);

CREATE INDEX "notifications_tenant_id_resource_type_resource_id_idx"
ON "process_discovery"."notifications"("tenant_id", "resource_type", "resource_id");

ALTER TABLE "process_discovery"."notification_preferences"
ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'immediate',
ADD COLUMN "language" TEXT NOT NULL DEFAULT 'fr',
ADD COLUMN "quiet_hours_start" TEXT,
ADD COLUMN "quiet_hours_end" TEXT;

CREATE TYPE "process_discovery"."TaskItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "process_discovery"."TaskItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "process_discovery"."task_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "assigned_to_user_id" UUID,
  "assigned_to_membership_id" UUID,
  "created_by" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "process_discovery"."TaskItemStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "process_discovery"."TaskItemPriority" NOT NULL DEFAULT 'MEDIUM',
  "due_date" TIMESTAMPTZ(6),
  "direction_id" UUID,
  "process_id" UUID,
  "resource_type" TEXT,
  "resource_id" UUID,
  "action_url" TEXT,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "task_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_items_tenant_id_assigned_to_user_id_status_idx"
ON "process_discovery"."task_items"("tenant_id", "assigned_to_user_id", "status");

CREATE INDEX "task_items_tenant_id_direction_id_idx"
ON "process_discovery"."task_items"("tenant_id", "direction_id");

CREATE INDEX "task_items_tenant_id_process_id_idx"
ON "process_discovery"."task_items"("tenant_id", "process_id");

ALTER TABLE "process_discovery"."task_items"
ADD CONSTRAINT "task_items_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "process_discovery"."tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
