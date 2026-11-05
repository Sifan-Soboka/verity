import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeDecision, findPathsToApproval, normaliseFactor, round1 } from "../lib/engine/decision";
import { DEMO_POLICY, assertValidPolicy, type ScoringPolicy } from "../lib/engine/policy";
import { REFERENCE_SCENARIOS } from "../lib/scenarios";
import type { ApplicationInput, FactorKey } from "../lib/engine/types";

const base: ApplicationInput = { monthlyIncome: 10_000, dtiRatio: 30, creditScore: 700 };
const contribution = (input: ApplicationInput, key: FactorKey) =>
  computeDecision(input).factors.find((f) => f.key === key)!.contribution;

describe("policy configuration", () => {
  it("the shipped demonstration policy is valid", () => {
    assert.doesNotThrow(() => assertValidPolicy(DEMO_POLICY));
  });

  it("rejects a policy whose score range would leave 0–100", () => {
    const bad: ScoringPolicy = structuredClone(DEMO_POLICY);
    bad.factors.creditScore.maxPoints = 60;
    assert.throws(() => assertValidPolicy(bad), /0–100/);
  });

  it("rejects a factor whose reference is not between its anchors", () => {
    const bad: ScoringPolicy = structuredClone(DEMO_POLICY);
    bad.factors.dtiRatio.reference = 5; // below fullSupportAt (10)
    assert.throws(() => assertValidPolicy(bad), /dtiRatio/);
  });
});

describe("normalisation", () => {
  const income = DEMO_POLICY.factors.monthlyIncome;
  const dti = DEMO_POLICY.factors.dtiRatio;

  it("is 0 at the reference point and ±1 at the anchors", () => {
    assert.equal(normaliseFactor(income.reference, income), 0);
    assert.equal(normaliseFactor(income.fullSupportAt, income), 1);
    assert.equal(normaliseFactor(income.fullConcernAt, income), -1);
    assert.equal(normaliseFactor(dti.fullSupportAt, dti), 1);
    assert.equal(normaliseFactor(dti.fullConcernAt, dti), -1);
  });

  it("is linear between anchors", () => {
    // halfway between 6,000 and 15,000 → +0.5
    assert.equal(normaliseFactor(10_500, income), 0.5);
    // DTI halfway between 30 and 70 → −0.5
    assert.equal(normaliseFactor(50, dti), -0.5);
  });

  it("is capped beyond the anchors", () => {
    assert.equal(normaliseFactor(900_000, income), 1);
    assert.equal(normaliseFactor(1_000, income), -1);
    assert.equal(normaliseFactor(0, dti), 1);
    assert.equal(normaliseFactor(100, dti), -1);
  });
});

describe("rounding", () => {
  it("rounds halves away from zero symmetrically", () => {
    assert.equal(round1(6.75), 6.8);
    assert.equal(round1(-6.75), -6.8);
    assert.equal(round1(-0.04), 0);
    assert.ok(!Object.is(round1(-0.04), -0));
  });
});

describe("computeDecision", () => {
  it("is deterministic", () => {
    const a = computeDecision(base);
    const b = computeDecision(base);
    assert.deepEqual(a, b);
  });

  it("score equals base score plus the displayed contributions", () => {
    for (const s of REFERENCE_SCENARIOS) {
      const r = computeDecision(s.input);
      const sum = r.factors.reduce((t, f) => t + f.contribution, 0);
      assert.equal(r.score, round1(r.baseScore + sum), `scenario ${s.id}`);
    }
  });

  it("keeps every contribution within ±maxPoints and the score within 0–100", () => {
    const extremes: ApplicationInput[] = [
      { monthlyIncome: 1_000, dtiRatio: 100, creditScore: 300 },
      { monthlyIncome: 1_000_000, dtiRatio: 0, creditScore: 900 },
    ];
    for (const input of extremes) {
      const r = computeDecision(input);
      for (const f of r.factors) assert.ok(Math.abs(f.contribution) <= f.maxPoints);
      assert.ok(r.score >= 0 && r.score <= 100);
    }
    assert.equal(computeDecision(extremes[0]).score, 0);
    assert.equal(computeDecision(extremes[1]).score, 100);
  });

  it("approves at exactly the threshold and rejects just below it", () => {
    // Every factor at its reference point → score = base = threshold (50).
    const neutral = { monthlyIncome: 6_000, dtiRatio: 30, creditScore: 640 };
    const r = computeDecision(neutral);
    assert.equal(r.score, 50);
    assert.equal(r.decision, "APPROVED");
    const justBelow = computeDecision({ ...neutral, creditScore: 637 }); // −0.9 pts
    assert.ok(justBelow.score < 50);
    assert.equal(justBelow.decision, "REJECTED");
  });

  it("throws on non-numeric input instead of guessing", () => {
    assert.throws(() => computeDecision({ ...base, dtiRatio: Number.NaN }), TypeError);
    assert.throws(
      () => computeDecision({ ...base, creditScore: "700" as unknown as number }),
      TypeError,
    );
  });

  it("labels small contributions as neutral and large ones by strength", () => {
    const r = computeDecision({ monthlyIncome: 6_000, dtiRatio: 65, creditScore: 790 });
    const [income, dti, credit] = r.factors;
    assert.equal(income.status, "neutral");
    assert.equal(income.strength, "none");
    assert.equal(dti.status, "concern");
    assert.equal(dti.strength, "strong");
    assert.equal(credit.status, "supports");
    assert.equal(credit.strength, "strong");
  });
});

