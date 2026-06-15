-- AlterTable
ALTER TABLE "support_access_grants" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "revocation_reason" TEXT,
ADD COLUMN     "revoked_by_id" UUID;
