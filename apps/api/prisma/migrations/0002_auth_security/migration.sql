-- CreateEnum
CREATE TYPE "AuthActionTokenType" AS ENUM ('INVITATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "created_ip" TEXT,
ADD COLUMN     "family_id" UUID NOT NULL,
ADD COLUMN     "last_used_ip" TEXT,
ADD COLUMN     "replaced_by_token_id" UUID,
ADD COLUMN     "used_at" TIMESTAMPTZ(6),
ADD COLUMN     "user_agent" TEXT;

-- CreateTable
CREATE TABLE "auth_action_tokens" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "membership_id" UUID,
    "token_hash" TEXT NOT NULL,
    "type" "AuthActionTokenType" NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_action_tokens_tenant_id_type_expires_at_idx" ON "auth_action_tokens"("tenant_id", "type", "expires_at");

-- CreateIndex
CREATE INDEX "auth_action_tokens_user_id_type_expires_at_idx" ON "auth_action_tokens"("user_id", "type", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_action_tokens_token_hash_key" ON "auth_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AddForeignKey
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_action_tokens" ADD CONSTRAINT "auth_action_tokens_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
