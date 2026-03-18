import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ConPaws — Your Furry Convention Companion',
  description:
    'Navigate conventions, import schedules, build your personal agenda, and never miss a panel. Coming to iOS & Android.',
  openGraph: {
    title: 'ConPaws — Your Furry Convention Companion',
    description: 'Navigate conventions, import schedules, build your personal agenda.',
    url: 'https://conpaws.com',
    siteName: 'ConPaws',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ConPaws',
    description: 'Your furry convention companion. Coming soon.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#091533] text-white antialiased">{children}</body>
    </html>
  );
}
