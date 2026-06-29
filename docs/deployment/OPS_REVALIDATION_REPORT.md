# OPS Revalidation Report
## GoalRadar · On-Demand ISR Revalidation Audit

Date: 2026-06-15
Scope: Does a revalidation endpoint exist? Can it be triggered for `/world-cup-2026/teams/italy` and `/world-cup-2026-schedule`?

---

## Overall Verdict: FAIL

No on-demand ISR revalidation endpoint exists in the codebase. The two legacy "refresh" routes are deprecated tombstones. Revalidation for the named paths **could not be triggered** programmatically. Pages with stale ISR caches will serve incorrect HTML until their TTLs expire or a new deployment is pushed.

---

## Audit Findings

### 1. Grep: `revalidatePath` / `revalidateTag` across all source

```
Pattern: revalidatePath|revalidateTag
Scope: src/ (all TypeScript files)
Result: 0 matches
```

No file in the repository calls `revalidatePath()` or `revalidateTag()`. There is no on-demand ISR handler anywhere.

---

### 2. Legacy "refresh" routes — deprecated tombstones

Both routes below exist only to redirect callers to the new orchestrator. Neither performs revalidation.

#### `GET /api/refresh/wc-fixtures`
```typescript
export async function GET() {
  return NextResponse.json({
    deprecated: true,
    message: 'Use /api/cron/orchestrator instead',
  }, { status: 410 });
}
```

#### `GET /api/refresh/standings`
```typescript
export async function GET() {
  return NextResponse.json({
    deprecated: true,
    message: 'Use /api/cron/orchestrator instead',
  }, { status: 410 });
}
```

**Verdict:** Both routes return HTTP 410 Gone. No `revalidatePath` / `revalidateTag` calls. Not usable for ISR revalidation.

---

### 3. Orchestrator (`/api/cron/orchestrator`) — data refresh only, no ISR

The orchestrator refreshes KV data (fixtures, standings, live matches) but does **not** call `revalidatePath()`. It updates what the Next.js data layer reads, but does not clear Vercel's HTML page cache. ISR-cached pages continue to serve stale HTML renders until their TTL expires.

---

### 4. All API routes checked

35 API route files scanned via Glob (`src/app/api/**/route.ts`). Selected:

| Route | Purpose | `revalidatePath`? |
|-------|---------|-------------------|
| `/api/cron/orchestrator` | Refreshes KV data | ❌ No |
| `/api/refresh/wc-fixtures` | Deprecated tombstone | ❌ No |
| `/api/refresh/standings` | Deprecated tombstone | ❌ No |
| `/api/live-score/[id]` | SSE live score stream | ❌ No |
| `/api/match/[id]` | Match detail | ❌ No |
| `/api/debug/*` | Debug/status endpoints | ❌ No |
| All others | Various | ❌ No |

**Total matches for `revalidatePath|revalidateTag`: 0 / 35 routes**

---

### 5. Trigger attempt result

| Path | Triggered? | Method | Outcome |
|------|-----------|--------|---------|
| `/world-cup-2026/teams/italy` | ❌ No | No endpoint exists | Stale ISR cache remains |
| `/world-cup-2026-schedule` | ❌ No | No endpoint exists | Stale pre-DATA-7 render remains |

---

## Stale Pages Inventory

Pages currently serving stale HTML (as of DATA-8 + hotfix `777dc3a` deploy):

| Page | TTL | Stale since | Issue |
|------|-----|-------------|-------|
| `/world-cup-2026/teams` | 86400s (24h) | DATA-8 deploy | "Group Group A" links → 404 (P0) |
| `/world-cup-2026-schedule` | 3600s (1h) | DATA-7 deploy | Fake fixtures (Mexico vs Spain, USA vs France, etc.) |
| `/world-cup-2026/teams/italy` | 3600s (1h) | DATA-7 / Italy FAQ fix | May have resolved within 1h post-deploy |
| All `/world-cup-2026/group-*` | 3600s (1h) | DATA-8 deploy | Empty standings / hotfix not yet rendered |
| All `/world-cup-2026/teams/[slug]` | 3600s (1h) | DATA-8 deploy | "Group Group A" badge / hotfix not yet rendered |

