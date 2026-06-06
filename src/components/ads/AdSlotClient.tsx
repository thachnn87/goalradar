'use client';

import { useEffect, useRef } from 'react';

interface AdSlotClientProps {
  publisherId: string;
  slotId:      string;
  format:      string;
  responsive:  boolean;
  style:       React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle?: Array<{ push?: (config: object) => void } | object>;
  }
}

/**
 * Lazy-loaded AdSense slot.
 *
 * Uses IntersectionObserver so the ad request is only sent when the
 * <ins> element enters the viewport (plus a 200 px root margin).
 * This prevents wasted ad requests for below-fold slots the user
 * never scrolls to, and avoids layout jank by deferring push() until
 * after the host element has been measured.
 */
export default function AdSlotClient({
  publisherId,
  slotId,
  format,
  responsive,
  style,
}: AdSlotClientProps) {
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const el = insRef.current;
    if (!el) return;

    // Guard against double-invocation in React StrictMode.
    let initialised = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !initialised) {
          initialised = true;
          try {
            const ads = (window.adsbygoogle = window.adsbygoogle ?? []);
            ads.push({});
          } catch {
            // AdSense script not yet loaded — silently ignore.
          }
          observer.disconnect();
        }
      },
      // Start loading 200 px before the slot scrolls into view so there
      // is no visible delay when the user reaches the slot.
      { rootMargin: '200px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={style}
      data-ad-client={publisherId}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
