"use client";

import Image from "next/image";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./app-preview.module.css";
import { startPreviewRotation } from "./app-preview-playback";

export interface AppPreviewScreen {
  id: string;
  title: string;
  description: string;
  src: string;
  darkSrc?: string;
  alt: string;
}

interface AppPreviewProps {
  screens: readonly AppPreviewScreen[];
  label: string;
  note: string;
  rotationLabels: { pause: string; play: string };
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
  rotationLabels,
  variant = "hero",
}: AppPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [alternate, setAlternate] = useState(false);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    if (variant !== "hero" || paused || interacting) return;
    return startPreviewRotation(
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      () => setAlternate((value) => !value),
      () => setAlternate(false),
    );
  }, [variant, paused, interacting]);

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
                data-capture-theme={screen.darkSrc ? "light" : undefined}
                src={screen.src}
                alt={screen.alt}
                width={440}
                height={956}
                sizes="(max-width: 767px) 240px, 30vw"
                loading="lazy"
              />
              {screen.darkSrc && (
                <Image
                  className={styles.image}
                  data-capture-theme="dark"
                  src={screen.darkSrc}
                  alt={screen.alt}
                  width={440}
                  height={956}
                  sizes="(max-width: 767px) 240px, 30vw"
                  loading="lazy"
                />
              )}
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
    <figure
      className={styles.hero}
      data-preview-alternate={alternate}
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setInteracting(false);
      }}
    >
      <div
        className={`${styles.screen} ${styles.swipe}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        {screens.map((screen, index) => (
          <div
            key={screen.id}
            className={`${styles.slide} ${index === activeIndex ? styles.activeSlide : ""}`}
            aria-hidden={index !== activeIndex}
            data-active={index === activeIndex}
          >
            <Image
              className={styles.image}
              data-capture-theme={screen.darkSrc ? "light" : undefined}
              src={screen.src}
              alt={index === activeIndex ? screen.alt : ""}
              width={440}
              height={956}
              sizes="220px"
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              draggable={false}
            />
            {screen.darkSrc && (
              <Image
                className={styles.image}
                data-capture-theme="dark"
                src={screen.darkSrc}
                alt={index === activeIndex ? screen.alt : ""}
                width={440}
                height={956}
                sizes="220px"
                loading={index === 0 ? "eager" : "lazy"}
                draggable={false}
              />
            )}
          </div>
        ))}
      </div>
      <div className={styles.controls}>
        <fieldset className={styles.dots}>
          <legend className="sr-only">{label}</legend>
          {screens.map((screen, index) => (
            <button
              key={screen.id}
              type="button"
              aria-label={screen.title}
              aria-pressed={index === activeIndex}
              onClick={() => {
                setSelectedIndex(index);
                setPaused(true);
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className={styles.rotation}
          aria-pressed={paused}
          aria-label={paused ? rotationLabels.play : rotationLabels.pause}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>
      </div>
      <figcaption className="sr-only" aria-live="polite" aria-atomic="true">
        <strong>{selected.title}</strong>
        <p>{selected.description}</p>
        <small>{note}</small>
      </figcaption>
    </figure>
  );
}
