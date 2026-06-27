# VERSION_GRAPH.md
## DATA-18WC.RUNTIME.TRUTH — Phase 0: Version Graph

---

## Current State: No Version Tracking

There is currently no version tracking on the match detail page.
No component embeds a version number. No component reads a version.
There is no `MatchVersion` type anywhere in the codebase.

---

## What Is a "Version" in This Context?

A `version` for the match page means: a monotonically increasing number that
identifies which snapshot of data the page is currently displaying. When any
mutable field (score, status, minute) advances to a new value, the version
increments. All components displaying that version of data should show the same
number.

---

## Current Closest Approximation: snapshot.generatedAt

`snapshot.generatedAt` is an ISO timestamp written when the snapshot is built.
It serves as a rough version signal:

- It is available on the server (embedded in `MatchSnapshot`)
- It is NOT embedded anywhere in the rendered HTML
- It is NOT accessible to `MatchLiveZone` (client component)
- It changes only on ISR revalidation — not on polling updates

**Gap**: `snapshot.generatedAt` represents only the server version.
When `MatchLiveZone` polls and gets a new score, there is no corresponding
"client version" signal. The two data paths cannot be compared for version alignment.

---

## Version Paths Currently

### Server Version Path

```
snapshot.generatedAt  ← set in getOrBuildMatchSnapshot() at build time
       │
       ├── NOT embedded in HTML
       ├── NOT accessible from client components
       └── Changes on ISR revalidation only
```

### Client Version Path

```
(none)

MatchLiveZone tracks:
  - score  (updated via polling)
  - status (updated via polling)
  - minute (updated via polling)
  
No version counter is attached to these updates.
No way to know: "this is the 5th poll result" vs "this is the 1st".
```

---

## Version Graph (Target — Phase 5)

```
KV write  (orchestrator, ~30s)
     │
     ↓
snapshot.generatedAt = new Date().toISOString()
     │
     ↓  [derive version number: seconds since epoch]
matchVersion = Math.floor(new Date(generatedAt).getTime() / 1000)
     │
     ├── embedded in HTML: <div data-match-version="{matchVersion}">
     ├── embedded in all rendered sections: data-version={matchVersion}
     └── passed to MatchLiveZone as initialVersion={matchVersion}
           │
           ↓  [on each poll response, API returns version]
           GET /api/live-score/{id}
           → { ..., version: number }   ← based on KV write timestamp
           │
           ↓
           setVersion(data.version)
           │
           ↓
           rendered: data-live-version={liveVersion}
```

**Pass condition**: `data-match-version` (SSR) === `data-live-version` (polling)
**Fail condition**: version mismatch → indicates stale server render vs live state

---

## Why Version Matters

Without version tracking, the following scenario is undetectable:

```
Server render (T+0):  score=0-0, goals=[], narrative="No goals yet"
User loads page:      score=0-0 (correct)

Poll (T+30):          score=1-0 (Spain goal at T+15)
MatchLiveZone:        shows 1-0  ← correct

Timeline:             still shows no goals  ← ISR lag, 0-0 snapshot
Narrative:            still says "No goals"  ← ISR lag

Current state: no way to detect or report this staleness window
Target state:  timeline shows data-version=T0, score shows data-version=T30
               → detectable divergence, operator can monitor
```

---

## Component Version Targets

| Component | Version Field | Source | Writable By |
|-----------|-------------|--------|------------|
| Page root div | `data-match-version` | snapshot.generatedAt → epoch seconds | ISR render |
| ScoreHero | `data-version` | same as page | ISR render |
| MatchTimeline | `data-version` | same as page | ISR render |
| MatchLiveZone | `data-live-version` | poll response version | Client polling |
| Story sections | `data-version` | same as page | ISR render |
| BelowTheFoldDeferred | `data-version` | same as page | ISR render |

**Version alignment**: If `data-match-version` ≠ `data-live-version`, the client
has advanced beyond the server render. This is expected during LIVE play and is
not an error — but it is now measurable.

---

## Implementation Status

| Component | Phase 5 Target | Current Status |
|-----------|---------------|---------------|
| Version type (`MatchVersion`) | Define in `match-runtime-state.ts` | ❌ Not defined |
| Embed in HTML | `data-match-version` attr | ❌ Not embedded |
| Pass to MatchLiveZone | `initialVersion` prop | ❌ Not passed |
| API returns version | `/api/live-score` response | ❌ Not included |
| Version validator script | `check-runtime-version.mjs` | ❌ Not written |
