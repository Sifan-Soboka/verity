/**
 * Runs the repository contract against the REAL Prisma client and a throwaway
 * SQLite file. It needs `npm install` (which runs `prisma generate`); if the
 * Prisma client hasn't been generated the whole suite is skipped with a note.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runRepositoryContract } from "./support/repositoryContract";
import { MIGRATION_SQL_PATH } from "./support/sqliteRepository";

runRepositoryContract("Prisma", async () => {
  let PrismaClientCtor: new (options: { datasourceUrl: string }) => any;
  let PrismaApplicationRepository: new (client: any) => any;
  try {
    PrismaClientCtor = (await import("@prisma/client")).PrismaClient;
    PrismaApplicationRepository = (await import("../lib/server/prismaRepository")).PrismaApplicationRepository;
  } catch {
    console.log("Prisma client not generated — run `npm install` to enable the Prisma repository tests.");
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), "verity-test-"));
  let prisma: any;
  try {
    prisma = new PrismaClientCtor({ datasourceUrl: `file:${join(dir, "test.db")}` });
    const statements = readFileSync(MIGRATION_SQL_PATH, "utf8")
      .split(";")
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    console.log(`Prisma unavailable (${(error as Error).message.split("\n")[0]}) — skipping.`);
    rmSync(dir, { recursive: true, force: true });
    return null;
  }

  return {
    repo: new PrismaApplicationRepository(prisma),
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
});
