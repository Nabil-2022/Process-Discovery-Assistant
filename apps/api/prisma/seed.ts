import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

import {
  DocumentStatus,
  MembershipStatus,
  RaciRole,
  RiskLevel,
  TenantStatus,
  UserStatus,
} from '../src/generated/prisma';
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

async function seedDemoFinanceProcess() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'map-demo' } });

  const direction = await prisma.direction.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'FIN',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Direction Finance',
      code: 'FIN',
      status: 'active',
    },
    update: {
      name: 'Direction Finance',
      status: 'active',
    },
  });

  const category = await prisma.processCategory.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'METIER',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Metier',
      code: 'METIER',
      type: 'business',
    },
    update: {
      name: 'Metier',
      type: 'business',
    },
  });

  const owner = await findOrCreateActor({
    tenantId: tenant.id,
    directionId: direction.id,
    name: 'Responsable comptable',
    title: 'Responsable comptable',
    email: 'responsable.comptable@example.test',
  });
  const accountable = await findOrCreateActor({
    tenantId: tenant.id,
    directionId: direction.id,
    name: 'Directeur Finance',
    title: 'Directeur Finance',
    email: 'directeur.finance@example.test',
  });

  const process = await prisma.process.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'FIN-CLOT-001',
      },
    },
    create: {
      tenantId: tenant.id,
      directionId: direction.id,
      categoryId: category.id,
      processOwnerActorId: owner.id,
      name: 'Cloture comptable mensuelle',
      code: 'FIN-CLOT-001',
      description: 'Processus de formalisation de la cloture mensuelle.',
      objective: 'Produire des comptes mensuels fiables et valides.',
      scope: 'Perimetre finance siege et filiales.',
      triggerEvent: 'Fin de mois',
      completenessScore: 76,
    },
    update: {
      directionId: direction.id,
      categoryId: category.id,
      processOwnerActorId: owner.id,
      name: 'Cloture comptable mensuelle',
      description: 'Processus de formalisation de la cloture mensuelle.',
      objective: 'Produire des comptes mensuels fiables et valides.',
      scope: 'Perimetre finance siege et filiales.',
      triggerEvent: 'Fin de mois',
      completenessScore: 76,
      deletedAt: null,
    },
  });

  await clearDemoProcessChildren(tenant.id, process.id);

  const collect = await prisma.processActivity.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      code: 'COLLECTER',
      name: 'Collecter les justificatifs',
      inputText: 'Factures validees, releves bancaires, pieces comptables',
      outputText: 'Dossier de cloture consolide',
      sortOrder: 1,
    },
  });
  const validate = await prisma.processActivity.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      code: 'VALIDER',
      name: 'Valider le dossier',
      inputText: 'Dossier de cloture consolide',
      outputText: 'Dossier valide pour production des etats financiers',
      sortOrder: 2,
    },
  });

  await prisma.processInput.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      name: 'Factures validees',
      source: 'ERP Finance',
      sortOrder: 1,
    },
  });
  await prisma.processOutput.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      name: 'Etats financiers mensuels',
      destination: 'Direction Finance',
      sortOrder: 1,
    },
  });
  await prisma.processTransition.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      fromActivityId: collect.id,
      toActivityId: validate.id,
      label: 'Dossier pret',
      sortOrder: 1,
    },
  });

  for (const activity of [collect, validate]) {
    await prisma.processActorRole.createMany({
      data: [
        {
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: owner.id,
          raciRole: RaciRole.RESPONSIBLE,
        },
        {
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: accountable.id,
          raciRole: RaciRole.ACCOUNTABLE,
        },
      ],
    });
  }

  await prisma.kpi.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      ownerActorId: owner.id,
      name: 'Delai de cloture',
      objective: 'Reduire le delai de production des etats mensuels.',
      definition: 'Nombre de jours entre fin de mois et validation du dossier.',
      unit: 'jours',
      frequency: 'mensuelle',
      target: '4 jours',
    },
  });

  const risk = await prisma.risk.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      ownerActorId: owner.id,
      description: 'Risque de delai non maitrise pour une procedure usager',
      category: 'Audit public',
      riskFamily: 'Conformite',
      inherentScore: 12,
      residualScore: 6,
      inherentLevel: RiskLevel.HIGH,
      residualLevel: RiskLevel.MEDIUM,
      auditRelevance: 'Preparation audit interne et externe',
      courtOfAccountsRelevance: true,
    },
  });
  const control = await prisma.control.create({
    data: {
      tenantId: tenant.id,
      ownerActorId: accountable.id,
      name: 'Revue mensuelle du dossier de cloture',
      description: 'Controle de coherence et validation formelle avant diffusion.',
      controlType: 'review',
      frequency: 'mensuelle',
    },
  });
  await prisma.riskControl.create({
    data: {
      tenantId: tenant.id,
      riskId: risk.id,
      controlId: control.id,
      coverage: 'partielle',
    },
  });

  await prisma.painPoint.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      description: 'Relances manuelles',
      impact: 'Risque de retard et manque de tracabilite',
      priority: 'high',
    },
  });
  await prisma.automationNeed.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      activityId: collect.id,
      description: 'Rapprochement automatique',
      expectedGain: 'Reduction des relances et controles manuels',
      complexity: 'Moyenne',
      priority: 'high',
    },
  });

  const application = await prisma.application.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'ERP-FIN',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'ERP Finance',
      code: 'ERP-FIN',
      owner: 'Direction Finance',
      criticality: RiskLevel.HIGH,
    },
    update: {
      name: 'ERP Finance',
      owner: 'Direction Finance',
      criticality: RiskLevel.HIGH,
      deletedAt: null,
    },
  });
  await prisma.processApplication.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      applicationId: application.id,
      usage: 'Source des pieces comptables et suivi de cloture.',
    },
  });

  const document = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      reference: `PROC-FIN-CLOT-${process.id.slice(0, 8)}`,
      title: 'Procedure de cloture',
      documentType: 'procedure',
      status: DocumentStatus.DRAFT,
      version: '1.0',
      ownerActorId: owner.id,
    },
  });
  await prisma.processDocument.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      documentId: document.id,
      usageType: 'procedure',
    },
  });

  await prisma.moroccoProcessCompliance.upsert({
    where: { processId: process.id },
    create: {
      tenantId: tenant.id,
      processId: process.id,
      isUserFacingProcess: true,
      law5519Applicable: true,
      administrativeProcedureType: 'Demande administrative',
      userCategory: 'Usager entreprise',
      currentChannel: 'Physique',
      targetChannel: 'Digital',
      simplificationPriority: 'Haute',
      digitalizationPriority: 'Haute',
      currentProcessingTimeDays: 12,
      targetProcessingTimeDays: 4,
      requiredDocumentsCount: 6,
      requestedCopiesCount: 2,
      physicalVisitsRequired: 1,
      feesRequired: false,
      legalReference: 'Loi 55-19',
      procedureOwnerEntity: 'Direction Finance',
      observations:
        'Cet outil facilite la structuration et la tracabilite sans garantir la conformite.',
    },
    update: {
      isUserFacingProcess: true,
      law5519Applicable: true,
      administrativeProcedureType: 'Demande administrative',
      userCategory: 'Usager entreprise',
      currentChannel: 'Physique',
      targetChannel: 'Digital',
      simplificationPriority: 'Haute',
      digitalizationPriority: 'Haute',
      currentProcessingTimeDays: 12,
      targetProcessingTimeDays: 4,
      requiredDocumentsCount: 6,
      requestedCopiesCount: 2,
      physicalVisitsRequired: 1,
      feesRequired: false,
      legalReference: 'Loi 55-19',
      procedureOwnerEntity: 'Direction Finance',
      observations:
        'Cet outil facilite la structuration et la tracabilite sans garantir la conformite.',
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      action: 'seed_demo_finance_process',
      resourceType: 'processes',
      resourceId: process.id,
      result: 'success',
      metadata: { code: process.code },
    },
  });
}

