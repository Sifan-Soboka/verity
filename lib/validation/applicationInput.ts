/**
 * Input validation shared by the form (instant feedback) and the API
 * (authoritative). Invalid values are reported, never silently corrected.
 */
import { FACTOR_KEYS, type ApplicationInput, type FactorKey } from "../engine/types";
import { INPUT_LIMITS } from "./limits";

export type FieldErrors = Partial<Record<FactorKey, string>>;

export type ValidationResult =
  | { ok: true; value: ApplicationInput }
  | { ok: false; fieldErrors: FieldErrors; formError?: string };

const nf = new Intl.NumberFormat("en-US");

function decimalPlaces(n: number): number {
  if (Number.isInteger(n)) return 0;
  const text = n.toString();
  if (text.includes("e-")) return Number(text.split("e-")[1]); // e.g. 1e-7
  return text.split(".")[1]?.length ?? 0;
}

/** Range / precision checks on a value already known to be a finite number. */
export function checkNumber(key: FactorKey, n: number): string | null {
  const limit = INPUT_LIMITS[key];
  const label = limit.label;

  if (key === "monthlyIncome") {
    if (n < 0) return "Monthly income cannot be negative.";
    if (n === 0) return "Monthly income must be greater than zero.";
    if (n < limit.min) return `Monthly income must be at least AED ${nf.format(limit.min)}.`;
    if (n > limit.max) {
      return `Monthly income above AED ${nf.format(limit.max)} is outside the range this simulation supports.`;
    }
  }
  if (key === "dtiRatio") {
    if (n < limit.min) return "Debt-to-income ratio cannot be below 0%.";
    if (n > limit.max) return `Debt-to-income ratio cannot be above ${nf.format(limit.max)}%.`;
  }
  if (key === "creditScore") {
    if (!Number.isInteger(n)) return "Credit score must be a whole number.";
    if (n < limit.min || n > limit.max) {
      return `Credit score must be between ${limit.min} and ${limit.max}.`;
    }
  }
  if (decimalPlaces(n) > limit.maxDecimals) {
    return `${label} can have at most ${limit.maxDecimals} decimal places.`;
  }
  return null;
}

/**
 * Validates a JSON request body for POST /api/applications.
 * Values must be JSON numbers — numeric strings are rejected, not converted.
 */
export function validateApplicationInput(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      fieldErrors: {},
      formError: "Request body must be a JSON object with monthlyIncome, dtiRatio and creditScore.",
    };
  }
  const body = raw as Record<string, unknown>;
  const fieldErrors: FieldErrors = {};

  const unexpected = Object.keys(body).filter((k) => !(FACTOR_KEYS as readonly string[]).includes(k));

  for (const key of FACTOR_KEYS) {
    const label = INPUT_LIMITS[key].label;
    const value = body[key];
    if (value === undefined || value === null || value === "") {
      fieldErrors[key] = `${label} is required.`;
    } else if (typeof value !== "number" || !Number.isFinite(value)) {
      fieldErrors[key] = `${label} must be a number.`;
    } else {
      const problem = checkNumber(key, value);
      if (problem) fieldErrors[key] = problem;
    }
  }

  if (Object.keys(fieldErrors).length > 0 || unexpected.length > 0) {
    return {
      ok: false,
      fieldErrors,
      formError: unexpected.length > 0 ? `Unexpected field(s): ${unexpected.join(", ")}.` : undefined,
    };
  }
  return {
    ok: true,
    value: {
      monthlyIncome: body.monthlyIncome as number,
      dtiRatio: body.dtiRatio as number,
      creditScore: body.creditScore as number,
    },
  };
}

/** Accepts "12000", "12,000", "12000.50", "35.5" — and nothing else. */
const NUMERIC_TEXT = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

export type FormValues = Record<FactorKey, string>;

/**
 * Parses and validates the raw text typed into the form.
 * Thousands separators are allowed; anything else non-numeric is an error.
 */
export function validateFormValues(values: FormValues): ValidationResult {
  const fieldErrors: FieldErrors = {};
  const parsed: Partial<ApplicationInput> = {};

  for (const key of FACTOR_KEYS) {
    const label = INPUT_LIMITS[key].label;
    const text = values[key].trim();
    if (text === "") {
      fieldErrors[key] = `${label} is required.`;
      continue;
    }
    if (/^-\s*[\d.,]+$/.test(text)) {
      // Give the specific "negative" message rather than a generic format error.
      const negative = -Number(text.replace(/[-\s,]/g, ""));
      fieldErrors[key] = Number.isFinite(negative)
        ? (checkNumber(key, negative) ?? `${label} cannot be negative.`)
        : `Enter ${label.toLowerCase()} as a number, e.g. ${INPUT_LIMITS[key].example}.`;
      continue;
    }
    if (!NUMERIC_TEXT.test(text)) {
      fieldErrors[key] = `Enter ${label.toLowerCase()} as a number, e.g. ${INPUT_LIMITS[key].example}.`;
      continue;
    }
    const n = Number(text.replace(/,/g, ""));
    const problem = checkNumber(key, n);
    if (problem) fieldErrors[key] = problem;
    else parsed[key] = n;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: parsed as ApplicationInput };
}
