"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { BadgeCard } from "./badge-card";

type Status = "idle" | "submitting" | "done";

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
    <div className="grid items-center gap-14 md:grid-cols-[1.05fr_0.95fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10.5px] text-primary uppercase tracking-[0.24em]">
          ● Beta signups open
        </span>

        <h1 className="mt-5 font-bold text-[clamp(34px,5.6vw,58px)] leading-[1.02] tracking-[-0.04em]">
          Your con
          <br />
          <em className="text-primary not-italic">schedule</em>, sorted.
        </h1>

        <p className="mt-4 max-w-[44ch] text-[15px] text-muted-foreground">
          Import a convention schedule, build your own, get reminders — all of
          it working offline, because con WiFi never does.
        </p>

        {status === "done" ? (
          <div className="mt-7 max-w-[430px] rounded-xl border border-primary/40 bg-primary/10 p-5">
            <p className="font-semibold">You&rsquo;re on the list.</p>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              We sent a confirmation link to your inbox. Click it and your spot
              is locked in — we won&rsquo;t email you again until there&rsquo;s
              something worth opening.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 max-w-[430px]">
            <div className="grid gap-3.5">
              <div>
                <label
                  htmlFor={nameId}
                  className="mb-1.5 block text-[10px] text-muted-foreground uppercase tracking-[0.18em]"
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
                  className="w-full rounded-[10px] border border-input bg-card px-4 py-3 text-[15px] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor={emailId}
                  className="mb-1.5 block text-[10px] text-muted-foreground uppercase tracking-[0.18em]"
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
                  className="w-full rounded-[10px] border border-input bg-card px-4 py-3 text-[15px] outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/20"
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
              className="mt-3.5 w-full rounded-[10px] bg-primary px-4 py-3.5 font-bold text-[14px] text-primary-foreground uppercase tracking-[0.1em] transition hover:brightness-110 disabled:opacity-60"
            >
              {status === "submitting"
                ? "Registering…"
                : "Register for the beta"}
            </button>

            <p className="mt-3 text-[11.5px] text-muted-foreground leading-relaxed">
              iOS and Android at launch. We&rsquo;ll email once to confirm —
              nothing else until it&rsquo;s ready.{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy
              </a>
            </p>
          </form>
        )}
      </div>

      <div className="md:order-none -order-1">
        <BadgeCard name={name} />
      </div>
    </div>
  );
}
