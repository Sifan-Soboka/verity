import { getDataset } from "@/lib/server/dataset";
import { handleDatasetLookup } from "@/lib/server/datasetHandlers";

// Reads the dataset file from disk, so it needs the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One applicant from the project dataset (by ?userId= or ?random=true). */
export function GET(request: Request) {
  return handleDatasetLookup(request, getDataset);
}
