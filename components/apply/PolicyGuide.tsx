import { DEMO_POLICY } from "@/lib/engine/policy";
import { FACTOR_KEYS } from "@/lib/engine/types";
import { formatFactorValue, formatPercent } from "@/lib/format";
import { REFERENCE_SCENARIOS } from "@/lib/scenarios";
import { FACTOR_ICON } from "@/components/results/FactorCard";
import { Card, CardHeader } from "@/components/ui/primitives";
import { InfoIcon } from "@/components/ui/Icons";

/**
 * Explains the demonstration policy next to the form. All numbers are read
 * from DEMO_POLICY, so this panel can never drift from the real engine.
 */
export function PolicyGuide() {
  const p = DEMO_POLICY;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="How Verity reads your values" icon={<InfoIcon size={17} />} />
        <div className="space-y-4 px-5 py-5 text-sm leading-relaxed text-navy-800 sm:px-6">
          <p>
            Every application starts at <strong>{p.baseScore}</strong> points. Each factor then adds points when it is
            better than its reference point, or removes points when it is worse.
          </p>
          <ul className="space-y-3">
            {FACTOR_KEYS.map((key) => {
              const f = p.factors[key];
              const Icon = FACTOR_ICON[key];
              return (
                <li key={key} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-800">
                    <Icon size={15} />
                  </span>
                  <div>
                    <p className="font-semibold text-navy-900">{f.label}</p>
                    <p className="text-[13px] text-muted">
                      Reference {formatFactorValue(key, f.reference)} · up to ±{f.maxPoints} points
                      {key === "dtiRatio" && " · lower is better"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="rounded-xl bg-canvas px-3.5 py-3 text-[13px]">
            Approved when the score is at least <strong>{p.approvalThreshold}</strong> and the debt-to-income ratio is no
            more than <strong>{formatPercent(p.maximumDti)}</strong>.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Reference scenarios" description="Fictional applicants from the research report" />
        <ul className="divide-y divide-line">
          {REFERENCE_SCENARIOS.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-navy-900 text-xs font-bold text-white">
                {s.id}
              </span>
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold tabular-nums text-navy-900">
                  {formatFactorValue("monthlyIncome", s.input.monthlyIncome)} · {formatPercent(s.input.dtiRatio)} ·{" "}
                  {s.input.creditScore}
                </p>
                <p className="text-muted">{s.purpose}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-faint">
        These reference points and weights are a demonstration policy chosen for this academic project. They are not
        any bank&apos;s lending criteria.
      </p>
    </div>
  );
}
