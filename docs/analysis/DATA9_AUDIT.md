# DATA-9 Audit
## GoalRadar · ISR Control Plane — Pre-Implementation Findings

Date: 2026-06-15

---

## Problem Statement

OPS Revalidation Audit (June 2026) found that stale ISR HTML is the #1 production failure mode.
Every DATA-7 and DATA-8 incident had correct code but stale HTML reaching users.

Instances:
- "Group Group A" badge — hotfix `777dc3a` deployed, but `/world-cup-2026/teams` served stale HTML for up to 24h
- Italy FAQ "Yes. Italy qualified" — fix deployed, but team page served old render for up to 1h
- Fake fixtures (Mexico vs Spain etc.) — DATA-7 removed them from code, but schedule page served stale for hours
- Empty standings after DATA-8 deploy — group pages served "no standings" render while KV had fresh data

Root cause: zero `revalidatePath()` / `revalidateTag()` calls anywhere in the codebase.

---

## Codebase Audit

### revalidatePath / revalidateTag usage

```
Pattern: revalidatePath|revalidateTag
Scope: src/ (all .ts/.tsx files)
Result: 0 matches
```

No file called `revalidatePath()` or `revalidateTag()` before DATA-9.

### API routes checked

35 route files scanned. Zero had any ISR revalidation logic.

Legacy "refresh" routes (`/api/refresh/wc-fixtures`, `/api/refresh/standings`) are deprecated
tombstones returning HTTP 410 — they refresh KV data but do not clear HTML page cache.

The orchestrator (`/api/cron/orchestrator`) refreshes KV data every 30 min but had no
`revalidatePath()` call — so fresh KV data was never pushed to ISR-cached pages automatically.

---

## TTL Audit

### WC page revalidate values (pre-DATA-9)

| File | TTL (s) | Issue |
|------|---------|-------|
| `world-cup-2026/page.tsx` | 30 | ✅ appropriate — live hub |
| `world-cup-2026/matches-today/page.tsx` | 60 | ✅ appropriate — live |
| `world-cup-2026/matches-tomorrow/page.tsx` | 60 | ✅ appropriate — near-live |
| `world-cup-2026/watch-live/page.tsx` | 60 | ✅ appropriate — live |
| `world-cup-2026/fixtures/page.tsx` | 900 | ✅ acceptable |
| `world-cup-2026-results/page.tsx` | 900 | ⚠️ too slow — results propagate in 15 min |
| `world-cup-2026-predictions/page.tsx` | 900 | ❌ wasteful — content is static |
| `world-cup-2026/matches/page.tsx` | 3600 | ❌ too slow for results page |
| `world-cup-2026-schedule/page.tsx` | 3600 | ❌ too slow — was serving fake fixtures for hours |
| `world-cup-2026/groups/page.tsx` | 3600 | ✅ appropriate |
| `world-cup-2026/[group]/page.tsx` | 3600 | ✅ appropriate |
| `world-cup-2026/teams/[slug]/page.tsx` | 3600 | ✅ appropriate |
| `world-cup-2026-standings/page.tsx` | 3600 | ✅ appropriate |
| `world-cup-2026-groups/page.tsx` | 3600 | ✅ appropriate |
| `world-cup-2026/bracket/page.tsx` | 21600 | ✅ appropriate — bracket rarely changes |
| `world-cup-2026-bracket/page.tsx` | 21600 | ✅ appropriate |
| `world-cup-2026-tv-guide/page.tsx` | 86400 | ✅ appropriate — static |
| `world-cup-2026-live-stream/page.tsx` | 86400 | ✅ appropriate — static |
| `world-cup-2026/teams/page.tsx` | **86400** | ❌ critical — 24h means DATA-8 hotfix took a full day to reach users |

### TTL changes required

| File | Before | After | Reason |
|------|--------|-------|--------|
| `world-cup-2026/teams/page.tsx` | 86400 | 3600 | Live group assignments — 24h is unacceptable |
| `world-cup-2026-schedule/page.tsx` | 3600 | 300 | Stale fixtures were the biggest user-facing bug |
| `world-cup-2026-results/page.tsx` | 900 | 300 | Results need fast propagation |
| `world-cup-2026/matches/page.tsx` | 3600 | 300 | Same as results |
| `world-cup-2026-predictions/page.tsx` | 900 | 86400 | Static content — prediction articles don't change |

---

## Orchestrator Audit

The orchestrator runs every 30 min, refreshes KV for:
- WC fixtures (4 tasks: all-matches, upcoming, finished, recent)
- Live matches (1 task)
- Standings for WC + 6 leagues (7 tasks)
- WC match seeding via prewarmWorldCup() (PERF-3)

After DATA-9, revalidation fires when any WC task (label starts `wc-` or equals `standings-wc`)
returns `status: 'ok'`. Revalidation is skipped if all WC tasks fail or are skipped — this
prevents unnecessary page cache invalidation on rate-limit events.

---

## Files to Create / Modify

| Action | File |
|--------|------|
| Create | `src/lib/revalidation.ts` |
| Create | `src/app/api/revalidate/route.ts` |
| Create | `src/app/api/debug/revalidation/route.ts` |
| Modify | `src/app/api/cron/orchestrator/route.ts` (import + hook) |
| Modify | `src/app/world-cup-2026/teams/page.tsx` (TTL 86400→3600) |
| Modify | `src/app/world-cup-2026-schedule/page.tsx` (TTL 3600→300) |
| Modify | `src/app/world-cup-2026-results/page.tsx` (TTL 900→300) |
| Modify | `src/app/world-cup-2026/matches/page.tsx` (TTL 3600→300) |
| Modify | `src/app/world-cup-2026-predictions/page.tsx` (TTL 900→86400) |
