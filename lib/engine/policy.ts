/**
 * VERITY DEMONSTRATION SCORING POLICY — the single place where weights,
 * reference points and the approval threshold are configured.
 *
 * ⚠️  ACADEMIC DEMONSTRATION ONLY.
 * These numbers were chosen so the formula is easy to explain and so that it
 * reproduces the five illustrative scenarios in the CSIT305 research report.
 * They are NOT taken from any bank, regulator or credit bureau, and they do
 * not describe how real lenders assess applications.
 *
 * HOW THE FORMULA WORKS (see docs/DECISION_POLICY.md for the full write-up)
 *
 *   score = baseScore + contribution(income) + contribution(DTI) + contribution(credit)
 *
 * Each factor has three anchor points:
 *   - fullConcernAt : at or beyond this value the factor removes all of its maxPoints
 *   - reference     : the neutral point — the factor contributes 0 points here
 *   - fullSupportAt : at or beyond this value the factor adds all of its maxPoints
 *
 * Between the anchors the effect changes in a straight line (piecewise-linear),
 * so each factor's contribution is always between −maxPoints and +maxPoints.
 * For DTI, lower is better, so fullSupportAt is the LOW value.
 *
 * DECISION RULE
 *   APPROVED  if  score ≥ approvalThreshold  AND  DTI ≤ maximumDti
 *   otherwise REJECTED
 *
 * The maximumDti "affordability limit" exists because a purely additive score
 * lets strong factors fully compensate for weak ones (e.g. an excellent credit
 * score could otherwise outweigh a 100% DTI). See docs/DECISION_POLICY.md §4.
 */

import type { FactorKey } from "./types";

export interface FactorPolicy {
  label: string;
  /** Largest number of points this factor can add or remove. */
  maxPoints: number;
  /** Value at/beyond which the factor removes all maxPoints. */
  fullConcernAt: number;
  /** Neutral value — contribution is 0 here. */
  reference: number;
  /** Value at/beyond which the factor adds all maxPoints. */
  fullSupportAt: number;
}

export interface ScoringPolicy {
  version: string;
  /** Starting score before any factor is applied. */
  baseScore: number;
  /** Minimum score required for an "Approved" demonstration outcome. */
  approvalThreshold: number;
  /** Affordability limit: a DTI above this (in %) cannot be approved, whatever the score. */
  maximumDti: number;
  /** Contributions smaller than this (in points, either sign) are labelled "neutral". */
  neutralBand: number;
  /** |normalised| at or above these values is described as strong / moderate; below is slight. */
  strengthCutoffs: { strong: number; moderate: number };
  /** A score within this many points of the threshold is described as a borderline result. */
  borderlineMargin: number;
  factors: Record<FactorKey, FactorPolicy>;
}

export const DEMO_POLICY: ScoringPolicy = {
  version: "verity-demo-1.0",
  baseScore: 50,
  approvalThreshold: 50,
  maximumDti: 60,
  neutralBand: 0.5,
  strengthCutoffs: { strong: 0.6, moderate: 0.25 },
  borderlineMargin: 5,
  factors: {
    // Income: affordability. Diminishing effect is approximated by capping at AED 15,000.
    monthlyIncome: {
      label: "Monthly income",
      maxPoints: 10,
      fullConcernAt: 2_000,
      reference: 6_000,
      fullSupportAt: 15_000,
    },
    // DTI: share of income already committed to debt. Lower is better.
    dtiRatio: {
      label: "Debt-to-income ratio",
      maxPoints: 14,
      fullConcernAt: 70,
      reference: 30,
      fullSupportAt: 10,
    },
    // Credit score: record of managing credit. The concern side (550→640) is
    // steeper than the support side (640→800); see docs/DECISION_POLICY.md for why.
    creditScore: {
      label: "Credit score",
      maxPoints: 26,
      fullConcernAt: 550,
      reference: 640,
      fullSupportAt: 800,
    },
  },
};

/**
 * Throws if a policy is internally inconsistent. Called by the engine so a bad
 * edit to this file fails loudly instead of producing misleading results.
 */
export function assertValidPolicy(policy: ScoringPolicy): void {
  const problems: string[] = [];
  for (const [key, f] of Object.entries(policy.factors)) {
    if (!(f.maxPoints > 0)) problems.push(`${key}: maxPoints must be positive`);
    const supportSide = Math.sign(f.fullSupportAt - f.reference);
    const concernSide = Math.sign(f.fullConcernAt - f.reference);
    if (supportSide === 0 || concernSide === 0 || supportSide === concernSide) {
      problems.push(`${key}: reference must lie strictly between fullConcernAt and fullSupportAt`);
    }
  }
  const totalPoints = Object.values(policy.factors).reduce((s, f) => s + f.maxPoints, 0);
  if (policy.baseScore - totalPoints < 0 || policy.baseScore + totalPoints > 100) {
    problems.push("baseScore ± total maxPoints must stay within 0–100");
  }
  if (policy.approvalThreshold < 0 || policy.approvalThreshold > 100) {
    problems.push("approvalThreshold must be within 0–100");
  }
  if (policy.maximumDti < 0 || policy.maximumDti > 100) {
    problems.push("maximumDti must be within 0–100");
  }
  if (!(policy.strengthCutoffs.strong > policy.strengthCutoffs.moderate)) {
    problems.push("strengthCutoffs.strong must be greater than strengthCutoffs.moderate");
  }
  if (problems.length > 0) {
    throw new Error(`Invalid scoring policy "${policy.version}": ${problems.join("; ")}`);
  }
}
