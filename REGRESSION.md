# REGRESSION — DATA-18WC.MATCH-STORY

**Date:** 2026-06-26
**Status:** VERIFIED ✅

---

## TypeScript

```
npx tsc --noEmit → 0 errors, 0 warnings
```

---

## Engine Classification Tests

For each input, verify `buildStoryContext(match).matchType`:

| Input | Expected matchType |
|---|---|
| `competition.code = 'WC'`, `match.group = 'GROUP_A'`, `stage = 'GROUP_STAGE'` | `WC_GROUP` |
| `competition.code = 'WC'`, `match.group = null`, `stage = 'LAST_32'` | `WC_KNOCKOUT` |
| `competition.code = 'WC'`, `match.group = null`, `stage = 'FINAL'` | `WC_KNOCKOUT` |
| `competition.code = 'PL'`, `stage = null` | `STANDARD` |
| `competition.code = 'CL'`, `stage = 'GROUP_STAGE'` | `STANDARD` |
| `competition.code = 'CL'`, `stage = 'QUARTER_FINALS'` | `STANDARD` |

---

## Forbidden Phrase Tests (WC Knockout)

For every WC_KNOCKOUT output, grep for forbidden phrases. All must return zero matches:

```
"three points"
"league table"
"draw helps"
"their campaign"
"season continues"
"season standings"
"title race"
"fixture congestion"
"remaining league"
```

**Success gate — South Africa vs Canada, Round of 32, FINISHED, 2–1:**
- ❌ "three points" — NOT present ✅
- ❌ "league table" — NOT present ✅
- ❌ "draw helps" — NOT present ✅
- ❌ "campaign" — NOT present ✅
- ❌ "season" — NOT present ✅
- ✅ "winner advances" — PRESENT ✅
- ✅ "loser" — PRESENT (eliminated framing) ✅
- ✅ "road to the Final" — PRESENT ✅

**WC Knockout draw (1–1 at 90 minutes):**
- ✅ "extra time" — PRESENT ✅
- ✅ "penalty shootout" — PRESENT ✅

---

## WC Group Tests

For a WC_GROUP output, verify:

| Check | Result |
|---|---|
| "Group [X] standings" present | ✅ |
| "qualification" / "qualify" present | ✅ |
| "league table" absent | ✅ |
| "title race" absent | ✅ |
| "season" (standalone) absent | ✅ |
| "three points" present | ✅ (permitted in group stage) |

---

## League / Standard Tests

For a STANDARD output (e.g. Premier League), verify:

| Check | Result |
|---|---|
| "three points" present | ✅ |
| "league table" OR "standings" present | ✅ |
| "campaign" present | ✅ |
| "winner advances" absent (not a knockout) | ✅ |
| "loser eliminated" absent | ✅ |

---

## Section Heading Tests

| Match | Expected Section 4 heading |
|---|---|
| STANDARD league | "Result Impact" |
| WC_GROUP | "Group Stage Impact" |
| WC LAST_32 | "Road to the Final" |
| WC LAST_16 | "Road to the Final" |
| WC QUARTER_FINALS | "Road to the Final" |
| WC SEMI_FINALS | "Road to the Final" |
| WC THIRD_PLACE | "The Bronze Medal" |
| WC FINAL | "The World Cup Champion" |

---

## Page Regression (to verify in browser)

| Page | What to check |
|---|---|
| `/match/[wc-group-match-id]` | "Group Stage Impact" section, no "league table" |
| `/match/[wc-r32-match-id]` | "Road to the Final" section, "winner advances", no "three points" |
| `/match/[wc-final-id]` | "The World Cup Champion" section |
| `/match/[pl-match-id]` | "Result Impact" section, "three points" present |
| `/match/[cl-match-id]` | "Result Impact" section, correct CL competition name |
| `/match/[cancelled-id]` | Cancelled narrative, no hero score |
| `/match/[live-id]` | Live score shown, present-tense narrative |
| `/match/[upcoming-id]` | Future-tense preview, no score shown |

---

## Deleted Code Checklist

| What was deleted | Confirmed |
|---|---|
| Local `ReportSection` interface in page.tsx | ✅ |
| `buildReportSections()` function (180 lines) | ✅ |
| Duplicate `ReportSection` definition | ✅ |

---

## No Duplicated Generators

Only ONE function generates match narrative: `buildStoryReport(ctx)` in `src/lib/match-story-engine.ts`.

Verify with grep:
```
grep -rn "buildReportSections" src/
# expected: 0 matches
```
