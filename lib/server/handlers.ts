/**
 * API request handlers. They use only the standard Web Request/Response
 * objects, so the Next.js route files stay one-liners and the handlers can be
 * tested directly with any repository implementation.
 *
 * Flow for POST:  parse → validate → decision engine → explanation engine → save → respond
 */
import { computeDecision } from "../engine/decision";
import type { ApplicationInput } from "../engine/types";
import { buildExplanation } from "../explain/explanation";
import {
  toListItem,
  type ApiError,
  type ApiErrorCode,
  type ApplicationListResponse,
  type ApplicationRecord,
} from "../api/types";
import { validateApplicationInput } from "../validation/applicationInput";
import { generateApplicationId, isValidApplicationId } from "./ids";
import { DuplicateSubmissionKeyError, type ApplicationRepository, type NewApplication } from "./repository";

export type RepositoryProvider = () => ApplicationRepository;

const MAX_BODY_BYTES = 10_000;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

const NO_STORE = { "Cache-Control": "no-store" };

function ok<T>(data: T, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json({ ok: true, data }, { status, headers: { ...NO_STORE, ...headers } });
}

function fail(status: number, code: ApiErrorCode, message: string, extra: Partial<ApiError> = {}): Response {
  return Response.json({ ok: false, error: { code, message, ...extra } }, { status, headers: NO_STORE });
}

/** Log the real error on the server; send the client a generic message only. */
function internalError(context: string, error: unknown): Response {
  console.error(`[verity-api] ${context}:`, error);
  return fail(500, "INTERNAL_ERROR", "Something went wrong on the server. Please try again.");
}

const sameInput = (a: ApplicationInput, b: ApplicationInput) =>
  a.monthlyIncome === b.monthlyIncome && a.dtiRatio === b.dtiRatio && a.creditScore === b.creditScore;

/** Runs the engines and assembles the record to store. */
export function buildApplication(input: ApplicationInput, submissionKey: string | null): NewApplication {
  const result = computeDecision(input);
  const explanation = buildExplanation(result);
  const contribution = (key: string) => result.factors.find((f) => f.key === key)!.contribution;
  return {
    id: generateApplicationId(),
    input: result.input,
    decision: result.decision,
    score: result.score,
    threshold: result.threshold,
    policyVersion: result.policyVersion,
    contributions: {
      monthlyIncome: contribution("monthlyIncome"),
      dtiRatio: contribution("dtiRatio"),
      creditScore: contribution("creditScore"),
    },
    details: {
      baseScore: result.baseScore,
      maximumDti: result.maximumDti,
      dtiLimitExceeded: result.dtiLimitExceeded,
      factors: result.factors,
    },
    explanation,
    submissionKey,
  };
}

/** A retried submission returns the original result; reusing a key with different values is a conflict. */
function replay(existing: ApplicationRecord, input: ApplicationInput): Response {
  if (!sameInput(existing.input, input)) {
    return fail(
      409,
      "IDEMPOTENCY_CONFLICT",
      "This submission key was already used with different values. Please submit again.",
    );
  }
  return ok(existing, 200, { Location: `/api/applications/${existing.id}` });
}

/** POST /api/applications */
export async function handleCreateApplication(request: Request, getRepo: RepositoryProvider): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "Send the application as JSON (Content-Type: application/json).");
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return fail(400, "INVALID_JSON", "The request body could not be read.");
  }
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const submissionKey = request.headers.get("idempotency-key");
  if (submissionKey !== null && !IDEMPOTENCY_KEY_PATTERN.test(submissionKey)) {
    return fail(400, "INVALID_IDEMPOTENCY_KEY", "The Idempotency-Key header has an invalid format.");
  }

  const validation = validateApplicationInput(body);
  if (!validation.ok) {
    return fail(422, "VALIDATION_ERROR", validation.formError ?? "Some values need attention.", {
      fieldErrors: validation.fieldErrors,
    });
  }
  const input = validation.value;

  try {
    const repo = getRepo();
    if (submissionKey) {
      const existing = await repo.findBySubmissionKey(submissionKey);
      if (existing) return replay(existing, input);
    }

    const application = buildApplication(input, submissionKey);
    try {
      const saved = await repo.create(application);
      return ok(saved, 201, { Location: `/api/applications/${saved.id}` });
    } catch (error) {
      // Two identical requests raced each other: return the one that won.
      if (error instanceof DuplicateSubmissionKeyError && submissionKey) {
        const existing = await repo.findBySubmissionKey(submissionKey);
        if (existing) return replay(existing, input);
      }
      throw error;
    }
  } catch (error) {
    return internalError("create application failed", error);
  }
}

/** GET /api/applications?limit=20 */
export async function handleListApplications(request: Request, getRepo: RepositoryProvider): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("limit");
  let limit = DEFAULT_LIST_LIMIT;
  if (raw !== null) {
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_LIST_LIMIT) {
      return fail(400, "INVALID_QUERY", `limit must be a whole number from 1 to ${MAX_LIST_LIMIT}.`);
    }
    limit = Number(raw);
  }
  try {
    const repo = getRepo();
    const [records, summary] = await Promise.all([repo.list({ limit }), repo.summary()]);
    const data: ApplicationListResponse = { items: records.map(toListItem), summary };
    return ok(data);
  } catch (error) {
    return internalError("list applications failed", error);
  }
}

/** GET /api/applications/:id */
export async function handleGetApplication(id: string, getRepo: RepositoryProvider): Promise<Response> {
  if (!isValidApplicationId(id)) {
    return fail(400, "INVALID_ID", "That is not a valid application ID.");
  }
  try {
    const record = await getRepo().findById(id);
    if (!record) return fail(404, "NOT_FOUND", `No application found with ID ${id}.`);
    return ok(record);
  } catch (error) {
    return internalError("get application failed", error);
  }
}

/** DELETE /api/applications?confirm=true — clears demonstration history. */
export async function handleClearApplications(request: Request, getRepo: RepositoryProvider): Promise<Response> {
  if (new URL(request.url).searchParams.get("confirm") !== "true") {
    return fail(400, "CONFIRMATION_REQUIRED", "Add ?confirm=true to confirm clearing all application history.");
  }
  try {
    const deleted = await getRepo().deleteAll();
    return ok({ deleted });
  } catch (error) {
    return internalError("clear applications failed", error);
  }
}
