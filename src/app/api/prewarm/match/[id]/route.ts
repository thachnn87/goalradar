/**
 * GET /api/prewarm/match/[id] — PERF-8 Phase 2
 *
 * Snapshot prewarm hint fired by the client on hover / touchstart / viewport
 * entry of a match card. Strictly KV-only: prewarmMatchSnapshotKVOnly has no
 * provider code path (PERF-7A invariant preserved). If both the snapshot and
 * the KV detail are missing, it does nothing — the eventual real page visit
 * handles the full-cold case under the cross-instance KV lock.
 *
 * Response is intentionally tiny and cacheable for 30 s at the edge so a
 * burst of identical hints (many users hovering the same featured match)
 * collapses to one function invocation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prewarmMatchSnapshotKVOnly } from '@/lib/match-snapshot';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = id.match(/^\d+/)?.[0];

  if (!numericId) {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }

  try {
    const status = await prewarmMatchSnapshotKVOnly(numericId);
    return NextResponse.json(
      { status },
      { headers: { 'Cache-Control': 'public, s-maxage=30, max-age=30' } },
    );
  } catch {
    // Prewarm is best-effort — never surface errors to the client.
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
