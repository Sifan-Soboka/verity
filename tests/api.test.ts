/**
 * API handler tests: the same handler functions the Next.js routes call,
 * wired to a real SQLite database built from the Prisma migration.
 */
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import {
  handleClearApplications,
  handleCreateApplication,
  handleGetApplication,
  handleListApplications,
} from "../lib/server/handlers";
import { REFERENCE_SCENARIOS } from "../lib/scenarios";
import { FailingRepository, SqliteApplicationRepository } from "./support/sqliteRepository";

const BASE = "http://localhost/api/applications";
let repo: SqliteApplicationRepository;
const getRepo = () => repo;

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const read = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

beforeEach(() => {
  repo = new SqliteApplicationRepository();
});

describe("POST /api/applications", () => {
  it("validates, calculates, explains and saves an application (201)", async () => {
    const res = await handleCreateApplication(post(REFERENCE_SCENARIOS[1].input), getRepo);
    const { status, body } = await read(res);
    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.match(body.data.id, /^VRT-[0-9A-Z]{10}$/);
    assert.equal(res.headers.get("location"), `/api/applications/${body.data.id}`);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(body.data.decision, "APPROVED");
    assert.equal(body.data.score, 65.6);
    assert.deepEqual(body.data.contributions, { monthlyIncome: 4.4, dtiRatio: -1.8, creditScore: 13 });
    assert.match(body.data.explanation.summary, /However, your debt-to-income ratio/);
    assert.equal(body.data.details.factors.length, 3);

    // Persisted:
    assert.deepEqual(await repo.findById(body.data.id), body.data);
  });

  it("calculates every reference scenario to the report's intended outcome", async () => {
    for (const s of REFERENCE_SCENARIOS) {
      const { body } = await read(await handleCreateApplication(post(s.input), getRepo));
      assert.equal(body.data.decision, s.reportOutcome, `scenario ${s.id}`);
    }
  });

  it("returns a different result when the inputs change", async () => {
    const a = await read(await handleCreateApplication(post({ monthlyIncome: 9_000, dtiRatio: 30, creditScore: 700 }), getRepo));
    const b = await read(await handleCreateApplication(post({ monthlyIncome: 9_000, dtiRatio: 30, creditScore: 560 }), getRepo));
    assert.equal(a.body.data.decision, "APPROVED");
    assert.equal(b.body.data.decision, "REJECTED");
    assert.notEqual(a.body.data.id, b.body.data.id);
    assert.notEqual(a.body.data.explanation.summary, b.body.data.explanation.summary);
  });

  it("rejects invalid values with field errors (422) and saves nothing", async () => {
    const { status, body } = await read(
      await handleCreateApplication(post({ monthlyIncome: -1, dtiRatio: 120, creditScore: 1000 }), getRepo),
    );
    assert.equal(status, 422);
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.equal(body.error.fieldErrors.monthlyIncome, "Monthly income cannot be negative.");
    assert.equal(body.error.fieldErrors.dtiRatio, "Debt-to-income ratio cannot be above 100%.");
    assert.equal(body.error.fieldErrors.creditScore, "Credit score must be between 300 and 900.");
    assert.equal((await repo.summary()).total, 0);
  });

  it("reports missing fields (422)", async () => {
    const { status, body } = await read(await handleCreateApplication(post({ monthlyIncome: 5_000 }), getRepo));
    assert.equal(status, 422);
    assert.deepEqual(Object.keys(body.error.fieldErrors).sort(), ["creditScore", "dtiRatio"]);
  });

  it("rejects malformed JSON (400), wrong content type (415) and oversized bodies (413)", async () => {
    assert.equal((await handleCreateApplication(post("{not json"), getRepo)).status, 400);
    const text = new Request(BASE, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" });
    assert.equal((await handleCreateApplication(text, getRepo)).status, 415);
    const huge = post({ monthlyIncome: 5_000, dtiRatio: 30, creditScore: 700, pad: "x".repeat(20_000) });
    assert.equal((await handleCreateApplication(huge, getRepo)).status, 413);
  });

  it("treats a repeated submission key as the same application (idempotent)", async () => {
    const input = REFERENCE_SCENARIOS[0].input;
    const key = { "Idempotency-Key": "3f1c9a2e-0b7d-4e55-9a51-6f0e2c1d4b88" };
    const first = await read(await handleCreateApplication(post(input, key), getRepo));
    const second = await read(await handleCreateApplication(post(input, key), getRepo));
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.data.id, first.body.data.id);
    assert.equal((await repo.summary()).total, 1);

    // Same key, different values → conflict, nothing new stored.
    const clash = await read(await handleCreateApplication(post(REFERENCE_SCENARIOS[3].input, key), getRepo));
    assert.equal(clash.status, 409);
    assert.equal(clash.body.error.code, "IDEMPOTENCY_CONFLICT");
    assert.equal((await repo.summary()).total, 1);
  });

  it("handles two simultaneous submissions with the same key", async () => {
    const key = { "Idempotency-Key": "double-click-0001" };
    const input = REFERENCE_SCENARIOS[2].input;
    const [a, b] = await Promise.all([
      handleCreateApplication(post(input, key), getRepo).then(read),
      handleCreateApplication(post(input, key), getRepo).then(read),
    ]);
    assert.equal(a.body.data.id, b.body.data.id);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal((await repo.summary()).total, 1);
  });

  it("rejects a malformed idempotency key (400)", async () => {
    const res = await handleCreateApplication(post(REFERENCE_SCENARIOS[0].input, { "Idempotency-Key": "bad key!" }), getRepo);
    assert.equal(res.status, 400);
  });

  it("returns a generic 500 on database failure without leaking details", async (t) => {
    const errorLog = mock.method(console, "error", () => {});
    t.after(() => errorLog.mock.restore());
    const { status, body } = await read(
      await handleCreateApplication(post(REFERENCE_SCENARIOS[0].input), () => new FailingRepository()),
    );
    assert.equal(status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.doesNotMatch(JSON.stringify(body), /SQLITE|secret|dev\.db/);
    assert.equal(errorLog.mock.callCount(), 1); // logged server-side
  });
});

describe("GET /api/applications", () => {
  it("returns an empty history with zeroed statistics", async () => {
    const { status, body } = await read(await handleListApplications(new Request(BASE), getRepo));
    assert.equal(status, 200);
    assert.deepEqual(body.data, { items: [], summary: { total: 0, approved: 0, rejected: 0, averageScore: null } });
  });

  it("returns stored applications (newest first) and statistics from the records", async () => {
    for (const s of REFERENCE_SCENARIOS) {
      await handleCreateApplication(post(s.input), getRepo);
      await new Promise((r) => setTimeout(r, 3));
    }
    const { body } = await read(await handleListApplications(new Request(`${BASE}?limit=3`), getRepo));
    assert.equal(body.data.items.length, 3);
    assert.deepEqual(body.data.items[0].input, REFERENCE_SCENARIOS[4].input);
    assert.deepEqual(body.data.summary, { total: 5, approved: 3, rejected: 2, averageScore: 57.2 });
    assert.equal(body.data.items[0].explanation, undefined); // compact list items
  });

  it("validates the limit parameter (400)", async () => {
    for (const bad of ["0", "101", "abc", "-1", "2.5"]) {
      const res = await handleListApplications(new Request(`${BASE}?limit=${bad}`), getRepo);
      assert.equal(res.status, 400, bad);
    }
  });

  it("returns 500 on database failure", async (t) => {
    const errorLog = mock.method(console, "error", () => {});
    t.after(() => errorLog.mock.restore());
    const res = await handleListApplications(new Request(BASE), () => new FailingRepository());
    assert.equal(res.status, 500);
  });
});

describe("GET /api/applications/:id", () => {
  it("returns a stored application", async () => {
    const created = await read(await handleCreateApplication(post(REFERENCE_SCENARIOS[4].input), getRepo));
    const { status, body } = await read(await handleGetApplication(created.body.data.id, getRepo));
    assert.equal(status, 200);
    assert.deepEqual(body.data, created.body.data);
    assert.equal(body.data.decision, "REJECTED");
  });

  it("returns 404 for an unknown id and 400 for a malformed one", async () => {
    const missing = await read(await handleGetApplication("VRT-ABCDEFGH12", getRepo));
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "NOT_FOUND");
    for (const bad of ["123", "VRT-short", "../etc/passwd", "VRT-abcdefgh12", "VRT-ILOU000000"]) {
      assert.equal((await handleGetApplication(bad, getRepo)).status, 400, bad);
    }
  });
});

describe("DELETE /api/applications", () => {
  it("requires explicit confirmation (400) and deletes nothing without it", async () => {
    await handleCreateApplication(post(REFERENCE_SCENARIOS[0].input), getRepo);
    const res = await handleClearApplications(new Request(BASE, { method: "DELETE" }), getRepo);
    assert.equal(res.status, 400);
    assert.equal((await repo.summary()).total, 1);
  });

  it("clears history when confirmed", async () => {
    for (const s of REFERENCE_SCENARIOS) await handleCreateApplication(post(s.input), getRepo);
    const { status, body } = await read(
      await handleClearApplications(new Request(`${BASE}?confirm=true`, { method: "DELETE" }), getRepo),
    );
    assert.equal(status, 200);
    assert.deepEqual(body.data, { deleted: 5 });
    assert.equal((await repo.summary()).total, 0);
  });
});
