"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaRuntime() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    const blockOfflineSubmit = (event: SubmitEvent) => {
      if (navigator.onLine) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOnline(false);
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    document.addEventListener("submit", blockOfflineSubmit, true);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      document.removeEventListener("submit", blockOfflineSubmit, true);
    };
  }, []);

  if (online) return null;

  return (
    <div
      data-offline-status
      role="status"
      aria-live="polite"
      className="sticky top-[var(--admin-header-height)] z-10 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950 sm:px-6"
    >
      <strong className="font-bold">You’re offline.</strong> Reconnect before
      saving or publishing. Private schedules aren’t cached for offline use.
    </div>
  );
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () => setInstalled(isStandalone());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    const platform = navigator.platform;

    setAppleMobile(
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    updateInstalled();
    standalone.addEventListener("change", updateInstalled);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      standalone.removeEventListener("change", updateInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function installOrExplain() {
    if (!installPrompt) {
      setShowInstructions((visible) => !visible);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setShowInstructions(true);
    } finally {
      setInstallPrompt(null);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={showInstructions}
        aria-controls="pwa-install-help"
        onClick={installOrExplain}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-xs font-semibold text-sky-950 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:px-3 sm:text-sm"
      >
        <Icon name="plus" className="size-4" />
        Install
      </button>
      {showInstructions ? (
        <div
          id="pwa-install-help"
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-5 text-slate-700 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-[#091533]">
              Install ConPaws Admin
            </p>
            <button
              type="button"
              aria-label="Close install instructions"
              onClick={() => setShowInstructions(false)}
              className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
            >
              ×
            </button>
          </div>
          <p className="mt-2">
            {appleMobile
              ? "Open your browser’s Share menu, then choose Add to Home Screen."
              : "Open your browser’s menu and choose Install app or Add to Home Screen."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
