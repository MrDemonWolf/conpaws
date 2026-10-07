import type { Metadata, Viewport } from "next";
import { Montserrat, Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
  weight: ["500", "600", "700"],
});

const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  applicationName: "ConPaws Admin",
  title: {
    default: "ConPaws Admin",
    template: "%s · ConPaws Admin",
  },
  description: "Private convention catalog and schedule publishing workspace.",
  robots: { index: false, follow: false, noarchive: true },
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ConPaws Admin",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#091533",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${roboto.variable} ${robotoMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
