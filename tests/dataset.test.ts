/**
 * The project dataset: parsing, unit conversion, the real file end-to-end,
 * and GET /api/dataset.
 */
import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { convertRecord, parseDatasetCsv, USD_TO_AED } from "../lib/dataset/applicants";
import { computeDecision } from "../lib/engine/decision";
import { DEFAULT_DATASET_PATH, InMemoryDataset } from "../lib/server/dataset";
import { handleDatasetLookup } from "../lib/server/datasetHandlers";
import { validateApplicationInput } from "../lib/validation/applicationInput";

const HEADER =
  "user_id,age,gender,education_level,employment_status,job_title,monthly_income_usd,monthly_expenses_usd,savings_usd,has_loan,loan_type,loan_amount_usd,loan_term_months,monthly_emi_usd,loan_interest_rate_pct,debt_to_income_ratio,credit_score,savings_to_income_ratio,region,record_date";
// First two rows of the real file.
const SAMPLE = [
  HEADER,
  "U00001,56,Female,High School,Self-employed,Salesperson,3531.69,1182.59,367655.03,No,None,0.0,0,0.0,0.0,0.0,430,8.68,Other,2024-01-09",
  "U00002,19,Female,PhD,Employed,Salesperson,3531.73,2367.99,260869.1,Yes,Education,146323.34,36,4953.5,13.33,1.4,543,6.16,North America,2022-02-13",
].join("\n");

describe("dataset conversion", () => {
  it("converts USD income to AED and the DTI fraction to a percentage", () => {
    assert.equal(USD_TO_AED, 3.6725);
    assert.deepEqual(convertRecord({ monthlyIncomeUsd: 3531.73, debtToIncomeRatio: 1.4, creditScore: 543 }), {
      monthlyIncome: 12_970.28, // 3531.73 × 3.6725 = 12,970.279… → 2 dp
      dtiRatio: 140,
      creditScore: 543,
    });
    assert.equal(convertRecord({ monthlyIncomeUsd: 4000, debtToIncomeRatio: 0.35, creditScore: 700 }).dtiRatio, 35);
  });

  it("parses rows and keeps only the fields Verity uses", () => {
    const [a, b] = parseDatasetCsv(SAMPLE);
    assert.deepEqual(a, {
      userId: "U00001",
      hasLoan: false,
      input: { monthlyIncome: 12_970.13, dtiRatio: 0, creditScore: 430 },
      source: { monthlyIncomeUsd: 3531.69, debtToIncomeRatio: 0, creditScore: 430 },
    });
    assert.equal(b.hasLoan, true);
    // Demographic and other columns are not carried through.
    assert.doesNotMatch(JSON.stringify([a, b]), /Female|PhD|Salesperson|North America|age|gender|region/);
  });

  it("rejects malformed files instead of skipping rows", () => {
    assert.throws(() => parseDatasetCsv(""), /empty/);
    assert.throws(() => parseDatasetCsv("user_id,credit_score\nU1,500"), /missing column/);
    assert.throws(() => parseDatasetCsv(`${HEADER}\nU00001,56,Female`), /line 2: expected 20 columns/);
    const badNumber = SAMPLE.replace("3531.69", "abc");
    assert.throws(() => parseDatasetCsv(badNumber), /line 2: "monthly_income_usd" is not a number/);
    const duplicate = `${SAMPLE}\n${SAMPLE.split("\n")[1]}`;
    assert.throws(() => parseDatasetCsv(duplicate), /duplicate user_id U00001/);
  });
});

describe("the real dataset file", () => {
  const records = parseDatasetCsv(readFileSync(DEFAULT_DATASET_PATH, "utf8"));

  it("loads every record", () => {
    assert.equal(records.length, 32_424);
    assert.equal(records.filter((r) => r.hasLoan).length, 12_995);
  });

  it("every converted record passes server validation and gets a decision", () => {
    const outcomes = { APPROVED: 0, REJECTED: 0 };
    for (const r of records) {
      const v = validateApplicationInput(r.input);
      assert.ok(v.ok, `${r.userId}: ${JSON.stringify(!v.ok && v.fieldErrors)}`);
      outcomes[computeDecision(r.input).decision]++;
    }
    assert.equal(outcomes.APPROVED + outcomes.REJECTED, records.length);
    assert.ok(outcomes.APPROVED > 0 && outcomes.REJECTED > 0);
  });

  it("records without a loan have a 0% DTI", () => {
    assert.ok(records.filter((r) => !r.hasLoan).every((r) => r.input.dtiRatio === 0));
  });
});

describe("GET /api/dataset", () => {
  const dataset = new InMemoryDataset(parseDatasetCsv(SAMPLE), () => 0.99);
  const get = (query: string, source = () => dataset) =>
    handleDatasetLookup(new Request(`http://localhost/api/dataset${query}`), source).then(async (res) => ({
      status: res.status,
      body: (await res.json()) as any,
    }));

  it("looks up a record by user ID (case-insensitive)", async () => {
    const { status, body } = await get("?userId=u00002");
    assert.equal(status, 200);
    assert.equal(body.data.userId, "U00002");
    assert.deepEqual(body.data.input, { monthlyIncome: 12_970.28, dtiRatio: 140, creditScore: 543 });
    assert.equal(body.data.datasetSize, 2);
  });

  it("returns a random record, optionally only ones with a loan", async () => {
    const any = await get("?random=true");
    assert.equal(any.status, 200);
    const withLoan = await get("?random=true&loan=true");
    assert.equal(withLoan.body.data.hasLoan, true);
  });

  it("validates the query and reports unknown IDs", async () => {
    assert.equal((await get("")).status, 400);
    assert.equal((await get("?userId=../../etc")).status, 400);
    const missing = await get("?userId=U99999");
    assert.equal(missing.status, 404);
    assert.match(missing.body.error.message, /No dataset record with user ID U99999/);
  });

  it("returns 500 without details if the file cannot be read", async (t) => {
    const log = mock.method(console, "error", () => {});
    t.after(() => log.mock.restore());
    const { status, body } = await get("?random=true", () => {
      throw new Error("ENOENT: /secret/path/data.csv");
    });
    assert.equal(status, 500);
    assert.doesNotMatch(JSON.stringify(body), /secret|ENOENT/);
  });
});
