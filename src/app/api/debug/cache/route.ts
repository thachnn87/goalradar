/**
 * GET /api/debug/cache
 *
 * PERF-4.5 Phase 5 — Unified cache coverage dashboard.
 *
 * Reports:
 *   • L1 in-memory stats  (cache.ts)  — hits, misses, hit ratio, stale-fallbacks
 *   • L2 KV stats         (kv-cache.ts) — hits, stale, misses, coalesced, disasters
 *   • KV key probe        — freshness of 15 canonical page-render keys
 *   • Provider call count — from providerManager debug snapshot
 *   • Coalescing saves    — bg-revalidations prevented by global lock
 *
 * Protected by ADMIN_SECRET (Bearer token).
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/cache | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv }                         from '@vercel/kv';
import { getCacheStats }              from '@/lib/cache';
import { getKVCacheStats }            from '@/lib/kv-cache';
import { providerManager }            from '@/lib/providers/manager';

export const dynamic = 'force-dynamic';

// ─── auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── KV probe: check freshness of canonical page-render keys ──────────────────

interface KVEntry<T = unknown> {
  data:       T;
  fetchedAt:  number;
  freshUntil: number;
}

/**
 * Canonical KV keys that MUST be warm for zero-provider page rendering.
 * Each entry specifies the KV key suffix (after "goalradar:") and the
 * expected fresh TTL in seconds so we can report whether it's fresh/stale/miss.
 */
function buildProbeKeys(today: string, from: string): { label: string; key: string; freshSec: number }[] {
  return [
    // WC structural
    { label: 'wc-all-matches',   key: '/competitions/WC/matches',                                freshSec: 21600 },
    { label: 'wc-upcoming',      key: '/competitions/WC/matches?status=SCHEDULED,TIMED',          freshSec: 900   },
    { label: 'wc-finished',      key: '/competitions/WC/matches?status=FINISHED',                 freshSec: 900   },
    { label: 'wc-recent',        key: `/competitions/WC/matches?dateFrom=${from}&dateTo=${today}`, freshSec: 900   },
    { label: 'today-matches',    key: `/matches?dateFrom=${today}&dateTo=${today}`,                freshSec: 60    },
    { label: 'live-matches',     key: 'live:matches',                                             freshSec: 30    },
    // Standings
    { label: 'standings-wc',     key: '/competitions/WC/standings',   freshSec: 3600 },
    { label: 'standings-pl',     key: '/competitions/PL/standings',   freshSec: 3600 },
    { label: 'standings-pd',     key: '/competitions/PD/standings',   freshSec: 3600 },
    { label: 'standings-bl1',    key: '/competitions/BL1/standings',  freshSec: 3600 },
    { label: 'standings-sa',     key: '/competitions/SA/standings',   freshSec: 3600 },
    { label: 'standings-fl1',    key: '/competitions/FL1/standings',  freshSec: 3600 },
    { label: 'standings-cl',     key: '/competitions/CL/standings',   freshSec: 3600 },
  ];
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const KV_ENABLED =
    typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL   !== '' &&
    typeof process.env.KV_REST_API_TOKEN === 'string' && process.env.KV_REST_API_TOKEN !== '';

  const now   = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const from  = new Date(now - 30 * 86_400_000).toISOString().split('T')[0];

  // ── 1. In-process stats ────────────────────────────────────────────────────
  const l1Stats = getCacheStats();
  const kvStats = getKVCacheStats();

  // ── 2. Provider call stats ─────────────────────────────────────────────────
  let providerStats: Record<string, unknown> | null = null;
  try {
    providerStats = providerManager.getDebugSnapshot() as unknown as Record<string, unknown>;
  } catch {
    providerStats = { error: 'provider debug snapshot unavailable' };
  }

  // ── 3. KV key probe ────────────────────────────────────────────────────────
  const probeKeys = buildProbeKeys(today, from);
  let   probeResults: { label: string; key: string; status: string; ageSec?: number; staleSec?: number }[] = [];

  if (KV_ENABLED) {
    const kvKeys = probeKeys.map((p) => `goalradar:${p.key}`);
    let entries: (KVEntry | null)[] = [];
    try {
      entries = await kv.mget<(KVEntry | null)[]>(...kvKeys);
    } catch {
      entries = new Array(probeKeys.length).fill(null);
    }

    probeResults = probeKeys.map((probe, i) => {
      const entry = entries[i];
      if (!entry) return { label: probe.label, key: probe.key, status: 'MISS' };
      const ageSec   = Math.ceil((now - entry.fetchedAt) / 1000);
      const staleSec = Math.ceil((now - entry.freshUntil) / 1000);
      const status   = now < entry.freshUntil ? 'FRESH' : 'STALE';
      return { label: probe.label, key: probe.key, status, ageSec, staleSec: status === 'STALE' ? staleSec : undefined };
    });
  } else {
    probeResults = probeKeys.map((p) => ({ label: p.label, key: p.key, status: 'KV_DISABLED' }));
  }

  const freshCount  = probeResults.filter((r) => r.status === 'FRESH').length;
  const staleCount  = probeResults.filter((r) => r.status === 'STALE').length;
  const missCount   = probeResults.filter((r) => r.status === 'MISS').length;
  const coverage    = Math.round((freshCount / probeKeys.length) * 100);

  // ── 4. Summary ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    generatedAt:   new Date().toISOString(),
    summary: {
      kvKeysFresh:       freshCount,
      kvKeysStale:       staleCount,
      kvKeysMissing:     missCount,
      kvCoveragePct:     `${coverage}%`,
      l1HitRatio:        `${l1Stats.hitRatio}%`,
      kvHitRatio:        `${kvStats.hitRatio}%`,
      coalescingSaves:   kvStats.coalesced,
      providerCallsTotal: (() => {
        if (!providerStats) return 'n/a';
        const ps = providerStats as { providers?: { requestCount?: number }[] };
        return ps.providers?.reduce((s, p) => s + (p.requestCount ?? 0), 0) ?? 'n/a';
      })(),
    },
    l1: {
      hits:          l1Stats.hits,
      misses:        l1Stats.misses,
      staleFallbacks: l1Stats.staleFallbacks,
      hitRatio:      `${l1Stats.hitRatio}%`,
    },
    kv: {
      fresh:       kvStats.hits,
      stale:       kvStats.stale,
      misses:      kvStats.misses,
      disasters:   kvStats.disasters,
      coalesced:   kvStats.coalesced,
      hitRatio:    `${kvStats.hitRatio}%`,
      queueBypassed: kvStats.queueBypassed,
    },
    kvProbe: probeResults,
    provider: providerStats,
  });
}