**Critical:** `/world-cup-2026/teams` has a 24-hour TTL — it will not auto-resolve until tomorrow and is actively serving broken group links that lead to 404s.

---

## Recommended Next Sprint: DATA-9

### Priority 1 — Immediate: Add `/api/revalidate` endpoint

Create an authenticated on-demand revalidation endpoint so stale pages can be cleared without waiting for TTL:

```typescript
// src/app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WC_PATHS = [
  '/world-cup-2026/teams',
  '/world-cup-2026-schedule',
  '/world-cup-2026-groups',
  '/world-cup-2026-standings',
  // Add group/team slugs as needed
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { paths }: { paths?: string[] } = await req.json().catch(() => ({}));
  const targets = paths ?? WC_PATHS;

  for (const path of targets) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: targets, timestamp: new Date().toISOString() });
}
```

Hook this into the orchestrator: after a successful standings/fixtures refresh, call `revalidatePath` for the affected pages.

### Priority 2 — Immediate: Trigger revalidation via Vercel dashboard

Until the endpoint exists, use Vercel's on-demand ISR UI:
1. Vercel Dashboard → Project → Deployments → active deployment
2. "Revalidate" tab → enter paths one by one:
   - `/world-cup-2026/teams` **(P0 — 24h TTL)**
   - `/world-cup-2026-schedule` **(P0 — fake fixtures)**
   - `/world-cup-2026-groups`
   - `/world-cup-2026-standings`
   - All `/world-cup-2026/group-*` (A–L)
   - All `/world-cup-2026/teams/[slug]` (affected by DATA-8 group badge bug)

### Priority 3 — Sprint: Reduce `/world-cup-2026/teams` TTL

Change `export const revalidate = 86400` → `export const revalidate = 3600` in `src/app/world-cup-2026/teams/page.tsx`.

24 hours is too long during a live tournament where group assignments are live data. A 1-hour TTL matches the standings pages and ensures group link corrections propagate within the hour.

### Priority 4 — Sprint: Dead code cleanup (DATA-9)

The following are fully orphaned after DATA-7 + DATA-8:

| File | Status |
|------|--------|
| `src/lib/wc-static-groups.ts` | No callers — safe to delete |
| `src/data/worldcup/fixtures.json` | No callers — safe to delete |
| `src/lib/wc-fixtures.ts` COMPACT array | No callers — safe to delete (keep file structure if other exports used) |

### Priority 5 — Sprint: API format smoke test

Add an integration assertion to the orchestrator or a separate health check:

```typescript
// assert getStandingsCached('WC') returns ≥1 table with a recognisable group string
const tables = standingsData.standings?.filter(s => s.type === 'TOTAL') ?? [];
const hasValidGroups = tables.every(t =>
  /^(GROUP_[A-L]|Group [A-L])$/.test(t.group ?? '')
);
if (!hasValidGroups) {
  console.error('[Health] WC standings group format unexpected:', tables.map(t => t.group));
}
```

This catches future football-data.org API format changes before they reach production HTML.

---

## Summary

| Finding | Severity | Action |
|---------|----------|--------|
| No `revalidatePath`/`revalidateTag` in codebase | HIGH | DATA-9: Add `/api/revalidate` endpoint |
| `/world-cup-2026/teams` — 24h TTL, "Group Group A" links → 404 | P0 | Manual revalidate via Vercel dashboard now |
| `/world-cup-2026-schedule` — fake fixtures (pre-DATA-7) | P0 | Manual revalidate via Vercel dashboard now |
| All group/team pages — DATA-8 hotfix not yet rendered | MEDIUM | Will auto-resolve within 1h of deploy |
| `/api/refresh/*` deprecated tombstones | LOW | Can be deleted in DATA-9 cleanup |
