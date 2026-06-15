# LIVE-1 Implementation Report
## GoalRadar · Sprint LIVE-1

Implemented: 2026-06-15

---

## What was built

### Phase 1 — Lightweight API endpoint

**`src/app/api/live-score/[matchId]/route.ts`**

`GET /api/live-score/[matchId]`

Source order:
1. `getLiveMatches()` → checks `goalradar:live:matches` (30s KV TTL, all competitions)
2. `getOrBuildMatchSnapshot(matchId)` → KV-backed, provider only on cold start

Returns:
```json
{ "matchId": 537358, "status": "IN_PLAY", "score": { ... }, "lastUpdated": "...", "source": "live" }
```

Rate-limit compliance: source 1 reads the existing live cache (zero new provider calls). Source 2 uses the established snapshot hierarchy. No new KV keys. No new caches.

---

### Phase 2 — Client-side poller

**`src/components/MatchLiveZone.tsx`**

Client component (`'use client'`) that polls `/api/live-score/[matchId]` every 30s via a `setInterval` countdown timer.

Behavior:
- Receives `initialStatus` and `initialScore` from SSR — no client-side flicker on first paint
- Renders an inline `StatusBadge` (mirrors the existing `StatusPill` styles: LIVE/HALF TIME/FULL TIME)
- Updates score + status in-place without a page refresh or `router.refresh()`
- Shows "Refreshes in Xs" spinner while active

**`src/app/match/[id]/page.tsx`** — two changes:

1. `ScoreHero` gains an optional `centerSlot?: React.ReactNode` prop. When provided, it replaces the entire status-badge + score column. Non-live matches (SCHEDULED, FINISHED) pass `undefined` → existing static render is unchanged.

2. The main page component (`MatchDetailPage`) passes `<MatchLiveZone>` as `centerSlot` when `match.status === 'IN_PLAY' || match.status === 'PAUSED'`.

The live zone is a pure client island — server components are not affected. The `ScoreHero` component remains a server component. ISR (`revalidate = 60`) is unchanged.

---

### Phase 3 — Auto-stop

Built into `MatchLiveZone`. After each successful poll, if the returned status is in `TERMINAL_STATUSES` (`FINISHED`, `POSTPONED`, `CANCELLED`, `SUSPENDED`):
- The interval is cleared (`setPolling(false)`)
- The "Refreshes in Xs" indicator is removed
- The final score and status remain rendered in the DOM

No user action required — the component self-terminates when the match ends.

---

### Phase 4 — Telemetry

**`src/lib/live-telemetry.ts`**

In-process per-match metrics store. Not KV-backed (resets on cold start — diagnostic, not durable).

Tracks per `matchId`:
| Metric | Description |
|--------|-------------|
| `totalPolls` | Number of polls attempted |
| `successPolls` | Polls that returned 2xx |
| `scoreChanges` | Polls where fullTime score changed |
| `lastLatencyMs` | Last poll round-trip ms |
| `avgLatencyMs` | Rolling average (last 100 polls) |
| `maxLatencyMs` | Maximum observed latency |
| `lastPollAt` | ISO timestamp of last poll |

**`src/app/api/telemetry/live/route.ts`**

`POST /api/telemetry/live` — receives client-side beacon after each poll:
```json
{ "matchId": "537358", "latencyMs": 42, "scoreChanged": false }
```
Best-effort: invalid payloads silently dropped. Returns 204.

**`src/app/api/debug/live-telemetry/route.ts`**

`GET /api/debug/live-telemetry` — returns the full metrics array.

---

## Files changed / created

| File | Type | Description |
|------|------|-------------|
| `src/lib/live-telemetry.ts` | NEW | In-process telemetry store |
| `src/components/MatchLiveZone.tsx` | NEW | Client poller component (Phases 2+3) |
| `src/app/api/live-score/[matchId]/route.ts` | NEW | Score endpoint (Phase 1) |
| `src/app/api/telemetry/live/route.ts` | NEW | Telemetry beacon receiver (Phase 4) |
| `src/app/api/debug/live-telemetry/route.ts` | NEW | Telemetry debug endpoint (Phase 4) |
| `src/app/match/[id]/page.tsx` | MODIFIED | `ScoreHero` + `centerSlot` + `MatchLiveZone` integration |

---

## Success criteria check

| Criteria | Status | Notes |
|----------|--------|-------|
| Goal scored → no browser refresh → hero updates within 30s | ✅ | `MatchLiveZone` polls every 30s and updates score in-place |
| No additional provider traffic beyond existing live cache flow | ✅ | Endpoint reads live cache (KV) first; snapshot (KV) second; provider only on cold start |
| ISR regressions — none | ✅ | `revalidate = 60` unchanged; `ScoreHero` is still a server component; `MatchLiveZone` is a leaf client island |
| Non-live matches unaffected | ✅ | `centerSlot` is `undefined` for SCHEDULED/FINISHED → existing static render |
| Auto-stop on terminal status | ✅ | Phase 3: interval clears on FINISHED/POSTPONED/CANCELLED/SUSPENDED |

---

## TypeScript

`npx tsc --noEmit` → 0 errors.

---

## Architecture notes

- `MatchLiveZone` is a client island inside a server component tree. This is idiomatic Next.js App Router. The `centerSlot` prop pattern (server component passes a client component as children/slot) is supported by React/Next.js without any server-component restrictions.
- `StatusBadge` in `MatchLiveZone` duplicates the visual logic from `StatusPill` in `page.tsx`. This is intentional: `StatusPill` is private to `page.tsx` (not exported), and extracting it to a shared file is a separate concern outside LIVE-1 scope.
- The telemetry store is in-process. In a multi-instance Vercel deployment, metrics are per-instance, not aggregated. This is acceptable for debugging — the pattern matches the existing `match-perf-tracker.ts` approach.
