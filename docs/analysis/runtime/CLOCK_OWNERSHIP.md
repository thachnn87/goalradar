# CLOCK_OWNERSHIP.md
## DATA-18WC.RUNTIME.TRUTH — Phase 4: ONE CLOCK

---

## RuntimeClock

```typescript
// src/lib/runtime-clock.ts
export const RUNTIME_POLL_INTERVAL = 30;   // seconds
export const RUNTIME_KV_LIVE_TTL   = 30;   // seconds  
export const RUNTIME_ISR_INTERVAL  = 60;   // seconds
```

All user-controlled timing constants live in `src/lib/runtime-clock.ts`.

---

## Clock Unification — What Changed

| File | Before | After |
|------|--------|-------|
| `MatchLiveZone.tsx` | `const POLL_INTERVAL = 30` (local) | `import { RUNTIME_POLL_INTERVAL }` |
| `LiveRefresher.tsx` | `const INTERVAL = 30` (local) | `import { RUNTIME_POLL_INTERVAL }` |

Both client-side timers now reference the same constant. Changing `RUNTIME_POLL_INTERVAL`
in one place updates both.

---

## Clock Registry

| Clock | Constant | File | Interval | Controls |
|-------|----------|------|---------|---------|
| ISR Clock | `export const revalidate = 60` | `src/app/match/[id]/page.tsx:40` | 60s | Server HTML, all SSR components |
| Poll Clock (match) | `RUNTIME_POLL_INTERVAL` | `src/lib/runtime-clock.ts` | 30s | MatchLiveZone score/status/minute |
| Poll Clock (live page) | `RUNTIME_POLL_INTERVAL` | `src/lib/runtime-clock.ts` | 30s | LiveRefresher router.refresh() |
| KV Live TTL | `RUNTIME_KV_LIVE_TTL` (documented) | `src/lib/live-cache.ts:KV_LIVE_TTL` | 30s | goalradar:live:matches expiry |
| KV Match TTL | N/A (documented in match-snapshot.ts) | `src/lib/match-snapshot.ts` | 30s live / 7d finished | goalradar:match:{id} expiry |
| Orchestrator Cron | vercel.json (infrastructure) | Vercel config | ~30s | KV writes + revalidatePath() |

---

## What Cannot Be Unified

The ISR Clock (`export const revalidate = 60`) is controlled by Next.js at the
framework level. It cannot be extracted to a runtime-clock constant because
Next.js reads the static export at build time — it does not accept a dynamic import.

Similarly, KV TTLs and the Orchestrator cron interval are infrastructure concerns.
They are documented in `runtime-clock.ts` for visibility, but not enforced there.

---

## Alignment

```
Orchestrator writes KV  every ~30s
KV goalradar:live:matches  TTL 30s
MatchLiveZone polls        every 30s  ← RUNTIME_POLL_INTERVAL
LiveRefresher refreshes    every 30s  ← RUNTIME_POLL_INTERVAL
ISR match page             60s        ← RUNTIME_ISR_INTERVAL
```

The three 30s values (orchestrator, KV TTL, poll interval) are all intentionally
aligned: a poll will always find fresh KV data because KV TTL ≤ poll interval.
The ISR interval is 2× longer because ISR provides full page content (events, story)
which is less time-sensitive than the score.

---

## To Change the Poll Rate

Change `RUNTIME_POLL_INTERVAL` in `src/lib/runtime-clock.ts`.
MatchLiveZone and LiveRefresher will both pick up the new value.

Also update:
- KV TTL in `src/lib/live-cache.ts` (KV_LIVE_TTL) — should be ≤ RUNTIME_POLL_INTERVAL
- Document in this file
- Notify orchestrator team if aligning with cron

Do NOT change the ISR `revalidate = 60` via runtime-clock.ts — it must stay as a static
constant in the page file (Next.js requirement).
