/**
 * AdSlot — reusable AdSense placeholder component.
 *
 * Disabled by default. Enable by setting env vars:
 *   NEXT_PUBLIC_ADS_ENABLED=true
 *   NEXT_PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXX
 *
 * CLS prevention: when ads are enabled the wrapper always reserves
 * the slot's minimum height so the page layout is stable before the
 * ad creative arrives.
 *
 * Lazy loading: the underlying AdSlotClient uses IntersectionObserver
 * — the ad request fires only when the slot scrolls within 200 px of
 * the viewport, not on initial page load.
 *
 * Dev preview: set NEXT_PUBLIC_ADS_DEV_PREVIEW=true (development only)
 * to see labelled placeholder boxes without a live AdSense account.
 */

import AdSlotClient from './AdSlotClient';

export type AdVariant =
  | 'banner'        // responsive leaderboard — top/bottom of page
  | 'rectangle'     // 300×250 medium rectangle — between content sections
  | 'leaderboard'   // 728×90 fixed width — desktop page top
  | 'auto';         // fully responsive — AdSense decides

interface AdSlotProps {
  /** AdSense ad unit slot ID, e.g. "1234567890". Required when ads are enabled. */
  slotId?: string;
  variant?: AdVariant;
  /** Extra wrapper classes, e.g. "my-6" for vertical rhythm. */
  className?: string;
  /** Accessible label for the complementary landmark. */
  label?: string;
}

const ADSENSE_ID  = process.env.NEXT_PUBLIC_ADSENSE_ID        ?? '';
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED       === 'true' && ADSENSE_ID !== '';
const DEV_PREVIEW = process.env.NEXT_PUBLIC_ADS_DEV_PREVIEW   === 'true'
                    && process.env.NODE_ENV                    === 'development';

// ---------------------------------------------------------------------------
// Dimensions per variant
// ---------------------------------------------------------------------------

interface SlotDimensions {
  /** CSS style for the <ins> element. */
  insStyle:   React.CSSProperties;
  /** Tailwind class for the wrapper min-height — prevents CLS. */
  minH:       string;
  /** AdSense format string. */
  format:     string;
  /** Whether data-full-width-responsive should be true. */
  responsive: boolean;
}

function dimensions(variant: AdVariant): SlotDimensions {
  switch (variant) {
    case 'leaderboard':
      return {
        insStyle:   { display: 'inline-block', width: 728, height: 90 },
        minH:       'min-h-[90px]',
        format:     'horizontal',
        responsive: false,
      };
    case 'rectangle':
      return {
        insStyle:   { display: 'inline-block', width: 300, height: 250 },
        minH:       'min-h-[250px]',
        format:     'rectangle',
        responsive: false,
      };
    case 'banner':
      return {
        insStyle:   { display: 'block' },
        minH:       'min-h-[90px]',   // reserve minimum banner height
        format:     'horizontal',
        responsive: true,
      };
    case 'auto':
    default:
      return {
        insStyle:   { display: 'block' },
        minH:       'min-h-[90px]',
        format:     'auto',
        responsive: true,
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdSlot({
  slotId    = '',
  variant   = 'auto',
  className = '',
  label     = 'Advertisement',
}: AdSlotProps) {
  const dim = dimensions(variant);

  // ── Real ads (ADS_ENABLED=true + publisher ID set) ────────────────────────
  if (ADS_ENABLED && slotId) {
    return (
      <div
        // min-height reserves space before the ad creative loads → no CLS.
        className={`text-center overflow-hidden ${dim.minH} ${className}`}
        aria-label={label}
        role="complementary"
      >
        <AdSlotClient
          publisherId={ADSENSE_ID}
          slotId={slotId}
          format={dim.format}
          responsive={dim.responsive}
          style={dim.insStyle}
        />
      </div>
    );
  }

  // ── Development preview (DEV_PREVIEW=true, NODE_ENV=development only) ─────
  if (DEV_PREVIEW) {
    const w = typeof dim.insStyle.width  === 'number' ? `${dim.insStyle.width}px`  : '100%';
    const h = typeof dim.insStyle.height === 'number' ? `${dim.insStyle.height}px` : '90px';

    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40 text-gray-600 text-xs font-mono ${dim.minH} ${className}`}
        style={{ width: w, height: h, maxWidth: '100%', margin: '0 auto' }}
        aria-hidden="true"
        role="presentation"
      >
        Ad · {variant}{slotId ? ` · ${slotId}` : ''}
      </div>
    );
  }

  // ── Disabled (default) — renders nothing, zero layout impact ─────────────
  return null;
}
