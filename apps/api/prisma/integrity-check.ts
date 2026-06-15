import { CampaignStatus, Prisma, ProcessStatus, TenantStatus } from '../src/generated/prisma';
import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    await prisma.$transaction(async (tx) => {
      const tenantA = await tx.tenant.create({
        data: {
          name: `Integrity Tenant A ${suffix}`,
          slug: `integrity-a-${suffix}`,
          status: TenantStatus.ACTIVE,
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          name: `Integrity Tenant B ${suffix}`,
          slug: `integrity-b-${suffix}`,
          status: TenantStatus.ACTIVE,
        },
      });

      const user = await tx.user.create({
        data: {
          email: `integrity-${suffix}@example.test`,
          fullName: 'Integrity User',
        },
      });

      const membership = await tx.tenantMembership.create({
        data: {
          tenantId: tenantA.id,
          userId: user.id,
        },
      });

      const role = await tx.role.upsert({
        where: { code: 'integrity_role' },
        create: { code: 'integrity_role', name: 'Integrity Role', isSystem: true },
        update: {},
      });

      await tx.membershipRole.create({
        data: {
          membershipId: membership.id,
          roleId: role.id,
        },
      });

      const direction = await tx.direction.create({
        data: {
          tenantId: tenantA.id,
          name: 'Integrity Direction',
          code: `integrity-${suffix}`,
        },
      });

      await tx.membershipDirection.create({
        data: {
          membershipId: membership.id,
          directionId: direction.id,
        },
      });

      const category = await tx.processCategory.create({
        data: {
          tenantId: tenantA.id,
          name: 'Integrity Category',
          code: `integrity-${suffix}`,
        },
      });

      const campaign = await tx.campaign.create({
        data: {
          tenantId: tenantA.id,
          name: 'Integrity Campaign',
          status: CampaignStatus.ACTIVE,
        },
      });

      const process = await tx.process.create({
        data: {
          tenantId: tenantA.id,
          directionId: direction.id,
          campaignId: campaign.id,
          categoryId: category.id,
          code: `integrity-${suffix}`,
          name: 'Integrity Process',
          status: ProcessStatus.IN_PROGRESS,
        },
      });

      const activity = await tx.processActivity.create({
        data: {
          tenantId: tenantA.id,
          processId: process.id,
          code: `activity-${suffix}`,
          name: 'Integrity Activity',
          sortOrder: 1,
        },
      });

      const actor = await tx.actor.create({
        data: {
          tenantId: tenantA.id,
          directionId: direction.id,
          name: 'Integrity Actor',
        },
      });

      await tx.processActorRole.create({
        data: {
          tenantId: tenantA.id,
          processId: process.id,
          activityId: activity.id,
          actorId: actor.id,
          raciRole: 'RESPONSIBLE',
        },
      });

      const tenantAProcessCount = await tx.process.count({ where: { tenantId: tenantA.id } });
      const tenantBProcessCount = await tx.process.count({ where: { tenantId: tenantB.id } });
      assert(tenantAProcessCount === 1, 'Tenant A process count should be isolated to 1.');
      assert(tenantBProcessCount === 0, 'Tenant B must not see Tenant A processes when filtered.');

      await tx.direction.update({
        where: { id: direction.id },
        data: { deletedAt: new Date() },
      });
      const softDeleted = await tx.direction.findUniqueOrThrow({ where: { id: direction.id } });
      assert(softDeleted.deletedAt, 'Soft delete timestamp should be set.');

      const uniqueIndexes = await tx.$queryRaw<{ indexname: string }[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'process_discovery'
          AND indexname IN (
            'users_email_key',
            'tenant_memberships_tenant_id_user_id_key',
            'directions_tenant_id_code_key',
            'processes_tenant_id_code_key'
          )
      `;
      assert(
        uniqueIndexes.length === 4,
        'Expected unique tenant and identity indexes are missing.',
      );

      throw new Error('ROLLBACK_INTEGRITY_CHECK');
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLLBACK_INTEGRITY_CHECK') {
      console.log('Integrity checks passed and transaction rolled back.');
      return;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new Error(`Prisma integrity check failed: ${error.code}`);
    }

    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
