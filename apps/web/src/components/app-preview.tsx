"use client";

import Image from "next/image";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import styles from "./app-preview.module.css";

export interface AppPreviewScreen {
  id: string;
  title: string;
  description: string;
  src: string;
  alt: string;
}

interface AppPreviewProps {
  screens: readonly AppPreviewScreen[];
  label: string;
  note: string;
  variant?: "hero" | "gallery";
}

export function previewIndexForKey(index: number, count: number, key: string) {
  if (count === 0) return null;
  switch (key) {
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "ArrowRight":
      return (index + 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function AppPreview({
  screens,
  label,
  note,
  variant = "hero",
}: AppPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  if (screens.length === 0) return null;
  const activeIndex = Math.min(selectedIndex, screens.length - 1);
  const selected = screens[activeIndex];
  if (!selected) return null;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = previewIndexForKey(index, screens.length, event.key);
    if (next === null) return;
    event.preventDefault();
    setSelectedIndex(next);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>("button")
      [next]?.focus();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    swipe.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return;
    setSelectedIndex(
      (current) =>
        (Math.min(current, screens.length - 1) +
          (dx < 0 ? 1 : -1) +
          screens.length) %
        screens.length,
    );
  }

  if (variant === "gallery") {
    return (
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this named scroll region to pan the screenshot rail.
      <section className={styles.gallery} aria-label={label} tabIndex={0}>
        {screens.map((screen) => (
          <figure className={styles.figure} key={screen.id}>
            <div className={styles.screen}>
              <Image
                className={styles.image}
                src={screen.src}
                alt={screen.alt}
                width={440}
                height={956}
                sizes="(max-width: 767px) 240px, 30vw"
                loading="lazy"
              />
            </div>
            <figcaption className={styles.caption}>
              <strong>{screen.title}</strong>
              <p>{screen.description}</p>
              <small>{note}</small>
            </figcaption>
          </figure>
        ))}
      </section>
    );
  }

  return (
    <figure className={styles.hero}>
      <fieldset className={styles.selector}>
        <legend className="sr-only">{label}</legend>
        {screens.map((screen, index) => (
          <button
            key={screen.id}
            type="button"
            aria-pressed={index === activeIndex}
            onClick={() => setSelectedIndex(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {screen.title}
          </button>
        ))}
      </fieldset>
      <div
        className={`${styles.screen} ${styles.swipe}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {screens.map((screen, index) => (
          <Image
            key={screen.id}
            className={`${styles.image} ${styles.slide}`}
            data-active={index === activeIndex}
            aria-hidden={index !== activeIndex}
            src={screen.src}
            alt={index === activeIndex ? screen.alt : ""}
            width={440}
            height={956}
            sizes="272px"
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            draggable={false}
          />
        ))}
      </div>
      <div className={styles.dots} aria-hidden="true">
        {screens.map((screen, index) => (
          <span key={screen.id} data-active={index === activeIndex} />
        ))}
      </div>
      <figcaption
        className={styles.caption}
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>{selected.title}</strong>
        <p>{selected.description}</p>
        <small>{note}</small>
      </figcaption>
    </figure>
  );
}
