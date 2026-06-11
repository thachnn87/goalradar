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

export default function MatchNavTelemetry({ matchId }: { matchId: string }) {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(NAV_STAMP_KEY);
      if (!raw) return;
      sessionStorage.removeItem(NAV_STAMP_KEY); // one-shot
      const { id, t } = JSON.parse(raw) as { id: string; t: number };
      if (String(id) !== String(matchId)) return;            // navigated elsewhere first
      const clickToRenderMs = Date.now() - t;
      if (clickToRenderMs < 0 || clickToRenderMs > 60_000) return; // stale stamp
      const payload = JSON.stringify({ clickToRenderMs });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/telemetry/navigation', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/telemetry/navigation', { method: 'POST', body: payload, keepalive: true }).catch(() => undefined);
      }
    } catch {
      // telemetry is best-effort
    }
  }, [matchId]);

  return null;
}
