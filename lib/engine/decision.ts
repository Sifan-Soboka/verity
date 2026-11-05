/**
 * Verity's deterministic demonstration decision engine.
 *
 * Pure functions only: the same input and policy always give the same result.
 * No randomness, no per-scenario special cases, no I/O.
 */

import { DEMO_POLICY, assertValidPolicy, type FactorPolicy, type ScoringPolicy } from "./policy";
import {
  FACTOR_KEYS,
  type ApplicationInput,
  type DecisionResult,
  type FactorKey,
  type FactorResult,
  type FactorStatus,
  type FactorStrength,
  type PathToApproval,
} from "./types";
import { INPUT_LIMITS } from "../validation/limits";

/** Round half away from zero to 1 decimal place (so −6.75 → −6.8, matching +6.75 → +6.8). */
export function round1(x: number): number {
  const r = Math.sign(x) * Math.round(Math.abs(x) * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Step 1 — normalise a value onto −1 … +1 using the factor's three anchors.
 *
 *   value on the "support" side of the reference:
 *       n = min(1, |value − reference| / |fullSupportAt − reference|)
 *   value on the "concern" side of the reference:
 *       n = −min(1, |value − reference| / |fullConcernAt − reference|)
 *
 * Works for both "higher is better" (income, credit) and "lower is better" (DTI)
 * factors because the direction is defined by where fullSupportAt sits.
 */
export function normaliseFactor(value: number, f: FactorPolicy): number {
  const supportDirection = Math.sign(f.fullSupportAt - f.reference);
  const offset = value - f.reference;
  if (offset === 0) return 0;
  if (Math.sign(offset) === supportDirection) {
    return Math.min(1, Math.abs(offset) / Math.abs(f.fullSupportAt - f.reference));
  }
  return -Math.min(1, Math.abs(offset) / Math.abs(f.fullConcernAt - f.reference));
}

function classify(contribution: number, normalised: number, policy: ScoringPolicy) {
  let status: FactorStatus;
  if (contribution >= policy.neutralBand) status = "supports";
  else if (contribution <= -policy.neutralBand) status = "concern";
  else status = "neutral";

  const size = Math.abs(normalised);
  let strength: FactorStrength;
  if (status === "neutral") strength = "none";
  else if (size >= policy.strengthCutoffs.strong) strength = "strong";
  else if (size >= policy.strengthCutoffs.moderate) strength = "moderate";
  else strength = "slight";

  return { status, strength };
}

function assertFiniteInput(input: ApplicationInput): void {
  for (const key of FACTOR_KEYS) {
    if (typeof input[key] !== "number" || !Number.isFinite(input[key])) {
      // The API validates first; this guards against programming errors.
      throw new TypeError(`Decision engine received a non-numeric value for ${key}`);
    }
  }
}

/**
 * Calculate the demonstration decision for one application.
 *
 * Steps: normalise → contribution = round1(maxPoints × normalised) →
 * score = round1(baseScore + Σ contributions) → APPROVED if score ≥ threshold.
 *
 * Contributions are rounded BEFORE summing so the numbers shown to the user
 * always add up exactly to the displayed score.
 */
export function computeDecision(
  input: ApplicationInput,
  policy: ScoringPolicy = DEMO_POLICY,
): DecisionResult {
  assertValidPolicy(policy);
  assertFiniteInput(input);

  const factors: FactorResult[] = FACTOR_KEYS.map((key) => {
    const f = policy.factors[key];
    const normalised = normaliseFactor(input[key], f);
    const contribution = round1(f.maxPoints * normalised);
    return {
      key,
      label: f.label,
      value: input[key],
      referenceValue: f.reference,
      normalised: Math.round(normalised * 1000) / 1000,
      contribution,
      maxPoints: f.maxPoints,
      ...classify(contribution, normalised, policy),
    };
  });

  const score = round1(policy.baseScore + factors.reduce((sum, f) => sum + f.contribution, 0));
  const dtiLimitExceeded = input.dtiRatio > policy.maximumDti;
  const decision = score >= policy.approvalThreshold && !dtiLimitExceeded ? "APPROVED" : "REJECTED";

  return {
    policyVersion: policy.version,
    input: { ...input },
    baseScore: policy.baseScore,
    threshold: policy.approvalThreshold,
    score,
    margin: round1(score - policy.approvalThreshold),
    decision,
    maximumDti: policy.maximumDti,
    dtiLimitExceeded,
    factors,
  };
}

/** Step size and rounding direction used when reporting a required value. */
const PATH_STEP: Record<FactorKey, number> = {
  monthlyIncome: 1, // whole AED
  dtiRatio: 0.1, // one decimal place
  creditScore: 1, // whole points
};

function roundToStep(x: number, step: number, mode: "up" | "down"): number {
  const scaled = x / step;
  // Small epsilon avoids 15.000000001 rounding up to 16 due to float noise.
  const r = mode === "up" ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  return Math.round(r * step * 10) / 10;
}

const tidy = (x: number) => Math.round(x * 10) / 10;

/**
 * For a REJECTED result, find — for each factor separately, holding the other two
 * fixed — the value that would lift the score to the approval threshold.
 *
 * This is a simple, calculated "what would change the outcome" view (a basic
 * counterfactual). Factors that cannot reach the threshold on their own, or
 * would need a value outside the accepted input range, are left out.
 * Returns [] for APPROVED results.
 */
export function findPathsToApproval(
  result: DecisionResult,
  policy: ScoringPolicy = DEMO_POLICY,
): PathToApproval[] {
  if (result.decision === "APPROVED") return [];
  const paths: PathToApproval[] = [];

  for (const factor of result.factors) {
    const f = policy.factors[factor.key];
    const othersTotal = result.score - policy.baseScore - factor.contribution;
    const needed = policy.approvalThreshold - policy.baseScore - othersTotal; // points this factor must give
    if (needed > f.maxPoints + 1e-9) continue; // unreachable even at full support

    // Invert the piecewise-linear normalisation.
    const n = needed / f.maxPoints;
    const target =
      n >= 0
        ? f.reference + n * (f.fullSupportAt - f.reference)
        : f.reference + -n * (f.fullConcernAt - f.reference);

    const higherIsBetter = f.fullSupportAt > f.reference;
    const step = PATH_STEP[factor.key];
    const improve = higherIsBetter ? step : -step;
    const approvedAt = (v: number) =>
      computeDecision({ ...result.input, [factor.key]: v }, policy).decision === "APPROVED";

    let candidate = roundToStep(target, step, higherIsBetter ? "up" : "down");
    // A DTI change must also bring the DTI within the affordability limit.
    if (factor.key === "dtiRatio") candidate = Math.min(candidate, policy.maximumDti);

    // Contributions are rounded, so the analytic target can be a step off either way:
    // move forward until approved, then back while the previous step still approves.
    for (let i = 0; i < 100 && !approvedAt(candidate); i++) candidate = tidy(candidate + improve);
    if (!approvedAt(candidate)) continue; // e.g. income/credit while the DTI limit is exceeded
    for (let i = 0; i < 100 && approvedAt(tidy(candidate - improve)); i++) {
      candidate = tidy(candidate - improve);
    }

    const limits = INPUT_LIMITS[factor.key];
    if (candidate < limits.min || candidate > limits.max) continue;

    paths.push({
      key: factor.key,
      currentValue: factor.value,
      requiredValue: candidate,
      change: higherIsBetter ? "increase" : "decrease",
    });
  }
  return paths;
}
