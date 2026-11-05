/**
 * Accepted input ranges. Shared by the form (client-side hints and checks),
 * the API (authoritative server-side validation) and the engine.
 *
 * These ranges describe what the simulation supports; they are not lending rules.
 */
import type { FactorKey } from "../engine/types";

export interface FieldLimit {
  label: string;
  min: number;
  max: number;
  /** Maximum number of decimal places accepted (0 = whole numbers only). */
  maxDecimals: number;
  unit: "AED" | "%" | "";
  example: string;
}

export const INPUT_LIMITS: Record<FactorKey, FieldLimit> = {
  monthlyIncome: {
    label: "Monthly income",
    min: 1_000,
    max: 1_000_000,
    maxDecimals: 2,
    unit: "AED",
    example: "12000",
  },
  dtiRatio: {
    label: "Debt-to-income ratio",
    min: 0,
    max: 100,
    maxDecimals: 2,
    unit: "%",
    example: "30",
  },
  creditScore: {
    label: "Credit score",
    min: 300,
    max: 900,
    maxDecimals: 0,
    unit: "",
    example: "700",
  },
};
