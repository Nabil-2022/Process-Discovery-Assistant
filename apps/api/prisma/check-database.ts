import { createScriptPrismaClient } from './prisma-script-client';

const prisma = createScriptPrismaClient();

type SchemaRow = { exists: boolean };
type ObjectRow = { object_type: string; object_name: string };

async function main() {
  const [schema] = await prisma.$queryRaw<SchemaRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_namespace
      WHERE nspname = 'process_discovery'
    ) AS "exists"
  `;

  const objects = await prisma.$queryRaw<ObjectRow[]>`
    SELECT c.relkind::text AS object_type, c.relname::text AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'process_discovery'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'i', 'S')
    ORDER BY c.relkind, c.relname
  `;

  console.log(
    JSON.stringify(
      {
        schemaExists: Boolean(schema?.exists),
        objectCount: objects.length,
        objects,
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
