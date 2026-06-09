/**
 * GET /api/debug/provider-switch
 *
 * Returns the current provider routing configuration: which provider is
 * primary, which is the emergency fallback, and whether api-football is
 * enabled for automatic failover.
 *
 * Use this endpoint to confirm that ENABLE_API_FOOTBALL=false is taking
 * effect without restarting the process.
 *
 * Protected by ADMIN_SECRET (Bearer token).  Fails closed.
 *
 * Response shape:
 *   {
 *     "primary":            "football-data",
 *     "emergencyProvider":  "api-football",
 *     "apiFootballEnabled": false,
 *     "fallbackOrder":      ["football-data", "kv", "dr-snapshot", "static-wc"],
 *     "note":               "...",
 *     "generatedAt":        "2026-06-09T..."
 *   }
 *
 * Usage:
 *   curl -s -H "Authorization: Bearer <ADMIN_SECRET>" \
 *        https://goalradar.org/api/debug/provider-switch | jq
 */

import { NextRequest, NextResponse } from 'next/server';
import { providerManager }           from '@/lib/providers/manager';
import { getRateSafeState }          from '@/lib/rate-safe';

export const dynamic = 'force-dynamic';

// ─── auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth   = req.headers.get('authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return bearer === secret;
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot           = providerManager.getDebugSnapshot();
  const apiFootballEnabled = snapshot.apiFootballEnabled;

  const fallbackOrder = apiFootballEnabled
    ? ['football-data', 'api-football', 'kv', 'dr-snapshot', 'static-wc']
    : ['football-data', 'kv', 'dr-snapshot', 'static-wc'];

  const note = apiFootballEnabled
    ? 'api-football is active as automatic failover. Set ENABLE_API_FOOTBALL=false to remove it from the normal request path.'
    : 'api-football is DISABLED (ENABLE_API_FOOTBALL=false). Only use FORCE_PROVIDER=api-football for emergency manual override.';

  const rsState = getRateSafeState();

  return NextResponse.json({
    primary:            'football-data',
    emergencyProvider:  'api-football',
    apiFootballEnabled,
    fallbackOrder,
    note,
    footballDataConfigured: snapshot.footballDataConfigured,
    apiFootballConfigured:  snapshot.apiFootballConfigured,
    rateSafeMode: rsState
      ? {
          active:       true,
          reason:       rsState.reason,
          enabledAt:    new Date(rsState.enabledAt).toISOString(),
          expiresAt:    new Date(rsState.expiresAt).toISOString(),
          expiresInSec: Math.max(0, Math.round((rsState.expiresAt - Date.now()) / 1000)),
        }
      : { active: false },
    generatedAt: new Date().toISOString(),
  });
}
