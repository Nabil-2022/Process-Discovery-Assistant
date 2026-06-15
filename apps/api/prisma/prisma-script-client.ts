import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma';

export function createScriptPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Prisma scripts.');
  }

  return new PrismaClient({
    adapter: new PrismaPg(connectionString),
  });
}
