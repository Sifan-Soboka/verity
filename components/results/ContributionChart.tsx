import type { FactorKey, FactorResult } from "@/lib/engine/types";
import { formatPoints, formatScore } from "@/lib/format";
import { cx } from "@/components/ui/primitives";

const SHORT_LABEL: Record<FactorKey, string> = {
  monthlyIncome: "income",
  dtiRatio: "DTI",
  creditScore: "credit score",
};

/**
 * Diverging bar chart of each factor's calculated contribution, on a shared
 * scale so the three factors can be compared. The faint band behind each bar
 * shows the most that factor could add or remove under the policy.
 */
export function ContributionChart({
  factors,
  baseScore,
  score,
  threshold,
}: {
  factors: FactorResult[];
  baseScore: number;
  score: number;
  threshold: number;
}) {
  const scale = Math.max(...factors.map((f) => f.maxPoints));
  const half = (points: number) => (Math.abs(points) / scale) * 50; // % of full width from centre

  return (
    <div>
      <ul className="space-y-4" aria-label="Factor contributions in points">
        {factors.map((f) => {
          const positive = f.contribution > 0;
          const width = half(f.contribution);
          return (
            <li key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[10.5rem_1fr_4.5rem]">
              <span className="text-sm font-semibold text-navy-900">{f.label}</span>
              <span
                className={cx(
                  "text-right text-sm font-bold tabular-nums sm:order-last",
                  f.status === "supports" && "text-teal-700",
                  f.status === "concern" && "text-risk-600",
                  f.status === "neutral" && "text-muted",
                )}
              >
                {formatPoints(f.contribution)}
              </span>
              <div className="relative col-span-2 h-7 sm:col-span-1" role="img" aria-label={`${f.label}: ${formatPoints(f.contribution)} points of a possible ±${f.maxPoints}`}>
                {/* possible range for this factor */}
                <div
                  className="absolute inset-y-1 rounded-md bg-navy-50 ring-1 ring-inset ring-line/70"
                  style={{ left: `${50 - half(f.maxPoints)}%`, right: `${50 - half(f.maxPoints)}%` }}
                />
                {/* the contribution */}
                {width > 0 && (
                  <div
                    className={cx(
                      "absolute inset-y-1 transition-all duration-500",
                      positive ? "rounded-r-md bg-teal-400" : "rounded-l-md bg-risk-500",
                    )}
                    style={positive ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                  />
                )}
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-navy-700" />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid grid-cols-[1fr] text-[11px] font-medium text-faint tabular-nums sm:grid-cols-[10.5rem_1fr_4.5rem] sm:gap-x-3">
        <span className="hidden sm:block" />
        <div>
          <div className="flex justify-between">
            <span>−{scale}</span>
            <span>0</span>
            <span>+{scale}</span>
          </div>
          <div className="mt-0.5 flex justify-between text-[10.5px]">
            <span>← reduces score</span>
            <span>adds to score →</span>
          </div>
        </div>
      </div>

      {/* The arithmetic, spelled out */}
      <div className="mt-5 rounded-xl bg-canvas px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">How the score adds up</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-navy-800">
          <span>
            Starting score <strong className="font-bold">{formatScore(baseScore)}</strong>
          </span>
          {factors.map((f) => (
            <span key={f.key} className="whitespace-nowrap">
              <span className="text-faint">{f.contribution < 0 ? "−" : "+"}</span>{" "}
              <span className="text-muted">{SHORT_LABEL[f.key]}</span>{" "}
              <strong className={cx("font-bold", f.contribution > 0 ? "text-teal-700" : f.contribution < 0 ? "text-risk-600" : "")}>
                {formatScore(Math.abs(f.contribution))}
              </strong>
            </span>
          ))}
          <span className="whitespace-nowrap">
            <span className="text-faint">=</span> <strong className="font-extrabold">{formatScore(score)}</strong>
            <span className="text-muted"> (threshold {formatScore(threshold)})</span>
          </span>
        </p>
      </div>
    </div>
  );
}
