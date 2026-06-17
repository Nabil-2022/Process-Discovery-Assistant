import { RaciRole } from '../src/generated/prisma';
import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();

type DirectionKey = 'dg' | 'commercial' | 'information' | 'dsi' | 'moyens';

const directionTargets: Record<DirectionKey, { code: string; name: string; aliases: string[] }> = {
  dg: {
    code: 'DG-CONSEIL',
    name: 'Conseil de la Direction Generale',
    aliases: ['conseil de la direction generale', 'conseil de direction generale'],
  },
  commercial: {
    code: 'MKT-COM',
    name: 'Marketing et Commercial',
    aliases: ['marketing commercial', 'marketing et commercial', 'direction commerciale'],
  },
  information: {
    code: 'INFO-MEDIA',
    name: "Production de l'Information : Depeche et Medias",
    aliases: [
      'production info depeche media',
      "production de l'information depeche et medias",
      "production de l'information : depeche et medias",
      "direction de l'information",
    ],
  },
  dsi: {
    code: 'DSI-BROADCAST',
    name: 'Systemes de Production / DSI / Broadcast',
    aliases: [
      'syste production dsi broadcast',
      'systeme production dsi broadcast',
      'systemes de production dsi broadcast',
      'systemes de production / dsi / broadcast',
      'direction dsi',
    ],
  },
  moyens: {
    code: 'MG',
    name: 'Moyens Generaux',
    aliases: ['moyen generaux', 'moyens generaux', 'direction moyen generaux'],
  },
};

