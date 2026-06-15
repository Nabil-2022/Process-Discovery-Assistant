import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

import { MembershipStatus, TenantStatus, UserStatus } from '../src/generated/prisma';
import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();
const scrypt = promisify(scryptCallback);

const mapDirections = [
  'Secrétariat Général',
  'Communication',
  'Conseil de la Direction Générale',
  'Trésorerie / Paierie',
  'Recherche',
  "Production de l'Information : Dépêche et Médias",
  'Gestion de la Documentation',
  'MAP Intelligence',
  'Marketing et Commercial',
  'Gestion Financière',
  'Moyens Généraux',
  'Ressources Humaines',
  'Systèmes de Production / DSI / Broadcast',
];

const roles = [
  ['super_admin', 'Super Admin HiGroup'],
  ['tenant_admin', 'Tenant Admin'],
  ['direction_referent', 'Référent de direction'],
  ['validator', 'Validateur'],
  ['consultant', 'Consultant'],
  ['readonly', 'Lecture seule'],
] as const;

const permissions = [
  ['manage_platform', 'platform', 'manage'],
  ['manage_tenants', 'tenants', 'manage'],
  ['manage_support_grants', 'support_access_grants', 'manage'],
  ['manage_users', 'users', 'manage'],
  ['manage_templates', 'templates', 'manage'],
  ['manage_campaigns', 'campaigns', 'manage'],
  ['manage_directions', 'directions', 'manage'],
  ['create_process', 'processes', 'create'],
  ['update_process_working_copy', 'processes', 'update_working_copy'],
  ['submit_process', 'processes', 'submit'],
  ['review_process', 'processes', 'review'],
  ['request_changes', 'processes', 'request_changes'],
  ['approve_process', 'processes', 'approve'],
  ['publish_process', 'processes', 'publish'],
  ['export_process', 'exports', 'create'],
  ['view_sensitive_audit', 'audit_logs', 'view_sensitive'],
  ['manage_ai_suggestions', 'ai_suggestions', 'manage'],
] as const;

const rolePermissions: Record<string, string[]> = {
  super_admin: [
    'manage_platform',
    'manage_tenants',
    'manage_support_grants',
    'manage_templates',
    'view_sensitive_audit',
  ],
  tenant_admin: [
    'manage_users',
    'manage_campaigns',
    'manage_directions',
    'create_process',
    'update_process_working_copy',
    'submit_process',
    'review_process',
    'request_changes',
    'approve_process',
    'publish_process',
    'export_process',
    'manage_ai_suggestions',
  ],
  direction_referent: [
    'create_process',
    'update_process_working_copy',
    'submit_process',
    'export_process',
    'manage_ai_suggestions',
  ],
  validator: ['review_process', 'request_changes', 'approve_process', 'export_process'],
  consultant: ['update_process_working_copy', 'export_process', 'manage_ai_suggestions'],
  readonly: ['export_process'],
};

const features = [
  ['process_discovery', 'Process Discovery'],
  ['bpmn', 'BPMN déterministe'],
  ['raci', 'RACI déterministe'],
  ['ai_copilot', 'Copilote IA encadré'],
  ['exports', 'Exports'],
] as const;

function codeFromName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function seedRolesAndPermissions() {
  const roleRecords = new Map<string, { id: string }>();
  const permissionRecords = new Map<string, { id: string }>();

  for (const [code, name] of roles) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name, isSystem: true },
      update: { name, isSystem: true },
      select: { id: true },
    });
    roleRecords.set(code, role);
  }

  for (const [code, resource, action] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { code },
      create: { code, resource, action },
      update: { resource, action },
      select: { id: true },
    });
    permissionRecords.set(code, permission);
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
    const role = roleRecords.get(roleCode);
    if (!role) {
      continue;
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionRecords.get(permissionCode);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
        update: {},
      });
    }
  }
}

async function seedFeatures() {
  for (const [code, name] of features) {
    await prisma.feature.upsert({
      where: { code },
      create: { code, name },
      update: { name },
    });
  }
}

