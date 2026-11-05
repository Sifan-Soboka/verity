import { getRepository } from "@/lib/server/db";
import { handleGetApplication } from "@/lib/server/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One stored application with its full result and explanation. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleGetApplication(id, getRepository);
}
