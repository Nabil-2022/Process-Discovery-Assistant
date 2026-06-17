import { ProcessStatus, RaciRole, RiskLevel, RiskStatus } from '../src/generated/prisma';
import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();

type DirectionKey = 'dg' | 'commercial' | 'information' | 'dsi' | 'moyens';
type ActorKey = DirectionKey | 'prestataire';

const projectCode = 'MAP-WEB';

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

const processPortfolio = [
  {
    code: 'MAP-WEB-001',
    name: 'Cadrage du besoin site web MAP',
    direction: 'dg' as const,
    owner: 'dg' as const,
    accountable: 'dg' as const,
    consulted: ['commercial' as const, 'information' as const, 'dsi' as const],
    previous: null,
    next: 'MAP-WEB-002',
    objective: 'Qualifier le besoin et obtenir un accord de principe de la Direction Generale.',
    trigger: "Expression d'un besoin de nouveau site web MAP",
    output: 'Note de besoin validee',
    completeness: 92,
    status: ProcessStatus.APPROVED,
    steps: [
      ['RECUEIL-BESOIN', 'Recueillir le besoin initial', 'Demande initiale', 'Besoin formalise'],
      ['ARBITRAGE-DG', 'Arbitrer la priorite avec la DG', 'Besoin formalise', 'Accord de principe DG'],
      ['NOTE-BESOIN', 'Produire la note de besoin', 'Accord DG', 'Note de besoin validee'],
    ],
  },
  {
    code: 'MAP-WEB-002',
    name: 'Specifications fonctionnelles du site web MAP',
    direction: 'commercial' as const,
    owner: 'commercial' as const,
    accountable: 'commercial' as const,
    consulted: ['information' as const, 'dsi' as const],
    previous: 'MAP-WEB-001',
    next: 'MAP-WEB-003',
    objective:
      "Formaliser les besoins metier commerciaux et editoriaux avec la Direction de l'Information.",
    trigger: 'Note de besoin validee',
    output: 'Specifications fonctionnelles validees',
    completeness: 88,
    status: ProcessStatus.READY_FOR_REVIEW,
    steps: [
      ['ATELIER-METIER', 'Animer les ateliers metier', 'Note de besoin', 'Liste des besoins'],
      ['SPEC-CONTENU', "Formaliser les parcours et contenus d'information", 'Liste des besoins', 'Parcours cibles'],
      ['VALIDATION-SPECS', 'Valider les specifications fonctionnelles', 'Parcours cibles', 'Specifications validees'],
    ],
  },
  {
    code: 'MAP-WEB-003',
    name: 'Preparation du CPS technique site web',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'dsi' as const,
    consulted: ['commercial' as const, 'information' as const, 'moyens' as const],
    previous: 'MAP-WEB-002',
    next: 'MAP-WEB-004',
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
    code: 'MAP-WEB-004',
    name: "Lancement de l'appel d'offre site web",
    direction: 'moyens' as const,
    owner: 'moyens' as const,
    accountable: 'moyens' as const,
    consulted: ['dsi' as const, 'commercial' as const],
    previous: 'MAP-WEB-003',
    next: 'MAP-WEB-005',
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
    code: 'MAP-WEB-005',
    name: 'Adjudication et developpement de la solution web',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'prestataire' as const,
    consulted: ['commercial' as const, 'information' as const, 'moyens' as const],
    previous: 'MAP-WEB-004',
    next: 'MAP-WEB-006',
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
    code: 'MAP-WEB-006',
    name: 'Reception technique et deploiement DSI',
    direction: 'dsi' as const,
    owner: 'dsi' as const,
    accountable: 'dsi' as const,
    consulted: ['prestataire' as const, 'commercial' as const, 'information' as const],
    previous: 'MAP-WEB-005',
    next: 'MAP-WEB-007',
    objective: 'Controler la solution, corriger les anomalies et deployer en environnement cible.',
    trigger: 'Solution web developpee',
    output: 'Site web deployee en recette',
    completeness: 72,
    status: ProcessStatus.DRAFT,
    steps: [
      ['RECETTE-TECH', 'Realiser la recette technique', 'Solution developpee', 'Rapport recette technique'],
      ['CORRECTIONS', 'Piloter les corrections', 'Rapport recette technique', 'Version corrigee'],
      ['DEPLOIEMENT', 'Deployer la solution', 'Version corrigee', 'Site en recette'],
    ],
  },
  {
    code: 'MAP-WEB-007',
    name: 'Reception metier et information du site web',
    direction: 'commercial' as const,
    owner: 'commercial' as const,
    accountable: 'commercial' as const,
    consulted: ['information' as const, 'dsi' as const],
    previous: 'MAP-WEB-006',
    next: null,
    objective:
      "Valider la conformite metier avec Marketing Commercial et Production de l'Information.",
    trigger: 'Site web deployee en recette',
    output: 'PV de reception metier et go-live',
    completeness: 70,
    status: ProcessStatus.DRAFT,
    steps: [
      ['RECETTE-METIER', 'Executer la recette metier', 'Site en recette', 'Anomalies metier'],
      ['VALIDATION-INFO', "Valider les contenus avec la Direction de l'Information", 'Contenus charges', 'Contenus valides'],
      ['PV-RECEPTION', 'Signer le PV de reception et autoriser le go-live', 'Validation metier', 'PV reception'],
    ],
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

  const oldSingleProcess = await prisma.process.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'MAP-WEB-001' } },
    select: { id: true, name: true },
  });
  if (oldSingleProcess?.name === 'Developpement site web MAP') {
    await clearProcessChildren(tenant.id, oldSingleProcess.id);
  }

  const createdProcesses = [];
  for (const item of processPortfolio) {
    const process = await upsertPortfolioProcess(tenant.id, category.id, directions, actors, item);
    createdProcesses.push(process);
  }

  console.log(`Use case seeded: ${createdProcesses.length} linked processes for ${projectCode}`);
  for (const process of createdProcesses) {
    console.log(`${process.code}: /tenant/processes/${process.id}/workshop`);
  }
  console.log('Mega BPMN: /tenant/mega-bpmn');
}

async function upsertPortfolioProcess(
  tenantId: string,
  categoryId: string,
  directions: Record<DirectionKey, { id: string; name: string; code: string | null }>,
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
      directionId: directions[item.direction].id,
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
      directionId: directions[item.direction].id,
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
    data: {
      tenantId,
      processId: process.id,
      name: item.trigger,
      source: item.previous ?? 'Direction Generale',
      sortOrder: 1,
    },
  });
  await prisma.processOutput.create({
    data: {
      tenantId,
      processId: process.id,
      name: item.output,
      destination: item.next ?? 'Go-live',
      sortOrder: 1,
    },
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
        {
          tenantId,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[item.owner].id,
          raciRole: RaciRole.RESPONSIBLE,
        },
        {
          tenantId,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[item.accountable].id,
          raciRole: RaciRole.ACCOUNTABLE,
        },
        ...item.consulted.map((key) => ({
          tenantId,
          processId: process.id,
          activityId: activity.id,
          actorId: actors[key].id,
          raciRole: RaciRole.CONSULTED,
        })),
        {
          tenantId,
          processId: process.id,
          activityId: activity.id,
          actorId: actors.dg.id,
          raciRole: RaciRole.INFORMED,
        },
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
      target: item.code === 'MAP-WEB-005' ? '30 jours' : '7 jours',
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

async function findOrCreateActor(tenantId: string, directionId: string | null, name: string) {
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
