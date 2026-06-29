# DATA-13B Runtime Verification
## ESPN Enrichment — WC 2026 Data Accessibility

Date: 2026-06-16
Status: **Complete**
Verdict: **GREEN** — ESPN has full WC 2026 event data. Three bugs in the parsing layer prevent enrichment from working.

---

## Summary

ESPN's public API (`site.api.espn.com`) exposes complete WC 2026 match data including goals, scorers,
assists, cards, and substitutions. All three target matches were resolved and verified. No data access
issue exists. The enrichment pipeline fails entirely due to three code bugs — two in `espn-id-map.ts`
and `espn.ts` that prevent ESPN ever being called, and one that causes all parsers to read empty arrays
instead of the actual event data.

---

## League Slug Verification

| Slug | HTTP Status | Notes |
|------|-------------|-------|
| `fifa.world` | **200** | ✅ Returns WC 2026 events |
| `fifa.worldcup` | 400 | ❌ |
| `fifa.world.2026` | 400 | ❌ |
| `soccer.world-cup` | 400 | ❌ |
| `soccer.world.cup` | 400 | ❌ |

**Confirmed slug:** `fifa.world` (already hardcoded as default in `espn.ts`).

---

## Target Match Resolution

All three WC 2026 target matches were resolved via direct Node.js HTTPS calls to ESPN's scoreboard
endpoint.

| FD Match ID | Teams | FD utcDate | ESPN Date Queried | ESPN Event ID | Status |
|-------------|-------|------------|-------------------|---------------|--------|
| 537352 | Ivory Coast vs Ecuador | 2026-06-14T21:00Z | 20260614 | **760423** | ✅ direct date match |
| 537358 | Sweden vs Tunisia | 2026-06-15T02:00Z | 20260614 | **760424** | ⚠️ prev-day (UTC 02:00Z → ESPN 20260614) |
| 537364 | Iran vs New Zealand | 2026-06-16T01:00Z | 20260615 | **760427** | ⚠️ prev-day (UTC 01:00Z → ESPN 20260615) |

**Note on date offset:** ESPN groups events by US local time (~UTC-6/UTC-5). Matches at 01:00Z or 02:00Z
UTC appear on the previous calendar day in ESPN's scoreboard. The current `findEspnMatch()` only queries
the UTC date — it would find 537352 but miss 537358 and 537364 (2 of 3 targets).

---

## Summary Endpoint Probe

Match: Ivory Coast vs Ecuador (ESPN event 760423). `GET /summary?event=760423` → HTTP 200.

### Top-level response keys

```
boxscore, format, gameInfo, lastFiveGames, headToHeadGames, leaders, broadcasts,
pickcenter, odds, news, rosters, header, article, videos, keyEvents, commentary
```

**`scoringPlays` → not present**
**`plays` → not present**
**`keyEvents` → 34 entries** ← actual event data

### keyEvents inventory (Ivory Coast 1–0 Ecuador)

| # | type.text | type.id | clock | period | team | athlete |
|---|-----------|---------|-------|--------|------|---------|
| 9 | Yellow Card | 94 | 28' | 1 | Ivory Coast | Seko Fofana |
| 10 | Yellow Card | 94 | 38' | 1 | Ivory Coast | Franck Kessié |
| 11 | Yellow Card | 94 | 40' | 1 | Ivory Coast | Guela Doué |
| 14 | Substitution | 76 | 56' | 2 | Ecuador | Nilson Angulo |
| 15 | Substitution | 76 | 56' | 2 | Ivory Coast | Ange-Yoan Bonny |
| 16 | Substitution | 76 | 56' | 2 | Ivory Coast | Amad Diallo |
| 17 | Substitution | 76 | 62' | 2 | Ecuador | Jackson Porozo |
| 18 | Substitution | 76 | 62' | 2 | Ecuador | Ángelo Preciado |
| 23 | Yellow Card | 94 | 73' | 2 | Ecuador | Jackson Porozo |
| 24–26 | Substitution | 76 | 77' | 2 | (3 teams) | ... |
| 31 | Substitution | 76 | 89' | 2 | Ivory Coast | Odilon Kossounou |
| **32** | **Goal** | **70** | **90'** | **2** | **Ivory Coast** | **Amad Diallo** |

