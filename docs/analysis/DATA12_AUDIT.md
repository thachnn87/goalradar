# DATA-12 Audit
## GoalRadar · Live Match UX Stabilization

Date: 2026-06-16
Branch: main

---

## Scope

Five surfaces audited for minute/status rendering correctness:

1. Match page hero (`MatchLiveZone.tsx`)
2. Live page cards (`live/page.tsx` → `MatchCard.tsx`)
3. Schedule page (all list surfaces via `overlayMatchStates`)
4. Results page (same list surfaces)
5. Debug endpoint (`/api/debug/minute-health`)

---

## Surface 1 — Match Page Hero (MatchLiveZone)

File: `src/components/MatchLiveZone.tsx`

| Check | Finding |
|-------|---------|
| IN_PLAY minute badge | ✅ `minute != null ? \`${minute}'\` : 'LIVE'` (line 37) |
| PAUSED → HT badge | ✅ Separate branch renders `HT` (line 48) |
| `matchProgress` labels | ✅ First Half / Second Half / Stoppage Time / Half Time (lines 27–33) |
| Progress label rendered | ✅ Below badge (lines 136–138) |
| `initialMinute` from SSR | ✅ Passed as prop from match page server component |
| `setMinute` on poll | ✅ `setMinute(data.minute ?? null)` (line 96) |
| Live-poll type declaration | ✅ `minute?: number \| null` in `LiveScoreResponse` |

**Verdict: GREEN — no changes needed**

---

## Surface 2 — Live Page Cards (MatchCard)

File: `src/components/MatchCard.tsx`

| Check | Finding |
|-------|---------|
| IN_PLAY minute badge | ✅ `minute != null ? \`${minute}'\` : 'LIVE'` (line 46) |
| PAUSED → HT | ✅ Status map `PAUSED: { text: 'HT' }` (line 59) |
| `matchProgress` labels | ✅ Same helper, same logic (lines 16–22) |
| Progress label rendered | ✅ Below score rows (lines 143–147) |
| `match.minute` prop consumed | ✅ `StatusBadge ... minute={match.minute}` (line 126) |

**Verdict: GREEN — no changes needed**

---

## Surface 3 — Schedule Page (and all list surfaces)

File: `src/lib/match-state-overlay.ts` — `mergeSnapshotState()`

| Check | Finding |
|-------|---------|
| Snapshot → list minute propagation | ❌ **BUG** — `minute` omitted from both merge branches |
| Branch 1 (state advance, line 61) | `{ ...listMatch, status, score, lastUpdated }` — missing `minute` |
| Branch 2 (same live state, line 65) | `{ ...listMatch, score, lastUpdated }` — missing `minute` |
| Impact | All 6 list call-sites in `api.ts` affected — schedule, live page, WC hub, homepage, team pages, competition pages |

**Verdict: RED — fixed**

Fix applied at `src/lib/match-state-overlay.ts` lines 61 and 65:
- Added `minute: snapMatch.minute` to both merge branches.

---

## Surface 4 — Results Page

There is no dedicated `/results` route. Finished matches are rendered via
`MatchCard` on the schedule and WC hub pages. `MatchCard` renders `FT` /
`FT (P)` / `FT AET` for FINISHED matches — minute is not shown for FINISHED,
which is correct behaviour. **No changes needed.**

---

## Surface 5 — /api/debug/minute-health

File: `src/app/api/debug/minute-health/route.ts` — did not exist.

| Requirement | Status |
|-------------|--------|
| Report kvLiveMinute for each live match | ✅ Reads `goalradar:live:matches` |
| Report snapshotMinute per match | ✅ `kv.mget` all `goalradar:match:{id}` |
| Diagnosis per match | ✅ PROVIDER_LOSS / SNAPSHOT_LOSS / NO_LOSS / MATCH_NOT_LIVE |
| Overall summary diagnosis | ✅ Worst diagnosis bubbled to top-level `diagnosis` field |
| Auth | ✅ CRON_SECRET or dev mode |

**Verdict: CREATED**

---

## TypeScript

`npx tsc --noEmit` — **0 errors** after all changes.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/match-state-overlay.ts` | Added `minute: snapMatch.minute` to both merge branches |
| `src/app/api/debug/minute-health/route.ts` | New endpoint — created |
