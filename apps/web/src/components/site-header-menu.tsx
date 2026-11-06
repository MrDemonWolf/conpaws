"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import styles from "./site-header.module.css";

type SiteHeaderMenuProps = {
  brand: ReactNode;
  menuLabel: string;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
};

/** Only dialog behavior hydrates; the locale list stays server-rendered. */
export function SiteHeaderMenu({
  brand,
  menuLabel,
  openLabel,
  closeLabel,
  children,
}: SiteHeaderMenuProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focusAfterClose = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const header = trigger.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const updateHeaderHeight = () => {
      const height = `${Math.ceil(header.getBoundingClientRect().height)}px`;
      if (root.style.getPropertyValue("--site-header-height") !== height) {
        root.style.setProperty("--site-header-height", height);
      }
    };
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-header-height");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 64rem)");
    const closeOnDesktop = () => {
      if (!desktop.matches) return;
      focusAfterClose.current =
        trigger.current?.closest("header")?.querySelector("a") ?? null;
      dialog.current?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      const target = focusAfterClose.current ?? trigger.current;
      focusAfterClose.current = null;
      target?.focus({ preventScroll: true });
    };
  }, [open]);

  const show = () => {
    if (!dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    setOpen(true);
    closeButton.current?.focus({ preventScroll: true });
  };
  const close = () => dialog.current?.close();
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    const element = dialog.current;
    if (!element) return;
    const language = element.querySelector<HTMLDetailsElement>(
      "details[data-lang-menu][open]",
    );
    if (event.key === "Escape" && language) {
      // One Escape closes the language disclosure; the next closes navigation.
      event.preventDefault();
      event.stopPropagation();
      language.open = false;
      language.querySelector("summary")?.focus();
      return;
    }
    if (event.key !== "Tab") return;
    const targets = Array.from(
      element.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), select:not([disabled]), summary",
      ),
    ).filter((target) => {
      const details = target.closest("details");
      return (
        (!details || details.open || target.tagName === "SUMMARY") &&
        target.getClientRects().length > 0
      );
    });
    const first = targets[0];
    const last = targets.at(-1);
    if (
      (event.shiftKey && document.activeElement === first) ||
      (!event.shiftKey && document.activeElement === last)
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    const element = dialog.current;
    if (!element) return;
    if (event.target === element) {
      const bounds = element.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        close();
      }
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!link || link.target === "_blank" || link.hasAttribute("download"))
      return;
    const destination = new URL(link.href);
    if (
      destination.origin === location.origin &&
      destination.pathname === location.pathname &&
      destination.search === location.search &&
      destination.hash
    ) {
      const target = document.getElementById(
        decodeURIComponent(destination.hash.slice(1)),
      );
      if (target) {
        focusAfterClose.current = target;
        if (!target.hasAttribute("tabindex")) {
          target.tabIndex = -1;
          target.addEventListener(
            "blur",
            () => target.removeAttribute("tabindex"),
            {
              once: true,
            },
          );
        }
      }
    }
    close();
  };

  return (
    <div className={styles.mobile}>
      <button
        ref={trigger}
        className={styles.menuButton}
        type="button"
        aria-label={`${menuLabel}: ${openLabel}`}
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open}
        onClick={show}
      >
        <span>{menuLabel}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className={styles.drawer}
        aria-label={menuLabel}
        onClose={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      >
        <div className={styles.drawerHeader}>
          {brand}
          <button
            ref={closeButton}
            type="button"
            className={styles.closeButton}
            aria-label={closeLabel}
            onClick={close}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </dialog>
    </div>
  );
}
