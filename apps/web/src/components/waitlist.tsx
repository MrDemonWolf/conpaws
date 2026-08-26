"use client";

import { env } from "@conpaws/env/web";
import Script from "next/script";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { CONSENT_COPY } from "../lib/consent";
import { Badge } from "./badge";

type Status = "idle" | "submitting" | "done";

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

// Keep the public form closed until D1 persistence, DOI, and retries land.
const WAITLIST_ACCEPTING_SIGNUPS = false;

const INPUT_CLASS =
  "w-full rounded-xl border border-input bg-card/70 px-4 py-3.5 text-[15px] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20";

export function Waitlist() {
  const nameId = useId();
  const emailId = useId();
  const hpId = useId();

  const turnstileSiteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Honeypot + time-to-submit: a free first gate that costs no latency and
  // catches naive bots before Turnstile is ever consulted.
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef(Date.now());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!WAITLIST_ACCEPTING_SIGNUPS || status === "submitting") return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    // Turnstile's implicit rendering writes the token into this hidden field.
    // It is verified server-side only; a token here proves nothing on its own.
    const turnstileToken = String(form.get("cf-turnstile-response") ?? "");

    const params = new URLSearchParams(window.location.search);

    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim(),
          honeypot,
          elapsedMs: Date.now() - mountedAt.current,
          turnstileToken,
          utmSource: params.get("utm_source") ?? undefined,
          utmMedium: params.get("utm_medium") ?? undefined,
          utmCampaign: params.get("utm_campaign") ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Something went wrong. Try again?");
      }

      setStatus("done");
      toast.success("Check your inbox to confirm your spot.");
    } catch (error) {
      setStatus("idle");
      // Turnstile tokens are single-use. Without this reset the hidden field
      // still holds the spent token, so every retry re-submits it and fails
      // again — the user would be stuck with no way out but a page reload.
      window.turnstile?.reset();
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  }

  return (
    // Three grid children, not two, so mobile can read copy -> badge -> form.
    // Stacked in one column the badge is 450px of decoration, and putting it
    // first (which it used to be) pushed the <h1> to y720 on a 812px screen --
    // the whole first screen was a badge with no explanation of the product.
    // Desktop is unchanged: copy and form share column 1 in rows 1 and 2, the
    // badge spans both in column 2, so it still sits beside the name field
    // that drives it. Row gap replaces the `mt-8` the form used to carry.
    <div className="grid items-start gap-8 md:grid-cols-[1fr_380px] md:gap-x-16">
      <div className="relative z-10 pt-6 md:col-start-1 md:row-start-1 md:pt-14">
        <span className="motion-safe:animate-rise inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-tech text-[11px] text-primary uppercase tracking-[0.24em]">
          <span className="relative flex h-[7px] w-[7px]">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-primary" />
          </span>
          Beta waitlist coming soon
        </span>

        <h1 className="motion-safe:animate-rise mt-6 font-bold text-[clamp(42px,6.2vw,76px)] leading-[0.95] tracking-[-0.03em] [animation-delay:80ms]">
          Your con
          <br />
          <span className="text-primary">schedule</span>,
          <br />
          sorted.
        </h1>

        <p className="motion-safe:animate-rise mt-6 max-w-[42ch] text-[16px] text-muted-foreground leading-relaxed [animation-delay:160ms]">
          Import a convention schedule, build your own, get reminders — all of
          it working offline, because con WiFi never does.
        </p>
      </div>

      {/* The badge hangs in front of everything: above the nav (z-20) and
          above every section below (z-10). Its lanyard runs off the top of
          the hero, so anything lower makes it look clipped rather than hung.
          This only works while the hero section stays free of a z-index --
          see the note in (marketing)/page.tsx. */}
      <div className="relative z-40 md:col-start-2 md:row-span-2 md:row-start-1 md:pt-2">
        <Badge name={name} />
      </div>

      <div className="relative z-10 md:col-start-1 md:row-start-2">
        {status === "done" ? (
          <div className="max-w-[440px] rounded-2xl border border-primary/40 bg-primary/10 p-6">
            <p className="font-bold text-[17px]">You&rsquo;re on the list.</p>
            <p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">
              We sent a confirmation link to your inbox. Click it and your spot
              is locked in — we won&rsquo;t email you again until there&rsquo;s
              something worth opening.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="motion-safe:animate-rise max-w-[440px] [animation-delay:240ms]"
          >
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1.5 block font-tech text-[12px] text-muted-foreground uppercase tracking-[0.2em]"
                >
                  Your name or fursona
                </label>
                {/* Deliberately never disabled: the badge filling in as you
                    type is the page's one interactive moment, and it works
                    whether or not signups are open. */}
                <input
                  id={nameId}
                  name="name"
                  autoComplete="name"
                  placeholder="Luna Starfall"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block font-tech text-[12px] text-muted-foreground uppercase tracking-[0.2em]"
                >
                  Email
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  disabled={!WAITLIST_ACCEPTING_SIGNUPS}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Honeypot. Hidden from humans, not from bots. Not `display:none`,
                which some bots detect — off-screen with aria-hidden instead. */}
            <div
              aria-hidden="true"
              className="-left-[9999px] absolute h-0 w-0 overflow-hidden"
            >
              <label htmlFor={hpId}>Company</label>
              <input
                id={hpId}
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {WAITLIST_ACCEPTING_SIGNUPS && turnstileSiteKey ? (
              <>
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="lazyOnload"
                />
                <div
                  className="cf-turnstile mt-5"
                  data-sitekey={turnstileSiteKey}
                  data-theme="auto"
                />
              </>
            ) : null}

            <button
              type="submit"
              disabled={!WAITLIST_ACCEPTING_SIGNUPS || status === "submitting"}
              className="mt-5 w-full rounded-xl bg-primary px-5 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {!WAITLIST_ACCEPTING_SIGNUPS
                ? "Registration opening soon"
                : status === "submitting"
                  ? "Registering…"
                  : "Register for the beta →"}
            </button>

            <p className="mt-3.5 text-[13px] text-muted-foreground leading-relaxed">
              {WAITLIST_ACCEPTING_SIGNUPS ? (
                CONSENT_COPY
              ) : (
                <>
                  We&rsquo;re finishing secure signup and email confirmation. No
                  addresses are being accepted yet.
                </>
              )}{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
