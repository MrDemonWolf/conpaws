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
      className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[10px] font-semibold leading-none transition md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm ${active ? "bg-sky-50 text-[#091533] md:border-l-2 md:border-l-[#0faced] md:bg-white/10 md:text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:text-slate-300 md:hover:bg-white/10 md:hover:text-white"}`}
    >
      <Icon name={icon} className="size-4 shrink-0 md:size-[18px]" />
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
    <div className="min-h-screen bg-[#f5f7fb] md:flex">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[252px] flex-col border-r border-white/5 bg-[#091533] px-4 py-5 text-white md:flex">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0faced] text-[#091533]">
            <CompassPaw className="size-7" />
          </span>
          <span>
            <span className="block font-display text-[17px] font-bold tracking-tight">
              ConPaws
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Admin workspace
            </span>
          </span>
        </Link>

        <p className="mb-2 mt-10 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </p>
        <nav aria-label="Main navigation" className="grid gap-1">
          {links.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-sky-200 font-display text-sm font-bold text-[#091533]">
              {session.email.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">
                {session.email}
              </span>
              <span className="mt-1 block text-[11px] capitalize text-slate-400">
                {session.role}
              </span>
            </span>
          </div>
          <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-slate-400">
            Private catalog. Access is verified on every request.
          </p>
        </div>
      </aside>

      <div className="min-h-screen min-w-0 flex-1 md:pl-[252px]">
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 backdrop-blur md:hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#091533] text-[#0faced]">
              <CompassPaw className="size-6" />
            </span>
            <span className="font-display text-base font-bold text-[#091533]">
              ConPaws Admin
            </span>
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
    </div>
  );
}
