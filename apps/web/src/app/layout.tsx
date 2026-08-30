import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, IBM_Plex_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        className={`${bricolage.variable} ${caveat.variable} ${plexMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
