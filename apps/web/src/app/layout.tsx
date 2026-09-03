import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import watchlyFavicon from '../../../mobile/assets/favicon.png';
import watchlySocialPreview from '../../../mobile/assets/watchly-wordmark-background.png';
import './globals.css';

const description =
  'Track films and series, log every watch, rate in half-stars, write reviews, and keep your viewing history in one place.';
const siteUrl = 'https://trywatchly.com';

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl,
  },
  description,
  icons: {
    icon: watchlyFavicon.src,
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    description,
    images: [
      {
        alt: 'Watchly',
        height: 887,
        url: watchlySocialPreview.src,
        width: 1774,
      },
    ],
    siteName: 'Watchly',
    title: 'Watchly',
    type: 'website',
    url: siteUrl,
  },
  title: {
    default: 'Watchly',
    template: '%s | Watchly',
  },
  twitter: {
    card: 'summary_large_image',
    description,
    images: [watchlySocialPreview.src],
    title: 'Watchly',
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