describe("factor directions (monotonicity)", () => {
  it("higher income never lowers the income contribution", () => {
    let prev = -Infinity;
    for (let income = 1_000; income <= 40_000; income += 500) {
      const c = contribution({ ...base, monthlyIncome: income }, "monthlyIncome");
      assert.ok(c >= prev, `income ${income}`);
      prev = c;
    }
  });

  it("higher DTI never raises the DTI contribution", () => {
    let prev = Infinity;
    for (let dti = 0; dti <= 100; dti += 0.5) {
      const c = contribution({ ...base, dtiRatio: dti }, "dtiRatio");
      assert.ok(c <= prev, `dti ${dti}`);
      prev = c;
    }
  });

  it("higher credit score never lowers the credit contribution", () => {
    let prev = -Infinity;
    for (let cs = 300; cs <= 900; cs += 5) {
      const c = contribution({ ...base, creditScore: cs }, "creditScore");
      assert.ok(c >= prev, `credit ${cs}`);
      prev = c;
    }
  });

  it("each factor can change the outcome on its own", () => {
    // Start from a rejected applicant; improving one factor alone flips the decision.
    const rejected: ApplicationInput = { monthlyIncome: 6_000, dtiRatio: 40, creditScore: 630 };
    assert.equal(computeDecision(rejected).decision, "REJECTED");
    assert.equal(computeDecision({ ...rejected, monthlyIncome: 14_000 }).decision, "APPROVED");
    assert.equal(computeDecision({ ...rejected, dtiRatio: 25 }).decision, "APPROVED");
    assert.equal(computeDecision({ ...rejected, creditScore: 700 }).decision, "APPROVED");
  });

  it("different inputs produce different results (no fixed output)", () => {
    const scores = new Set(
      [500, 600, 650, 700, 750, 800].map((cs) => computeDecision({ ...base, creditScore: cs }).score),
    );
    assert.equal(scores.size, 6);
  });
});

describe("reference scenarios A–E (report Table 1)", () => {
  // Expected values are worked out by hand in docs/DECISION_POLICY.md.
  const expected: Record<string, { score: number; contributions: [number, number, number] }> = {
    A: { score: 92.8, contributions: [10, 8.4, 24.4] },
    B: { score: 65.6, contributions: [4.4, -1.8, 13] },
    C: { score: 54, contributions: [2.2, -6.3, 8.1] },
    D: { score: 31.9, contributions: [0, -12.3, -5.8] },
    E: { score: 41.8, contributions: [5.6, 3.5, -17.3] },
  };

  for (const scenario of REFERENCE_SCENARIOS) {
    it(`scenario ${scenario.id} reproduces the report outcome (${scenario.reportOutcome})`, () => {
      const r = computeDecision(scenario.input);
      assert.equal(r.decision, scenario.reportOutcome);
      assert.equal(r.score, expected[scenario.id].score);
      assert.deepEqual(
        r.factors.map((f) => f.contribution),
        expected[scenario.id].contributions,
      );
    });
  }

  it("factor directions match the report's narrative for every scenario", () => {
    // + supports, − concern, 0 neutral (report §8.2 and Table 1)
    const narrative: Record<string, string> = { A: "+++", B: "+-+", C: "+-+", D: "0--", E: "++-" };
    const symbol = { supports: "+", concern: "-", neutral: "0" } as const;
    for (const s of REFERENCE_SCENARIOS) {
      const got = computeDecision(s.input).factors.map((f) => symbol[f.status]).join("");
      assert.equal(got, narrative[s.id], `scenario ${s.id}`);
    }
  });

  it("borderline scenarios B/C sit closer to the threshold than baseline A", () => {
    const margin = (id: string) =>
      computeDecision(REFERENCE_SCENARIOS.find((s) => s.id === id)!.input).margin;
    assert.ok(margin("C") < margin("B") && margin("B") < margin("A"));
  });
});

