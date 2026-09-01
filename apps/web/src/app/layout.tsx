import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  description: 'A home for the films you discover, watch, rate, remember, and share.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: 'A home for the films you discover, watch, rate, remember, and share.',
    siteName: 'Watchly',
    title: 'Watchly',
    type: 'website',
    url: siteUrl,
  },
  title: {
    default: 'Watchly',
    template: '%s | Watchly',
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0D0B0A',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body>{children}</body>
    </html>
  );
}

function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) return 'http://localhost:3001';

  try {
    return new URL(configured).toString();
  } catch {
    return 'http://localhost:3001';
  }
}
