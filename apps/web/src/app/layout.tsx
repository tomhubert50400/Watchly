import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  description: 'Watchly legal information, community standards, support, and account controls.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: 'Legal information, community standards, support, and account controls for Watchly.',
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
  themeColor: '#090C13',
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
