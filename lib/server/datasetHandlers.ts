/**
 * GET /api/dataset — fetch one applicant from the project dataset so the form
 * can be filled with real dataset values. Nothing is scored or stored here;
 * the user still submits through POST /api/applications.
 *
 *   ?userId=U00002            → that record
 *   ?random=true              → any record
 *   ?random=true&loan=true    → a record that has a loan
 */
import type { DatasetApplicantResponse } from "../api/types";
import type { DatasetSource } from "./dataset";

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const headers = { "Cache-Control": "no-store" };

const fail = (status: number, code: string, message: string) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers });

export async function handleDatasetLookup(request: Request, getDataset: () => DatasetSource): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const userId = params.get("userId");
  const random = params.get("random") === "true";

  if (!userId && !random) {
    return fail(400, "INVALID_QUERY", "Provide ?userId=… or ?random=true.");
  }
  if (userId !== null && !USER_ID_PATTERN.test(userId.trim())) {
    return fail(400, "INVALID_QUERY", "That is not a valid dataset user ID (e.g. U00002).");
  }

  let dataset: DatasetSource;
  try {
    dataset = getDataset();
  } catch (error) {
    console.error("[verity-api] dataset could not be loaded:", error);
    return fail(500, "INTERNAL_ERROR", "The dataset could not be loaded on the server.");
  }

  const record = userId
    ? dataset.findById(userId)
    : dataset.random({ withLoan: params.get("loan") === "true" });
  if (!record) {
    return fail(404, "NOT_FOUND", userId ? `No dataset record with user ID ${userId.trim()}.` : "No matching records.");
  }

  const data: DatasetApplicantResponse = { ...record, datasetSize: dataset.count() };
  return Response.json({ ok: true, data }, { headers });
}
