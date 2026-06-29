# MATCH_RUNTIME_VALIDATION.md
## DATA-18WC.MATCH.TRUTH — Phase 9: Runtime Validation

---

## Check Script

See: `scripts/check-match-truth.mjs`

Run locally (requires dev server):
```bash
node scripts/check-match-truth.mjs [matchId]
node scripts/check-match-truth.mjs 123456
```

Run against production:
```bash
BASE_URL=https://goalradar.org node scripts/check-match-truth.mjs [matchId]
```

---

## What the Script Checks

For a given match ID, the script fetches the match page and verifies:

1. **Score extraction**: Extracts score from the rendered HTML in all locations it appears
2. **Narrative score**: Extracts any score reference from the story section
3. **JSON-LD score**: Extracts score from the embedded `application/ld+json` script tag
4. **FAQ score**: Extracts score from FAQ JSON-LD
5. **Consistency**: All extracted scores must match or be marked as LIVE-exempt

**Checks performed:**

| Check | Pass Criteria |
|-------|-------------|
| JSON-LD has no score for LIVE match | `hasScore` field absent or eventStatus = EventInProgress |
| FAQ has no score claim for LIVE match | No numeric score in FAQ answer text |
| Story has no score claim for LIVE match | No `\d–\d` pattern in intro sections |
| All non-LIVE score surfaces agree | Same `H–A` value across all occurrences |

---

## Architecture Check Script

See: `scripts/check-match-architecture.mjs`

Run as a CI pre-build check (no server needed — static code analysis):
```bash
node scripts/check-match-architecture.mjs
```

Pass: exits 0. Fail: exits 1 with violation details.

---

## What Architecture Check Verifies

1. `getOrBuildMatchSnapshot` is wrapped with `React.cache()` (deduplications intact)
2. No file outside `match-snapshot.ts` calls a function that returns `MatchSnapshot`
3. No LIVE branch in `match-story-engine.ts` contains `ftH` or `ftA` in score claims
4. `JsonLd` component gates score on `isFinished` (not `isLive`)
5. `buildFaqs` gates score FAQs on `isFinished` only
6. `ScoreHero` uses `centerSlot ??` pattern (not `&&` or conditional)

---

## Debug Endpoints

These existing API routes aid runtime validation:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/debug/live-health` | KV live-cache health and match IDs |
| `GET /api/debug/match-snapshot/{id}` | Full snapshot contents for a match |
| `GET /api/debug/live-score/{id}` | Current live score for a match |

---

## Expected Output (FINISHED match, consistent)

```
DATA-18WC.MATCH.TRUTH — Runtime Truth Check
==========================================
Match 123456 — Spain 3 vs Uruguay 1 (FINISHED)

  ✅ JSON-LD score:     3–1 (isFinished gate applied)
  ✅ FAQ score:         3–1 (isFinished gate applied)
  ✅ Story score:       3–1 (FINISHED, no divergence possible)
  ✅ All surfaces:      consistent

ONE TRUTH ✅
```

---

## Expected Output (LIVE match, consistent)

```
DATA-18WC.MATCH.TRUTH — Runtime Truth Check
==========================================
Match 789012 — Brazil 0 vs Germany 1 (IN_PLAY, min 67)

  ✅ JSON-LD score:     not embedded (isLive — correct)
  ✅ FAQ score:         not embedded (isLive — correct)
  ✅ Story score:       not embedded (isLive — removed by Phase 8 fix)
  ✅ Live score owner:  MatchLiveZone (sole source)

ONE TRUTH ✅
```

---

## Expected Output (LIVE match, pre-Phase-8)

```
DATA-18WC.MATCH.TRUTH — Runtime Truth Check
==========================================
Match 789012 — Brazil 0 vs Germany 1 (IN_PLAY, min 67)

  ✅ JSON-LD score:     not embedded (isLive — correct)
  ✅ FAQ score:         not embedded (isLive — correct)
  ❌ Story score:       "1–0" found in intro — divergence risk with MatchLiveZone

DIVERGENCE DETECTED ❌
  Reason: story engine embeds snapshot score for LIVE matches
  Fix: remove score claims from LIVE branches in match-story-engine.ts
```
