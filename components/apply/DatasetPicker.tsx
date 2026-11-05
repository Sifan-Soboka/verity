"use client";

import { useRef, useState } from "react";

import { ApiClientError, fetchDatasetApplicant } from "@/lib/api/client";
import type { DatasetApplicantResponse } from "@/lib/api/types";
import { RefreshIcon } from "@/components/ui/Icons";
import { Button, Spinner, cx } from "@/components/ui/primitives";

/**
 * Loads one applicant from the project dataset (by user ID or at random) via
 * GET /api/dataset and hands the converted values to the form.
 */
export function DatasetPicker({
  onLoad,
  disabled,
}: {
  onLoad: (record: DatasetApplicantResponse) => void;
  disabled?: boolean;
}) {
  const [userId, setUserId] = useState("");
  const [withLoan, setWithLoan] = useState(true);
  const [busy, setBusy] = useState<"id" | "random" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function load(kind: "id" | "random") {
    if (kind === "id" && userId.trim() === "") {
      setError("Enter a dataset user ID, e.g. U00002.");
      return;
    }
    controller.current?.abort(); // only the latest request may fill the form
    const c = new AbortController();
    controller.current = c;
    setBusy(kind);
    setError(null);
    try {
      const record = await fetchDatasetApplicant(
        kind === "id" ? { userId } : { random: true, withLoan },
        c.signal,
      );
      if (c.signal.aborted) return;
      onLoad(record);
      if (kind === "random") setUserId(record.userId);
    } catch (e) {
      if (c.signal.aborted) return;
      setError(e instanceof ApiClientError ? e.message : "Couldn't load from the dataset.");
    } finally {
      if (!c.signal.aborted) setBusy(null);
    }
  }

  const off = disabled || busy !== null;
  return (
    <div>
      <p className="text-sm font-bold text-navy-900">Load from the project dataset</p>
      <p className="text-xs text-muted">
        Income is converted from USD to AED (× 3.6725) and the DTI fraction to a percentage.
      </p>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        {/* Not a <form>: this sits inside the application form, and forms can't be nested. */}
        <div className="flex flex-1 gap-2">
          <label htmlFor="datasetUserId" className="sr-only">
            Dataset user ID
          </label>
          <input
            id="datasetUserId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // don't submit the application form
                load("id");
              }
            }}
            placeholder="User ID, e.g. U00002"
            autoComplete="off"
            spellCheck={false}
            disabled={off}
            className={cx(
              "h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 font-mono text-sm text-navy-900 outline-none",
              "placeholder:font-sans placeholder:text-faint focus:border-teal-500 focus:ring-4 focus:ring-teal-100",
              error ? "border-risk-500" : "border-line-strong",
            )}
          />
          <Button variant="secondary" size="sm" className="h-10" onClick={() => load("id")} disabled={off}>
            {busy === "id" ? <Spinner /> : null} Load
          </Button>
        </div>
        <Button variant="secondary" size="sm" className="h-10" onClick={() => load("random")} disabled={off}>
          {busy === "random" ? <Spinner /> : <RefreshIcon size={15} />} Random applicant
        </Button>
      </div>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={withLoan}
          onChange={(e) => setWithLoan(e.target.checked)}
          disabled={off}
          className="size-3.5 accent-navy-900"
        />
        Random picks only applicants with a loan (60% of records have none, so DTI would be 0%)
      </label>
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-risk-600">
          {error}
        </p>
      )}
    </div>
  );
}
