import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, '');

  return {
    rules: {
      allow: '/',
      disallow: '/admin',
      userAgent: '*',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
