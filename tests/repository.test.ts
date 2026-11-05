/**
 * Database operations, against a real SQLite database created from the
 * Prisma migration SQL (see tests/support/sqliteRepository.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fromRow, type ApplicationRow } from "../lib/server/repository";
import { runRepositoryContract } from "./support/repositoryContract";
import { SqliteApplicationRepository } from "./support/sqliteRepository";

runRepositoryContract("SQLite (Prisma migration schema)", async () => ({
  repo: new SqliteApplicationRepository(),
}));

describe("migration schema", () => {
  it("creates the Application table with the expected columns", () => {
    const repo = new SqliteApplicationRepository();
    const columns = repo.db.prepare(`PRAGMA table_info("Application")`).all() as { name: string; notnull: number }[];
    assert.deepEqual(
      columns.map((c) => c.name),
      [
        "id", "monthlyIncome", "dtiRatio", "creditScore", "decision", "score", "threshold",
        "incomeContribution", "dtiContribution", "creditContribution", "factorDetails",
        "explanation", "policyVersion", "submissionKey", "createdAt",
      ],
    );
    // Only the idempotency key is optional; no personal-information columns exist.
    assert.deepEqual(columns.filter((c) => c.notnull === 0).map((c) => c.name), ["submissionKey"]);
  });

  it("refuses to map a corrupt decision value", () => {
    const row = { decision: "MAYBE", id: "VRT-0000000000" } as unknown as ApplicationRow;
    assert.throws(() => fromRow(row), /unknown decision/);
  });
});
