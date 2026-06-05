/**
 * /world-cup-2026/watch-live/[country]
 *
 * Country-specific "How to Watch World Cup 2026" pages.
 * Six statically-generated routes: us, uk, canada, australia, thailand, vietnam.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  WC_WATCH_COUNTRY_SLUGS,
  getWatchCountry,
} from '@/lib/wc-watch-countries';
import WCWatchCountryContent from '@/components/WCWatchCountryContent';

export const revalidate = 86400; // Re-generate once per day — this content rarely changes

const BASE_URL = 'https://goalradar.org';

// ---------------------------------------------------------------------------
// Static params — pre-render all 6 country slugs at build time
// ---------------------------------------------------------------------------
export function generateStaticParams() {
  return WC_WATCH_COUNTRY_SLUGS.map((country) => ({ country }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country: slug } = await params;
  const country = getWatchCountry(slug);
  if (!country) return {};

  const canonicalUrl = `${BASE_URL}/world-cup-2026/watch-live/${slug}`;

  return {
    title: country.metaTitle,
    description: country.metaDesc,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: country.metaTitle,
      description: country.metaDesc,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: country.metaTitle,
      description: country.metaDesc,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function WatchLiveCountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country: slug } = await params;
  const country = getWatchCountry(slug);

  if (!country) notFound();

  return <WCWatchCountryContent country={country} />;
}
