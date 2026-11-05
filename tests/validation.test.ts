import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateApplicationInput, validateFormValues } from "../lib/validation/applicationInput";

const valid = { monthlyIncome: 12_000, dtiRatio: 30, creditScore: 700 };
const apiError = (body: unknown, field: string) => {
  const r = validateApplicationInput(body);
  assert.equal(r.ok, false);
  return r.ok ? "" : (r.fieldErrors as Record<string, string>)[field];
};

describe("API input validation", () => {
  it("accepts valid input, including decimals and range boundaries", () => {
    assert.deepEqual(validateApplicationInput(valid), { ok: true, value: valid });
    for (const body of [
      { monthlyIncome: 1_000, dtiRatio: 0, creditScore: 300 },
      { monthlyIncome: 1_000_000, dtiRatio: 100, creditScore: 900 },
      { monthlyIncome: 8_500.75, dtiRatio: 35.25, creditScore: 640 },
    ]) {
      assert.equal(validateApplicationInput(body).ok, true, JSON.stringify(body));
    }
  });

  it("rejects a non-object body", () => {
    for (const body of [null, "text", 42, [1, 2, 3]]) {
      const r = validateApplicationInput(body);
      assert.equal(r.ok, false);
      assert.ok(!r.ok && r.formError);
    }
  });

  it("reports missing fields", () => {
    const r = validateApplicationInput({});
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.fieldErrors.monthlyIncome, "Monthly income is required.");
      assert.equal(r.fieldErrors.dtiRatio, "Debt-to-income ratio is required.");
      assert.equal(r.fieldErrors.creditScore, "Credit score is required.");
    }
  });

  it("rejects numeric strings instead of converting them", () => {
    assert.equal(apiError({ ...valid, monthlyIncome: "12000" }, "monthlyIncome"), "Monthly income must be a number.");
    assert.equal(apiError({ ...valid, creditScore: true }, "creditScore"), "Credit score must be a number.");
  });

  it("handles income edge cases", () => {
    assert.equal(apiError({ ...valid, monthlyIncome: -500 }, "monthlyIncome"), "Monthly income cannot be negative.");
    assert.equal(apiError({ ...valid, monthlyIncome: 0 }, "monthlyIncome"), "Monthly income must be greater than zero.");
    assert.match(apiError({ ...valid, monthlyIncome: 999 }, "monthlyIncome"), /at least AED 1,000/);
    assert.match(apiError({ ...valid, monthlyIncome: 1_000_000.01 }, "monthlyIncome"), /outside the range/);
    assert.match(apiError({ ...valid, monthlyIncome: 5e12 }, "monthlyIncome"), /outside the range/);
    assert.match(apiError({ ...valid, monthlyIncome: 12_000.123 }, "monthlyIncome"), /at most 2 decimal places/);
  });

  it("handles DTI edge cases", () => {
    assert.equal(apiError({ ...valid, dtiRatio: -0.1 }, "dtiRatio"), "Debt-to-income ratio cannot be below 0%.");
    assert.equal(apiError({ ...valid, dtiRatio: 100.5 }, "dtiRatio"), "Debt-to-income ratio cannot be above 100%.");
    assert.match(apiError({ ...valid, dtiRatio: 33.333 }, "dtiRatio"), /at most 2 decimal places/);
  });

  it("handles credit score edge cases", () => {
    assert.equal(apiError({ ...valid, creditScore: 299 }, "creditScore"), "Credit score must be between 300 and 900.");
    assert.equal(apiError({ ...valid, creditScore: 901 }, "creditScore"), "Credit score must be between 300 and 900.");
    assert.equal(apiError({ ...valid, creditScore: 700.5 }, "creditScore"), "Credit score must be a whole number.");
  });

  it("rejects unexpected fields so nothing extra can be stored", () => {
    const r = validateApplicationInput({ ...valid, name: "Jane" });
    assert.equal(r.ok, false);
    assert.ok(!r.ok && /Unexpected field\(s\): name/.test(r.formError ?? ""));
  });
});

describe("form value parsing", () => {
  const form = { monthlyIncome: "12,000", dtiRatio: "35.5", creditScore: "720" };

  it("parses well-formed text, allowing thousands separators", () => {
    assert.deepEqual(validateFormValues(form), {
      ok: true,
      value: { monthlyIncome: 12_000, dtiRatio: 35.5, creditScore: 720 },
    });
  });

  it("reports empty and non-numeric text without guessing", () => {
    const r = validateFormValues({ monthlyIncome: "", dtiRatio: "abc", creditScore: "7OO" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.fieldErrors.monthlyIncome, "Monthly income is required.");
      assert.match(r.fieldErrors.dtiRatio ?? "", /as a number/);
      assert.match(r.fieldErrors.creditScore ?? "", /as a number/);
    }
  });

  it("rejects malformed separators and mixed text", () => {
    for (const bad of ["12,00", "1,2345", "12000abc", "1e4", "12 000", "Infinity", "0x10"]) {
      const r = validateFormValues({ ...form, monthlyIncome: bad });
      assert.equal(r.ok, false, bad);
    }
  });

  it("gives the specific negative-value message", () => {
    const r = validateFormValues({ ...form, monthlyIncome: "-5000", dtiRatio: "-3" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.fieldErrors.monthlyIncome, "Monthly income cannot be negative.");
      assert.equal(r.fieldErrors.dtiRatio, "Debt-to-income ratio cannot be below 0%.");
    }
  });

  it("applies the same range rules as the API", () => {
    const r = validateFormValues({ monthlyIncome: "0", dtiRatio: "120", creditScore: "250" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.fieldErrors.monthlyIncome, "Monthly income must be greater than zero.");
      assert.equal(r.fieldErrors.dtiRatio, "Debt-to-income ratio cannot be above 100%.");
      assert.equal(r.fieldErrors.creditScore, "Credit score must be between 300 and 900.");
    }
  });
});
