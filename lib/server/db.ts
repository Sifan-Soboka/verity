/**
 * Server-only database access. Creates one PrismaClient per process (re-used
 * across hot reloads in development so connections aren't exhausted).
 *
 * The connection string comes from the DATABASE_URL environment variable and
 * is never sent to the browser or included in API responses.
 */
import { PrismaClient } from "@prisma/client";

import { PrismaApplicationRepository } from "./prismaRepository";
import type { ApplicationRepository } from "./repository";

const globalForPrisma = globalThis as unknown as { verityPrisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.verityPrisma) {
    globalForPrisma.verityPrisma = new PrismaClient();
  }
  return globalForPrisma.verityPrisma;
}

export function getRepository(): ApplicationRepository {
  return new PrismaApplicationRepository(getPrismaClient());
}
