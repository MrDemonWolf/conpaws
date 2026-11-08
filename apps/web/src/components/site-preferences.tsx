"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./site-header.module.css";

export function SitePreferences({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        details.current &&
        !details.current.contains(event.target)
      )
        details.current.open = false;
    };
    document.addEventListener("click", closeOutside);
    return () => document.removeEventListener("click", closeOutside);
  }, []);
  return (
    <details
      ref={details}
      className={styles.preferences}
      data-site-preferences
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          details.current?.querySelector("details[open]")
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (details.current) {
          details.current.open = false;
          details.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={label}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v16M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
        </svg>
      </summary>
      <div className={styles.preferencesBody}>{children}</div>
    </details>
  );
}
