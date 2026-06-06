/**
 * GET /api/debug/kv
 *
 * Production KV verification endpoint.
 * Runs five checks and returns a structured JSON report:
 *
 *   1. ping          — round-trip latency to Upstash Redis
 *   2. dbsize        — total key count in the Redis instance
 *   3. scan          — up to 20 most-recently-set goalradar:* keys with their TTL
 *   4. read/write    — ephemeral set → get → del cycle on a canary key
 *   5. known entries — spot-check of the 5 most important KV cache keys
 *
 * Protected by ADMIN_SECRET (Bearer token).
 * Fails closed: if ADMIN_SECRET is not set, all requests are denied.
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/kv | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

// ─── auth ────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // fail closed — no secret = no access
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

// ─── types ───────────────────────────────────────────────────────────────────

interface CheckResult<T> {
  ok:       boolean;
  data?:    T;
  error?:   string;
  latencyMs: number;
}

interface KVKeyInfo {
  key:      string;
  ttlSec:   number | null; // -1 = no expiry, -2 = key gone, null = error
  fetchedAt?: string;       // ISO string from stored KVEntry if readable
  freshUntil?: string;      // ISO string from stored KVEntry if readable
}

interface KVEntry {
  fetchedAt:  number;
  freshUntil: number;
  data?:      unknown;
}

// ─── known keys to spot-check ────────────────────────────────────────────────

const today   = () => new Date().toISOString().split('T')[0];
const from30  = () => new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0];

function knownKeys(): Array<{ label: string; key: string }> {
  const t = today();
  const f = from30();
  return [
    { label: 'WC Upcoming',      key: 'goalradar:/competitions/WC/matches?status=SCHEDULED,TIMED'                      },
    { label: 'WC All Matches',   key: 'goalradar:/competitions/WC/matches'                                             },
    { label: 'WC Standings',     key: 'goalradar:/competitions/WC/standings'                                           },
    { label: 'WC Recent (30d)',  key: `goalradar:/competitions/WC/matches?dateFrom=${f}&dateTo=${t}`                   },
    { label: 'PL Standings',     key: 'goalradar:/competitions/PL/standings'                                           },
  ];
}

// ─── individual checks ───────────────────────────────────────────────────────

async function checkPing(): Promise<CheckResult<string>> {
  const t0 = Date.now();
  try {
    const result = await kv.ping();
    return { ok: true, data: result, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkDbsize(): Promise<CheckResult<number>> {
  const t0 = Date.now();
  try {
    const size = await kv.dbsize();
    return { ok: true, data: size, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkScan(): Promise<CheckResult<KVKeyInfo[]>> {
  const t0 = Date.now();
  try {
    // SCAN for goalradar:* keys (excludes disaster-recovery keys goalradar:dr:*)
    // COUNT is a hint to Redis — actual batch size may vary.
    const [, keys] = await kv.scan(0, { match: 'goalradar:[^d]*', count: 100 });

    // Also scan for disaster keys separately
    const [, drKeys] = await kv.scan(0, { match: 'goalradar:dr:*', count: 100 });

    const allKeys = [...new Set([...keys, ...drKeys])].slice(0, 20);

    // Fetch TTL for each key in parallel
    const ttls = await Promise.allSettled(allKeys.map((k) => kv.ttl(k)));

    // Fetch entry metadata (fetchedAt, freshUntil) for non-DR keys
    const entries = await Promise.allSettled(
      allKeys.map((k) => k.startsWith('goalradar:dr:') ? Promise.resolve(null) : kv.get<KVEntry>(k)),
    );

    const info: KVKeyInfo[] = allKeys.map((key, i) => {
      const ttlResult = ttls[i];
      const entryResult = entries[i];

      const ttlSec = ttlResult.status === 'fulfilled' ? ttlResult.value : null;

      const row: KVKeyInfo = { key, ttlSec };

      if (entryResult.status === 'fulfilled' && entryResult.value) {
        const e = entryResult.value;
        if (typeof e.fetchedAt  === 'number') row.fetchedAt  = new Date(e.fetchedAt).toISOString();
        if (typeof e.freshUntil === 'number') row.freshUntil = new Date(e.freshUntil).toISOString();
      }

      return row;
    });

    return { ok: true, data: info, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkReadWrite(): Promise<CheckResult<{ written: string; read: string; deleted: boolean; matched: boolean }>> {
  const t0 = Date.now();
  const canaryKey = `goalradar:debug:canary:${Date.now()}`;
  const canaryVal = `ping-${Math.random().toString(36).slice(2)}`;

  try {
    await kv.set(canaryKey, canaryVal, { ex: 30 }); // auto-expires in 30s
    const read = await kv.get<string>(canaryKey);
    await kv.del(canaryKey);

    return {
      ok:   read === canaryVal,
      data: {
        written: canaryVal,
        read:    read ?? '(null)',
        deleted: true,
        matched: read === canaryVal,
      },
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    // Best-effort cleanup
    await kv.del(canaryKey).catch(() => undefined);
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 };
  }
}

async function checkKnownKeys(): Promise<CheckResult<Array<{
  label:      string;
  key:        string;
  exists:     boolean;
  status:     'FRESH' | 'STALE' | 'MISSING' | 'ERROR';
  fetchedAt?:  string;
  freshUntil?: string;
  ttlSec?:    number;
}>>> {
  const t0  = Date.now();
  const now = Date.now();
  const keys = knownKeys();

  try {
    const [entries, ttls] = await Promise.all([
      Promise.allSettled(keys.map((k) => kv.get<KVEntry>(k.key))),
      Promise.allSettled(keys.map((k) => kv.ttl(k.key))),
    ]);

    const data = keys.map((k, i) => {
      const entryResult = entries[i];
      const ttlResult   = ttls[i];

      if (entryResult.status === 'rejected') {
        return { label: k.label, key: k.key, exists: false, status: 'ERROR' as const };
      }

      const entry  = entryResult.value;
      const ttlSec = ttlResult.status === 'fulfilled' ? ttlResult.value : undefined;

      if (!entry) {
        return { label: k.label, key: k.key, exists: false, status: 'MISSING' as const, ttlSec };
      }

      const isFresh = typeof entry.freshUntil === 'number' && entry.freshUntil > now;

      return {
        label:      k.label,
        key:        k.key,
        exists:     true,
        status:     (isFresh ? 'FRESH' : 'STALE') as 'FRESH' | 'STALE',
        fetchedAt:  typeof entry.fetchedAt  === 'number' ? new Date(entry.fetchedAt).toISOString()  : undefined,
        freshUntil: typeof entry.freshUntil === 'number' ? new Date(entry.freshUntil).toISOString() : undefined,
        ttlSec,
      };
    });

    return { ok: true, data, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: String(err), latencyMs: Date.now() - t0 };
  }
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  // Run all checks concurrently
  const [ping, dbsize, scan, readWrite, knownEntries] = await Promise.all([
    checkPing(),
    checkDbsize(),
    checkScan(),
    checkReadWrite(),
    checkKnownKeys(),
  ]);

  const allOk = ping.ok && dbsize.ok && readWrite.ok && knownEntries.ok;

  return NextResponse.json(
    {
      ok:          allOk,
      checkedAt:   new Date().toISOString(),
      totalMs:     Date.now() - start,
      checks: {
        ping,
        dbsize,
        scan,
        readWrite,
        knownEntries,
      },
    },
    {
      status:  allOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