describe("affordability limit (maximumDti)", () => {
  it("rejects a DTI above the limit even when the score passes the threshold", () => {
    const r = computeDecision({ monthlyIncome: 15_000, dtiRatio: 65, creditScore: 800 });
    assert.ok(r.score >= r.threshold, `score ${r.score}`);
    assert.equal(r.dtiLimitExceeded, true);
    assert.equal(r.decision, "REJECTED");
  });

  it("allows a DTI exactly at the limit", () => {
    const r = computeDecision({ monthlyIncome: 15_000, dtiRatio: 60, creditScore: 800 });
    assert.equal(r.dtiLimitExceeded, false);
    assert.equal(r.decision, "APPROVED");
  });

  it("stops one strong factor from rescuing extreme profiles", () => {
    // Excellent credit cannot outweigh a 100% DTI…
    assert.equal(computeDecision({ monthlyIncome: 1_000, dtiRatio: 100, creditScore: 900 }).decision, "REJECTED");
    assert.equal(computeDecision({ monthlyIncome: 1_000_000, dtiRatio: 100, creditScore: 900 }).decision, "REJECTED");
    // …and maximum income with no debt cannot outweigh the lowest credit score.
    assert.equal(computeDecision({ monthlyIncome: 1_000_000, dtiRatio: 0, creditScore: 300 }).decision, "REJECTED");
  });
});

describe("findPathsToApproval", () => {
  it("returns nothing for approved applications", () => {
    assert.deepEqual(findPathsToApproval(computeDecision(REFERENCE_SCENARIOS[0].input)), []);
  });

  it("finds the minimum single-factor change for scenario E, and each one really approves", () => {
    const r = computeDecision(REFERENCE_SCENARIOS[4].input); // E: 11,000 / 25% / 580
    const paths = findPathsToApproval(r);
    const byKey = Object.fromEntries(paths.map((p) => [p.key, p]));

    // Income is already near its cap — it cannot close an 8.2-point gap alone.
    assert.equal(byKey.monthlyIncome, undefined);
    assert.equal(byKey.creditScore.change, "increase");
    assert.equal(byKey.dtiRatio.change, "decrease");

    for (const p of paths) {
      const approved = computeDecision({ ...r.input, [p.key]: p.requiredValue });
      assert.equal(approved.decision, "APPROVED", `${p.key} at ${p.requiredValue}`);
      // ...and one step less is not enough (the value is the minimum change).
      const step = p.key === "dtiRatio" ? 0.1 : 1;
      const lessValue = p.change === "increase" ? p.requiredValue - step : p.requiredValue + step;
      const notEnough = computeDecision({ ...r.input, [p.key]: Math.round(lessValue * 10) / 10 });
      assert.equal(notEnough.decision, "REJECTED", `${p.key} at ${lessValue}`);
    }
  });

  it("only offers a DTI change when the DTI limit is the sole blocker", () => {
    const r = computeDecision({ monthlyIncome: 15_000, dtiRatio: 65, creditScore: 800 });
    const paths = findPathsToApproval(r);
    assert.deepEqual(paths, [{ key: "dtiRatio", currentValue: 65, requiredValue: 60, change: "decrease" }]);
  });

  it("returns nothing when no single change is enough", () => {
    // Very weak profile: no one factor can reach the threshold on its own.
    const r = computeDecision({ monthlyIncome: 1_000, dtiRatio: 90, creditScore: 400 });
    const paths = findPathsToApproval(r);
    assert.deepEqual(paths, []);
  });
});
