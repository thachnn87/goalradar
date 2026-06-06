/**
 * GET /api/cache-stats
 *
 * Returns current L1 (in-memory) and L2 (Vercel KV) cache hit ratio
 * statistics for the running process.
 *
 * Protected by CRON_SECRET — only accessible internally or from Vercel cron.
 *
 * Response fields:
 *   l1.hitRatio        — % of requests served from in-memory cache (fresh hits)
 *   l1.staleFallbacks  — # of times expired in-memory data was served on API error
 *   l2.hitRatio        — % of KV requests served fresh or stale (avoids blocking fetch)
 *   l2.disasters       — # of times the 7-day disaster key was used (API + KV both down)
 */

import { NextResponse } from 'next/server';
import { getCacheStats } from '@/lib/cache';
import { getKVCacheStats } from '@/lib/kv-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Simple bearer-token guard — same secret used by the cron refresh route.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const l1 = getCacheStats();
  const l2 = getKVCacheStats();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    l1: {
      hits:           l1.hits,
      misses:         l1.misses,
      staleFallbacks: l1.staleFallbacks,
      hitRatio:       `${l1.hitRatio}%`,
      storeSize:      l1.storeSize,
      inflightCount:  l1.inflightCount,
    },
    l2: {
      hits:          l2.hits,
      stale:         l2.stale,
      misses:        l2.misses,
      disasters:     l2.disasters,
      hitRatio:      `${l2.hitRatio}%`,
      kvEnabled:     l2.kvEnabled,
    },
    combined: {
      totalRequests:    l1.hits + l1.misses,
      servedFromCache:  l1.hits + l1.staleFallbacks,
      networkCalls:     l1.misses,
    },
  });
}
