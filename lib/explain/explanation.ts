/**
 * Verity's explanation engine.
 *
 * Turns a DecisionResult into plain-language text for non-technical users.
 * Every sentence is chosen from the CALCULATED status/strength/contribution of
 * each factor and includes the applicant's actual values — nothing is
 * hardcoded per scenario. Wording was informed by the illustrative
 * explanations in the CSIT305 report (§8.2).
 */

import { findPathsToApproval } from "../engine/decision";
import { DEMO_POLICY, type ScoringPolicy } from "../engine/policy";
import type { DecisionResult, FactorKey, FactorResult, FactorStatus } from "../engine/types";
import { capitalise, formatAED, formatFactorValue, formatPercent, formatScore, joinList } from "../format";

export const CONTRIBUTION_DISCLAIMER =
  "Contributions come from Verity's demonstration scoring policy. They are not SHAP or LIME values and do not represent any real lender's assessment.";

export const STATUS_LABEL: Record<FactorStatus, string> = {
  supports: "Supports approval",
  concern: "Potential concern",
  neutral: "Little effect",
};

export interface FactorExplanation {
  key: FactorKey;
  label: string;
  valueText: string;
  statusLabel: string;
  /** One or two sentences for the factor card. */
  text: string;
}

export interface PathExplanation {
  key: FactorKey;
  change: "increase" | "decrease";
  requiredValue: number;
  text: string;
}

