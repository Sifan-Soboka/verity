/**
 * Test-only ApplicationRepository backed by a real SQLite database (Node's
 * built-in node:sqlite). The schema is created by executing the SAME migration
 * SQL that Prisma applies, so these tests also check that the migration,
 * column types, unique index and row mapping all work together.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ApplicationRecord, ApplicationSummary } from "../../lib/api/types";
import {
  DuplicateSubmissionKeyError,
  fromRow,
  toRow,
  type ApplicationRepository,
  type ApplicationRow,
  type NewApplication,
} from "../../lib/server/repository";

export const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../prisma/migrations/20261105000000_init/migration.sql",
);

export class SqliteApplicationRepository implements ApplicationRepository {
  readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(readFileSync(MIGRATION_SQL_PATH, "utf8"));
  }

  async create(app: NewApplication): Promise<ApplicationRecord> {
    const row = { ...toRow(app), createdAt: new Date().toISOString() };
    const columns = Object.keys(row);
    try {
      this.db
        .prepare(
          `INSERT INTO "Application" (${columns.map((c) => `"${c}"`).join(", ")})
           VALUES (${columns.map(() => "?").join(", ")})`,
        )
        .run(...(Object.values(row) as (string | number | null)[]));
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed: Application.submissionKey")) {
        throw new DuplicateSubmissionKeyError();
      }
      throw error;
    }
    return (await this.findById(app.id))!;
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const row = this.db.prepare(`SELECT * FROM "Application" WHERE "id" = ?`).get(id);
    return row ? fromRow(row as unknown as ApplicationRow) : null;
  }

  async findBySubmissionKey(key: string): Promise<ApplicationRecord | null> {
    const row = this.db.prepare(`SELECT * FROM "Application" WHERE "submissionKey" = ?`).get(key);
    return row ? fromRow(row as unknown as ApplicationRow) : null;
  }

  async list({ limit }: { limit: number }): Promise<ApplicationRecord[]> {
    const rows = this.db
      .prepare(`SELECT * FROM "Application" ORDER BY "createdAt" DESC, rowid DESC LIMIT ?`)
      .all(limit);
    return rows.map((r) => fromRow(r as unknown as ApplicationRow));
  }

  async summary(): Promise<ApplicationSummary> {
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN "decision" = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
                AVG("score") AS avg
         FROM "Application"`,
      )
      .get() as { total: number; approved: number | null; avg: number | null };
    return {
      total: r.total,
      approved: r.approved ?? 0,
      rejected: r.total - (r.approved ?? 0),
      averageScore: r.avg === null ? null : Math.round(r.avg * 10) / 10,
    };
  }

  async deleteAll(): Promise<number> {
    const result = this.db.prepare(`DELETE FROM "Application"`).run();
    return Number(result.changes);
  }
}

/** A repository whose every call fails — simulates a database outage. */
export class FailingRepository implements ApplicationRepository {
  private fail(): never {
    throw new Error("SQLITE_CANTOPEN: unable to open database file /secret/path/dev.db");
  }
  create = async () => this.fail();
  findById = async () => this.fail();
  findBySubmissionKey = async () => this.fail();
  list = async () => this.fail();
  summary = async () => this.fail();
  deleteAll = async () => this.fail();
}
