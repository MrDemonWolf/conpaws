import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
