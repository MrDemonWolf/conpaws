import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, IBM_Plex_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conpaws.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ConPaws — your furry convention companion",
    template: "%s · ConPaws",
  },
  description:
    "Import a convention schedule, build your own, get reminders — all of it working offline. iOS and Android.",
  openGraph: {
    type: "website",
    siteName: "ConPaws",
    title: "ConPaws — your furry convention companion",
    description:
      "Import a convention schedule, build your own, get reminders — all of it working offline. iOS and Android.",
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ConPaws" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ConPaws — your furry convention companion",
    description:
      "Import a convention schedule, build your own, get reminders — all of it working offline.",
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
      </body>
    </html>
  );
}