const activities = [
  {
    code: 'BESOIN-CONSEIL-DG',
    name: 'Exprimer le besoin et demander conseil',
    direction: 'dg' as const,
    input: 'Besoin initial de creation du site web MAP',
    output: 'Note de besoin validee par la Direction Generale',
    duration: '2 jours',
    type: 'cadrage',
  },
  {
    code: 'SPECS-FONCTIONNELLES',
    name: 'Formuler les specifications fonctionnelles',
    direction: 'commercial' as const,
    consulted: ['information' as const],
    input: 'Note de besoin validee',
    output: 'Specifications fonctionnelles partagees',
    duration: '5 jours',
    type: 'specification',
  },
  {
    code: 'PREPARATION-CPS',
    name: 'Preparer le CPS',
    direction: 'dsi' as const,
    input: 'Specifications fonctionnelles',
    output: 'CPS technique et fonctionnel',
    duration: '4 jours',
    type: 'achat',
  },
  {
    code: 'APPEL-OFFRE',
    name: "Lancer l'appel d'offre",
    direction: 'moyens' as const,
    input: 'CPS valide',
    output: "Dossier d'appel d'offre publie",
    duration: '7 jours',
    type: 'achat',
  },
  {
    code: 'ADJUDICATION-DEVELOPPEMENT',
    name: 'Adjuger le prestataire et developper la solution',
    direction: 'dsi' as const,
    consulted: ['commercial' as const, 'information' as const],
    input: "Offres recues et dossier d'appel d'offre",
    output: 'Solution site web developpee',
    duration: '30 jours',
    type: 'realisation',
    automated: true,
  },
  {
    code: 'RECEPTION-DEPLOIEMENT-DSI',
    name: 'Receptionner et deployer la solution',
    direction: 'dsi' as const,
    input: 'Solution developpee',
    output: 'Site web deployee en recette',
    duration: '5 jours',
    type: 'deploiement',
    automated: true,
  },
  {
    code: 'RECEPTION-METIER',
    name: "Receptionner par les directions metier et de l'information",
    direction: 'commercial' as const,
    consulted: ['information' as const],
    input: 'Site web deployee en recette',
    output: 'PV de reception metier et go-live',
    duration: '3 jours',
    type: 'validation',
  },
];

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'map-demo' } });
  const directions = await ensureDirections(tenant.id);
  const category = await prisma.processCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'PROJET-DIGITAL' } },
    create: {
      tenantId: tenant.id,
      code: 'PROJET-DIGITAL',
      name: 'Projet digital',
      type: 'support',
    },
    update: { name: 'Projet digital', type: 'support' },
  });

  const actors = {
    dg: await findOrCreateActor(tenant.id, directions.dg.id, 'Conseil Direction Generale'),
    commercial: await findOrCreateActor(
      tenant.id,
      directions.commercial.id,
      'Referent Marketing Commercial',
    ),
    information: await findOrCreateActor(
      tenant.id,
      directions.information.id,
      'Referent Information Depeche Media',
    ),
    dsi: await findOrCreateActor(tenant.id, directions.dsi.id, 'Chef de projet DSI Broadcast'),
    moyens: await findOrCreateActor(tenant.id, directions.moyens.id, 'Responsable Moyens Generaux'),
    prestataire: await findOrCreateActor(tenant.id, null, 'Prestataire developpement web'),
  };

  const process = await prisma.process.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAP-WEB-001' } },
    create: {
      tenantId: tenant.id,
      directionId: directions.dsi.id,
      categoryId: category.id,
      processOwnerActorId: actors.dsi.id,
      code: 'MAP-WEB-001',
      name: 'Developpement site web MAP',
      description:
        "Processus transverse de cadrage, achat, developpement, reception et deploiement d'un site web MAP.",
      objective: 'Mettre en ligne une solution web conforme aux besoins metier MAP.',
      scope:
        'Direction generale, Marketing Commercial, Production Information, DSI Broadcast, Moyens Generaux et prestataire.',
      triggerEvent: "Expression d'un besoin de nouveau site web MAP",
      status: 'DRAFT',
      completenessScore: 88,
    },
    update: {
      directionId: directions.dsi.id,
      categoryId: category.id,
      processOwnerActorId: actors.dsi.id,
      name: 'Developpement site web MAP',
      description:
        "Processus transverse de cadrage, achat, developpement, reception et deploiement d'un site web MAP.",
      objective: 'Mettre en ligne une solution web conforme aux besoins metier MAP.',
      scope:
        'Direction generale, Marketing Commercial, Production Information, DSI Broadcast, Moyens Generaux et prestataire.',
      triggerEvent: "Expression d'un besoin de nouveau site web MAP",
      status: 'DRAFT',
      completenessScore: 88,
      deletedAt: null,
    },
  });

  await clearProcessChildren(tenant.id, process.id);

  await prisma.processInput.createMany({
    data: [
      {
        tenantId: tenant.id,
        processId: process.id,
        name: 'Besoin de creation du site web MAP',
        source: 'Direction Generale',
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        processId: process.id,
        name: 'Contraintes metier et information',
        source: 'Marketing Commercial / Production Information',
        sortOrder: 2,
      },
    ],
  });

  await prisma.processOutput.createMany({
    data: [
      {
        tenantId: tenant.id,
        processId: process.id,
        name: 'Site web MAP deployee',
        destination: 'MAP',
        sortOrder: 1,
      },
      {
        tenantId: tenant.id,
        processId: process.id,
        name: 'PV de reception metier et technique',
        destination: 'Direction Generale',
        sortOrder: 2,
      },
    ],
  });

  const createdActivities = [];
  for (const [index, item] of activities.entries()) {
    const activity = await prisma.processActivity.create({
      data: {
        tenantId: tenant.id,
        processId: process.id,
        code: item.code,
        name: item.name,
        activityType: item.type,
        sortOrder: index + 1,
        inputText: item.input,
        outputText: item.output,
        duration: item.duration,
        isAutomated: item.automated ?? false,
      },
    });
    createdActivities.push({ ...item, id: activity.id });

    await prisma.processActorRole.createMany({
      data: [
        {
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[item.direction].id,
          raciRole: RaciRole.RESPONSIBLE,
        },
        {
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: item.code === 'ADJUDICATION-DEVELOPPEMENT' ? actors.prestataire.id : actors.dsi.id,
          raciRole: RaciRole.ACCOUNTABLE,
        },
        ...(item.consulted ?? []).map((key) => ({
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[key].id,
          raciRole: RaciRole.CONSULTED,
        })),
        {
          tenantId: tenant.id,
          processId: process.id,
          activityId: activity.id,
          actorId: actors.dg.id,
          raciRole: RaciRole.INFORMED,
        },
      ],
      skipDuplicates: true,
    });
  }

  for (let index = 0; index < createdActivities.length - 1; index += 1) {
    await prisma.processTransition.create({
      data: {
        tenantId: tenant.id,
        processId: process.id,
        fromActivityId: createdActivities[index]?.id,
        toActivityId: createdActivities[index + 1]?.id,
        label: 'Etape suivante',
        transitionType: 'sequence',
        sortOrder: index + 1,
      },
    });
  }

  await prisma.kpi.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      ownerActorId: actors.dsi.id,
      name: 'Delai de mise en ligne du site',
      objective: 'Piloter le delai global du besoin jusqu au go-live.',
      definition: 'Nombre de jours entre la note de besoin validee et la mise en ligne.',
      unit: 'jours',
      frequency: 'par projet',
      target: '60 jours',
    },
  });

  await prisma.risk.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      ownerActorId: actors.dsi.id,
      description: 'Risque de decalage entre specifications metier et solution developpee',
      category: 'Projet digital',
      riskFamily: 'Qualite / cadrage',
      inherentScore: 12,
      residualScore: 6,
      inherentLevel: 'HIGH',
      residualLevel: 'MEDIUM',
      status: 'IDENTIFIED',
    },
  });

  await prisma.painPoint.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      description:
        'Multiples validations inter-directions pouvant retarder la finalisation du CPS et la reception.',
      impact: 'Delai projet et risques de rework',
      frequency: 'Occasionnelle',
    },
  });

  await prisma.automationNeed.create({
    data: {
      tenantId: tenant.id,
      processId: process.id,
      description: 'Suivi numerique des validations CPS, reception technique et reception metier.',
      expectedGain: 'Traçabilite et reduction des relances manuelles',
      priority: 'HIGH',
    },
  });

  console.log(`Use case seeded: ${process.name} (${process.code})`);
  console.log(`Open: /tenant/processes/${process.id}/workshop`);
  console.log(`BPMN: /tenant/processes/${process.id}/bpmn`);
}

