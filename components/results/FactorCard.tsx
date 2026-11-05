import type { FactorExplanation } from "@/lib/explain/explanation";
import type { FactorKey, FactorResult } from "@/lib/engine/types";
import { formatFactorValue, formatPoints } from "@/lib/format";
import { GaugeIcon, PercentIcon, WalletIcon } from "@/components/ui/Icons";
import { StatusBadge, cx } from "@/components/ui/primitives";

export const FACTOR_ICON: Record<FactorKey, typeof WalletIcon> = {
  monthlyIncome: WalletIcon,
  dtiRatio: PercentIcon,
  creditScore: GaugeIcon,
};

/** One of the three consistent factor cards (same size and layout for every application). */
export function FactorCard({ factor, explanation }: { factor: FactorResult; explanation: FactorExplanation }) {
  const Icon = FACTOR_ICON[factor.key];
  const markerLeft = 50 + factor.normalised * 50; // −1…+1 → 0…100%
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-800">
            <Icon size={19} />
          </span>
          <h3 className="text-sm font-bold leading-snug text-navy-900">{factor.label}</h3>
        </div>
        <StatusBadge status={factor.status} label={explanation.statusLabel} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Submitted</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight tabular-nums text-navy-900">
            {formatFactorValue(factor.key, factor.value)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Contribution</p>
          <p
            className={cx(
              "mt-0.5 text-lg font-bold tabular-nums",
              factor.status === "supports" && "text-teal-700",
              factor.status === "concern" && "text-risk-600",
              factor.status === "neutral" && "text-muted",
            )}
          >
            {formatPoints(factor.contribution)} <span className="text-xs font-semibold text-faint">pts</span>
          </p>
        </div>
      </div>

      {/* Where the value sits between full concern and full support */}
      <div className="mt-4" aria-hidden="true">
        <div className="relative h-1.5 rounded-full bg-gradient-to-r from-risk-200 via-navy-100 to-teal-200">
          <div className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-navy-700/50" />
          <div
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy-900 shadow"
            style={{ left: `${markerLeft}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] font-medium text-faint">
          <span>Concern</span>
          <span>Reference: {formatFactorValue(factor.key, factor.referenceValue)}</span>
          <span>Support</span>
        </div>
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-navy-800">{explanation.text}</p>
      <p className="mt-4 border-t border-line pt-3 text-xs text-faint">
        Can add or remove up to {factor.maxPoints} points
      </p>
    </article>
  );
}
