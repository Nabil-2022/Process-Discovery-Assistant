import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

import {
  MembershipStatus,
  ProcessStatus,
  RaciRole,
  RiskLevel,
  RiskStatus,
  TenantStatus,
  UserStatus,
} from '../src/generated/prisma';
import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();
const scrypt = promisify(scryptCallback);

const tenantSlug = 'tenant-demo';
const tenantName = 'Tenant Demo';
const adminEmail = process.env.SEED_TENANT_DEMO_ADMIN_EMAIL ?? 'demo.admin@example.test';
const adminPassword = process.env.SEED_TENANT_DEMO_ADMIN_PASSWORD ?? 'ChangeMe12345!';
const projectCode = 'DEMO-WEB';

type DirectionKey = 'dg' | 'commercial' | 'information' | 'dsi' | 'moyens';
type ActorKey = DirectionKey | 'prestataire';

const directions: Record<DirectionKey, { code: string; name: string }> = {
  dg: { code: 'DG', name: 'Direction Generale' },
  commercial: { code: 'MKT-COM', name: 'Marketing et Commercial' },
  information: { code: 'INFO-MEDIA', name: "Production de l'Information" },
  dsi: { code: 'DSI', name: 'Systemes d Information' },
  moyens: { code: 'MG', name: 'Moyens Generaux' },
};

