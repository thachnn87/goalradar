import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',      // internal dashboard — no public value
          '/api/',        // server-side API routes
          '/newsletter/', // confirmation / invalid token pages
        ],
      },
    ],
    sitemap: 'https://goalradar.org/sitemap.xml',
    host: 'https://goalradar.org',
  };
}
