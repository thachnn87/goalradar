/**
 * AdSlot — canonical reusable AdSense placeholder component.
 * Canonical path: src/components/ads/AdSlot.tsx
 * Legacy shim:    src/components/AdSlot.tsx  (re-exports this module)
 *
 * ─── Activation ─────────────────────────────────────────────────────────────
 * Disabled by default. Enable via Vercel environment variables:
 *
 *   NEXT_PUBLIC_ADS_ENABLED=true
 *   NEXT_PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXX   ← publisher ID, never hardcoded
 *
 * ─── CLS prevention ─────────────────────────────────────────────────────────
 * The wrapper always reserves the slot's minimum height so the page layout
 * is stable before the ad creative arrives (Core Web Vitals / CLS = 0).
 *
 *   banner      → min-h-[90px]   responsive leaderboard
 *   rectangle   → min-h-[250px]  300×250 medium rectangle
 *   leaderboard → min-h-[90px]   728×90 fixed (hidden on mobile < 728 px)
 *   auto        → min-h-[90px]   fully responsive; AdSense picks the format
 *
 * ─── Lazy loading ───────────────────────────────────────────────────────────
 * AdSlotClient fires the AdSense push() only when the <ins> element enters
 * the viewport (+200 px root margin) via IntersectionObserver.
 *
 * ─── Dev preview ────────────────────────────────────────────────────────────
 * Set NEXT_PUBLIC_ADS_DEV_PREVIEW=true (development only) to render labelled
 * dashed-border placeholder boxes without a live AdSense account.
 *
 * ─── Slot ID reference ──────────────────────────────────────────────────────
 * Page            Slot ID                  Variant
 * ──────────────  ───────────────────────  ──────────
 * Home (top)      homepage-top             banner
 * Home (mid)      homepage-mid             rectangle
 * Schedule (top)  schedule-top             banner
 * Schedule (mid)  schedule-mid             rectangle
 * Schedule (bot)  schedule-bottom          banner
 * Standings (top) standings-top            banner
 * Standings (bot) standings-bottom         banner
 * Match (top)     match-top                banner
 * Match (mid)     match-mid                rectangle
 * Match (bot)     match-bottom             banner
 * Live (top)      live-top                 banner
 * Live (bot)      live-bottom              banner
 */

import AdSlotClient from './AdSlotClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdVariant =
  | 'banner'       // responsive leaderboard — top / bottom of page sections
  | 'rectangle'    // 300×250 medium rectangle — between content sections
  | 'leaderboard'  // 728×90 fixed width — desktop-only page header
  | 'auto';        // fully responsive — AdSense picks the best format

export interface AdSlotProps {
  /**
   * AdSense ad unit slot ID (numeric string, e.g. "1234567890").
   * Required for live ads; optional for dev-preview / placeholder mode.
   */
  slotId?: string;
  variant?: AdVariant;
  /** Additional Tailwind classes applied to the outer wrapper, e.g. "my-6". */
  className?: string;
  /** Accessible label for the complementary landmark. */
  label?: string;
}

// ─── Environment flags (resolved at build time on the server) ────────────────

const ADSENSE_ID  = process.env.NEXT_PUBLIC_ADSENSE_ID      ?? '';
const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED     === 'true' && ADSENSE_ID !== '';
const DEV_PREVIEW = process.env.NEXT_PUBLIC_ADS_DEV_PREVIEW === 'true'
                    && process.env.NODE_ENV                  === 'development';

// ─── Per-variant dimensions ───────────────────────────────────────────────────

interface SlotDimensions {
  insStyle:   React.CSSProperties; // applied to the <ins> element
  minH:       string;              // Tailwind min-height — prevents CLS
  format:     string;              // data-ad-format value
  responsive: boolean;             // data-full-width-responsive value
  /** Tailwind class to hide the slot on screens narrower than the fixed width. */
  hideBelow?: string;
}

function dimensions(variant: AdVariant): SlotDimensions {
  switch (variant) {
    case 'leaderboard':
      return {
        insStyle:   { display: 'inline-block', width: 728, height: 90 },
        minH:       'min-h-[90px]',
        format:     'horizontal',
        responsive: false,
        hideBelow:  'hidden sm:block', // 728 px leaderboard is pointless on mobile
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
        minH:       'min-h-[90px]',
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdSlot({
  slotId    = '',
  variant   = 'auto',
  className = '',
  label     = 'Advertisement',
}: AdSlotProps) {
  const dim = dimensions(variant);

  // ── 1. Real ads: ADS_ENABLED + publisher ID present ─────────────────────
  if (ADS_ENABLED && slotId) {
    return (
      <div
        // min-height is set even before the creative loads → CLS = 0.
        className={[
          'text-center overflow-hidden',
          dim.minH,
          dim.hideBelow ?? '',
          className,
        ].filter(Boolean).join(' ')}
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

  // ── 2. Dev preview: labelled placeholder boxes (development only) ────────
  if (DEV_PREVIEW) {
    const w = typeof dim.insStyle.width  === 'number' ? `${dim.insStyle.width}px`  : '100%';
    const h = typeof dim.insStyle.height === 'number' ? `${dim.insStyle.height}px` : '90px';

    return (
      <div
        className={[
          'flex items-center justify-center rounded-lg',
          'border border-dashed border-gray-700 bg-gray-900/40',
          'text-gray-600 text-xs font-mono select-none',
          dim.minH,
          dim.hideBelow ?? '',
          className,
        ].filter(Boolean).join(' ')}
        style={{ width: w, height: h, maxWidth: '100%', margin: '0 auto' }}
        aria-hidden="true"
        role="presentation"
      >
        Ad · {variant}{slotId ? ` · ${slotId}` : ''}
      </div>
    );
  }

  // ── 3. Disabled (default) — zero layout impact, no DOM node ─────────────
  return null;
}
