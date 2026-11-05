import { computeDecision } from "@/lib/engine/decision";
import { DEMO_POLICY } from "@/lib/engine/policy";
import type { FactorKey } from "@/lib/engine/types";
import { buildExplanation } from "@/lib/explain/explanation";
import { formatFactorValue, formatPercent } from "@/lib/format";
import { REFERENCE_SCENARIOS } from "@/lib/scenarios";
import { ContributionChart } from "@/components/results/ContributionChart";
import { FACTOR_ICON } from "@/components/results/FactorCard";
import { ScoreTrack } from "@/components/results/ScoreTrack";
import { ArrowRightIcon, GridIcon, ShieldIcon } from "@/components/ui/Icons";
import { ButtonLink, Card, DecisionBadge } from "@/components/ui/primitives";

const FACTOR_COPY: Record<FactorKey, { title: string; body: string }> = {
  monthlyIncome: {
    title: "Monthly income",
    body: "Your earning capacity. Higher income generally improves the affordability side of the assessment.",
  },
  dtiRatio: {
    title: "Debt-to-income ratio",
    body: "The share of income already committed to debt repayments. A higher DTI leaves less room for new repayments.",
  },
  creditScore: {
    title: "Credit score",
    body: "A summary of past borrowing and repayment behaviour. Higher scores point to a stronger repayment record.",
  },
};

export default function LandingPage() {
  // A real calculation by the same engine the API uses — not a mock-up.
  const example = REFERENCE_SCENARIOS.find((s) => s.id === "B")!;
  const result = computeDecision(example.input);
  const explanation = buildExplanation(result);
  const p = DEMO_POLICY;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
              <ShieldIcon size={14} /> Educational loan-decision simulation
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-navy-900 sm:text-5xl">
              Financial decisions,
              <br />
              <span className="text-teal-600">made clearer.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Verity shows how monthly income, debt-to-income ratio and credit score combine into a loan decision — and
              explains the result in plain language, factor by factor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/apply" size="lg">
                Start assessment <ArrowRightIcon size={18} />
              </ButtonLink>
              <ButtonLink href="/dashboard" size="lg" variant="secondary">
                <GridIcon size={18} /> View dashboard
              </ButtonLink>
            </div>
            <p className="mt-8 max-w-xl rounded-xl border border-line bg-canvas px-4 py-3 text-[13px] leading-relaxed text-muted">
              <strong className="text-navy-900">Academic demonstration.</strong> Verity was built for a CSIT305 research
              project on explaining AI-assisted loan decisions. It uses a transparent, documented scoring policy — not a
              trained model or a bank&apos;s criteria — and makes no real lending decisions.
            </p>
          </div>

          {/* Worked example, calculated live */}
          <Card className="p-5 shadow-raised sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Worked example</p>
                <p className="mt-0.5 text-sm font-bold text-navy-900">Report Scenario {example.id}</p>
              </div>
              <DecisionBadge decision={result.decision} />
            </div>
            <p className="mt-2 text-[13px] tabular-nums text-muted">
              {formatFactorValue("monthlyIncome", example.input.monthlyIncome)} income ·{" "}
              {formatPercent(example.input.dtiRatio)} DTI · credit score {example.input.creditScore}
            </p>
            <div className="mt-6">
              <ScoreTrack score={result.score} threshold={result.threshold} decision={result.decision} />
            </div>
            <div className="mt-6 border-t border-line pt-5">
              <ContributionChart
                factors={result.factors}
                baseScore={result.baseScore}
                score={result.score}
                threshold={result.threshold}
              />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-navy-800">{explanation.headline}</p>
            <p className="mt-2 text-[11px] text-faint">Calculated by Verity&apos;s demonstration policy ({result.policyVersion}).</p>
          </Card>
        </div>
      </section>

      {/* Factors */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">What Verity looks at</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Three factors, one clear picture</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Income alone doesn&apos;t tell the whole story. Verity reads the three together so you can see which ones
            helped and which ones held an application back.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(Object.keys(FACTOR_COPY) as FactorKey[]).map((key) => {
            const Icon = FACTOR_ICON[key];
            const f = p.factors[key];
            return (
              <Card key={key} as="article" className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-navy-900 text-teal-400">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 font-bold text-navy-900">{FACTOR_COPY[key].title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{FACTOR_COPY[key].body}</p>
                <p className="mt-4 border-t border-line pt-3 text-xs font-medium text-faint">
                  Reference point {formatFactorValue(key, f.reference)} · up to ±{f.maxPoints} points
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">How a decision is made</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Transparent by design</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Enter three values",
                body: "Type your own figures or load one of the five fictional scenarios from the research report.",
              },
              {
                title: "Each factor adds or removes points",
                body: `Starting from ${p.baseScore}, each factor moves the score up or down depending on how it compares with its reference point.`,
              },
              {
                title: "See the outcome — and why",
                body: `A score of ${p.approvalThreshold} or more (with DTI no higher than ${formatPercent(p.maximumDti)}) is approved. Every point is shown and explained.`,
              },
            ].map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border border-line p-6">
                <span className="text-sm font-extrabold tabular-nums text-teal-600">0{i + 1}</span>
                <h3 className="mt-2 font-bold text-navy-900">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-navy-900 px-6 py-10 sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">See how the factors work together</h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-navy-100">
              Try a borderline case like Scenario C, then change one value and watch the explanation change with it.
            </p>
          </div>
          <ButtonLink href="/apply" size="lg" variant="accent">
            Start assessment <ArrowRightIcon size={18} />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
