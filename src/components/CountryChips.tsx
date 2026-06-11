/**
 * CountryChips — GEO-1 Smart Country Prioritization
 *
 * "Your country" chip row on match pages.
 *
 *   - SSR/initial render: global tier order (deterministic — no hydration
 *     mismatch, no CLS).
 *   - After mount: visitor country fetched once from /api/geo (cached in
 *     sessionStorage for the session) → detected country moves to position 1,
 *     its regional neighbours follow, remainder stays in tier order.
 *   - Mobile (<768px): 6 chips + "+N more" toggle. Desktop: all chips.
 *   - Every chip links to an existing canonical watch-live / tv-schedule
 *     page — no new URLs (SEO-safe).
 *   - Clicks fire the `country_chip_click` GA4 event.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GEO_COUNTRIES, orderCountries, type GeoCountry } from '@/lib/geo-countries';
import { trackCountryChipClick } from '@/lib/analytics';

const GEO_CACHE_KEY = 'gr:geo-country';
const MOBILE_VISIBLE = 6;

async function detectCountry(): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached !== null) return cached || null; // '' = previously detected nothing
    const res = await fetch('/api/geo', { priority: 'low' } as RequestInit);
    const { country } = (await res.json()) as { country: string | null };
    sessionStorage.setItem(GEO_CACHE_KEY, country ?? '');
    return country;
  } catch {
    return null;
  }
}

export default function CountryChips({
  matchId,
  pageType = 'match',
}: {
  matchId:   number | string;
  pageType?: string;
}) {
  const [countries, setCountries] = useState<GeoCountry[]>(GEO_COUNTRIES);
  const [expanded,  setExpanded]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    detectCountry().then((code) => {
      if (cancelled || !code) return;
      const ordered = orderCountries(code);
      if (ordered !== GEO_COUNTRIES) setCountries(ordered);
    });
    return () => { cancelled = true; };
  }, []);

  const hiddenCount = countries.length - MOBILE_VISIBLE;

  return (
    <div className="px-4 pb-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
      <span className="text-xs text-gray-600 self-center shrink-0 mr-1">Your country:</span>
      {countries.map((c, i) => (
        <Link
          key={c.code}
          href={c.href}
          onClick={() => trackCountryChipClick({ country: c.code, matchId, pageType })}
          className={`items-center gap-1 text-xs text-white/60 hover:text-yellow-400 bg-white/5 hover:bg-white/10 border border-white/8 rounded-full px-2 py-0.5 transition-colors ${
            i >= MOBILE_VISIBLE && !expanded ? 'hidden md:inline-flex' : 'inline-flex'
          }`}
        >
          {c.flag} {c.label}
        </Link>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="md:hidden inline-flex items-center text-xs text-yellow-500/80 hover:text-yellow-400 bg-white/5 border border-white/8 rounded-full px-2 py-0.5 transition-colors"
        >
          {expanded ? '− Less' : `+ ${hiddenCount} More`}
        </button>
      )}
    </div>
  );
}
