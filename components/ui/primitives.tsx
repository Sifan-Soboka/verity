/**
 * Small, reusable UI building blocks used across every page so spacing,
 * colour and typography stay consistent.
 */
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";

import type { Decision, FactorStatus } from "@/lib/engine/types";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon, MinusIcon } from "./Icons";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-800 shadow-sm disabled:bg-navy-700/60",
  accent: "bg-teal-400 text-navy-950 hover:bg-teal-500 shadow-sm disabled:bg-teal-200",
  secondary: "bg-white text-navy-900 ring-1 ring-inset ring-line hover:bg-navy-50 hover:ring-line-strong",
  ghost: "text-navy-800 hover:bg-navy-50",
  danger: "bg-risk-600 text-white hover:bg-risk-700 shadow-sm disabled:bg-risk-500/60",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

function buttonClasses(variant: Variant, size: Size, extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-xl font-semibold whitespace-nowrap",
    "transition-colors duration-150 disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: Variant; size?: Size }) {
  // React 19: `ref` arrives as a normal prop and is forwarded via ...props.
  return <button type="button" className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({ className, children, as: Tag = "section" }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("rounded-2xl border border-line bg-white shadow-card", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-800">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-navy-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

export function DecisionBadge({ decision, size = "md" }: { decision: Decision; size?: "sm" | "md" | "lg" }) {
  const approved = decision === "APPROVED";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset",
        approved ? "bg-teal-50 text-teal-800 ring-teal-200" : "bg-risk-50 text-risk-700 ring-risk-200",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        size === "lg" && "px-3.5 py-1.5 text-base",
      )}
    >
      {approved ? <CheckIcon size={size === "lg" ? 18 : 14} strokeWidth={2.25} /> : <CloseIcon size={size === "lg" ? 18 : 14} strokeWidth={2.25} />}
      {approved ? "Approved" : "Rejected"}
    </span>
  );
}

const STATUS_STYLE: Record<FactorStatus, string> = {
  supports: "bg-teal-50 text-teal-800 ring-teal-200",
  concern: "bg-risk-50 text-risk-700 ring-risk-200",
  neutral: "bg-navy-50 text-navy-700 ring-line",
};

export function StatusBadge({ status, label }: { status: FactorStatus; label: string }) {
  const Icon = status === "supports" ? CheckIcon : status === "concern" ? AlertIcon : MinusIcon;
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", STATUS_STYLE[status])}>
      <Icon size={13} strokeWidth={2.25} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "error" | "success";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = {
    info: "border-navy-100 bg-navy-50 text-navy-800",
    error: "border-risk-200 bg-risk-50 text-risk-700",
    success: "border-teal-200 bg-teal-50 text-teal-800",
  }[tone];
  const Icon = tone === "error" ? AlertIcon : tone === "success" ? CheckIcon : InfoIcon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", style)}>
      <Icon size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-navy-100/70", className)} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}
