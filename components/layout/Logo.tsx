import { cx } from "@/components/ui/primitives";

/** Verity mark: a navy tile with a teal "V" that doubles as a tick. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#102A43" />
      <path d="M9 10.5l7 12 7-12" fill="none" stroke="#2DD4BF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="9" r="1.9" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className={cx("text-[19px] font-extrabold tracking-tight", inverted ? "text-white" : "text-navy-900")}>
        Verity
      </span>
    </span>
  );
}