async function findOrCreateActor(data: {
  tenantId: string;
  directionId: string;
  name: string;
  title: string;
  email: string;
}) {
  const actor = await prisma.actor.findFirst({
    where: {
      tenantId: data.tenantId,
      email: data.email,
      deletedAt: null,
    },
  });
  if (actor) {
    return prisma.actor.update({
      where: { id: actor.id },
      data: {
        directionId: data.directionId,
        name: data.name,
        title: data.title,
      },
    });
  }
  return prisma.actor.create({ data });
}

async function clearDemoProcessChildren(tenantId: string, processId: string) {
  const risks = await prisma.risk.findMany({
    where: { tenantId, processId },
    select: { id: true },
  });
  const riskIds = risks.map((risk) => risk.id);
  if (riskIds.length) {
    await prisma.riskControl.deleteMany({ where: { tenantId, riskId: { in: riskIds } } });
  }
  await prisma.processActorRole.deleteMany({ where: { tenantId, processId } });
  await prisma.processTransition.deleteMany({ where: { tenantId, processId } });
  await prisma.processActivity.deleteMany({ where: { tenantId, processId } });
  await prisma.processInput.deleteMany({ where: { tenantId, processId } });
  await prisma.processOutput.deleteMany({ where: { tenantId, processId } });
  await prisma.kpi.deleteMany({ where: { tenantId, processId } });
  await prisma.risk.deleteMany({ where: { tenantId, processId } });
  await prisma.painPoint.deleteMany({ where: { tenantId, processId } });
  await prisma.automationNeed.deleteMany({ where: { tenantId, processId } });
  await prisma.processApplication.deleteMany({ where: { tenantId, processId } });
  await prisma.processDocument.deleteMany({ where: { tenantId, processId } });
  await prisma.document.deleteMany({
    where: {
      tenantId,
      title: 'Procedure de cloture',
      reference: { startsWith: 'PROC-FIN-CLOT-' },
    },
  });
  await prisma.control.deleteMany({
    where: {
      tenantId,
      name: 'Revue mensuelle du dossier de cloture',
    },
  });
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
  await seedDemoFinanceProcess();
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
