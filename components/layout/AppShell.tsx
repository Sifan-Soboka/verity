"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GridIcon, PlusIcon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/primitives";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: GridIcon },
  { href: "/apply", label: "New assessment", icon: PlusIcon },
];

function SiteHeader() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Verity home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/dashboard" && pathname.startsWith("/applications"));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors",
                  active ? "bg-navy-50 text-navy-900" : "text-muted hover:bg-navy-50 hover:text-navy-900",
                )}
              >
                <Icon size={17} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[13px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-navy-900">Verity</span> is an educational loan-decision simulation
          (CSIT305). It does not make real lending decisions.
        </p>
        <p className="text-faint">Results come from a documented demonstration policy, not a trained model.</p>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
