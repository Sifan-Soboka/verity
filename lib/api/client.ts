/**
 * Browser-side API client. Every page talks to the backend through these
 * functions — the UI never calculates decisions itself.
 */
import type { ApplicationInput } from "../engine/types";
import type { FieldErrors } from "../validation/applicationInput";
import type {
  ApiError,
  ApiErrorCode,
  ApiResponse,
  ApplicationListResponse,
  ApplicationRecord,
  DatasetApplicantResponse,
} from "./types";

const TIMEOUT_MS = 15_000;

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(path, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (outer?.aborted) throw error; // caller cancelled — let them ignore it
    const timedOut = controller.signal.aborted;
    throw new ApiClientError(
      0,
      "NETWORK_ERROR",
      timedOut
        ? "The server took too long to respond. Please try again."
        : "Couldn't reach the Verity server. Check that it is running and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    throw new ApiClientError(response.status, "INTERNAL_ERROR", `Unexpected response from the server (${response.status}).`);
  }
  if (!payload.ok) {
    const err: ApiError = payload.error;
    throw new ApiClientError(response.status, err.code, err.message, err.fieldErrors);
  }
  return payload.data;
}

export function submitApplication(
  input: ApplicationInput,
  submissionKey: string,
  signal?: AbortSignal,
): Promise<ApplicationRecord> {
  return request<ApplicationRecord>("/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": submissionKey },
    body: JSON.stringify(input),
    signal,
  });
}

export function getApplication(id: string, signal?: AbortSignal): Promise<ApplicationRecord> {
  return request<ApplicationRecord>(`/api/applications/${encodeURIComponent(id)}`, { signal });
}

export function listApplications(limit = 20, signal?: AbortSignal): Promise<ApplicationListResponse> {
  return request<ApplicationListResponse>(`/api/applications?limit=${limit}`, { signal });
}

export function clearApplications(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/api/applications?confirm=true", { method: "DELETE" });
}

/** One applicant from the project dataset, already converted to Verity's units. */
export function fetchDatasetApplicant(
  query: { userId: string } | { random: true; withLoan: boolean },
  signal?: AbortSignal,
): Promise<DatasetApplicantResponse> {
  const params =
    "userId" in query
      ? `userId=${encodeURIComponent(query.userId.trim())}`
      : `random=true${query.withLoan ? "&loan=true" : ""}`;
  return request<DatasetApplicantResponse>(`/api/dataset?${params}`, { signal });
}

/** A fresh idempotency key for one submission attempt. */
export function newSubmissionKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