async function seedMapTemplate() {
  const template = await prisma.template.upsert({
    where: { code: 'map' },
    create: {
      code: 'map',
      name: 'MAP',
      description: 'Template configurable initial pour la MAP.',
    },
    update: {
      name: 'MAP',
      description: 'Template configurable initial pour la MAP.',
      isActive: true,
    },
  });

  const configuration = {
    language: 'fr',
    steps: [
      'identification',
      'description',
      'activities',
      'actors_responsibilities',
      'documents',
      'applications',
      'kpis',
      'risks_controls',
      'pain_points',
      'automation_needs',
      'summary_submission',
    ],
    completeness: {
      threshold: 80,
      ruleVersion: 'map-v1',
    },
  };

  const version = await prisma.templateVersion.upsert({
    where: {
      templateId_versionNumber: {
        templateId: template.id,
        versionNumber: 1,
      },
    },
    create: {
      templateId: template.id,
      versionNumber: 1,
      status: 'published',
      configuration,
    },
    update: {
      status: 'published',
      configuration,
    },
  });

  for (const [index, name] of mapDirections.entries()) {
    const code = codeFromName(name);
    await prisma.templateDirection.upsert({
      where: {
        templateVersionId_name: {
          templateVersionId: version.id,
          name,
        },
      },
      create: {
        templateVersionId: version.id,
        name,
        code,
        sortOrder: index + 1,
      },
      update: {
        code,
        sortOrder: index + 1,
      },
    });
  }

  return { template, version, configuration };
}

async function seedDemoMapTenant(templateVersionId: string, frozenConfig: unknown) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'map-demo' },
    create: {
      name: 'MAP Démonstration',
      slug: 'map-demo',
      status: TenantStatus.ACTIVE,
      deploymentMode: 'demo',
    },
    update: {
      name: 'MAP Démonstration',
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.tenantTemplate.upsert({
    where: {
      tenantId_templateVersionId: {
        tenantId: tenant.id,
        templateVersionId,
      },
    },
    create: {
      tenantId: tenant.id,
      templateVersionId,
      frozenConfig: frozenConfig as object,
    },
    update: {
      frozenConfig: frozenConfig as object,
    },
  });

  for (const [index, name] of mapDirections.entries()) {
    const code = codeFromName(name);
    await prisma.direction.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code,
        },
      },
      create: {
        tenantId: tenant.id,
        name,
        code,
        status: 'active',
      },
      update: {
        name,
        status: 'active',
        lockVersion: { increment: 1 },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        action: 'seed_direction',
        resourceType: 'directions',
        result: 'success',
        metadata: { code, sortOrder: index + 1 },
      },
    });
  }

  return tenant;
}

async function seedOptionalSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'Skipping super admin seed: SEED_SUPER_ADMIN_EMAIL or SEED_SUPER_ADMIN_PASSWORD is missing.',
    );
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: 'Super Admin Développement',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'super_admin' } });
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    create: {
      userId: user.id,
      roleId: role.id,
    },
    update: {},
  });
}

async function seedOptionalMapTenantAdmin() {
  const email = process.env.SEED_MAP_TENANT_ADMIN_EMAIL;
  const password = process.env.SEED_MAP_TENANT_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'Skipping MAP tenant admin seed: SEED_MAP_TENANT_ADMIN_EMAIL or SEED_MAP_TENANT_ADMIN_PASSWORD is missing.',
    );
    return;
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'map-demo' } });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: 'Tenant Admin MAP Développement',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    update: {
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
    update: {
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
  });

  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'tenant_admin' } });
  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: role.id,
      },
    },
    create: {
      membershipId: membership.id,
      roleId: role.id,
    },
    update: {},
  });
}

async function main() {
  await seedRolesAndPermissions();
  await seedFeatures();
  const { version, configuration } = await seedMapTemplate();
  await seedDemoMapTenant(version.id, configuration);
  await seedOptionalSuperAdmin();
  await seedOptionalMapTenantAdmin();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
