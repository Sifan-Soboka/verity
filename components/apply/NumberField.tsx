import type { ReactNode } from "react";

import { cx } from "@/components/ui/primitives";

/**
 * Text input tuned for numbers: numeric keyboard on mobile, unit adornments,
 * help text and an accessible error message. Values are kept as typed text and
 * validated explicitly, so invalid input is reported rather than silently coerced.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  prefix,
  suffix,
  help,
  range,
  icon,
  inputMode = "decimal",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  help: ReactNode;
  range: string;
  icon?: ReactNode;
  inputMode?: "decimal" | "numeric";
  disabled?: boolean;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-bold text-navy-900">
          {icon && <span className="text-navy-700">{icon}</span>}
          {label}
        </label>
        <span className="text-xs font-medium tabular-nums text-faint">{range}</span>
      </div>
      <div
        className={cx(
          "mt-2 flex h-12 items-center rounded-xl border bg-white transition-colors",
          "focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-100",
          error ? "border-risk-500 ring-4 ring-risk-50" : "border-line-strong",
          disabled && "opacity-60",
        )}
      >
        {prefix && <span className="pl-4 pr-1 text-sm font-semibold text-muted">{prefix}</span>}
        <input
          id={id}
          name={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          className={cx(
            "h-full w-full min-w-0 rounded-xl bg-transparent text-[17px] font-semibold tabular-nums text-navy-900 outline-none placeholder:font-medium placeholder:text-faint/70",
            prefix ? "pl-1" : "pl-4",
            suffix ? "pr-1" : "pr-4",
          )}
        />
        {suffix && <span className="pl-1 pr-4 text-sm font-semibold text-muted">{suffix}</span>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-risk-600">
          {error}
        </p>
      )}
      <p id={helpId} className="mt-1.5 text-[13px] leading-relaxed text-muted">
        {help}
      </p>
    </div>
  );
}