export interface Explanation {
  /** Short line for the decision banner. */
  headline: string;
  /** Narrative paragraph: supporting factors, concerns, and the outcome. */
  summary: string;
  /** Why the overall score produced the displayed outcome. */
  outcomeReason: string;
  supporting: FactorKey[];
  concerns: FactorKey[];
  neutral: FactorKey[];
  borderline: boolean;
  factors: FactorExplanation[];
  /** Calculated single-factor changes that would reach approval (rejected results only). */
  pathsToApproval: PathExplanation[];
  /** Shown for rejected results when no single change is enough; otherwise null. */
  pathsNote: string | null;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Factor card sentences
// ---------------------------------------------------------------------------

const aboveBelow = (f: FactorResult, higherIsBetter: boolean) => {
  const above = higherIsBetter ? f.status === "supports" : f.status === "concern";
  const word = above ? "above" : "below";
  if (f.strength === "strong") return `well ${word}`;
  if (f.strength === "slight") return `a little ${word}`;
  return word;
};

function incomeText(f: FactorResult): string {
  const lead = `Your monthly income of ${formatAED(f.value)}`;
  const ref = formatAED(f.referenceValue);
  if (f.status === "neutral") {
    return `${lead} is close to the ${ref} reference point, so it had little effect on the result either way.`;
  }
  const position = `${lead} is ${aboveBelow(f, true)} the ${ref} reference point`;
  if (f.status === "supports") {
    return {
      strong: `${position}, which strongly supports your capacity to repay.`,
      moderate: `${position} and supports your capacity to repay.`,
      slight: `${position}, giving a small boost to your repayment capacity.`,
      none: "",
    }[f.strength];
  }
  return {
    strong: `${position}, which significantly limits the repayment capacity this assessment looks for.`,
    moderate: `${position}, which limits the repayment capacity this assessment looks for.`,
    slight: `${position}, which slightly limits the repayment capacity this assessment looks for.`,
    none: "",
  }[f.strength];
}

function dtiShare(value: number): string {
  if (value === 0) return "none of your income currently goes to existing debt repayments";
  if (value > 100) {
    const times = Math.round((value / 100) * 10) / 10;
    return times === 1
      ? "your debt repayments are slightly more than your whole monthly income"
      : `your debt repayments are about ${times} times your monthly income`;
  }
  const perHundred = Math.round(value);
  return perHundred < 1
    ? "less than AED 1 of every AED 100 you earn goes to existing debt repayments"
    : `about AED ${perHundred} of every AED 100 you earn already goes to existing debt repayments`;
}

function dtiText(f: FactorResult, result: DecisionResult): string {
  const ref = formatPercent(f.referenceValue);
  let text = `Your debt-to-income ratio is ${formatPercent(f.value)}: ${dtiShare(f.value)}. `;
  if (f.status === "neutral") {
    text += `That is close to the ${ref} reference point, so it had little effect on the result.`;
  } else if (f.status === "supports") {
    text += {
      strong: `That is well below the ${ref} reference point, which leaves plenty of room for new repayments and strongly supports approval.`,
      moderate: `That is below the ${ref} reference point, which leaves room for new repayments and supports approval.`,
      slight: `That is a little below the ${ref} reference point, which gives slight support to the assessment.`,
      none: "",
    }[f.strength];
  } else {
    text += {
      strong: `That is well above the ${ref} reference point: a large proportion of your income is already committed, which significantly increases the demonstration risk.`,
      moderate: `That is above the ${ref} reference point: a considerable proportion of your income is already committed, which increases the demonstration risk.`,
      slight: `That is a little above the ${ref} reference point, which slightly reduces approval confidence.`,
      none: "",
    }[f.strength];
  }
  if (result.dtiLimitExceeded) {
    text += ` It is also above the ${formatPercent(result.maximumDti)} maximum this demonstration policy accepts, so the application could not be approved whatever the overall score.`;
  }
  return text;
}

function creditText(f: FactorResult): string {
  const lead = `Your credit score of ${f.value}`;
  const ref = String(f.referenceValue);
  if (f.status === "neutral") {
    return `${lead} is close to the ${ref} reference point, so it had little effect on the result either way.`;
  }
  const position = `${lead} is ${aboveBelow(f, true)} the ${ref} reference point`;
  if (f.status === "supports") {
    return {
      strong: `${position}, which points to a strong record of managing credit and strongly supports approval.`,
      moderate: `${position}, which points to a good record of managing credit and supports approval.`,
      slight: `${position}, giving some additional support to the assessment.`,
      none: "",
    }[f.strength];
  }
  return {
    strong: `${position}, which suggests past difficulties with repayments and significantly reduces the likelihood of approval.`,
    moderate: `${position}, which suggests some past difficulty with repayments and reduces the likelihood of approval.`,
    slight: `${position}, which slightly reduces the likelihood of approval.`,
    none: "",
  }[f.strength];
}

// ---------------------------------------------------------------------------
// Short clauses used in the narrative summary (no numbers — the cards have them)
// ---------------------------------------------------------------------------

function clause(f: FactorResult): string {
  switch (f.key) {
    case "monthlyIncome":
      if (f.status === "supports") return "your monthly income supports your capacity to repay";
      if (f.status === "concern") return "your monthly income is lower than this assessment looks for";
      return "your monthly income had little effect either way";
    case "dtiRatio":
      if (f.status === "supports")
        return "your debt-to-income ratio shows that only a small part of your income is committed to existing debt";
      if (f.status === "concern") {
        const share = { strong: "a large", moderate: "a considerable", slight: "a moderate", none: "" }[f.strength];
        return `your debt-to-income ratio indicates that ${share} proportion of your income is already committed to existing debt repayments`;
      }
      return "your debt-to-income ratio had little effect either way";
    case "creditScore":
      if (f.status === "supports")
        return f.strength === "slight"
          ? "your credit score provides some additional support"
          : "your credit score points to a good record of managing credit";
      if (f.status === "concern")
        return f.strength === "slight"
          ? "your credit score is slightly below the reference point"
          : "your credit score points to past difficulties with repayments";
      return "your credit score had little effect either way";
  }
}

const factorName = (f: FactorResult) =>
  ({ monthlyIncome: "monthly income", dtiRatio: "debt-to-income ratio", creditScore: "credit score" })[f.key];

// ---------------------------------------------------------------------------
// Outcome reasoning
// ---------------------------------------------------------------------------

function buildOutcomeReason(
  result: DecisionResult,
  supporters: FactorResult[],
  concerns: FactorResult[],
): string {
  const score = formatScore(result.score);
  const threshold = formatScore(result.threshold);
  const gap = formatScore(Math.abs(result.margin));
  const limitText = `your debt-to-income ratio of ${formatPercent(result.input.dtiRatio)} is above the ${formatPercent(result.maximumDti)} maximum this demonstration policy accepts`;

  if (result.decision === "APPROVED") {
    const lead =
      concerns.length > 0
        ? `Overall, the supporting factors outweighed the ${joinList(concerns.map(factorName))}: the`
        : "Overall, the";
    const position =
      result.margin === 0
        ? `is exactly at the approval threshold of ${threshold}`
        : `is ${gap} points above the approval threshold of ${threshold}`;
    return `${lead} demonstration score of ${score} ${position}, so the application was approved in this simulation.`;
  }

  if (result.score >= result.threshold) {
    // Rejected only because of the affordability limit.
    return `Your demonstration score of ${score} reached the approval threshold of ${threshold}, but ${limitText}, so the application was not approved in this simulation.`;
  }

  const main = concerns[0];
  let text = `Overall, the demonstration score of ${score} is ${gap} points below the approval threshold of ${threshold}, so the application was not approved in this simulation.`;
  if (main) {
    text += ` The main reason was your ${factorName(main)}.`;
    if (supporters.length > 0) {
      const verb = supporters.length > 1 ? "they were" : "it was";
      text += ` Although your ${joinList(supporters.map(factorName))} supported approval, ${verb} not enough to offset this.`;
    }
  }
  if (result.dtiLimitExceeded) text += ` In addition, ${limitText}.`;
  return text;
}

function buildHeadline(result: DecisionResult, supporters: FactorResult[], concerns: FactorResult[]): string {
  if (result.decision === "APPROVED") {
    return supporters[0]
      ? `Approved — mainly supported by your ${factorName(supporters[0])}.`
      : "Approved — your profile sits at the policy's reference points.";
  }
  if (result.dtiLimitExceeded && result.score >= result.threshold) {
    return `Rejected — your debt-to-income ratio is above the ${formatPercent(result.maximumDti)} limit.`;
  }
  return concerns[0]
    ? `Rejected — mainly because of your ${factorName(concerns[0])}.`
    : "Rejected — the score did not reach the approval threshold.";
}

function pathText(key: FactorKey, current: number, required: number): string {
  switch (key) {
    case "monthlyIncome":
      return `Increase monthly income from ${formatAED(current)} to at least ${formatAED(required)}.`;
    case "dtiRatio":
      return `Lower the debt-to-income ratio from ${formatPercent(current)} to ${formatPercent(required)} or less.`;
    case "creditScore":
      return `Raise the credit score from ${current} to at least ${required}.`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildExplanation(result: DecisionResult, policy: ScoringPolicy = DEMO_POLICY): Explanation {
  const supporters = result.factors
    .filter((f) => f.status === "supports")
    .sort((a, b) => b.contribution - a.contribution);
  const concerns = result.factors
    .filter((f) => f.status === "concern")
    .sort((a, b) => a.contribution - b.contribution);
  const neutral = result.factors.filter((f) => f.status === "neutral");

  const factors: FactorExplanation[] = result.factors.map((f) => ({
    key: f.key,
    label: f.label,
    valueText: formatFactorValue(f.key, f.value),
    statusLabel: STATUS_LABEL[f.status],
    text: f.key === "monthlyIncome" ? incomeText(f) : f.key === "dtiRatio" ? dtiText(f, result) : creditText(f),
  }));

  const outcomeReason = buildOutcomeReason(result, supporters, concerns);
  const limitOnly = result.dtiLimitExceeded && result.score >= result.threshold;
  const borderline = !limitOnly && Math.abs(result.margin) < policy.borderlineMargin;

  const sentences: string[] = [];
  if (supporters.length > 0) sentences.push(`${capitalise(joinList(supporters.map(clause)))}.`);
  if (concerns.length > 0) {
    const text = joinList(concerns.map(clause));
    sentences.push(supporters.length > 0 ? `However, ${text}.` : `${capitalise(text)}.`);
  }
  if (neutral.length > 0) {
    const each = neutral.length > 1 ? "each " : "";
    sentences.push(`Your ${joinList(neutral.map(factorName))} ${each}had little effect either way.`);
  }
  sentences.push(outcomeReason);
  if (borderline) {
    sentences.push(
      "This result is close to the threshold, so a small change in any one factor could change the outcome.",
    );
  }

  const paths = findPathsToApproval(result, policy).map((p) => ({
    key: p.key,
    change: p.change,
    requiredValue: p.requiredValue,
    text: pathText(p.key, p.currentValue, p.requiredValue),
  }));
  const pathsNote =
    result.decision === "REJECTED" && paths.length === 0
      ? "No single change would be enough on its own in this simulation — it would take improvements in more than one factor."
      : null;

  return {
    headline: buildHeadline(result, supporters, concerns),
    summary: sentences.join(" "),
    outcomeReason,
    supporting: supporters.map((f) => f.key),
    concerns: concerns.map((f) => f.key),
    neutral: neutral.map((f) => f.key),
    borderline,
    factors,
    pathsToApproval: paths,
    pathsNote,
    disclaimer: CONTRIBUTION_DISCLAIMER,
  };
}
