"use client";

/**
 * Last-resort error boundary. Replaces the root layout entirely, so it must
 * render its own <html> and <body>.
 *
 * Deliberately styled inline rather than through the design system: this is
 * the page that shows when something in the root layout failed, and that
 * includes the case where the stylesheet or a provider is what broke. Reaching
 * for the same CSS that may have just failed would risk an unstyled white
 * page, which is the exact outcome this file exists to prevent.
 *
 * The landing page mounts an animated badge and a client-side count fetch, so
 * a crash here is realistic rather than theoretical.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f7f9fb",
          color: "#0d1a2b",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.6,
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #091533 !important; color: #e8eef6 !important; }
            .gx-card { background: #0e1c3d !important; border-color: #24365e !important; }
            .gx-muted { color: #9fb0c9 !important; }
          }
          .gx-btn:hover { filter: brightness(1.1); }
          .gx-btn:focus-visible { outline: 2px solid #0faced; outline-offset: 3px; }
        `}</style>

        <main
          className="gx-card"
          style={{
            maxWidth: "34rem",
            width: "100%",
            background: "#ffffff",
            border: "1px solid #dde5ee",
            borderRadius: "18px",
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <p
            className="gx-muted"
            style={{
              margin: 0,
              fontSize: "11px",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#5d7186",
            }}
          >
            Something broke
          </p>

          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "clamp(26px, 5vw, 36px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            This page didn&rsquo;t load
          </h1>

          <p
            className="gx-muted"
            style={{
              margin: "16px auto 0",
              maxWidth: "44ch",
              fontSize: "15px",
              color: "#5d7186",
            }}
          >
            The problem is on our side, not yours. Trying again usually works —
            if it doesn&rsquo;t, the site itself is having a bad day.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
              marginTop: "28px",
            }}
          >
            <button
              type="button"
              onClick={reset}
              className="gx-btn"
              style={{
                appearance: "none",
                border: 0,
                cursor: "pointer",
                borderRadius: "12px",
                background: "#00729c",
                color: "#ffffff",
                padding: "14px 26px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              className="gx-btn"
              style={{
                borderRadius: "12px",
                border: "1px solid #dde5ee",
                color: "inherit",
                textDecoration: "none",
                padding: "14px 26px",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Go home
            </a>
          </div>

          {error.digest ? (
            <p
              className="gx-muted"
              style={{
                margin: "26px 0 0",
                fontSize: "12px",
                color: "#5d7186",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
