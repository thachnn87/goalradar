# CLOCK_GRAPH.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Clock Graph

---

## Current Clock Inventory

There are **five independent clocks** currently operating in the match page system.
None of them are coordinated. None of them share a reference.

---

## Clock 1 — ISR Clock

```
Type:          Next.js ISR
File:          src/app/match/[id]/page.tsx:40
Value:         export const revalidate = 60
Interval:      60 seconds (baseline, can be shorter via forced revalidation)
Controls:      Server render, all SSR components, metadata, JSON-LD, story
Cannot be:     Accessed from client components
Cannot be:     Changed at runtime
Cannot be:     Synchronized with polling
```

**What it advances**: The entire server render. When ISR fires, ALL server components
get a fresh `snapshot.match`. This includes score, events, story, JSON-LD.

**What it does NOT advance**: MatchLiveZone client state. The client state only
updates via Poll Clock.

---

## Clock 2 — Poll Clock (MatchLiveZone)

```
Type:          setInterval(1s) countdown
File:          src/components/MatchLiveZone.tsx:10,117
Constants:     POLL_INTERVAL = 30 (seconds)
Interval:      1s tick, poll every 30s when countdown reaches 0
Controls:      score, status, minute (React state in MatchLiveZone)
Only active:   When pageState === 'LIVE' (centerSlot provided)
Stops:         When TERMINAL_STATUSES.includes(data.status)
```

**What it advances**: The three mutable live fields: `score`, `status`, `minute`.
These are React state variables inside MatchLiveZone.

**What it does NOT advance**: Timeline events, story text, JSON-LD, metadata.

**Reference**: `POLL_INTERVAL = 30` is a module-scoped constant. It is not
shared with any other file.

---

## Clock 3 — Orchestrator Clock

```
Type:          Vercel Cron (server-side)
File:          src/app/api/cron/orchestrator/route.ts
Interval:      ~30s (configured in vercel.json)
Controls:      KV writes (goalradar:live:matches, goalradar:match:{id})
Also:          Calls revalidatePath() to force ISR on changed matches
```

**What it advances**: KV cache freshness. When a match state changes (goal scored,
match kicks off, etc.), the orchestrator writes to KV and calls `revalidatePath()`.
The `revalidatePath()` call effectively overrides the ISR 60s clock — the next
request gets a fresh render immediately.

**Interaction with ISR**: When orchestrator calls `revalidatePath()`, ISR next-request
latency drops to near-zero instead of waiting up to 60s.

---

## Clock 4 — KV TTL Clock

```
Type:          Vercel KV TTL (key expiration)
Files:         src/lib/live-cache.ts, src/lib/match-snapshot.ts
Values:
  goalradar:live:matches   TTL: 30s
  goalradar:match:{id}     TTL: 30s (live), 7 days (finished)
  goalradar:authority:v1   TTL: 30–900s (dynamic)
Controls:      Cache freshness for server-side data fetches
```

**What it advances**: The staleness of data available to server renders and
the `/api/live-score` endpoint. When a KV key expires and is refetched, the
snapshot reflects the latest provider data.

---

## Clock 5 — Telemetry Clock (fire-and-forget)

```
Type:          fire-and-forget POST
File:          src/components/MatchLiveZone.tsx:99-103
Endpoint:      /api/telemetry/live
Trigger:       After each successful poll
Controls:      Telemetry only — no UI state
```

Not a real clock (does not control any UI state), but fires on Poll Clock.

---

## Clock Independence — The Problem

```
Clock 1 (ISR, 60s):         ─────────┬────────────────────────────────┬─────
                                      │                                │
                                   render                           render
                                      │                                │
Clock 3 (Orchestrator, 30s):   ──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──
                                 │     │     │     │     │
                              KV write       KV write         KV write
                                 │           │                │
Clock 4 (KV TTL, 30s):       expires      expires          expires

Clock 2 (Poll, 30s):   ─────────────┬──────────────┬─────────────────┬─────
                                     │              │                 │
                                  poll()         poll()           poll()
                                     │              │                 │
                                 score=1-0      score=1-0        score=2-0
```

**Key insight**: Clock 2 (polling) and Clock 1 (ISR) are completely independent.
Clock 3 (orchestrator) affects Clock 1 indirectly via `revalidatePath()`, but
does NOT affect Clock 2.

---

## Clock Analysis by Field

| Field | Clock | Interval | Advancement |
|-------|-------|---------|------------|
| Server HTML | ISR Clock | ≤60s | On ISR request (60s TTL or forced by orchestrator) |
| score (client) | Poll Clock | 30s | On each MatchLiveZone poll |
| status (client) | Poll Clock | 30s | On each MatchLiveZone poll |
| minute (client) | Poll Clock | 30s | On each MatchLiveZone poll |
| KV live data | KV TTL Clock | 30s | On KV expiration + provider write |
| story | ISR Clock | ≤60s | Server re-render only |
| JSON-LD | ISR Clock | ≤60s | Server re-render only |
| metadata | ISR Clock | ≤60s | Server re-render only |

---

## LiveRefresher — NOT on Match Page

`LiveRefresher` (which calls `router.refresh()` every 30s) is used on the `/live`
page and `/schedule` pages. It is **NOT** used on the match detail page.

This means the match page has **no full-page ISR refresh mechanism** from the client.
The only client-side update is the narrow MatchLiveZone polling (score/status/minute only).

**Consequence**: If a goal is scored at T+1s after ISR, the timeline won't show it
for up to ~60s (ISR) or until the orchestrator triggers a forced revalidation.

---

## Target: RuntimeClock (Phase 4)

The goal is not to merge these clocks — that is not possible (ISR is framework-controlled,
KV TTL is a deployment concern). The goal is to:

1. **Name them** explicitly via a `RuntimeClockRegistry` constant file
2. **Align them** — ensure all user-controlled clocks (Poll, LiveRefresher) use
   the same `RUNTIME_POLL_INTERVAL` constant
3. **Document them** — make it clear which fields are under which clock

What CANNOT be unified:
- ISR Clock (Next.js framework — `export const revalidate` is the only control)
- KV TTL Clock (infrastructure — set in live-cache.ts and match-snapshot.ts)
- Orchestrator Clock (Vercel Cron — set in vercel.json)

What CAN be unified:
- Poll Clock (`POLL_INTERVAL = 30` in MatchLiveZone)
- LiveRefresher Clock (`INTERVAL = 30` in LiveRefresher.tsx)
→ Both should reference a single `RUNTIME_POLL_INTERVAL` exported constant

---

## Implementation Status

| Clock | Phase 4 Target | Current Status |
|-------|---------------|---------------|
| ISR Clock | Document + cannot change | `revalidate = 60` ✅ documented |
| Poll Clock | Extract to shared constant | `POLL_INTERVAL = 30` — local only ❌ |
| LiveRefresher | Reference shared constant | `INTERVAL = 30` — local only ❌ |
| KV TTL | Document | 30s in live-cache.ts ✅ documented |
| Orchestrator | Document | ~30s via vercel.json ✅ documented |
| RuntimeClock constant | Create src/lib/runtime-clock.ts | ❌ Not created |
