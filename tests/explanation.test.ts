import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeDecision } from "../lib/engine/decision";
import { buildExplanation, CONTRIBUTION_DISCLAIMER } from "../lib/explain/explanation";
import { REFERENCE_SCENARIOS } from "../lib/scenarios";
import type { ApplicationInput } from "../lib/engine/types";

const explain = (input: ApplicationInput) => buildExplanation(computeDecision(input));
const scenario = (id: string) => REFERENCE_SCENARIOS.find((s) => s.id === id)!.input;

describe("explanation engine", () => {
  it("covers all three factors in the same order every time", () => {
    for (const s of REFERENCE_SCENARIOS) {
      const e = explain(s.input);
      assert.deepEqual(
        e.factors.map((f) => f.key),
        ["monthlyIncome", "dtiRatio", "creditScore"],
      );
      for (const f of e.factors) assert.ok(f.text.length > 20);
    }
  });

  it("uses the applicant's actual values in the factor text", () => {
    const e = explain({ monthlyIncome: 12_345.5, dtiRatio: 41.25, creditScore: 733 });
    assert.match(e.factors[0].text, /AED 12,345\.5/);
    assert.match(e.factors[1].text, /41\.25%/);
    assert.match(e.factors[1].text, /about AED 41 of every AED 100/);
    assert.match(e.factors[2].text, /733/);
  });

  it("produces a different explanation for each reference scenario", () => {
    const summaries = new Set(REFERENCE_SCENARIOS.map((s) => explain(s.input).summary));
    assert.equal(summaries.size, REFERENCE_SCENARIOS.length);
  });

  it("lists supporting and concerning factors from the calculated contributions", () => {
    const b = explain(scenario("B"));
    assert.deepEqual(b.supporting, ["creditScore", "monthlyIncome"]); // largest first
    assert.deepEqual(b.concerns, ["dtiRatio"]);
    assert.match(b.summary, /However, your debt-to-income ratio/);

    const e = explain(scenario("E"));
    assert.deepEqual(e.concerns, ["creditScore"]);
    assert.match(e.outcomeReason, /main reason was your credit score/);
    assert.match(e.outcomeReason, /Although your monthly income and debt-to-income ratio supported approval/);
  });

  it("states the score, threshold and outcome", () => {
    const a = explain(scenario("A"));
    assert.match(a.outcomeReason, /92\.8 is 42\.8 points above the approval threshold of 50\.0/);
    assert.match(a.outcomeReason, /approved in this simulation/);
    const d = explain(scenario("D"));
    assert.match(d.outcomeReason, /31\.9 is 18\.1 points below/);
    assert.match(d.outcomeReason, /not approved/);
  });

  it("flags borderline results near the threshold (scenario C) but not clear ones (A)", () => {
    assert.equal(explain(scenario("C")).borderline, true);
    assert.match(explain(scenario("C")).summary, /close to the threshold/);
    assert.equal(explain(scenario("A")).borderline, false);
  });

  it("explains the DTI affordability limit when it is the only blocker", () => {
    const e = explain({ monthlyIncome: 15_000, dtiRatio: 65, creditScore: 800 });
    assert.match(e.headline, /above the 60% limit/);
    assert.match(e.outcomeReason, /reached the approval threshold/);
    assert.match(e.factors[1].text, /above the 60% maximum/);
    assert.deepEqual(
      e.pathsToApproval.map((p) => p.text),
      ["Lower the debt-to-income ratio from 65% to 60% or less."],
    );
  });

  it("describes neutral factors as having little effect", () => {
    const e = explain({ monthlyIncome: 6_000, dtiRatio: 30, creditScore: 640 });
    assert.deepEqual(e.neutral, ["monthlyIncome", "dtiRatio", "creditScore"]);
    assert.match(e.summary, /each had little effect either way/);
    assert.match(e.outcomeReason, /exactly at the approval threshold/);
  });

  it("offers calculated paths to approval only for rejected applications", () => {
    assert.deepEqual(explain(scenario("A")).pathsToApproval, []);
    assert.equal(explain(scenario("A")).pathsNote, null);
    const e = explain(scenario("E"));
    assert.ok(e.pathsToApproval.some((p) => p.text === "Raise the credit score from 580 to at least 609."));
    const hopeless = explain({ monthlyIncome: 1_000, dtiRatio: 90, creditScore: 400 });
    assert.equal(hopeless.pathsToApproval.length, 0);
    assert.match(hopeless.pathsNote ?? "", /No single change/);
  });

  it("never describes contributions as SHAP or LIME output", () => {
    for (const s of REFERENCE_SCENARIOS) {
      const e = explain(s.input);
      const text = [e.headline, e.summary, ...e.factors.map((f) => f.text)].join(" ");
      assert.doesNotMatch(text, /SHAP|LIME/);
      assert.equal(e.disclaimer, CONTRIBUTION_DISCLAIMER);
    }
  });
});