const processPortfolio = [
  {
    code: 'DEMO-WEB-001',
    name: 'Cadrage du besoin portail web',
    direction: 'dg' as const,
    owner: 'dg' as const,
    accountable: 'dg' as const,
    consulted: ['commercial' as const, 'information' as const, 'dsi' as const],
    previous: null,
    next: 'DEMO-WEB-002',
    objective: 'Qualifier le besoin et obtenir un accord de principe de la direction generale.',
    trigger: "Expression d'un besoin de portail web",
    output: 'Note de besoin validee',
    completeness: 92,
    status: ProcessStatus.APPROVED,
    steps: [
      ['RECUEIL-BESOIN', 'Recueillir le besoin initial', 'Demande initiale', 'Besoin formalise'],
      ['ARBITRAGE-DG', 'Arbitrer la priorite', 'Besoin formalise', 'Accord de principe'],
      ['NOTE-BESOIN', 'Produire la note de besoin', 'Accord de principe', 'Note de besoin validee'],
    ],
  },
  {
    code: 'DEMO-WEB-002',
    name: 'Specifications fonctionnelles du portail web',
    direction: 'commercial' as const,
    owner: 'commercial' as const,
    accountable: 'commercial' as const,
    consulted: ['information' as const, 'dsi' as const],
    previous: 'DEMO-WEB-001',
    next: 'DEMO-WEB-003',
    objective: 'Formaliser les besoins metier, les parcours utilisateurs et les contenus.',
    trigger: 'Note de besoin validee',
    output: 'Specifications fonctionnelles validees',
    completeness: 88,
    status: ProcessStatus.READY_FOR_REVIEW,
    steps: [
      ['ATELIER-METIER', 'Animer les ateliers metier', 'Note de besoin', 'Liste des besoins'],
      ['SPEC-CONTENU', 'Formaliser les parcours et contenus', 'Liste des besoins', 'Parcours cibles'],
      ['VALIDATION-SPECS', 'Valider les specifications fonctionnelles', 'Parcours cibles', 'Specifications validees'],
    ],
  },
  {
    code: 'DEMO-WEB-003',
    name: 'Preparation du CPS technique portail web',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'dsi' as const,
    consulted: ['commercial' as const, 'information' as const, 'moyens' as const],
    previous: 'DEMO-WEB-002',
    next: 'DEMO-WEB-004',
    objective: 'Transformer les specifications fonctionnelles en CPS technique exploitable.',
    trigger: 'Specifications fonctionnelles validees',
    output: 'CPS technique et fonctionnel valide',
    completeness: 84,
    status: ProcessStatus.SUBMITTED,
    steps: [
      ['ANALYSE-TECH', 'Analyser les exigences techniques', 'Specifications fonctionnelles', 'Contraintes techniques'],
      ['REDIGER-CPS', 'Rediger le CPS', 'Contraintes techniques', 'CPS initial'],
      ['VALIDER-CPS', 'Valider le CPS avec les directions concernees', 'CPS initial', 'CPS valide'],
    ],
  },
  {
    code: 'DEMO-WEB-004',
    name: "Lancement de l'appel d'offre portail web",
    direction: 'moyens' as const,
    owner: 'moyens' as const,
    accountable: 'moyens' as const,
    consulted: ['dsi' as const, 'commercial' as const],
    previous: 'DEMO-WEB-003',
    next: 'DEMO-WEB-005',
    objective: "Publier l'appel d'offre et organiser la consultation des prestataires.",
    trigger: 'CPS valide',
    output: "Dossier d'appel d'offre publie et offres recues",
    completeness: 80,
    status: ProcessStatus.IN_PROGRESS,
    steps: [
      ['DOSSIER-AO', "Constituer le dossier d'appel d'offre", 'CPS valide', 'Dossier AO'],
      ['PUBLICATION-AO', "Publier l'appel d'offre", 'Dossier AO', 'AO publie'],
      ['RECEPTION-OFFRES', 'Receptionner les offres', 'AO publie', 'Offres recues'],
    ],
  },
  {
    code: 'DEMO-WEB-005',
    name: 'Adjudication et developpement de la solution web',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'prestataire' as const,
    consulted: ['commercial' as const, 'information' as const, 'moyens' as const],
    previous: 'DEMO-WEB-004',
    next: 'DEMO-WEB-006',
    objective: 'Selectionner le prestataire et piloter le developpement de la solution.',
    trigger: 'Offres recues',
    output: 'Solution web developpee',
    completeness: 76,
    status: ProcessStatus.IN_PROGRESS,
    steps: [
      ['ANALYSE-OFFRES', 'Analyser les offres techniques et financieres', 'Offres recues', 'Rapport analyse'],
      ['ADJUDICATION', 'Adjuger le prestataire', 'Rapport analyse', 'Prestataire retenu'],
      ['DEVELOPPEMENT', 'Developper la solution web', 'CPS et specifications', 'Solution developpee'],
    ],
  },
  {
    code: 'DEMO-WEB-006',
    name: 'Reception technique et deploiement',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'dsi' as const,
    consulted: ['prestataire' as const, 'commercial' as const, 'information' as const],
    previous: 'DEMO-WEB-005',
    next: 'DEMO-WEB-007',
    objective: 'Controler la solution, corriger les anomalies et deployer en environnement cible.',
    trigger: 'Solution web developpee',
    output: 'Site web deploye en recette',
    completeness: 72,
    status: ProcessStatus.DRAFT,
    steps: [
      ['RECETTE-TECH', 'Realiser la recette technique', 'Solution developpee', 'Rapport recette technique'],
      ['CORRECTIONS', 'Piloter les corrections', 'Rapport recette technique', 'Version corrigee'],
      ['DEPLOIEMENT', 'Deployer la solution', 'Version corrigee', 'Site en recette'],
    ],
  },
  {
    code: 'DEMO-WEB-007',
    name: 'Reception metier et go-live du portail web',
    direction: 'commercial' as const,
    owner: 'commercial' as const,
    accountable: 'commercial' as const,
    consulted: ['information' as const, 'dsi' as const],
    previous: 'DEMO-WEB-006',
    next: null,
    objective: 'Valider la conformite metier, signer la reception et autoriser le go-live.',
    trigger: 'Site web deploye en recette',
    output: 'PV de reception metier et go-live',
    completeness: 70,
    status: ProcessStatus.DRAFT,
    steps: [
      ['RECETTE-METIER', 'Executer la recette metier', 'Site en recette', 'Anomalies metier'],
      ['VALIDATION-CONTENU', 'Valider les contenus', 'Contenus charges', 'Contenus valides'],
      ['PV-RECEPTION', 'Signer le PV de reception et autoriser le go-live', 'Validation metier', 'PV reception'],
    ],
  },
];

async function main() {
  const tenant = await seedTenant();
  await seedTenantAdmin(tenant.id);
  const seededDirections = await seedDirections(tenant.id);
  const category = await prisma.processCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PROJET-DIGITAL' } },
    create: { tenantId: tenant.id, code: 'PROJET-DIGITAL', name: 'Projet digital', type: 'support' },
    update: { name: 'Projet digital', type: 'support' },
  });

  const actors = {
    dg: await findOrCreateActor(tenant.id, seededDirections.dg.id, 'Direction Generale'),
    commercial: await findOrCreateActor(tenant.id, seededDirections.commercial.id, 'Referent Marketing Commercial'),
    information: await findOrCreateActor(tenant.id, seededDirections.information.id, 'Referent Information'),
    dsi: await findOrCreateActor(tenant.id, seededDirections.dsi.id, 'Chef de projet SI'),
    moyens: await findOrCreateActor(tenant.id, seededDirections.moyens.id, 'Responsable Moyens Generaux'),
    prestataire: await findOrCreateActor(tenant.id, null, 'Prestataire developpement web'),
  };

  const createdProcesses = [];
  for (const item of processPortfolio) {
    createdProcesses.push(await upsertProcess(tenant.id, category.id, seededDirections, actors, item));
  }

  console.log(`Tenant demo ready: ${tenantName} (${tenantSlug})`);
  console.log(`Login: ${adminEmail} / ${adminPassword}`);
  console.log(`Seeded processes: ${createdProcesses.length} linked processes for ${projectCode}`);
}

