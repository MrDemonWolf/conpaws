import Image from "next/image";
import styles from "./app-preview.module.css";

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
  variant?: "hero" | "gallery";
}

export function AppPreview({
  screens,
  label,
  note,
  variant = "hero",
}: AppPreviewProps) {
  const selected = screens[0];
  if (!selected) return null;

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
    <figure className={styles.hero}>
      <div className={styles.screen}>
        <Image
          className={styles.image}
          data-capture-theme={selected.darkSrc ? "light" : undefined}
          src={selected.src}
          alt={selected.alt}
          width={440}
          height={956}
          sizes="184px"
          loading="eager"
          fetchPriority="high"
        />
        {selected.darkSrc && (
          <Image
            className={styles.image}
            data-capture-theme="dark"
            src={selected.darkSrc}
            alt={selected.alt}
            width={440}
            height={956}
            sizes="184px"
            loading="eager"
          />
        )}
      </div>
      <figcaption className="sr-only">
        {selected.title}. {note}
      </figcaption>
    </figure>
  );
}
