import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import watchlyFavicon from '../../../mobile/assets/favicon.png';
import './globals.css';

const description =
  'Track films and series, log every watch, rate in half-stars, write reviews, and keep your viewing history in one place.';
const siteUrl = 'https://trywatchly.com';
const socialPreviewUrl = `${siteUrl}/watchly-social-preview-v2.png`;

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
        height: 627,
        secureUrl: socialPreviewUrl,
        type: 'image/png',
        url: socialPreviewUrl,
        width: 1200,
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
    images: [socialPreviewUrl],
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