async function ensureDirections(tenantId: string) {
  const existing = await prisma.direction.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });

  const result = {} as Record<DirectionKey, { id: string; name: string; code: string | null }>;
  for (const [key, target] of Object.entries(directionTargets) as [
    DirectionKey,
    (typeof directionTargets)[DirectionKey],
  ][]) {
    const found = existing.find((direction) =>
      [direction.name, direction.code ?? ''].some((value) =>
        target.aliases.some((alias) => normalize(value).includes(normalize(alias))),
      ),
    );

    if (found) {
      result[key] = found;
      continue;
    }

    result[key] = await prisma.direction.upsert({
      where: { tenantId_code: { tenantId, code: target.code } },
      create: { tenantId, code: target.code, name: target.name, status: 'active' },
      update: { name: target.name, status: 'active', deletedAt: null },
      select: { id: true, name: true, code: true },
    });
  }

  return result;
}

async function findOrCreateActor(
  tenantId: string,
  directionId: string | null,
  name: string,
) {
  const existing = await prisma.actor.findFirst({
    where: { tenantId, name, deletedAt: null },
  });
  if (existing) {
    return prisma.actor.update({
      where: { id: existing.id },
      data: { directionId, title: name },
    });
  }
  return prisma.actor.create({
    data: {
      tenantId,
      directionId,
      name,
      title: name,
      email: `${slug(name)}@map-demo.example.test`,
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