Final score confirmed from ESPN: **Ivory Coast 1–0 Ecuador** ✅ (matches FD data)

---

## keyEvents Field Structure

### Goal event (type.id = "70", scoringPlay = true)

```json
{
  "id": "49520440",
  "type": { "id": "70", "text": "Goal", "type": "goal" },
  "text": "Goal! Côte d'Ivoire 1, Ecuador 0. Amad Diallo (Côte d'Ivoire) left footed shot from the centre of the box to the bottom left corner. Assisted by Wilfried Singo.",
  "shortText": "Amad Diallo Goal",
  "period": { "number": 2 },
  "clock": { "value": 5372, "displayValue": "90'" },
  "scoringPlay": true,
  "team": { "id": "4789", "displayName": "Ivory Coast" },
  "participants": [
    { "athlete": { "id": "291630", "displayName": "Amad Diallo" } },
    { "athlete": { "id": "286569", "displayName": "Wilfried Singo" } }
  ]
}
```

- `participants[0]` = **scorer** (Amad Diallo)
- `participants[1]` = **assist** (Wilfried Singo) — present when assist exists, absent otherwise
- No `type` field on participants — roles are positional only

### Substitution event (type.id = "76")

```json
{
  "type": { "id": "76", "text": "Substitution", "type": "substitution" },
  "text": "Substitution, Ecuador. Nilson Angulo replaces Alan Minda.",
  "clock": { "value": 3332, "displayValue": "56'" },
  "team": { "id": "209", "displayName": "Ecuador" },
  "participants": [
    { "athlete": { "id": "318090", "displayName": "Nilson Angulo" } },
    { "athlete": { "id": "319422", "displayName": "Alan Minda" } }
  ]
}
```

- `participants[0]` = **player in** (Nilson Angulo — coming on)
- `participants[1]` = **player out** (Alan Minda — being replaced)
- Confirmed by `text` field: "Nilson Angulo **replaces** Alan Minda"
- No `type` field on participants — roles are positional only

### Yellow card event (type.id = "94")

```json
{
  "type": { "id": "94", "text": "Yellow Card", "type": "yellow-card" },
  "text": "Seko Fofana (Côte d'Ivoire) is shown the yellow card for a bad foul.",
  "clock": { "value": 1655, "displayValue": "28'" },
  "team": { "id": "4789", "displayName": "Ivory Coast" },
  "participants": [
    { "athlete": { "id": "184118", "displayName": "Seko Fofana" } }
  ]
}
```

- `participants[0]` = player shown the card (single participant)

### Type ID reference

| type.id | type.text | Relevant for enrichment |
|---------|-----------|------------------------|
| 70 | Goal | ✅ goals |
| 76 | Substitution | ✅ substitutions |
| 94 | Yellow Card | ✅ bookings |
| 80 | Kickoff | ❌ skip |
| 81 | Halftime | ❌ skip |
| 82 | Start 2nd Half | ❌ skip |
| 83 | End Regular Time | ❌ skip |
| 129 | Start Delay | ❌ skip |
| 130 | End Delay | ❌ skip |

---

## Bugs Found

### Bug 1 — KV null/undefined: ESPN never called (CRITICAL)

**File:** `src/lib/espn-id-map.ts` line 88
**Symptom:** All 3 matches show `lookupHit=true, espnId=null, source=lookup-miss` in the debug endpoint.

```typescript
// BUG: Vercel KV kv.get() returns null for missing keys, not undefined
const cached = await kv.get<string | null>(lookupKey);
if (cached !== undefined) {   // null !== undefined → always true
  return cached;              // returns null on every call
}
// ESPN scoreboard is never reached
```

