/**
 * Storage contract for applications, plus the row ↔ record mapping shared by
 * every implementation. The app uses the Prisma implementation; the tests also
 * run the same contract against a plain SQLite implementation built from the
 * Prisma migration SQL.
 */
import type { ApplicationRecord, ApplicationSummary } from "../api/types";

/** A new record to insert; createdAt is set by the database. */
export type NewApplication = Omit<ApplicationRecord, "createdAt"> & { submissionKey: string | null };

export interface ApplicationRepository {
  create(app: NewApplication): Promise<ApplicationRecord>;
  findById(id: string): Promise<ApplicationRecord | null>;
  findBySubmissionKey(key: string): Promise<ApplicationRecord | null>;
  /** Newest first. */
  list(options: { limit: number }): Promise<ApplicationRecord[]>;
  summary(): Promise<ApplicationSummary>;
  /** Deletes every application; returns how many were removed. */
  deleteAll(): Promise<number>;
}

/** Thrown when an insert reuses an existing submission (idempotency) key. */
export class DuplicateSubmissionKeyError extends Error {
  constructor() {
    super("An application with this submission key already exists.");
    this.name = "DuplicateSubmissionKeyError";
  }
}

/** Flat database row — mirrors prisma/schema.prisma. */
export interface ApplicationRow {
  id: string;
  monthlyIncome: number;
  dtiRatio: number;
  creditScore: number;
  decision: string;
  score: number;
  threshold: number;
  incomeContribution: number;
  dtiContribution: number;
  creditContribution: number;
  factorDetails: string;
  explanation: string;
  policyVersion: string;
  submissionKey: string | null;
  createdAt: Date | string;
}

export function toRow(app: NewApplication): Omit<ApplicationRow, "createdAt"> {
  return {
    id: app.id,
    monthlyIncome: app.input.monthlyIncome,
    dtiRatio: app.input.dtiRatio,
    creditScore: app.input.creditScore,
    decision: app.decision,
    score: app.score,
    threshold: app.threshold,
    incomeContribution: app.contributions.monthlyIncome,
    dtiContribution: app.contributions.dtiRatio,
    creditContribution: app.contributions.creditScore,
    factorDetails: JSON.stringify(app.details),
    explanation: JSON.stringify(app.explanation),
    policyVersion: app.policyVersion,
    submissionKey: app.submissionKey,
  };
}

export function fromRow(row: ApplicationRow): ApplicationRecord {
  if (row.decision !== "APPROVED" && row.decision !== "REJECTED") {
    throw new Error(`Corrupt application row ${row.id}: unknown decision "${row.decision}"`);
  }
  return {
    id: row.id,
    createdAt: new Date(row.createdAt).toISOString(),
    input: {
      monthlyIncome: row.monthlyIncome,
      dtiRatio: row.dtiRatio,
      creditScore: row.creditScore,
    },
    decision: row.decision,
    score: row.score,
    threshold: row.threshold,
    policyVersion: row.policyVersion,
    contributions: {
      monthlyIncome: row.incomeContribution,
      dtiRatio: row.dtiContribution,
      creditScore: row.creditContribution,
    },
    details: JSON.parse(row.factorDetails),
    explanation: JSON.parse(row.explanation),
  };
}
