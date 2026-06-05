/**
 * AdSlot — reusable ad placement component.
 *
 * Disabled by default. Enable by setting:
 *   NEXT_PUBLIC_ADS_ENABLED=true
 *   NEXT_PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXX
 *
 * Pass a slotId prop for each distinct ad unit (from AdSense dashboard).
 *
 * In development, set NEXT_PUBLIC_ADS_DEV_PREVIEW=true to render
 * labelled placeholder boxes so you can visualise ad positions without
 * needing a live AdSense account.
 */

import AdSlotClient from './AdSlotClient';

export type AdVariant =
  | 'banner'        // responsive leaderboard — use at top/bottom of page
  | 'rectangle'     // 300×250 medium rectangle — use inline between sections
  | 'leaderboard'   // 728×90 fixed — use at top of page (desktop)
  | 'auto';         // fully responsive — let AdSense decide

interface AdSlotProps {
  /** AdSense ad unit slot ID (e.g. "1234567890"). Required when ads are enabled. */
  slotId?: string;
  variant?: AdVariant;
  /** Extra wrapper classes (e.g. "my-6" for vertical rhythm). */
  className?: string;
  /** Accessible label for the ad region. */
  label?: string;
}

const ADSENSE_ID   = process.env.NEXT_PUBLIC_ADSENSE_ID   ?? '';
const ADS_ENABLED  = process.env.NEXT_PUBLIC_ADS_ENABLED  === 'true' && ADSENSE_ID !== '';
const DEV_PREVIEW  = process.env.NEXT_PUBLIC_ADS_DEV_PREVIEW === 'true'
                     && process.env.NODE_ENV === 'development';

/** Inline style per variant — used for both the real ad and the dev preview box. */
function slotStyle(variant: AdVariant): React.CSSProperties {
  switch (variant) {
    case 'leaderboard': return { display: 'inline-block', width: 728, height: 90 };
    case 'rectangle':   return { display: 'inline-block', width: 300, height: 250 };
    case 'banner':      return { display: 'block' };
    case 'auto':
    default:            return { display: 'block' };
  }
}

function adFormat(variant: AdVariant) {
  return variant === 'auto' ? 'auto' : variant === 'rectangle' ? 'rectangle' : 'horizontal';
}

export default function AdSlot({
  slotId = '',
  variant = 'auto',
  className = '',
  label = 'Advertisement',
}: AdSlotProps) {
  // ── Real ads ──────────────────────────────────────────────────────────────
  if (ADS_ENABLED && slotId) {
    return (
      <div
        className={`text-center overflow-hidden ${className}`}
        aria-label={label}
        role="complementary"
      >
        <AdSlotClient
          publisherId={ADSENSE_ID}
          slotId={slotId}
          format={adFormat(variant)}
          responsive={variant === 'auto' || variant === 'banner'}
          style={slotStyle(variant)}
        />
      </div>
    );
  }

  // ── Development preview placeholder ───────────────────────────────────────
  if (DEV_PREVIEW) {
    const style = slotStyle(variant);
    const w = typeof style.width  === 'number' ? `${style.width}px`  : '100%';
    const h = typeof style.height === 'number' ? `${style.height}px` : '90px';

    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 text-gray-600 text-xs font-mono ${className}`}
        style={{ width: w, height: h, maxWidth: '100%', margin: '0 auto' }}
        aria-hidden="true"
      >
        Ad · {variant} {slotId ? `· ${slotId}` : ''}
      </div>
    );
  }

  // ── Disabled (default) — renders nothing ──────────────────────────────────
  return null;
}
