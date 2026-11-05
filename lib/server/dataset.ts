/**
 * Server-side access to the project dataset. The CSV is read once, on first
 * use, and kept in memory (≈32k rows). Set DATASET_PATH to use another copy.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseDatasetCsv, type DatasetApplicant } from "../dataset/applicants";

export interface DatasetSource {
  count(): number;
  findById(userId: string): DatasetApplicant | undefined;
  /** A random record; `withLoan` restricts to records that have a loan (non-zero DTI). */
  random(options: { withLoan: boolean }): DatasetApplicant | undefined;
}

export class InMemoryDataset implements DatasetSource {
  private readonly byId: Map<string, DatasetApplicant>;
  private readonly withLoan: DatasetApplicant[];

  constructor(
    private readonly records: DatasetApplicant[],
    private readonly rng: () => number = Math.random,
  ) {
    this.byId = new Map(records.map((r) => [r.userId.toUpperCase(), r]));
    this.withLoan = records.filter((r) => r.hasLoan);
  }

  count() {
    return this.records.length;
  }

  findById(userId: string) {
    return this.byId.get(userId.trim().toUpperCase());
  }

  random({ withLoan }: { withLoan: boolean }) {
    const pool = withLoan ? this.withLoan : this.records;
    return pool.length ? pool[Math.floor(this.rng() * pool.length)] : undefined;
  }
}

export const DEFAULT_DATASET_PATH = join(process.cwd(), "data", "synthetic_personal_finance_dataset.csv");

let cached: InMemoryDataset | null = null;

export function getDataset(): DatasetSource {
  if (!cached) {
    const path = process.env.DATASET_PATH || DEFAULT_DATASET_PATH;
    cached = new InMemoryDataset(parseDatasetCsv(readFileSync(path, "utf8")));
  }
  return cached;
}
