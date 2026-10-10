import { CompassPaw } from "@conpaws/ui/components/compass-paw";
import type { ReactNode } from "react";

/** The full-screen card used for signing in and for access problems. */
export function AuthScreen({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#091533] px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 text-[#091533] shadow-2xl sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#0faced] text-[#091533]">
          <CompassPaw className="size-9" />
        </span>
        <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.2em] text-sky-800">
          ConPaws Admin
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-bold">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-center text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </section>
    </main>
  );
}
