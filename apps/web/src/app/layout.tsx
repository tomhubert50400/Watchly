import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import watchlyFavicon from '../../../mobile/assets/favicon.png';
import './globals.css';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  description: 'Track films and series, log every watch, rate in half-stars, write reviews, and keep your viewing history in one place.',
  icons: {
    icon: watchlyFavicon.src,
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: 'Track films and series, log every watch, rate in half-stars, write reviews, and keep your viewing history in one place.',
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
