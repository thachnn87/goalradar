/**
 * WCRelatedLinks — "More World Cup 2026" contextual link grid.
 * Pass an array of { href, label, desc } to render a responsive card grid.
 * Typically placed near the bottom of WC content pages.
 *
 * SEO & accessibility
 * ───────────────────
 * Every card Link receives:
 *   title      — computed from label + desc; shown as tooltip and read by some
 *                crawlers as supplementary link context.
 *   aria-label — same full text; gives screen readers a complete description
 *                of the destination when the card's visible content is split
 *                across two <p> elements.
 *
 * The <section> is a proper landmark with aria-labelledby pointing to the
 * visible heading, so assistive technologies can navigate directly to it.
 *
 * Build-time / dev validation
 * ───────────────────────────
 * In development mode, each href is checked against the canonical route
 * registry in wc-nav-routes.ts.  An unrecognised href triggers a
 * console.warn so stale or mis-typed links are caught before deploy.
 * The check is a no-op in production (tree-shaken by the bundler).
 */

import Link from 'next/link';
import { isValidWCNavHref } from '@/lib/wc-nav-routes';

export interface WCRelatedLink {
  href:  string;
  label: string;
  desc:  string;
  icon?: string;
}

interface Props {
  links:    WCRelatedLink[];
  heading?: string;
  /** Override the generated section id (useful when multiple grids appear on one page). */
  sectionId?: string;
}

export default function WCRelatedLinks({
  links,
  heading   = 'More World Cup 2026',
  sectionId = 'wc-related-links',
}: Props) {
  if (!links.length) return null;

  // Dev-mode route validation — caught at render time, zero production cost.
  if (process.env.NODE_ENV === 'development') {
    for (const { href, label } of links) {
      if (!isValidWCNavHref(href)) {
        console.warn(
          `[WCRelatedLinks] unrecognised href "${href}" on card "${label}". ` +
          `Add it to src/lib/wc-nav-routes.ts if it is a valid new route.`,
        );
      }
    }
  }

  const headingId = `${sectionId}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-10 pt-8 border-t border-gray-800"
    >
      <h2
        id={headingId}
        className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4"
      >
        {heading}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {links.map(({ href, label, desc, icon }) => {
          // Full descriptive text used for both title tooltip and aria-label.
          // Gives crawlers and assistive tech a complete, self-contained
          // description of each link without relying on surrounding context.
          const fullDescription = `${label}: ${desc}`;

          return (
            <Link
              key={href}
              href={href}
              title={fullDescription}
              aria-label={fullDescription}
              className="group bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-yellow-700/40 rounded-xl p-4 transition-all"
            >
              {icon && (
                <span className="text-xl block mb-1.5" aria-hidden="true">
                  {icon}
                </span>
              )}
              <p className="text-white text-sm font-bold group-hover:text-yellow-400 transition-colors leading-tight mb-1">
                {label}
              </p>
              <p className="text-gray-500 text-xs leading-snug">{desc}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
