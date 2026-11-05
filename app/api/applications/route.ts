import { getRepository } from "@/lib/server/db";
import {
  handleClearApplications,
  handleCreateApplication,
  handleListApplications,
} from "@/lib/server/handlers";

// Prisma needs the Node.js runtime, and results must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validate, score, explain and save a new application. */
export function POST(request: Request) {
  return handleCreateApplication(request, getRepository);
}

/** Application history (newest first) with summary statistics. */
export function GET(request: Request) {
  return handleListApplications(request, getRepository);
}

/** Clear demonstration history (requires ?confirm=true). */
export function DELETE(request: Request) {
  return handleClearApplications(request, getRepository);
}
