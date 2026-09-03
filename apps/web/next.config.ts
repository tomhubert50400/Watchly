import type { NextConfig } from 'next';

const apiOrigin = getOrigin(
  process.env.NEXT_PUBLIC_API_URL
    || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined),
);
const developmentScriptSource = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
const connectSources = [
  "'self'",
  apiOrigin,
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://www.googleapis.com',
  'https://*.firebaseapp.com',
].filter(Boolean);
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src ${connectSources.join(' ')}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
  "img-src 'self' data: https:",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${developmentScriptSource} https://apis.google.com https://www.gstatic.com`,
  "style-src 'self' 'unsafe-inline'",
  process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
].filter(Boolean).join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ headers: securityHeaders, source: '/(.*)' }];
  },
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;

function getOrigin(value: string | undefined) {
  if (!value) return '';

  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}