`kv.get()` on a missing key returns `null`. The condition `null !== undefined` is always `true`, so every
call returns null before ever querying ESPN. The scoreboard is never called.

**Fix:** Use `null` as the sentinel for a missing key:
```typescript
const cached = await kv.get<string>(lookupKey);
if (cached !== null) {
  return cached === '__NOT_FOUND__' ? null : cached;
}
// proceed to ESPN scoreboard
```
Or simply: `if (cached !== undefined && cached !== null)`. The same null-vs-undefined bug exists in
`src/app/api/debug/espn-enrichment/[matchId]/route.ts` line 111 (`lookupHit = lookupRaw !== undefined`).

---

### Bug 2 — Wrong response array: parsers always return empty (CRITICAL)

**File:** `src/lib/providers/espn.ts`, function `getEspnMatchEvents()` (line 261–266)

```typescript
// BUG: ESPN summary does not return scoringPlays or plays for WC 2026
return {
  espnMatchId,
  goals:         parseGoals(data.scoringPlays ?? []),      // scoringPlays missing → []
  bookings:      parseBookings(data.plays ?? []),           // plays missing → []
  substitutions: parseSubstitutions(data.plays ?? []),      // plays missing → []
};
```

The ESPN summary endpoint returns a `keyEvents` array (34 entries for Ivory Coast–Ecuador), not
`scoringPlays` or `plays`. Both fallback to `[]`, so all three parsers always return empty arrays.

**Fix:** Read from `data.keyEvents` instead. Filter by `type.id`:
- Goals: `keyEvents.filter(e => e.type?.id === '70')` (or `scoringPlay === true`)
- Substitutions: `keyEvents.filter(e => e.type?.id === '76')`
- Yellow cards: `keyEvents.filter(e => e.type?.id === '94')`
- Red cards: need to confirm type.id (not observed in test match — Ecuador had none)

---

### Bug 3 — Date offset: 2 of 3 target matches missed (MODERATE)

**File:** `src/lib/providers/espn.ts`, function `findEspnMatch()` (line 205)

```typescript
// BUG: queries only the UTC date — misses matches at 01:00Z–02:00Z UTC
const dateStr = utcDate.slice(0, 10).replace(/-/g, '');
const url     = `${ESPN_BASE}/${ESPN_LEAGUE}/scoreboard?dates=${dateStr}`;
```

ESPN groups events by US local time (~UTC-6). Matches kicking off at 01:00Z or 02:00Z UTC appear on
the previous calendar day in ESPN's scoreboard.

- 537358 Sweden–Tunisia: FD utcDate=`2026-06-15T02:00Z` → ESPN date `20260614` (not queried)
- 537364 Iran–New Zealand: FD utcDate=`2026-06-16T01:00Z` → ESPN date `20260615` (not queried)

Only 537352 (21:00Z kickoff) would be found with the current single-date query.

**Fix:** If no match is found for `dateStr`, also query `dateStr - 1 day`:
```typescript
const dateStr  = utcDate.slice(0, 10).replace(/-/g, '');
const prevDate = /* dateStr minus 1 day */;
// try dateStr first; if not found, try prevDate
```

---

### Bug 4 — Substitution participant order: playerIn/playerOut reversed (MODERATE)

**File:** `src/lib/providers/espn.ts`, function `parseSubstitutions()` (line ~374)

Current fallback (when no labeled `in`/`out` participant type found):
```typescript
const pOut = playerOut ?? participants[0];
const pIn  = playerIn  ?? participants[1];
```

The `keyEvents` substitution data has **no participant type labels** (no `type` field on participants).
The positional order from ESPN is:
- `participants[0]` = player **in** (coming on)
- `participants[1]` = player **out** (going off)

Confirmed from event text: `"Nilson Angulo replaces Alan Minda"` with Angulo at index 0, Minda at index 1.

