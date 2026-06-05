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
 * This prevents CLS by deferring the push() until after layout is
 * stable, and avoids wasted ad requests for below-fold slots that
 * the user never scrolls to.
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

    // Only initialise once — guard against double-invocation in StrictMode.
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
      // Load the ad 200 px before it scrolls into view so there is no
      // visible delay when the user reaches the slot.
      { rootMargin: '200px 0px' }
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