async function seedTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    create: { name: tenantName, slug: tenantSlug, status: TenantStatus.ACTIVE, deploymentMode: 'demo' },
    update: { name: tenantName, status: TenantStatus.ACTIVE },
  });

  const featureRecords = await prisma.feature.findMany();
  for (const feature of featureRecords) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_featureId: { tenantId: tenant.id, featureId: feature.id } },
      create: { tenantId: tenant.id, featureId: feature.id, enabled: true },
      update: { enabled: true },
    });
  }

  return tenant;
}

async function seedTenantAdmin(tenantId: string) {
  const passwordHash = await hashPassword(adminPassword);
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      fullName: 'Tenant Admin Demo',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    update: {
      fullName: 'Tenant Admin Demo',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });

  const membership = await prisma.tenantMembership.upsert({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    create: { tenantId, userId: user.id, status: MembershipStatus.ACTIVE, joinedAt: new Date() },
    update: { status: MembershipStatus.ACTIVE, joinedAt: new Date() },
  });

  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'tenant_admin' } });
  await prisma.membershipRole.upsert({
    where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
    create: { membershipId: membership.id, roleId: role.id },
    update: {},
  });
}

async function seedDirections(tenantId: string) {
  const result = {} as Record<DirectionKey, { id: string; name: string; code: string | null }>;
  for (const [key, direction] of Object.entries(directions) as [DirectionKey, { code: string; name: string }][]) {
    result[key] = await prisma.direction.upsert({
      where: { tenantId_code: { tenantId, code: direction.code } },
      create: { tenantId, code: direction.code, name: direction.name, status: 'active' },
      update: { name: direction.name, status: 'active', deletedAt: null },
      select: { id: true, name: true, code: true },
    });
  }
  return result;
}

