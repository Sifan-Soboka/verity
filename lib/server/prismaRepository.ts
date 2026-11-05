/**
 * Prisma implementation of ApplicationRepository (used by the running app).
 * All queries go through Prisma's query builder — no raw SQL.
 */
import { Prisma, type PrismaClient } from "@prisma/client";

import type { ApplicationRecord, ApplicationSummary } from "../api/types";
import {
  DuplicateSubmissionKeyError,
  fromRow,
  toRow,
  type ApplicationRepository,
  type NewApplication,
} from "./repository";

function isDuplicateSubmissionKey(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "").includes("submissionKey")
  );
}

export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(app: NewApplication): Promise<ApplicationRecord> {
    try {
      const row = await this.prisma.application.create({ data: toRow(app) });
      return fromRow(row);
    } catch (error) {
      if (isDuplicateSubmissionKey(error)) throw new DuplicateSubmissionKeyError();
      throw error;
    }
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const row = await this.prisma.application.findUnique({ where: { id } });
    return row ? fromRow(row) : null;
  }

  async findBySubmissionKey(submissionKey: string): Promise<ApplicationRecord | null> {
    const row = await this.prisma.application.findUnique({ where: { submissionKey } });
    return row ? fromRow(row) : null;
  }

  async list({ limit }: { limit: number }): Promise<ApplicationRecord[]> {
    const rows = await this.prisma.application.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map(fromRow);
  }

  async summary(): Promise<ApplicationSummary> {
    const [total, approved, avg] = await this.prisma.$transaction([
      this.prisma.application.count(),
      this.prisma.application.count({ where: { decision: "APPROVED" } }),
      this.prisma.application.aggregate({ _avg: { score: true } }),
    ]);
    const mean = avg._avg.score;
    return {
      total,
      approved,
      rejected: total - approved,
      averageScore: mean === null ? null : Math.round(mean * 10) / 10,
    };
  }

  async deleteAll(): Promise<number> {
    const { count } = await this.prisma.application.deleteMany();
    return count;
  }
}
