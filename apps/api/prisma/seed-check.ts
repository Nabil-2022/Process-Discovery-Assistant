import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();

async function main() {
  const [roleCount, permissionCount, featureCount] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.feature.count(),
  ]);

  const template = await prisma.template.findUnique({
    where: { code: 'map' },
    include: {
      versions: {
        include: {
          directions: true,
        },
      },
    },
  });

  const mapTenant = await prisma.tenant.findUnique({
    where: { slug: 'map-demo' },
    include: {
      directions: true,
      tenantTemplates: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        roleCount,
        permissionCount,
        featureCount,
        mapTemplateVersions: template?.versions.length ?? 0,
        mapTemplateDirections: template?.versions[0]?.directions.length ?? 0,
        mapTenantExists: Boolean(mapTenant),
        mapTenantDirections: mapTenant?.directions.length ?? 0,
        mapTenantTemplates: mapTenant?.tenantTemplates.length ?? 0,
      },
      null,
      2,
    ),
  );
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
