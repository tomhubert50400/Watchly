import type { MetadataRoute } from 'next';
import { publicLegalRoutes } from '../content/legal';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date('2026-08-13T00:00:00.000Z');

  return [
    { changeFrequency: 'monthly', lastModified, priority: 1, url: baseUrl },
    ...publicLegalRoutes.map((route) => ({
      changeFrequency: 'monthly' as const,
      lastModified,
      priority: route === '/privacy' || route === '/account-deletion' ? 0.9 : 0.8,
      url: `${baseUrl}${route}`,
    })),
  ];
}

function getBaseUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3001';
  return value.replace(/\/+$/, '');
}
