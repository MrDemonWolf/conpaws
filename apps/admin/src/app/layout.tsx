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

const adminName = "ConPaws Admin";
const description =
  "Private convention catalog and schedule publishing workspace.";
const shareImage = "/admin-share.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://admin.conpaws.com"),
  applicationName: adminName,
  title: {
    default: adminName,
    template: "%s · ConPaws Admin",
  },
  description,
  openGraph: {
    type: "website",
    siteName: adminName,
    title: adminName,
    description,
    images: [{ url: shareImage, width: 1200, height: 630, alt: adminName }],
  },
  twitter: {
    card: "summary_large_image",
    title: adminName,
    description,
    images: [{ url: shareImage, alt: adminName }],
  },
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
