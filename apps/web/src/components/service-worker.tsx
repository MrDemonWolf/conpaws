"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js`, which makes the site readable with no connection.
 *
 * Production only. In development a service worker sits in front of the dev
 * server and serves stale bundles after an edit, which reads as "HMR is
 * broken" and costs an hour before anyone suspects the worker.
 *
 * Registration is deferred to `load` so it never competes with the first
 * paint. Nothing on the page depends on it: if registration fails, or the
 * browser has no service workers at all, the site behaves exactly as it did
 * before — which is why this swallows the error rather than reporting it.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline reading is a nicety. A failure here is not worth a console
        // error on a marketing page.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
