import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { CHANGELOG } from "@/content/changelog";
import { LAUNCH } from "@/content/launch";
import { getMessages } from "@/i18n";

export const metadata: Metadata = {
  title: "Updates",
  description: "Release notes and improvements to ConPaws.",
  alternates: { canonical: "/updates" },
};

export default function Updates() {
  return (
    <PageShell messages={getMessages("en")} narrow>
      <section className="py-12">
        <p className="text-sm text-primary">ConPaws</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Updates</h1>
        <p className="mt-4 max-w-[56ch] text-muted-foreground leading-relaxed">
          Release notes for the app. New features, fixes, and improvements,
          collected in one place.
        </p>
        {CHANGELOG.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card/40 p-6">
            <h2 className="text-xl font-bold">
              Release notes are on their way
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Published release notes will appear here. For now, explore what
              ConPaws does
              {LAUNCH.mode === "waitlist" ? " and join the beta waitlist" : ""}.
            </p>
            <a
              href="/"
              className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground"
            >
              Explore ConPaws
            </a>
          </div>
        ) : (
          <div className="mt-8 grid gap-8">
            {CHANGELOG.map((entry) => (
              <article
                key={entry.version}
                className="rounded-2xl border border-border bg-card/40 p-6"
              >
                <time
                  dateTime={entry.date}
                  className="text-sm text-muted-foreground"
                >
                  {entry.date}
                </time>
                <h2 className="mt-4 text-2xl font-bold">{entry.version}</h2>
                <ul className="mt-4 list-disc space-y-2 pl-6">
                  {entry.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
