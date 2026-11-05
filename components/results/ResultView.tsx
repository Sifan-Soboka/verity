"use client";

import { useEffect, useState } from "react";

import { ApiClientError, getApplication } from "@/lib/api/client";
import type { ApplicationRecord } from "@/lib/api/types";
import { formatDateTime, formatFactorValue, formatPercent } from "@/lib/format";
import { matchScenario } from "@/lib/scenarios";
import {
  AlertIcon,
  ArrowLeftIcon,
  ChartBarsIcon,
  PlusIcon,
  RefreshIcon,
  RouteIcon,
  TextIcon,
} from "@/components/ui/Icons";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  DecisionBadge,
  Skeleton,
  cx,
} from "@/components/ui/primitives";
import { ContributionChart } from "./ContributionChart";
import { FactorCard } from "./FactorCard";
import { ScoreTrack } from "./ScoreTrack";

type State =
  | { status: "loading" }
  | { status: "error"; error: ApiClientError }
  | { status: "ready"; record: ApplicationRecord };

/** Loads one stored application from the API and shows its calculated result. */
export function ResultView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" }); // never show a previous application's result
    getApplication(id, controller.signal)
      .then((record) => {
        if (!controller.signal.aborted) setState({ status: "ready", record });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error:
            error instanceof ApiClientError
              ? error
              : new ApiClientError(0, "NETWORK_ERROR", "Couldn't load this application. Please try again."),
        });
      });
    return () => controller.abort();
  }, [id, attempt]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/dashboard" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeftIcon size={16} /> Dashboard
        </ButtonLink>
        <ButtonLink href="/apply" variant="primary" size="sm">
          <PlusIcon size={16} /> Submit another application
        </ButtonLink>
      </div>

      {state.status === "loading" && <ResultSkeleton />}

      {state.status === "error" && (
        <Card className="mx-auto max-w-xl p-6">
          <Alert
            tone="error"
            title={state.error.status === 404 || state.error.code === "INVALID_ID" ? "Application not found" : "Couldn't load this result"}
            action={
              state.error.status !== 404 && state.error.code !== "INVALID_ID" ? (
                <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  <RefreshIcon size={15} /> Try again
                </Button>
              ) : (
                <ButtonLink href="/dashboard" size="sm" variant="secondary">
                  Go to dashboard
                </ButtonLink>
              )
            }
          >
            {state.error.message}
          </Alert>
        </Card>
      )}

      {state.status === "ready" && state.record.id === id && <ResultContent record={state.record} />}
    </div>
  );
}

function ResultContent({ record }: { record: ApplicationRecord }) {
  const { explanation, details } = record;
  const approved = record.decision === "APPROVED";
  const scenario = matchScenario(record.input);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Decision hero */}
      <Card className="overflow-hidden">
        <div className={cx("h-1.5", approved ? "bg-teal-400" : "bg-risk-500")} />
        <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.25fr_1fr] lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <DecisionBadge decision={record.decision} size="lg" />
              <span className="text-xs font-medium text-faint">Simulated outcome</span>
            </div>
            <h1 className="mt-4 text-xl font-bold leading-snug tracking-tight text-navy-900 sm:text-2xl">
              {explanation.headline}
            </h1>
            <dl className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-line bg-canvas p-3.5 text-sm">
              {details.factors.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                    {{ monthlyIncome: "Income", dtiRatio: "DTI", creditScore: "Credit" }[f.key]}
                  </dt>
                  <dd className="mt-0.5 truncate font-bold tabular-nums text-navy-900">{formatFactorValue(f.key, f.value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>
                Application <span className="font-mono font-medium text-navy-800">{record.id}</span>
              </span>
              <span>{formatDateTime(record.createdAt)}</span>
              <span>Policy {record.policyVersion}</span>
            </p>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <ScoreTrack score={record.score} threshold={record.threshold} decision={record.decision} />
            <p className="text-xs leading-relaxed text-muted">
              Approved when the score is at least {record.threshold} and the debt-to-income ratio is no more than{" "}
              {formatPercent(details.maximumDti)}.
            </p>
          </div>
        </div>
      </Card>

      {details.dtiLimitExceeded && (
        <Alert tone="error" title={`Debt-to-income ratio above the ${formatPercent(details.maximumDti)} limit`}>
          This demonstration policy does not approve applications whose DTI is above {formatPercent(details.maximumDti)},
          whatever the overall score.
        </Alert>
      )}

      {scenario && (
        <Alert
          tone={scenario.reportOutcome === record.decision ? "success" : "error"}
          title={`These values match report Scenario ${scenario.id}`}
        >
          The research report&apos;s intended outcome was{" "}
          <strong>{scenario.reportOutcome === "APPROVED" ? "Approved" : "Rejected"}</strong>; Verity calculated{" "}
          <strong>{approved ? "Approved" : "Rejected"}</strong>
          {scenario.reportOutcome === record.decision ? " — they agree." : " — they differ (see docs/DECISION_POLICY.md)."}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader title="Why this result" icon={<TextIcon size={17} />} description="Plain-language explanation of your calculation" />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[15px] leading-7 text-navy-800">{explanation.summary}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {explanation.supporting.length > 0 && (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
                  Supported approval: {explanation.supporting.length}
                </span>
              )}
              {explanation.concerns.length > 0 && (
                <span className="rounded-full bg-risk-50 px-2.5 py-1 font-semibold text-risk-700">
                  Increased risk: {explanation.concerns.length}
                </span>
              )}
              {explanation.borderline && (
                <span className="rounded-full bg-navy-50 px-2.5 py-1 font-semibold text-navy-700">Close to threshold</span>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Factor contributions"
            icon={<ChartBarsIcon size={17} />}
            description="Points each factor added to or removed from the starting score"
          />
          <div className="px-5 py-5 sm:px-6">
            <ContributionChart
              factors={details.factors}
              baseScore={details.baseScore}
              score={record.score}
              threshold={record.threshold}
            />
          </div>
        </Card>
      </div>

      <section aria-labelledby="factor-cards-heading">
        <h2 id="factor-cards-heading" className="sr-only">
          Factor details
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {details.factors.map((f) => (
            <FactorCard key={f.key} factor={f} explanation={explanation.factors.find((e) => e.key === f.key)!} />
          ))}
        </div>
      </section>

      {record.decision === "REJECTED" && (
        <Card>
          <CardHeader
            title="What would change the outcome"
            icon={<RouteIcon size={17} />}
            description="Calculated by re-running the policy with one factor changed and the other two held the same"
          />
          <div className="px-5 py-5 sm:px-6">
            {explanation.pathsToApproval.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {explanation.pathsToApproval.map((p) => (
                  <li key={p.key} className="flex items-start gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-navy-800">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-800">
                      →
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-navy-800">{explanation.pathsNote}</p>
            )}
            <p className="mt-3 text-xs text-faint">
              Any one change on its own would reach approval in this simulation. This is not financial advice.
            </p>
          </div>
        </Card>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-line bg-white px-4 py-3 text-xs leading-relaxed text-muted">
        <AlertIcon size={15} className="mt-px shrink-0 text-faint" />
        {explanation.disclaimer} Verity is an educational simulation and does not make real lending decisions.
      </p>

      <div className="flex justify-center pt-2">
        <ButtonLink href="/apply" size="lg">
          <PlusIcon size={18} /> Submit another application
        </ButtonLink>
      </div>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading result">
      <Card className="p-7">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}
