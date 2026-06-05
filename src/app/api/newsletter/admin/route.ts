/**
 * GET /api/newsletter/admin
 *
 * Admin export endpoint for newsletter subscribers.
 *
 * Authentication: Bearer token in Authorization header
 *   Authorization: Bearer <ADMIN_SECRET>
 *
 * Query params:
 *   ?format=json (default) | csv
 *   ?confirmed=true        — confirmed subscribers only (default: all)
 *   ?limit=1000            — max rows (capped at 5000)
 *   ?offset=0              — pagination offset
 *   ?include_fallback=true — also include KV fallback leads (default: true)
 *
 * Required env vars:
 *   ADMIN_SECRET   — a strong random secret (set in Vercel environment variables)
 *   POSTGRES_URL   — Vercel Postgres connection string (optional — shows KV-only if absent)
 *
 * Example usage:
 *   curl -H "Authorization: Bearer <your-secret>" \
 *        "https://goalradar.org/api/newsletter/admin?format=csv&confirmed=true"
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getSubscribers, DB_AVAILABLE, type SubscriberRow } from '@/lib/db';

const KV_FALLBACK_SET  = 'newsletter:fallback:leads';
const KV_FALLBACK_META = 'newsletter:fallback:meta';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false; // No secret set → always deny

  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// KV fallback leads
// ---------------------------------------------------------------------------

interface FallbackLead {
  email: string;
  source: string | null;
  captured_at: string | null;
  fallback: true;
}

async function getKVLeads(): Promise<FallbackLead[]> {
  try {
    const emails = (await kv.smembers(KV_FALLBACK_SET)) as string[];
    if (!emails.length) return [];

    const rawMeta = emails.length > 0
      ? await kv.hmget(KV_FALLBACK_META, ...emails)
      : {};
    const meta: (string | null)[] = emails.map((e) =>
      rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
        ? ((rawMeta as Record<string, unknown>)[e] as string | null) ?? null
        : null
    );

    return emails.map((email, i) => {
      let source: string | null = null;
      let ts: number | null = null;

      try {
        const m = meta[i] ? JSON.parse(meta[i] as string) : null;
        source = m?.source ?? null;
        ts     = m?.ts     ?? null;
      } catch { /* ignore parse errors */ }

      return {
        email,
        source,
        captured_at: ts ? new Date(ts).toISOString() : null,
        fallback: true as const,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// CSV serialiser
// ---------------------------------------------------------------------------

function toCSV(
  dbRows: SubscriberRow[],
  fallbackLeads: FallbackLead[],
): string {
  const lines: string[] = [
    'id,email,confirmed,confirmed_at,source,created_at,fallback',
  ];

  for (const r of dbRows) {
    lines.push([
      r.id,
      `"${r.email}"`,
      r.confirmed,
      r.confirmed_at ? new Date(r.confirmed_at).toISOString() : '',
      r.source ? `"${r.source}"` : '',
      new Date(r.created_at).toISOString(),
      'false',
    ].join(','));
  }

  for (const l of fallbackLeads) {
    lines.push([
      '',
      `"${l.email}"`,
      'false',
      '',
      l.source ? `"${l.source}"` : '',
      l.captured_at ?? '',
      'true',
    ].join(','));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format          = searchParams.get('format') ?? 'json';
  const confirmedOnly   = searchParams.get('confirmed') === 'true';
  const limit           = Math.min(parseInt(searchParams.get('limit')  ?? '1000', 10), 5000);
  const offset          = parseInt(searchParams.get('offset') ?? '0', 10);
  const includeFallback = searchParams.get('include_fallback') !== 'false';

  // Fetch Postgres rows
  let dbRows:    SubscriberRow[] = [];
  let dbTotal    = 0;
  let dbError: string | null = null;

  if (DB_AVAILABLE) {
    try {
      const result = await getSubscribers({ confirmedOnly, limit, offset });
      dbRows  = result.rows;
      dbTotal = result.total;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  // Fetch KV fallback leads
  let fallbackLeads: FallbackLead[] = [];
  if (includeFallback) {
    fallbackLeads = await getKVLeads();

    // If confirmedOnly is requested, skip fallback leads (they haven't confirmed)
    if (confirmedOnly) fallbackLeads = [];
  }

  // Response
  if (format === 'csv') {
    const csv = toCSV(dbRows, fallbackLeads);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="goalradar-subscribers-${Date.now()}.csv"`,
        'Cache-Control':       'no-store',
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      db: {
        available: DB_AVAILABLE,
        error: dbError,
        total: dbTotal,
        returned: dbRows.length,
        rows: dbRows,
      },
      fallback: {
        count: fallbackLeads.length,
        leads: fallbackLeads,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