The current fallback assigns `participants[0]` to `pOut` and `participants[1]` to `pIn` — exactly reversed.

**Fix:** Swap the positional fallback:
```typescript
const pOut = playerOut ?? participants[1];  // index 1 = going off
const pIn  = playerIn  ?? participants[0];  // index 0 = coming on
```

---

### Bug 5 — Goal scorer detection: participantTypeText always returns "" (MODERATE)

**File:** `src/lib/providers/espn.ts`, function `parseGoals()` (line ~286)

```typescript
const scorer = participants.find(
  (p) => participantTypeText(p).toLowerCase().includes('scorer') ||
         participantTypeText(p).toLowerCase().includes('goal'),
);
```

`keyEvents` goal participants have no `type` field — `participantTypeText(p)` returns `""` for all.
The `.find()` never matches, `scorer` is always `undefined`, and goals are silently skipped
(`if (!scorer) continue`).

**Fix:** Use positional lookup for keyEvents goals:
```typescript
const scorer = participants[0];    // index 0 = scorer
const assist = participants[1];    // index 1 = assist (may be absent)
```

---

## Data Accessibility Assessment

| Check | Result |
|-------|--------|
| League slug `fifa.world` accessible | ✅ HTTP 200 |
| WC 2026 events present | ✅ confirmed |
| Target matches resolvable | ✅ all 3 found (with correct date query) |
| Goals present and correct | ✅ Amad Diallo 90' (1 goal, matches FD/UI) |
| Scorers in data | ✅ `participants[0]` |
| Assists in data | ✅ `participants[1]` when present |
| Yellow cards present | ✅ 3 cards (Fofana 28', Kessié 38', Doué 40', Porozo 73') |
| Substitutions present | ✅ 8 substitutions with in/out players |
| Score confirmed | ✅ Ivory Coast 1–0 Ecuador |
| `scoringPlays` key in summary | ❌ not present |
| `plays` key in summary | ❌ not present |
| `keyEvents` key in summary | ✅ 34 entries |

---

## Verdict: GREEN

ESPN has complete WC 2026 event data. The API is accessible, the league slug is correct, and all
target matches are resolvable. Goals (with scorers and assists), cards, and substitutions are all
present in the `keyEvents` array.

No data access problem exists. All four bugs are in the client code:

| Bug | File | Severity | Effect |
|-----|------|----------|--------|
| KV null/undefined | `espn-id-map.ts:88` | CRITICAL | ESPN never called |
| Wrong response array | `espn.ts:261–266` | CRITICAL | All events return empty |
| Date offset | `espn.ts:205` | MODERATE | 2 of 3 matches missed |
| Sub participant order | `espn.ts:~374` | MODERATE | playerIn/Out swapped |
| Goal scorer detection | `espn.ts:~286` | MODERATE | Goals silently dropped |

These five bugs can be fixed without any ESPN-side changes. DATA-13C should address all five.

---

## DATA-13C Fix Plan

1. **`espn-id-map.ts` line 88** — change `!== undefined` to `!== null` for KV hit detection.
   Same fix needed in `route.ts:111` for the debug endpoint.

2. **`espn.ts` `getEspnMatchEvents()`** — read `keyEvents` instead of `scoringPlays`/`plays`.
   Update `EspnSummaryResponse` interface to include `keyEvents`. Pass separate arrays to each parser
   filtered by `type.id`: `'70'` (goals), `'76'` (subs), `'94'`/`'95'`/`'96'` (cards).

3. **`espn.ts` `findEspnMatch()`** — add previous-day fallback. If no match found for `dateStr`,
   compute `dateStr - 1 day` and retry once.

4. **`espn.ts` `parseSubstitutions()`** — swap positional fallback: index 0 = playerIn, index 1 = playerOut.

5. **`espn.ts` `parseGoals()`** — remove participant type-text lookup; use positional:
   `participants[0]` = scorer, `participants[1]` = assist.
