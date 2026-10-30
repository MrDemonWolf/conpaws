"use client";

import { useEffect } from "react";

/**
 * Invite links carry the address after `#`, which browsers never send to the
 * server, so it stays out of request logs. This copies it into the email
 * field and then drops it from the address bar.
 */
export function EmailFromLink({ inputId }: { inputId: string }) {
  useEffect(() => {
    const match = /(?:^#|&)email=([^&]*)/.exec(window.location.hash);
    if (!match) return;
    let address = "";
    try {
      address = decodeURIComponent(match[1] ?? "");
    } catch {
      address = "";
    }
    const input = document.getElementById(inputId);
    if (address && input instanceof HTMLInputElement && !input.value) {
      input.value = address;
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, [inputId]);
  return null;
}
