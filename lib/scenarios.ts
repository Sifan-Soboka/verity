/**
 * The five fictional reference scenarios from the CSIT305 research report
 * (Section 8.2, Table 1). They are used as form presets and as test cases.
 *
 * `reportOutcome` is the outcome the REPORT intended. It is never used to
 * produce a result — the engine calculates every result from the inputs. The
 * results page only compares the two, so examiners can see they agree.
 */
import type { ApplicationInput, Decision } from "./engine/types";

export interface ReferenceScenario {
  id: "A" | "B" | "C" | "D" | "E";
  input: ApplicationInput;
  reportOutcome: Decision;
  /** What the scenario was designed to test (report Table 1). */
  purpose: string;
}

export const REFERENCE_SCENARIOS: readonly ReferenceScenario[] = [
  {
    id: "A",
    input: { monthlyIncome: 15_000, dtiRatio: 18, creditScore: 790 },
    reportOutcome: "APPROVED",
    purpose: "Baseline: a clear approval",
  },
  {
    id: "B",
    input: { monthlyIncome: 10_000, dtiRatio: 35, creditScore: 720 },
    reportOutcome: "APPROVED",
    purpose: "DTI is the factor holding the approval back",
  },
  {
    id: "C",
    input: { monthlyIncome: 8_000, dtiRatio: 48, creditScore: 690 },
    reportOutcome: "APPROVED",
    purpose: "Borderline: approval despite a high DTI",
  },
  {
    id: "D",
    input: { monthlyIncome: 6_000, dtiRatio: 65, creditScore: 620 },
    reportOutcome: "REJECTED",
    purpose: "How a 65% DTI contributes to a rejection",
  },
  {
    id: "E",
    input: { monthlyIncome: 11_000, dtiRatio: 25, creditScore: 580 },
    reportOutcome: "REJECTED",
    purpose: "Rejection where DTI is favourable and credit score is the concern",
  },
];

/** Returns the reference scenario whose values exactly match the input, if any. */
export function matchScenario(input: ApplicationInput): ReferenceScenario | undefined {
  return REFERENCE_SCENARIOS.find(
    (s) =>
      s.input.monthlyIncome === input.monthlyIncome &&
      s.input.dtiRatio === input.dtiRatio &&
      s.input.creditScore === input.creditScore,
  );
}
