/**
 * MatchNavTelemetry — PERF-8 Phase 4 (client)
 *
 * Rendered by /match/[id]. On mount (≈ first content visible — this component
 * hydrates with the page content), it reads the click timestamp stamped by
 * MatchLink in sessionStorage, computes clickToRenderMs, and beacons it to
 * /api/telemetry/navigation. Stale or mismatched stamps (direct visits,
 * back/forward, different match) are discarded.
 */

'use client';

import { useEffect } from 'react';
import { NAV_STAMP_KEY } from '@/components/MatchLink';

function sendPayload(payload: Record<string, number>): void {
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/telemetry/navigation', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/telemetry/navigation', { method: 'POST', body, keepalive: true }).catch(() => undefined);
  }
}

export default function MatchNavTelemetry({ matchId }: { matchId: string }) {
  useEffect(() => {
    try {
      // PERF-11: hero render ≈ this component's hydration (it mounts with the
      // above-the-fold block); full render ≈ window load (all sections + ads).
      const heroMs = Math.round(performance.now());
      const onLoad = () => {
        try {
          sendPayload({ heroMs, fullMs: Math.round(performance.now()) });
        } catch { /* best-effort */ }
      };
      if (document.readyState === 'complete') onLoad();
      else window.addEventListener('load', onLoad, { once: true });

      const raw = sessionStorage.getItem(NAV_STAMP_KEY);
      if (!raw) return;
      sessionStorage.removeItem(NAV_STAMP_KEY); // one-shot
      const { id, t } = JSON.parse(raw) as { id: string; t: number };
      if (String(id) !== String(matchId)) return;            // navigated elsewhere first
      const clickToRenderMs = Date.now() - t;
      if (clickToRenderMs < 0 || clickToRenderMs > 60_000) return; // stale stamp
      sendPayload({ clickToRenderMs });
    } catch {
      // telemetry is best-effort
    }
  }, [matchId]);

  return null;
}
