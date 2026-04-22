import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/account/',
        '/admin/',
        '/api/',
        '/onboarding/',
        '/unauthorized/',
        '/appointments/',
        '/bookings/',
        '/data/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
