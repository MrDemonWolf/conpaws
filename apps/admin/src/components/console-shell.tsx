"use client";

import { CompassPaw } from "@conpaws/ui/components/compass-paw";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminSession } from "../lib/auth";
import { Icon } from "./icons";

const links = [
  { href: "/", label: "Overview", icon: "grid" as const },
  { href: "/conventions", label: "Conventions", icon: "calendar" as const },
  { href: "/team", label: "Team", icon: "users" as const },
  { href: "/activity", label: "Activity", icon: "activity" as const },
] as const;

function isCurrent(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ href, label, icon }: (typeof links)[number]) {
  const pathname = usePathname();
  const active = isCurrent(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none transition md:flex-row md:justify-center md:gap-2 md:px-3 md:text-xs lg:text-sm ${active ? "bg-sky-50 text-[#091533] ring-1 ring-sky-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      <Icon name={icon} className="size-4 shrink-0 md:size-[17px]" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function ConsoleShell({
  session,
  children,
}: {
  session: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1360px] items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-10">
          <Link
            href="/"
            aria-label="ConPaws Admin workspace"
            className="flex shrink-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#091533] text-[#0faced]">
              <CompassPaw className="size-6" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-[#091533]">
              ConPaws
            </span>
            <span className="hidden border-l border-slate-200 pl-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:block">
              Admin
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
          >
            {links.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              role="img"
              aria-label={`Signed in as ${session.email}, ${session.role}`}
              title={session.email}
              className="grid size-8 place-items-center rounded-full bg-sky-100 font-display text-xs font-bold text-[#091533]"
            >
              {session.email.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block max-w-40 truncate text-xs font-semibold text-slate-800">
                {session.email}
              </span>
              <span className="mt-0.5 block text-[10px] capitalize text-slate-500">
                {session.role}
              </span>
            </span>
            <span className="hidden text-xs font-semibold capitalize text-slate-600 sm:block lg:hidden">
              {session.role}
            </span>
          </div>
        </div>
      </header>

      <main className="admin-main mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        {children}
        <footer className="mt-12 border-t border-slate-200 py-5 text-xs text-slate-500">
          ConPaws Admin <span className="mx-1.5">·</span> Published catalog
          revisions are stored here; attendee downloads are a separate release
          gate
        </footer>
      </main>

      <nav
        aria-label="Main navigation"
        className="admin-mobile-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-slate-200/80 bg-white/95 px-3 pt-2 shadow-[0_-8px_24px_rgba(9,21,51,0.08)] backdrop-blur md:hidden"
      >
        {links.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>
    </div>
  );
}
