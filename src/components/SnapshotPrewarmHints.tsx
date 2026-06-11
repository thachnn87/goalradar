/**
 * SnapshotPrewarmHints — PERF-8 Phase 3
 *
 * Server pages pass the first N (≤10) visible match IDs; on browser idle the
 * client queues KV-only snapshot prewarm hints for them, so the snapshots
 * (and the edge-cached prewarm responses) exist before the user clicks any
 * card. Renders nothing. Never touches providers — the prewarm endpoint is
 * structurally KV-only.
 */

'use client';

import { useEffect } from 'react';
import { prewarmMatchesOnIdle } from '@/lib/match-prewarm';

export default function SnapshotPrewarmHints({ ids }: { ids: Array<number | string> }) {
  useEffect(() => {
    if (ids.length > 0) prewarmMatchesOnIdle(ids, 10);
    // ids are render-stable per page load; join keeps the dep primitive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.map(String).join(',')]);

  return null;
}
