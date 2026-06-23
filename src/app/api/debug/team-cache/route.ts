/**
 * GET /api/debug/team-cache
 *
 * DATA-18TEAM.1B — read-only team cache + warming audit.
 *
 * For a set of target team ids (default Argentina/France/Brazil/Spain/Germany,
 * or ?id=762,773,...) reports, WITHOUT writing anything to KV:
 *   - team KV entry goalradar:/teams/{id}: exists / age / freshUntil / ttl / name
 *   - direct provider probe providerManager.getTeam(id): ok / name / error
 *
 * Plus global signals:
 *   - rate-safe mode (goalradar:rate-safe:active)
 *   - extractTeamIdsFromStandings(): count + sample (what Phase 4 would warm)
 *   - coverage: how many extracted team ids actually have a KV entry (ttl > 0)
 *
 * Side-effect-free: only kv.get / kv.ttl reads + provider reads. Does NOT call
 * getTeamCached()/withKVCache(), so it never warms KV and never masks the bug.
 *
 * Auth: CRON_SECRET (Bearer or ?secret=) or NODE_ENV=development.
 *
 * Usage:
 *   curl "https://www.goalradar.org/api/debug/team-cache?secret=$CRON_SECRET"
 *   curl "https://www.goalradar.org/api/debug/team-cache?secret=$CRON_SECRET&id=762&coverage=1"
 */

import { NextRequest, NextResponse }       from 'next/server';
import { kv }                              from '@vercel/kv';
import { providerManager }                 from '@/lib/providers/manager';
import { extractTeamIdsFromStandings }     from '@/lib/refresh';
import { RATE_SAFE_KV_KEY }                from '@/lib/rate-safe';
import type { TeamDetail }                 from '@/lib/types';

export const dynamic     = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get('secret') === secret;
}

interface KVEntry<T> {
  data?:       T;
  fetchedAt?:  number;
  freshUntil?: number;
}

const DEFAULT_IDS = [762, 773, 764, 760, 759]; // Argentina, France, Brazil, Spain, Germany
const NAMES: Record<number, string> = {
  762: 'Argentina', 773: 'France', 764: 'Brazil', 760: 'Spain', 759: 'Germany',
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url       = new URL(req.url);
  const idsParam  = url.searchParams.get('id');
  const doCoverage = url.searchParams.get('coverage') === '1';
  const targetIds = idsParam
    ? idsParam.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n > 0)
    : DEFAULT_IDS;

  const now       = Date.now();
  const checkedAt = new Date(now).toISOString();

  // ── 1. Rate-safe mode ───────────────────────────────────────────────────────
  let rateSafe: { active: boolean; detail: unknown } = { active: false, detail: null };
  try {
    const rs = await kv.get<{ reason?: string; expiresAt?: number }>(RATE_SAFE_KV_KEY);
    rateSafe = { active: rs != null && (rs.expiresAt == null || rs.expiresAt > now), detail: rs };
  } catch (err) {
    rateSafe = { active: false, detail: `read error: ${err instanceof Error ? err.message : String(err)}` };
  }

  // ── 2. Per-team KV + provider probe ──────────────────────────────────────────
  const teams = await Promise.all(targetIds.map(async (id) => {
    const key = `goalradar:/teams/${id}`;

    // KV (read-only)
    let kvExists = false, kvName: string | null = null;
    let fetchedAt: string | null = null, freshUntil: string | null = null;
    let ageSec: number | null = null, ttlSec: number | null = null, kvError: string | null = null;
    try {
      const [entry, ttl] = await Promise.all([kv.get<KVEntry<TeamDetail>>(key), kv.ttl(key)]);
      ttlSec = typeof ttl === 'number' ? ttl : null;
      if (entry) {
        kvExists = true;
        kvName = entry.data?.name ?? null;
        if (typeof entry.fetchedAt === 'number') { fetchedAt = new Date(entry.fetchedAt).toISOString(); ageSec = Math.round((now - entry.fetchedAt) / 1000); }
        if (typeof entry.freshUntil === 'number') freshUntil = new Date(entry.freshUntil).toISOString();
      }
    } catch (err) {
      kvError = err instanceof Error ? err.message : String(err);
    }

    // Direct provider probe (no KV write)
    let providerOk = false, providerName: string | null = null, providerError: string | null = null;
    try {
      const t = await providerManager.getTeam(String(id));
      providerOk = true;
      providerName = t?.name ?? null;
    } catch (err) {
      providerError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }

    // What getTeamCached() would return right now (read-only replication):
    //   KV hit → team; KV miss + rate-safe → would still call provider via
    //   withKVCache (rate-safe does NOT gate withKVCache), so renderWouldBe
    //   reflects KV-or-provider.
    const renderWouldBe =
      kvExists ? 'TEAM (from KV)'
      : providerOk ? 'TEAM (from provider on miss)'
      : 'NULL → "Team Data Unavailable"';

    return {
      id, expected: NAMES[id] ?? '(unknown)',
      url: `/teams/${id}-${(NAMES[id] ?? '').toLowerCase()}`,
      kv: { key, exists: kvExists, name: kvName, fetchedAt, freshUntil, ageSec, ttlSec, error: kvError },
      provider: { ok: providerOk, name: providerName, error: providerError },
      renderWouldBe,
    };
  }));

  // ── 3. extractTeamIdsFromStandings + coverage ────────────────────────────────
  let extractedIds: number[] = [];
  let extractError: string | null = null;
  try {
    extractedIds = await extractTeamIdsFromStandings();
  } catch (err) {
    extractError = err instanceof Error ? err.message : String(err);
  }

  let coverage: {
    standingsTeamCount: number; cachedCount: number; missingCount: number;
    coveragePct: number; sampleMissing: number[];
  } | null = null;

  if (doCoverage && extractedIds.length > 0) {
    const ttls = await Promise.allSettled(extractedIds.map((id) => kv.ttl(`goalradar:/teams/${id}`)));
    const missing: number[] = [];
    let cached = 0;
    ttls.forEach((r, i) => {
      const ttl = r.status === 'fulfilled' ? r.value : -2;
      if (typeof ttl === 'number' && ttl > 0) cached++;
      else missing.push(extractedIds[i]);
    });
    coverage = {
      standingsTeamCount: extractedIds.length,
      cachedCount: cached,
      missingCount: missing.length,
      coveragePct: Math.round((cached / extractedIds.length) * 1000) / 10,
      sampleMissing: missing.slice(0, 20),
    };
  }

  const allTargetsNull = teams.every((t) => t.renderWouldBe.startsWith('NULL'));
  const allKvMissing   = teams.every((t) => !t.kv.exists);
  const anyProviderOk  = teams.some((t) => t.provider.ok);

  return NextResponse.json(
    {
      checkedAt,
      rateSafe,
      teams,
      extract: { count: extractedIds.length, sample: extractedIds.slice(0, 15), error: extractError },
      coverage,
      diagnosis: {
        allTargetsRenderNull: allTargetsNull,
        allTargetKvMissing:   allKvMissing,
        anyProviderReachable: anyProviderOk,
        likelyLayer:
          allKvMissing && anyProviderOk
            ? 'KV never written (warming not populating) — provider works, so read-path miss should self-heal unless reader short-circuits'
            : allKvMissing && !anyProviderOk
              ? 'Provider failing AND KV empty — provider layer'
              : !allKvMissing
                ? 'KV present for some — investigate reader/render path'
                : 'inconclusive — see per-team detail',
      },
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
