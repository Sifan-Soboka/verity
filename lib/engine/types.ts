/**
 * Shared types for Verity's demonstration decision engine.
 *
 * These types are deliberately framework-free so the engine can be unit-tested
 * in isolation and reused by the API, the explanation engine and the UI.
 */

/** The three financial factors Verity assesses, in display order. */
export const FACTOR_KEYS = ["monthlyIncome", "dtiRatio", "creditScore"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

/** Validated applicant input. */
export interface ApplicationInput {
  /** Monthly income in AED. */
  monthlyIncome: number;
  /** Debt-to-income ratio as a percentage, 0–100. */
  dtiRatio: number;
  /** Credit score (integer). */
  creditScore: number;
}

export type Decision = "APPROVED" | "REJECTED";

/** How a factor affected the score. */
export type FactorStatus = "supports" | "concern" | "neutral";

/** How strongly a factor affected the score, relative to its maximum possible effect. */
export type FactorStrength = "strong" | "moderate" | "slight" | "none";

/** Calculation details for one factor. */
export interface FactorResult {
  key: FactorKey;
  label: string;
  /** The submitted value. */
  value: number;
  /** The value at which this factor is neutral (contributes 0 points). */
  referenceValue: number;
  /** Position between full concern (−1) and full support (+1). */
  normalised: number;
  /** Points added to (+) or removed from (−) the base score, rounded to 1 dp. */
  contribution: number;
  /** Largest number of points this factor can add or remove. */
  maxPoints: number;
  status: FactorStatus;
  strength: FactorStrength;
}

/** A single-factor change that would, on its own, reach the approval threshold. */
export interface PathToApproval {
  key: FactorKey;
  currentValue: number;
  requiredValue: number;
  /** Whether the value would need to go up or down. */
  change: "increase" | "decrease";
}

/** Complete output of the decision engine. */
export interface DecisionResult {
  policyVersion: string;
  input: ApplicationInput;
  baseScore: number;
  threshold: number;
  /** baseScore + sum of contributions, 0–100, rounded to 1 dp. */
  score: number;
  /** score − threshold (positive = above the threshold). */
  margin: number;
  decision: Decision;
  /** The policy's affordability limit (maximum DTI %) in force. */
  maximumDti: number;
  /** True when the DTI is above maximumDti — the application cannot be approved. */
  dtiLimitExceeded: boolean;
  /** Factors in FACTOR_KEYS order. */
  factors: FactorResult[];
}
