"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { ApiClientError, newSubmissionKey, submitApplication } from "@/lib/api/client";
import type { DatasetApplicantResponse } from "@/lib/api/types";
import type { ApplicationInput } from "@/lib/engine/types";
import { formatAED, formatPercent } from "@/lib/format";
import { FACTOR_KEYS, type FactorKey } from "@/lib/engine/types";
import { REFERENCE_SCENARIOS, matchScenario, type ReferenceScenario } from "@/lib/scenarios";
import { validateFormValues, type FieldErrors, type FormValues } from "@/lib/validation/applicationInput";
import { INPUT_LIMITS } from "@/lib/validation/limits";
import { ArrowRightIcon, GaugeIcon, PercentIcon, WalletIcon } from "@/components/ui/Icons";
import { Alert, Button, Card, Spinner, cx } from "@/components/ui/primitives";
import { DatasetPicker } from "./DatasetPicker";
import { NumberField } from "./NumberField";

const EMPTY: FormValues = { monthlyIncome: "", dtiRatio: "", creditScore: "" };
const nf = new Intl.NumberFormat("en-US");

const toFormValues = (input: ApplicationInput): FormValues => ({
  monthlyIncome: String(input.monthlyIncome),
  dtiRatio: String(input.dtiRatio),
  creditScore: String(input.creditScore),
});

