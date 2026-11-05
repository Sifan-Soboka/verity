/** Display formatting shared by the explanation engine and the UI. */
import type { FactorKey } from "./engine/types";

const aed = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const oneDp = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 15000 → "AED 15,000"; 12500.5 → "AED 12,500.5" */
export function formatAED(value: number): string {
  return `AED ${aed.format(value)}`;
}

/** 18 → "18%"; 35.25 → "35.25%" */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

/** Score-style number with exactly one decimal: 54 → "54.0" */
export function formatScore(value: number): string {
  return oneDp.format(value);
}

/** Signed points: 2.2 → "+2.2", -6.3 → "−6.3", 0 → "0.0" */
export function formatPoints(value: number): string {
  if (value > 0) return `+${oneDp.format(value)}`;
  if (value < 0) return `−${oneDp.format(Math.abs(value))}`;
  return oneDp.format(0);
}

/** Formats a factor value with its unit. */
export function formatFactorValue(key: FactorKey, value: number): string {
  switch (key) {
    case "monthlyIncome":
      return formatAED(value);
    case "dtiRatio":
      return formatPercent(value);
    case "creditScore":
      return String(value);
  }
}

/** "2026-11-05T10:20:00.000Z" → "5 Nov 2026, 14:20" (in the viewer's locale/time zone) */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** ["a"] → "a"; ["a","b"] → "a and b"; ["a","b","c"] → "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
