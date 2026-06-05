/**
 * AffiliateBlock — reusable affiliate partner card.
 *
 * Pass a real `url` to display the block. Pass `url="#"` (or omit) for a
 * placeholder that renders nothing — keeping the page clean until an
 * affiliate deal is in place.
 *
 * Usage:
 *   <AffiliateBlock
 *     title="Fubo TV"
 *     description="Stream every World Cup 2026 match. 7-day free trial."
 *     cta="Start Free Trial"
 *     url="https://fubo.tv/?ref=goalradar"
 *     tag="fubo-wc2026"
 *   />
 */

export interface AffiliateBlockProps {
  /** Partner / product name shown as the card heading. */
  title: string;
  /** One-line description of the offer or product. */
  description: string;
  /** Button label, e.g. "Start Free Trial" or "Watch Now". */
  cta: string;
  /**
   * Destination URL.
   * Pass "#" or omit to render nothing (placeholder / not-yet-active).
   */
  url?: string;
  /** Optional tracking tag written to data-affiliate-tag. */
  tag?: string;
  /** Optional accent variant — defaults to yellow (WC gold theme). */
  variant?: 'yellow' | 'green' | 'blue';
  /** Extra wrapper classes, e.g. "my-6". */
  className?: string;
}

const VARIANTS = {
  yellow: {
    border:  'border-yellow-800/30',
    bg:      'from-yellow-950/30 to-gray-900',
    badge:   'text-yellow-400',
    button:  'bg-yellow-500 hover:bg-yellow-400 text-black',
  },
  green: {
    border:  'border-green-800/30',
    bg:      'from-green-950/30 to-gray-900',
    badge:   'text-green-400',
    button:  'bg-green-500 hover:bg-green-400 text-white',
  },
  blue: {
    border:  'border-blue-800/30',
    bg:      'from-blue-950/30 to-gray-900',
    badge:   'text-blue-400',
    button:  'bg-blue-500 hover:bg-blue-400 text-white',
  },
} as const;

export default function AffiliateBlock({
  title,
  description,
  cta,
  url,
  tag,
  variant = 'yellow',
  className = '',
}: AffiliateBlockProps) {
  // Render nothing when url is not set or is a placeholder.
  if (!url || url === '#') return null;

  const v = VARIANTS[variant];

  return (
    <div
      className={`bg-gradient-to-br ${v.bg} border ${v.border} rounded-2xl p-5 ${className}`}
      aria-label={`Affiliate: ${title}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${v.badge}`}>
            Partner offer
          </p>
          <p className="text-white font-bold text-base leading-tight">{title}</p>
          <p className="text-gray-400 text-sm mt-1 leading-relaxed">{description}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          data-affiliate-tag={tag}
          className={`${v.button} px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0 text-center`}
        >
          {cta} →
        </a>
      </div>
    </div>
  );
}
