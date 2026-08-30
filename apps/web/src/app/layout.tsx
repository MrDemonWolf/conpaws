import type { Metadata, Viewport } from "next";
import { Montserrat, Roboto, Roboto_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

// Subsets are wider than `latin` because the site ships in 23 locales.
// `latin-ext` carries Polish, Czech and Hungarian; `cyrillic` carries Russian
// and Ukrainian. Each subset is emitted as its own @font-face with its own
// unicode-range, so an English reader still downloads only the latin file —
// listing them costs nothing until someone needs the glyphs. Japanese, Chinese
// and Korean are not in these families at all and fall back to the system
// font, which is the right outcome: a CJK webfont is megabytes.
//
// Montserrat sets headings and the badge; Roboto sets body text; Roboto Mono
// sets the technical micro-labels, times and badge numbers. All three are
// variable fonts, so no `weight` array — one file per subset covers the whole
// range and `font-bold` is a real weight rather than a synthesised one.
//
// The subset list is repeated three times rather than hoisted to a constant:
// next/font parses these calls at build time and rejects anything that is not
// a literal ("Font loader values must be explicitly written literals").
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

// Root-layout defaults. Per-locale pages override title and description with
// their own catalog; these are the fallback for every route that does not,
// which is why they read the default catalog rather than being retyped.
const messages = getMessages(DEFAULT_LOCALE);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: messages.meta.title,
    template: messages.meta.titleTemplate,
  },
  description: messages.meta.description,
  openGraph: {
    type: "website",
    siteName: "ConPaws",
    title: messages.meta.title,
    description: messages.meta.description,
    url: SITE_URL,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: messages.meta.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: messages.meta.title,
    // The short form exists because Twitter truncates harder than OG does.
    description: messages.meta.descriptionShort,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#091533",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${roboto.variable} ${robotoMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
