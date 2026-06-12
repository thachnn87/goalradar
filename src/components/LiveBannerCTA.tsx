/**
 * LiveBannerCTA — LIVE-2 (client)
 *
 * CTA button for the World Cup live banner. Client component only so the
 * click can fire the `live_banner_click` GA4 event — destination and label
 * are decided server-side in WCCountdown.
 */

'use client';

import Link from 'next/link';
import { trackLiveBannerClick } from '@/lib/analytics';

export default function LiveBannerCTA({
  href,
  label,
  matchId = null,
  liveMatchCount,
}: {
  href:           string;
  label:          string;
  matchId?:       number | string | null;
  liveMatchCount: number;
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      onClick={() =>
        trackLiveBannerClick({ matchId, destination: href, liveMatchCount })
      }
      className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg text-sm font-bold transition-colors shrink-0 whitespace-nowrap"
    >
      {label}
    </Link>
  );
}
