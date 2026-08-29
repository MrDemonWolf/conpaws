"use client";

import { env } from "@conpaws/env/web";
import Script from "next/script";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import type { Messages } from "@/i18n";
import { CONSENT_COPY } from "../lib/consent";
import { Badge } from "./badge";

type Status = "idle" | "submitting" | "done";
type WaitlistMessages = Messages["waitlist"];

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}

// Open as of 2026-08-28. The gate this waited on is done: D1 persistence, the
// listmonk double opt-in, the resend cooldown, and the hourly reconciler are all
// live and verified against production.
//
// Setting this to false is still the kill switch if signups need to stop — the
// route keeps working, so it closes the form without touching the API or losing
// the addresses already collected.
const WAITLIST_ACCEPTING_SIGNUPS = true;

const INPUT_CLASS =
  "w-full rounded-xl border border-input bg-card/70 px-4 py-3.5 text-[15px] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20";

export function Waitlist({ messages }: { messages: WaitlistMessages }) {
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
        throw new Error(body.error ?? messages.errorRetry);
      }

      setStatus("done");
      toast.success(messages.successToast);
    } catch (error) {
      setStatus("idle");
      // Turnstile tokens are single-use. Without this reset the hidden field
      // still holds the spent token, so every retry re-submits it and fails
      // again — the user would be stuck with no way out but a page reload.
      window.turnstile?.reset();
      toast.error(
        error instanceof Error ? error.message : messages.errorGeneric,
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
          {WAITLIST_ACCEPTING_SIGNUPS ? messages.badgeOpen : messages.badgeSoon}
        </span>

        {/*
          The accent word is highlighted by splitting the headline on it rather
          than by hardcoding line breaks around it, which is what this used to
          do. Fixed <br>s only work for one word order: "schedule" lands in the
          middle in English and at the end in German, and CJK has no space to
          break on at all. Splitting on the accent keeps the emphasis wherever
          the translator put the word, and falls back to a plain headline if
          they rephrased it away.
        */}
        <h1 className="motion-safe:animate-rise mt-6 text-balance font-bold text-[clamp(42px,6.2vw,76px)] leading-[0.95] tracking-[-0.03em] [animation-delay:80ms]">
          {(() => {
            const at = messages.title.indexOf(messages.titleAccent);
            if (at === -1 || !messages.titleAccent) return messages.title;
            return (
              <>
                {messages.title.slice(0, at)}
                <span className="text-primary">{messages.titleAccent}</span>
                {messages.title.slice(at + messages.titleAccent.length)}
              </>
            );
          })()}
        </h1>

        <p className="motion-safe:animate-rise mt-6 max-w-[42ch] text-[16px] text-muted-foreground leading-relaxed [animation-delay:160ms]">
          {messages.body}
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
            <p className="font-bold text-[17px]">{messages.doneTitle}</p>
            <p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">
              {messages.doneBody}
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
                  {messages.nameLabel}
                </label>
                {/* Deliberately never disabled: the badge filling in as you
                    type is the page's one interactive moment, and it works
                    whether or not signups are open. */}
                <input
                  id={nameId}
                  name="name"
                  autoComplete="name"
                  placeholder={messages.namePlaceholder}
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
                  {messages.emailLabel}
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
                  disabled={!WAITLIST_ACCEPTING_SIGNUPS}
                  autoComplete="email"
                  placeholder={messages.emailPlaceholder}
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
              <label htmlFor={hpId}>{messages.honeypotLabel}</label>
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
                ? messages.submitClosed
                : status === "submitting"
                  ? messages.submitting
                  : messages.submit}
            </button>

            {/*
              CONSENT_COPY is deliberately NOT translated.

              This exact string is written verbatim onto every waitlist row, so
              that each person keeps the wording they actually agreed to. Show a
              German sentence here while storing the English one and the record
              no longer matches what was consented to, which is the whole reason
              the text is stored rather than a boolean.

              Localising it properly means the server picking the string by
              locale from its own copy of the catalogs and storing that — never
              trusting a client-supplied consent string, which would be
              tamperable. Until that lands, English is the honest option: the
              text shown and the text stored are the same.
            */}
            <p className="mt-3.5 text-[13px] text-muted-foreground leading-relaxed">
              {WAITLIST_ACCEPTING_SIGNUPS ? (
                <span lang="en">{CONSENT_COPY}</span>
              ) : (
                messages.closedNotice
              )}{" "}
              <a href="/privacy" className="text-primary hover:underline">
                {messages.privacyLink}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
