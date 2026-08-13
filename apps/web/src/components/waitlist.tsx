"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { BadgeCard } from "./badge-card";

type Status = "idle" | "submitting" | "done";

const INPUT_CLASS =
  "w-full rounded-xl border border-input bg-card/70 px-4 py-3.5 text-[15px] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20";

export function Waitlist() {
  const nameId = useId();
  const emailId = useId();
  const hpId = useId();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Honeypot + time-to-submit: a free first gate that costs no latency and
  // catches naive bots before Turnstile is ever consulted.
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef(Date.now());

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

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
      toast.error(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    }
  }

  return (
    <div className="grid items-start gap-16 md:grid-cols-[1fr_380px]">
      <div className="pt-6 md:pt-14">
        <span className="motion-safe:animate-rise inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 font-tech text-[10px] text-primary uppercase tracking-[0.28em]">
          <span className="relative flex h-[7px] w-[7px]">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-primary" />
          </span>
          Beta signups open
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

        {status === "done" ? (
          <div className="mt-8 max-w-[440px] rounded-2xl border border-primary/40 bg-primary/10 p-6">
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
            className="motion-safe:animate-rise mt-8 max-w-[440px] [animation-delay:240ms]"
          >
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1.5 block font-tech text-[10px] text-muted-foreground uppercase tracking-[0.24em]"
                >
                  Your name or fursona
                </label>
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
                  className="mb-1.5 block font-tech text-[10px] text-muted-foreground uppercase tracking-[0.24em]"
                >
                  Email
                </label>
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  required
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

            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-5 w-full rounded-xl bg-primary px-5 py-4 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.14em] transition hover:shadow-[0_0_36px_rgb(15_172_237/0.35)] hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {status === "submitting"
                ? "Registering…"
                : "Register for the beta →"}
            </button>

            <p className="mt-3.5 text-[12px] text-muted-foreground leading-relaxed">
              iOS and Android at launch. We&rsquo;ll email once to confirm —
              nothing else until it&rsquo;s ready.{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy
              </a>
            </p>
          </form>
        )}
      </div>

      <div className="md:order-none -order-1 md:pt-2">
        <BadgeCard name={name} />
      </div>
    </div>
  );
}
