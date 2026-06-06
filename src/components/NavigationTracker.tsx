'use client';

/**
 * NavigationTracker
 *
 * Fires a GA4 page_view event on every client-side route change in the
 * Next.js App Router.
 *
 * GA4's `send_page_view: true` config handles the initial hard navigation.
 * This component handles subsequent SPA navigations where the browser does
 * not reload — without it, only the first page load is tracked.
 *
 * Renders null — zero layout impact, no DOM output.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

export default function NavigationTracker() {
  const pathname    = usePathname();
  const initialized = useRef(false);

  useEffect(() => {
    // Skip the very first mount: GA4 `send_page_view: true` already fires
    // a page_view for the initial hard load. Only fire on subsequent changes.
    if (!initialized.current) {
      initialized.current = true;
      return;
    }

    // Pathname changed — fire page_view with full URL + current document title.
    // document.title may still reflect the previous page at this exact moment
    // in some cases; requestAnimationFrame defers until the title settles.
    requestAnimationFrame(() => {
      trackPageView(window.location.href, document.title);
    });
  }, [pathname]);

  return null;
}