const sameInput = (a: ApplicationInput, b: ApplicationInput) =>
  a.monthlyIncome === b.monthlyIncome && a.dtiRatio === b.dtiRatio && a.creditScore === b.creditScore;

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function ApplicationForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FactorKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [datasetRecord, setDatasetRecord] = useState<DatasetApplicantResponse | null>(null);
  // One key per set of values: an identical retry is recognised by the server, an edit is a new application.
  const submissionKey = useRef<string>(newSubmissionKey());
  const inFlight = useRef(false);

  const parsed = useMemo(() => validateFormValues(values), [values]);
  const loadedScenario = parsed.ok ? matchScenario(parsed.value) : undefined;
  const datasetUnchanged = datasetRecord !== null && parsed.ok && sameInput(parsed.value, datasetRecord.input);

  function update(key: FactorKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    submissionKey.current = newSubmissionKey();
    setFormError(null);
    if (touched[key]) {
      const next = validateFormValues({ ...values, [key]: value });
      setErrors((e) => ({ ...e, [key]: next.ok ? undefined : next.fieldErrors[key] }));
    }
  }

  function blur(key: FactorKey) {
    if (values[key].trim() === "" && !touched[key]) return; // don't nag before the user has typed
    setTouched((t) => ({ ...t, [key]: true }));
    const result = validateFormValues(values);
    setErrors((e) => ({ ...e, [key]: result.ok ? undefined : result.fieldErrors[key] }));
  }

  function loadValues(input: ApplicationInput) {
    setValues(toFormValues(input));
    setErrors({});
    setTouched({});
    setFormError(null);
    submissionKey.current = newSubmissionKey();
  }

  function loadScenario(s: ReferenceScenario) {
    setDatasetRecord(null);
    loadValues(s.input);
  }

  function loadDatasetRecord(record: DatasetApplicantResponse) {
    setDatasetRecord(record);
    loadValues(record.input);
  }

  function statusLine(): string {
    if (loadedScenario) return `Scenario ${loadedScenario.id} loaded — ${loadedScenario.purpose}.`;
    if (datasetRecord && datasetUnchanged) {
      const { source, input, userId } = datasetRecord;
      return `Dataset record ${userId} loaded — income USD ${usd.format(source.monthlyIncomeUsd)} → ${formatAED(
        input.monthlyIncome,
      )} · DTI ${source.debtToIncomeRatio} → ${formatPercent(input.dtiRatio)} · credit score ${input.creditScore}.`;
    }
    if (datasetRecord) return `Dataset record ${datasetRecord.userId} loaded, then edited.`;
    return "Or enter your own values below.";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return; // ignore double-clicks / repeated Enter presses

    const result = validateFormValues(values);
    setTouched({ monthlyIncome: true, dtiRatio: true, creditScore: true });
    if (!result.ok) {
      setErrors(result.fieldErrors);
      const first = FACTOR_KEYS.find((k) => result.fieldErrors[k]);
      if (first) document.getElementById(first)?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);
    inFlight.current = true;
    try {
      const record = await submitApplication(result.value, submissionKey.current);
      router.push(`/applications/${record.id}`);
      // Keep the button disabled while the results page loads.
    } catch (error) {
      inFlight.current = false;
      setSubmitting(false);
      if (error instanceof ApiClientError) {
        if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
        if (error.code === "IDEMPOTENCY_CONFLICT") submissionKey.current = newSubmissionKey();
        setFormError(error.message);
      } else {
        setFormError("Something unexpected went wrong. Please try again.");
      }
    }
  }

  const limit = INPUT_LIMITS;
  return (
    <Card className="overflow-hidden">
      <form onSubmit={handleSubmit} noValidate aria-describedby="form-intro">
        {/* Scenario presets */}
        <div className="border-b border-line bg-canvas/60 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-navy-900">Load a report scenario</p>
              <p className="text-xs text-muted">Fills the form with one of the five reference cases. You can still edit every value.</p>
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Reference scenarios">
              {REFERENCE_SCENARIOS.map((s) => {
                const active = loadedScenario?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => loadScenario(s)}
                    disabled={submitting}
                    aria-pressed={active}
                    title={`Scenario ${s.id}: ${s.purpose}`}
                    className={cx(
                      "grid size-10 place-items-center rounded-xl text-sm font-bold transition-colors",
                      active
                        ? "bg-navy-900 text-white shadow-sm"
                        : "bg-white text-navy-800 ring-1 ring-inset ring-line hover:ring-line-strong",
                    )}
                  >
                    {s.id}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <DatasetPicker onLoad={loadDatasetRecord} disabled={submitting} />
          </div>
          <p className="mt-3 min-h-5 text-xs font-medium text-navy-700" aria-live="polite">
            {statusLine()}
          </p>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          <p id="form-intro" className="sr-only">
            Enter three financial values. Verity calculates a demonstration decision on the server.
          </p>
          <NumberField
            id="monthlyIncome"
            label="Monthly income"
            icon={<WalletIcon size={17} />}
            prefix="AED"
            value={values.monthlyIncome}
            onChange={(v) => update("monthlyIncome", v)}
            onBlur={() => blur("monthlyIncome")}
            error={errors.monthlyIncome}
            disabled={submitting}
            range={`${nf.format(limit.monthlyIncome.min)} – ${nf.format(limit.monthlyIncome.max)}`}
            help={<>Your total income each month before debt repayments. For example, <strong>12,000</strong>.</>}
          />
          <NumberField
            id="dtiRatio"
            label="Debt-to-income ratio"
            icon={<PercentIcon size={17} />}
            suffix="%"
            value={values.dtiRatio}
            onChange={(v) => update("dtiRatio", v)}
            onBlur={() => blur("dtiRatio")}
            error={errors.dtiRatio}
            disabled={submitting}
            range={`${limit.dtiRatio.min} – ${nf.format(limit.dtiRatio.max)}%`}
            help={
              <>
                Monthly debt repayments ÷ monthly income × 100. Paying AED 3,000 a month on an AED 10,000 income is{" "}
                <strong>30</strong>%. It can be above 100% if repayments are larger than income.
              </>
            }
          />
          <NumberField
            id="creditScore"
            label="Credit score"
            icon={<GaugeIcon size={17} />}
            inputMode="numeric"
            value={values.creditScore}
            onChange={(v) => update("creditScore", v)}
            onBlur={() => blur("creditScore")}
            error={errors.creditScore}
            disabled={submitting}
            range={`${limit.creditScore.min} – ${limit.creditScore.max}`}
            help={<>A whole number summarising your repayment history. For example, <strong>700</strong>.</>}
          />

          {formError && <Alert tone="error" title="We couldn't calculate this application">{formError}</Alert>}

          <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting}>
            {submitting ? (
              <>
                <Spinner /> Calculating decision…
              </>
            ) : (
              <>
                Calculate decision <ArrowRightIcon size={18} />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-faint">
            Values are sent to Verity&apos;s server, scored by the demonstration policy and saved to the history. No
            personal details are collected.
          </p>
        </div>
      </form>
    </Card>
  );
}
