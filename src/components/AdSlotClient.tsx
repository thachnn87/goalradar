'use client';

import { useEffect } from 'react';

interface AdSlotClientProps {
  publisherId: string;
  slotId: string;
  format: string;
  responsive: boolean;
  style: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle?: Array<{ push?: (config: object) => void } | object>;
  }
}

export default function AdSlotClient({
  publisherId,
  slotId,
  format,
  responsive,
  style,
}: AdSlotClientProps) {
  useEffect(() => {
    try {
      const ads = (window.adsbygoogle = window.adsbygoogle ?? []);
      ads.push({});
    } catch {
      // AdSense not loaded yet — silently ignore
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={publisherId}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
