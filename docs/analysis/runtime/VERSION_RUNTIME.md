# VERSION_RUNTIME.md
## DATA-18WC.RUNTIME.TRUTH — Phase 5: ONE VERSION

---

## MatchVersion

A version number derived from `snapshot.generatedAt` (epoch-ms):

```typescript
version = Math.floor(snapshot.generatedAt / 1000)   // Unix seconds
```

Example: `snapshot.generatedAt = 1750012800000` → `version = 1750012800`

---

## Version Embedding

### Server-rendered (ISR version)

```html
<!-- Rendered by MatchDetailPage in page.tsx -->
<div class="max-w-2xl mx-auto space-y-4 pb-10"
     data-match-version="1750012800"
     data-match-id="537327">
```

This attribute is set once per ISR render. It advances when:
- ISR 60s TTL expires and a new request triggers re-render
- Orchestrator calls `revalidatePath()` forcing immediate re-render

### Client-side (live version)

```html
<!-- Rendered by MatchLiveZone after polling -->
<div data-live-version="1750012835">
  <!-- score, status, minute display -->
</div>
```

This attribute is updated when `/api/live-score/{id}` returns a new `lastUpdated` timestamp.

---

## Version Flow

```
KV write (orchestrator, T+0):
  snapshot.generatedAt = 1750012800000
  matchVersion = 1750012800
  → embedded in HTML: data-match-version="1750012800"
  → passed to MatchLiveZone: initialVersion={1750012800}

MatchLiveZone initializes:
  liveVersion = 1750012800  (from initialVersion prop)
  renders: data-live-version="1750012800"

Poll at T+30s:
  GET /api/live-score/537327
  response: { ..., lastUpdated: "2025-06-27T12:00:35.000Z" }
  liveVersion = Math.floor(1750012835000 / 1000) = 1750012835
  renders: data-live-version="1750012835"

ISR revalidation at T+60s:
  snapshot.generatedAt = 1750012860000
  matchVersion = 1750012860
  HTML: data-match-version="1750012860"
  MatchLiveZone reinitializes: initialVersion={1750012860}
  liveVersion resets to 1750012860
```

---

## Version Validation

The `scripts/check-runtime-version.mjs` script reads both attributes from the rendered HTML:

```
data-match-version:  1750012800   (server render time)
data-live-version:   1750012835   (last poll update)

Difference: 35 seconds
Status: LIVE — client is ahead of server (expected, acceptable)
```

**Version alignment states:**

| Condition | Meaning |
|-----------|---------|
| `live == match` | In sync — match not live or just revalidated |
| `live > match` | Client ahead — LIVE match, polling returned newer data |
| `live == 0` | MatchLiveZone not initialized (non-live match) |
| `live == initialVersion` | No poll update yet (first 30s after page load) |

---

## What Version Does NOT Prove

Version alignment proves that MatchLiveZone's last poll update is newer than
the server render. It does NOT prove that:
- The timeline events are current (they update on ISR only)
- The story is current (updates on ISR only)
- JSON-LD is current (updates on ISR only)

For these fields, ISR is the update mechanism and no per-component versioning exists.
The MATCH.TRUTH fix (score-agnostic story for LIVE) eliminates the divergence risk
for the most critical field (score).

---

## Files Changed in Phase 5

| File | Change |
|------|--------|
| `src/lib/match-runtime-state.ts` | Exports `versionFromTimestamp()` utility |
| `src/app/match/[id]/page.tsx` | Derives `matchVersion`, embeds `data-match-version` + `data-match-id` |
| `src/components/MatchLiveZone.tsx` | Accepts `initialVersion` prop; tracks `liveVersion` state; renders `data-live-version` |
| `scripts/check-runtime-version.mjs` | NEW — validates version alignment |
