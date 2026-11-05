/**
 * Behaviour every ApplicationRepository must have. Run against the SQLite test
 * repository (always) and the Prisma repository (when Prisma is set up).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildApplication } from "../../lib/server/handlers";
import { DuplicateSubmissionKeyError, type ApplicationRepository } from "../../lib/server/repository";
import { REFERENCE_SCENARIOS } from "../../lib/scenarios";

export interface ContractSetup {
  repo: ApplicationRepository;
  cleanup?: () => Promise<void>;
}

export function runRepositoryContract(name: string, setup: () => Promise<ContractSetup | null>) {
  describe(`${name} — repository contract`, () => {
    let ctx: ContractSetup | null = null;
    before(async () => {
      ctx = await setup();
    });
    after(async () => {
      await ctx?.cleanup?.();
    });
    beforeEach(async () => {
      await ctx?.repo.deleteAll();
    });

    const test = (title: string, fn: (repo: ApplicationRepository) => Promise<void>) =>
      it(title, async (t) => {
        if (!ctx) return t.skip("repository not available");
        await fn(ctx.repo);
      });

    test("stores an application and reads it back unchanged", async (repo) => {
      const app = buildApplication(REFERENCE_SCENARIOS[2].input, null);
      const saved = await repo.create(app);
      assert.equal(saved.id, app.id);
      assert.deepEqual(saved.input, app.input);
      assert.equal(saved.decision, app.decision);
      assert.equal(saved.score, app.score);
      assert.deepEqual(saved.contributions, app.contributions);
      assert.deepEqual(saved.details, app.details);
      assert.deepEqual(saved.explanation, app.explanation);
      assert.ok(!Number.isNaN(Date.parse(saved.createdAt)));

      const found = await repo.findById(app.id);
      assert.deepEqual(found, saved);
    });

    test("returns null for an unknown id", async (repo) => {
      assert.equal(await repo.findById("VRT-0000000000"), null);
    });

    test("stores decimal inputs exactly", async (repo) => {
      const saved = await repo.create(
        buildApplication({ monthlyIncome: 12_345.67, dtiRatio: 33.25, creditScore: 701 }, null),
      );
      assert.deepEqual(saved.input, { monthlyIncome: 12_345.67, dtiRatio: 33.25, creditScore: 701 });
    });

    test("enforces unique submission keys", async (repo) => {
      await repo.create(buildApplication(REFERENCE_SCENARIOS[0].input, "key-aaaaaaaa"));
      await assert.rejects(
        repo.create(buildApplication(REFERENCE_SCENARIOS[0].input, "key-aaaaaaaa")),
        DuplicateSubmissionKeyError,
      );
      const found = await repo.findBySubmissionKey("key-aaaaaaaa");
      assert.ok(found);
      // Many applications may have no key.
      await repo.create(buildApplication(REFERENCE_SCENARIOS[1].input, null));
      await repo.create(buildApplication(REFERENCE_SCENARIOS[1].input, null));
    });

    test("lists newest first and respects the limit", async (repo) => {
      const ids: string[] = [];
      for (const s of REFERENCE_SCENARIOS) {
        ids.push((await repo.create(buildApplication(s.input, null))).id);
        await new Promise((r) => setTimeout(r, 5)); // distinct timestamps
      }
      const all = await repo.list({ limit: 10 });
      assert.deepEqual(all.map((a) => a.id), [...ids].reverse());
      assert.equal((await repo.list({ limit: 2 })).length, 2);
    });

    test("summarises the stored decisions", async (repo) => {
      assert.deepEqual(await repo.summary(), { total: 0, approved: 0, rejected: 0, averageScore: null });
      for (const s of REFERENCE_SCENARIOS) await repo.create(buildApplication(s.input, null));
      const summary = await repo.summary();
      assert.equal(summary.total, 5);
      assert.equal(summary.approved, 3);
      assert.equal(summary.rejected, 2);
      // (92.8 + 65.6 + 54.0 + 31.9 + 41.8) / 5 = 57.22 → 57.2
      assert.equal(summary.averageScore, 57.2);
    });

    test("deleteAll removes everything and reports the count", async (repo) => {
      for (const s of REFERENCE_SCENARIOS.slice(0, 3)) await repo.create(buildApplication(s.input, null));
      assert.equal(await repo.deleteAll(), 3);
      assert.equal((await repo.summary()).total, 0);
      assert.equal(await repo.deleteAll(), 0);
    });
  });
}
