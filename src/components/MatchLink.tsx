/**
 * MatchLink — PERF-8 Phases 1, 2 & 4
 *
 * Drop-in <Link> wrapper for navigation to /match/[id] (or /predict/[id]):
 *
 *   Phase 1 — prefetch={true}: full route prefetch (JS chunk + RSC payload)
 *             as soon as the link enters the viewport, even where Next's
 *             default heuristics would skip it.
 *   Phase 2 — snapshot prewarm hints: viewport entry (IntersectionObserver),
 *             desktop hover (80 ms debounce) and mobile touchstart all queue
 *             a KV-only snapshot prewarm (deduped, max 3 concurrent).
 *   Phase 4 — click timestamp: stamps sessionStorage so the match page can
 *             beacon the click→content time to navigationPerf telemetry.
 */

'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { prewarmMatch, prewarmMatchOnHover } from '@/lib/match-prewarm';

export const NAV_STAMP_KEY = 'gr:nav';

export function stampNavigation(matchId: number | string): void {
  try {
    sessionStorage.setItem(NAV_STAMP_KEY, JSON.stringify({ id: String(matchId), t: Date.now() }));
  } catch {
    // sessionStorage unavailable (private mode quota etc.) — telemetry only
  }
}

interface MatchLinkProps {
  href:      string;
  matchId:   number | string;
  className?: string;
  children:  React.ReactNode;
}

export default function MatchLink({ href, matchId, className, children }: MatchLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const cancelHover = useRef<(() => void) | null>(null);

  // Viewport-entry prewarm hint (one-shot per link)
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          prewarmMatch(matchId);
          io.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [matchId]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={true}
      className={className}
      onMouseEnter={() => { cancelHover.current = prewarmMatchOnHover(matchId); }}
      onMouseLeave={() => { cancelHover.current?.(); cancelHover.current = null; }}
      onTouchStart={() => prewarmMatch(matchId)}
      onClick={() => stampNavigation(matchId)}
    >
      {children}
    </Link>
  );
}