async function upsertProcess(
  tenantId: string,
  categoryId: string,
  seededDirections: Record<DirectionKey, { id: string; name: string; code: string | null }>,
  actors: Record<ActorKey, { id: string }>,
  item: (typeof processPortfolio)[number],
) {
  const owner = actors[item.owner];
  const description = [
    item.objective,
    item.previous ? `Depend de: ${item.previous}.` : 'Demarre le portefeuille projet.',
    item.next ? `Alimente: ${item.next}.` : 'Cloture le portefeuille projet.',
  ].join(' ');

  const process = await prisma.process.upsert({
    where: { tenantId_code: { tenantId, code: item.code } },
    create: {
      tenantId,
      directionId: seededDirections[item.direction].id,
      categoryId,
      processOwnerActorId: owner.id,
      code: item.code,
      name: item.name,
      description,
      objective: item.objective,
      scope: `Projet ${projectCode}. Processus ${item.code}. ${item.previous ? `Entree depuis ${item.previous}. ` : ''}${item.next ? `Sortie vers ${item.next}.` : 'Derniere etape du portefeuille.'}`,
      triggerEvent: item.trigger,
      status: item.status,
      completenessScore: item.completeness,
    },
    update: {
      directionId: seededDirections[item.direction].id,
      categoryId,
      processOwnerActorId: owner.id,
      name: item.name,
      description,
      objective: item.objective,
      scope: `Projet ${projectCode}. Processus ${item.code}. ${item.previous ? `Entree depuis ${item.previous}. ` : ''}${item.next ? `Sortie vers ${item.next}.` : 'Derniere etape du portefeuille.'}`,
      triggerEvent: item.trigger,
      status: item.status,
      completenessScore: item.completeness,
      deletedAt: null,
    },
  });

  await clearProcessChildren(tenantId, process.id);
  await prisma.processInput.create({
    data: { tenantId, processId: process.id, name: item.trigger, source: item.previous ?? 'Direction Generale', sortOrder: 1 },
  });
  await prisma.processOutput.create({
    data: { tenantId, processId: process.id, name: item.output, destination: item.next ?? 'Go-live', sortOrder: 1 },
  });

  const activities = [];
  for (const [index, [code, name, input, output]] of item.steps.entries()) {
    const activity = await prisma.processActivity.create({
      data: {
        tenantId,
        processId: process.id,
        code,
        name,
        activityType: code.toLowerCase().replace(/-/g, '_'),
        sortOrder: index + 1,
        inputText: input,
        outputText: output,
        duration: index === 0 ? '1 jour' : index === 1 ? '3 jours' : '2 jours',
        isAutomated: code === 'DEVELOPPEMENT' || code === 'DEPLOIEMENT',
      },
    });
    activities.push(activity);

    await prisma.processActorRole.createMany({
      data: [
        { tenantId, processId: process.id, activityId: activity.id, actorId: actors[item.owner].id, raciRole: RaciRole.RESPONSIBLE },
        { tenantId, processId: process.id, activityId: activity.id, actorId: actors[item.accountable].id, raciRole: RaciRole.ACCOUNTABLE },
        ...item.consulted.map((key) => ({
          tenantId,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[key].id,
          raciRole: RaciRole.CONSULTED,
        })),
        { tenantId, processId: process.id, activityId: activity.id, actorId: actors.dg.id, raciRole: RaciRole.INFORMED },
      ],
      skipDuplicates: true,
    });
  }

  for (let index = 0; index < activities.length - 1; index += 1) {
    await prisma.processTransition.create({
      data: {
        tenantId,
        processId: process.id,
        fromActivityId: activities[index]?.id,
        toActivityId: activities[index + 1]?.id,
        label: 'Etape suivante',
        transitionType: 'sequence',
        sortOrder: index + 1,
      },
    });
  }

  await prisma.kpi.create({
    data: {
      tenantId,
      processId: process.id,
      ownerActorId: owner.id,
      name: `Respect delai - ${item.code}`,
      objective: `Piloter le delai du processus ${item.name}.`,
      definition: 'Nombre de jours entre declencheur et livrable attendu.',
      unit: 'jours',
      frequency: 'par projet',
      target: item.code === 'DEMO-WEB-005' ? '30 jours' : '7 jours',
    },
  });

  await prisma.risk.create({
    data: {
      tenantId,
      processId: process.id,
      ownerActorId: owner.id,
      description: `Risque de retard ou rework sur ${item.name}`,
      category: 'Projet digital',
      riskFamily: 'Coordination inter-directions',
      inherentScore: 9,
      residualScore: 4,
      inherentLevel: RiskLevel.MEDIUM,
      residualLevel: RiskLevel.LOW,
      status: RiskStatus.IDENTIFIED,
    },
  });

  await prisma.painPoint.create({
    data: {
      tenantId,
      processId: process.id,
      description: `Risque de blocage si le livrable ${item.output} n'est pas valide a temps.`,
      impact: 'Decalage du processus suivant',
      frequency: 'Occasionnelle',
      priority: 'MEDIUM',
    },
  });

  await prisma.automationNeed.create({
    data: {
      tenantId,
      processId: process.id,
      description: `Suivi numerique du livrable ${item.output}.`,
      expectedGain: 'Tracabilite des validations et reduction des relances',
      priority: 'MEDIUM',
    },
  });

  return process;
}

async function findOrCreateActor(tenantId: string, directionId: string | null, name: string) {
  const existing = await prisma.actor.findFirst({ where: { tenantId, name, deletedAt: null } });
  if (existing) {
    return prisma.actor.update({ where: { id: existing.id }, data: { directionId, title: name } });
  }
  return prisma.actor.create({
    data: {
      tenantId,
      directionId,
      name,
      title: name,
      email: `${slug(name)}@tenant-demo.example.test`,
    },
  });
}

async function clearProcessChildren(tenantId: string, processId: string) {
  await prisma.processActorRole.deleteMany({ where: { tenantId, processId } });
  await prisma.processTransition.deleteMany({ where: { tenantId, processId } });
  await prisma.processActivity.deleteMany({ where: { tenantId, processId } });
  await prisma.processInput.deleteMany({ where: { tenantId, processId } });
  await prisma.processOutput.deleteMany({ where: { tenantId, processId } });
  await prisma.kpi.deleteMany({ where: { tenantId, processId } });
  await prisma.risk.deleteMany({ where: { tenantId, processId } });
  await prisma.painPoint.deleteMany({ where: { tenantId, processId } });
  await prisma.automationNeed.deleteMany({ where: { tenantId, processId } });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function slug(value: string) {
  return normalize(value).replace(/\s+/g, '.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

