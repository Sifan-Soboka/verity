import type { Decision } from "@/lib/engine/types";
import { formatScore } from "@/lib/format";
import { cx } from "@/components/ui/primitives";

/**
 * Overall demonstration score on a 0–100 track with the approval threshold
 * marked. Every position comes from the stored calculation.
 */
export function ScoreTrack({
  score,
  threshold,
  decision,
}: {
  score: number;
  threshold: number;
  decision: Decision;
}) {
  const approved = decision === "APPROVED";
  const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`;
  return (
    <figure
      role="img"
      aria-label={`Demonstration score ${formatScore(score)} out of 100. Approval threshold ${formatScore(threshold)}.`}
      className="w-full"
    >
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Demonstration score</figcaption>
        <p className="tabular-nums">
          <span className={cx("text-4xl font-extrabold tracking-tight", approved ? "text-navy-900" : "text-risk-700")}>
            {formatScore(score)}
          </span>
          <span className="ml-1 text-sm font-semibold text-faint">/ 100</span>
        </p>
      </div>

      <div className="relative mt-7">
        {/* threshold label */}
        <div className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-navy-700" style={{ left: pct(threshold) }}>
          Threshold {formatScore(threshold)}
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-navy-100">
          <div
            className={cx("h-full rounded-full transition-[width] duration-500", approved ? "bg-teal-400" : "bg-risk-500")}
            style={{ width: pct(score) }}
          />
        </div>
        <div className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded bg-navy-900" style={{ left: pct(threshold) }} />
        <div
          className={cx(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow",
            approved ? "bg-teal-600" : "bg-risk-600",
          )}
          style={{ left: pct(score) }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-faint tabular-nums">
        <span>0</span>
        <span>100</span>
      </div>
    </figure>
  );
}
