/**
 * Turns rows of the project dataset (synthetic_personal_finance_dataset.csv)
 * into Verity application inputs.
 *
 * Conversions (documented in README → "Dataset"):
 *   monthly_income_usd   × 3.6725  → monthlyIncome (AED, 2 dp)   — fixed USD/AED peg
 *   debt_to_income_ratio × 100     → dtiRatio (%, 2 dp)          — dataset stores a fraction (EMI ÷ income)
 *   credit_score                   → creditScore (unchanged, 300–850)
 *
 * Only these three values (plus the synthetic user_id and loan flag) are used.
 * Age, gender, education, job, region etc. are deliberately ignored so they
 * cannot influence or appear alongside a decision (report §9.4, proxy bias).
 */
import type { ApplicationInput } from "../engine/types";

export const USD_TO_AED = 3.6725;

/** Columns Verity needs; the file may contain others, which are ignored. */
export const REQUIRED_COLUMNS = [
  "user_id",
  "monthly_income_usd",
  "debt_to_income_ratio",
  "credit_score",
  "has_loan",
] as const;

export interface DatasetApplicant {
  userId: string;
  hasLoan: boolean;
  /** Values converted for Verity. */
  input: ApplicationInput;
  /** Original values exactly as they appear in the dataset. */
  source: { monthlyIncomeUsd: number; debtToIncomeRatio: number; creditScore: number };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function convertRecord(raw: {
  monthlyIncomeUsd: number;
  debtToIncomeRatio: number;
  creditScore: number;
}): ApplicationInput {
  return {
    monthlyIncome: round2(raw.monthlyIncomeUsd * USD_TO_AED),
    dtiRatio: round2(raw.debtToIncomeRatio * 100),
    creditScore: raw.creditScore,
  };
}

function toNumber(text: string, column: string, line: number): number {
  const n = Number(text);
  if (text.trim() === "" || !Number.isFinite(n)) {
    throw new Error(`Dataset line ${line}: "${column}" is not a number ("${text}")`);
  }
  return n;
}

/**
 * Parses the dataset CSV (plain comma-separated, no quoted fields).
 * Throws with a line number on any malformed row rather than skipping it.
 */
export function parseDatasetCsv(text: string): DatasetApplicant[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("Dataset is empty");

  const header = lines[0].split(",").map((h) => h.trim());
  const index = Object.fromEntries(header.map((h, i) => [h, i]));
  const missing = REQUIRED_COLUMNS.filter((c) => !(c in index));
  if (missing.length > 0) throw new Error(`Dataset is missing column(s): ${missing.join(", ")}`);

  const seen = new Set<string>();
  return lines.slice(1).map((line, i) => {
    const lineNo = i + 2;
    const cells = line.split(",");
    if (cells.length !== header.length) {
      throw new Error(`Dataset line ${lineNo}: expected ${header.length} columns, found ${cells.length}`);
    }
    const get = (c: (typeof REQUIRED_COLUMNS)[number]) => cells[index[c]].trim();

    const userId = get("user_id");
    if (!userId) throw new Error(`Dataset line ${lineNo}: empty user_id`);
    if (seen.has(userId)) throw new Error(`Dataset line ${lineNo}: duplicate user_id ${userId}`);
    seen.add(userId);

    const source = {
      monthlyIncomeUsd: toNumber(get("monthly_income_usd"), "monthly_income_usd", lineNo),
      debtToIncomeRatio: toNumber(get("debt_to_income_ratio"), "debt_to_income_ratio", lineNo),
      creditScore: toNumber(get("credit_score"), "credit_score", lineNo),
    };
    const hasLoan = get("has_loan");
    if (hasLoan !== "Yes" && hasLoan !== "No") {
      throw new Error(`Dataset line ${lineNo}: has_loan must be Yes or No ("${hasLoan}")`);
    }
    return { userId, hasLoan: hasLoan === "Yes", input: convertRecord(source), source };
  });
}
