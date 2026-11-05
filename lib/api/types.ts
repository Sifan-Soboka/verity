/**
 * Shapes of data sent between the API and the UI.
 *
 * Every response uses the same envelope:
 *   success → { ok: true,  data: … }
 *   failure → { ok: false, error: { code, message, fieldErrors? } }
 */
import type { ApplicationInput, Decision, FactorKey, FactorResult } from "../engine/types";
import type { DatasetApplicant } from "../dataset/applicants";
import type { Explanation } from "../explain/explanation";
import type { FieldErrors } from "../validation/applicationInput";

/** Calculation details stored with each application (JSON column `factorDetails`). */
export interface StoredDetails {
  baseScore: number;
  maximumDti: number;
  dtiLimitExceeded: boolean;
  factors: FactorResult[];
}

/** A stored application and the result calculated for it. */
export interface ApplicationRecord {
  id: string;
  createdAt: string; // ISO 8601
  input: ApplicationInput;
  decision: Decision;
  score: number;
  threshold: number;
  policyVersion: string;
  contributions: Record<FactorKey, number>;
  details: StoredDetails;
  explanation: Explanation;
}

/** Compact form used in history lists. */
export interface ApplicationListItem {
  id: string;
  createdAt: string;
  input: ApplicationInput;
  decision: Decision;
  score: number;
}

export interface ApplicationSummary {
  total: number;
  approved: number;
  rejected: number;
  /** Mean score across all stored applications, or null when there are none. */
  averageScore: number | null;
}

/** GET /api/dataset response: one dataset record converted to Verity's units. */
export interface DatasetApplicantResponse extends DatasetApplicant {
  /** Total records in the dataset (for display). */
  datasetSize: number;
}

export interface ApplicationListResponse {
  items: ApplicationListItem[];
  summary: ApplicationSummary;
}

export type ApiErrorCode =
  | "INVALID_JSON"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_ERROR"
  | "INVALID_IDEMPOTENCY_KEY"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_ID"
  | "INVALID_QUERY"
  | "NOT_FOUND"
  | "CONFIRMATION_REQUIRED"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"; // client-side only

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const toListItem = (r: ApplicationRecord): ApplicationListItem => ({
  id: r.id,
  createdAt: r.createdAt,
  input: r.input,
  decision: r.decision,
  score: r.score,
});
