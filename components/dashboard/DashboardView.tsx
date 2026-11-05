"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, clearApplications, listApplications } from "@/lib/api/client";
import type { ApplicationListResponse } from "@/lib/api/types";
import { formatAED, formatDateTime, formatPercent, formatScore } from "@/lib/format";
import {
  ChartBarsIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  GridIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  DecisionBadge,
  PageHeader,
  Skeleton,
  Spinner,
  cx,
} from "@/components/ui/primitives";

const LIMIT = 20;

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ApplicationListResponse };

export function DashboardView() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => {
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    listApplications(LIMIT, signal)
      .then((data) => {
        if (!signal?.aborted) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setState({
          status: "error",
          message: error instanceof ApiClientError ? error.message : "Couldn't load the dashboard.",
        });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const data = state.status === "ready" ? state.data : null;
  const empty = data !== null && data.summary.total === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PageHeader
        eyebrow="Dashboard"
        title="Application history"
        description="Every figure below is calculated from the applications stored in Verity's database."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(true)}
              disabled={!data || empty}
            >
              <TrashIcon size={17} /> Clear history
            </Button>
            <ButtonLink href="/apply">
              <PlusIcon size={17} /> New assessment
            </ButtonLink>
          </>
        }
      />

      <div className="mt-8 space-y-6">
        {notice && (
          <Alert tone="success" title={notice}>
            You can start a fresh set of demonstration applications at any time.
          </Alert>
        )}

        {state.status === "loading" && <DashboardSkeleton />}

        {state.status === "error" && (
          <Alert
            tone="error"
            title="Couldn't load application history"
            action={
              <Button size="sm" variant="secondary" onClick={() => load()}>
                <RefreshIcon size={15} /> Try again
              </Button>
            }
          >
            {state.message}
          </Alert>
        )}

        {empty && <EmptyState />}

        {data && !empty && (
          <div className="animate-fade-in space-y-6">
            <StatGrid data={data} />
            <OutcomeDistribution approved={data.summary.approved} rejected={data.summary.rejected} />
            <RecentApplications data={data} />
          </div>
        )}
      </div>

      {confirmOpen && data && (
        <ClearHistoryDialog
          total={data.summary.total}
          onCancel={() => setConfirmOpen(false)}
          onCleared={(deleted) => {
            setConfirmOpen(false);
            setNotice(`Cleared ${deleted} application${deleted === 1 ? "" : "s"} from the history.`);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatGrid({ data }: { data: ApplicationListResponse }) {
  const { total, approved, rejected, averageScore } = data.summary;
  const stats = [
    { label: "Applications submitted", value: String(total), icon: GridIcon, tone: "navy" },
    { label: "Simulated approvals", value: String(approved), icon: CheckIcon, tone: "teal" },
    { label: "Simulated rejections", value: String(rejected), icon: CloseIcon, tone: "risk" },
    {
      label: "Average score",
      value: averageScore === null ? "—" : formatScore(averageScore),
      icon: ChartBarsIcon,
      tone: "navy",
    },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} as="div" className="p-5">
          <span
            className={cx(
              "grid size-9 place-items-center rounded-xl",
              tone === "teal" && "bg-teal-50 text-teal-700",
              tone === "risk" && "bg-risk-50 text-risk-600",
              tone === "navy" && "bg-navy-50 text-navy-800",
            )}
          >
            <Icon size={18} strokeWidth={2} />
          </span>
          <p className="mt-4 text-3xl font-extrabold tracking-tight tabular-nums text-navy-900">{value}</p>
          <p className="mt-0.5 text-sm font-medium text-muted">{label}</p>
        </Card>
      ))}
    </div>
  );
}

function OutcomeDistribution({ approved, rejected }: { approved: number; rejected: number }) {
  const total = approved + rejected;
  const approvedPct = total === 0 ? 0 : (approved / total) * 100;
  const rejectedPct = 100 - approvedPct;
  const fmt = (n: number) => `${Math.round(n)}%`;
  return (
    <Card>
      <CardHeader
        title="Outcome distribution"
        icon={<ChartBarsIcon size={17} />}
        description={`Across all ${total} stored application${total === 1 ? "" : "s"}`}
      />
      <div className="px-5 py-5 sm:px-6">
        <div
          className="flex h-4 overflow-hidden rounded-full bg-navy-100"
          role="img"
          aria-label={`${approved} approved (${fmt(approvedPct)}), ${rejected} rejected (${fmt(rejectedPct)})`}
        >
          {approved > 0 && <div className="h-full bg-teal-400 transition-all duration-500" style={{ width: `${approvedPct}%` }} />}
          {rejected > 0 && (
            <div
              className={cx("h-full bg-risk-500 transition-all duration-500", approved > 0 && "border-l-2 border-white")}
              style={{ width: `${rejectedPct}%` }}
            />
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-teal-400" />
            <span className="font-semibold text-navy-900">Approved</span>
            <span className="tabular-nums text-muted">
              {approved} · {fmt(approvedPct)}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-risk-500" />
            <span className="font-semibold text-navy-900">Rejected</span>
            <span className="tabular-nums text-muted">
              {rejected} · {fmt(rejectedPct)}
            </span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function RecentApplications({ data }: { data: ApplicationListResponse }) {
  const { items, summary } = data;
  return (
    <Card>
      <CardHeader
        title="Recent applications"
        icon={<ClockIcon size={17} />}
        description={
          summary.total > items.length
            ? `Showing the ${items.length} most recent of ${summary.total}`
            : "Newest first — open any application to see its full result"
        }
      />

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
              <th className="px-6 py-3 font-semibold">Application</th>
              <th className="px-3 py-3 text-right font-semibold">Income</th>
              <th className="px-3 py-3 text-right font-semibold">DTI</th>
              <th className="px-3 py-3 text-right font-semibold">Credit</th>
              <th className="px-3 py-3 text-right font-semibold">Score</th>
              <th className="px-3 py-3 font-semibold">Outcome</th>
              <th className="px-6 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((a) => (
              <tr key={a.id} className="group transition-colors hover:bg-canvas/70">
                <td className="px-6 py-3.5">
                  <Link href={`/applications/${a.id}`} className="font-mono text-[13px] font-medium text-navy-900 hover:underline">
                    {a.id}
                  </Link>
                  <p className="text-xs text-faint">{formatDateTime(a.createdAt)}</p>
                </td>
                <td className="px-3 py-3.5 text-right tabular-nums">{formatAED(a.input.monthlyIncome)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{formatPercent(a.input.dtiRatio)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{a.input.creditScore}</td>
                <td className="px-3 py-3.5 text-right font-bold tabular-nums">{formatScore(a.score)}</td>
                <td className="px-3 py-3.5">
                  <DecisionBadge decision={a.decision} size="sm" />
                </td>
                <td className="px-6 py-3.5 text-right">
                  <Link
                    href={`/applications/${a.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800"
                    aria-label={`View result for ${a.id}`}
                  >
                    View <ChevronRightIcon size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <ul className="divide-y divide-line md:hidden">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/applications/${a.id}`} className="flex items-center gap-3 px-5 py-4 active:bg-canvas">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[13px] font-medium text-navy-900">{a.id}</span>
                  <DecisionBadge decision={a.decision} size="sm" />
                </div>
                <p className="mt-1 text-[13px] tabular-nums text-muted">
                  {formatAED(a.input.monthlyIncome)} · {formatPercent(a.input.dtiRatio)} · {a.input.creditScore} ·{" "}
                  <span className="font-semibold text-navy-900">Score {formatScore(a.score)}</span>
                </p>
                <p className="mt-0.5 text-xs text-faint">{formatDateTime(a.createdAt)}</p>
              </div>
              <ChevronRightIcon size={16} className="shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-navy-50 text-navy-700">
        <ChartBarsIcon size={26} />
      </span>
      <h2 className="mt-5 text-lg font-bold text-navy-900">No applications yet</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        Submit an assessment — with your own values or one of the five report scenarios — and its result will appear
        here.
      </p>
      <div className="mt-6 flex justify-center">
        <ButtonLink href="/apply">
          <PlusIcon size={17} /> Start an assessment
        </ButtonLink>
      </div>
    </Card>
  );
}

function ClearHistoryDialog({
  total,
  onCancel,
  onCleared,
}: {
  total: number;
  onCancel: () => void;
  onCleared: (deleted: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const { deleted } = await clearApplications();
      onCleared(deleted);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiClientError ? e.message : "Couldn't clear the history. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]" onClick={() => !busy && onCancel()} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-title"
        aria-describedby="clear-desc"
        className="animate-fade-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-raised"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-risk-50 text-risk-600">
          <TrashIcon size={21} />
        </span>
        <h2 id="clear-title" className="mt-4 text-lg font-bold text-navy-900">
          Clear demonstration history?
        </h2>
        <p id="clear-desc" className="mt-1.5 text-sm leading-relaxed text-muted">
          This permanently deletes all {total} stored application{total === 1 ? "" : "s"} and their results. This
          can&apos;t be undone.
        </p>
        {error && (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Spinner /> Clearing…
              </>
            ) : (
              <>Clear {total} application{total === 1 ? "" : "s"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
