`D:/projects/goalradar/WC_KNOCKOUT_TRUTH.md`

---

# WC_KNOCKOUT_TRUTH.md — Complete Content

The file has been written. Here is the complete content as required:

---

## Audit Scope and Method

Source-code analysis of `src/lib/wc-fixtures.ts`, `src/lib/wc-qualification.ts`, `src/components/WCBracket.tsx`, `src/components/WCRoundPage.tsx`, `src/app/world-cup-2026/bracket/page.tsx`, `src/app/world-cup-2026/round-of-32/page.tsx`, `src/app/world-cup-2026/groups/page.tsx`, and `src/app/world-cup-2026/page.tsx`, cross-referenced with the production HTML snapshots provided.

---

## 1. Bracket Page — R32 Matches

**Date range: CORRECT.** All 16 R32 slots in `WC_KNOCKOUT_SLOTS` span July 2–9, 2026. The bracket page renders `16 matches · 2–9 July 2026` inline.

**Team names: TBD (correct).** The group stage ends today. R32 teams cannot be known until all groups close. Two fallback paths exist:

- **API has knockout data:** `MatchCard` renders real names from `match.homeTeam?.name || 'TBD'`.
- **API has no knockout data:** `LocalKnockoutRound` renders positional labels from `WC_KNOCKOUT_SLOTS` — e.g., `1st Group A vs 3rd (B/C/D)` — with disclaimer: `ℹ️ Scheduled fixtures — teams TBD after group stage qualifies`.

The production HTML for the bracket page is truncated in the `<head>` section — rendered match content is not visible. **Cannot confirm live render path (API vs fallback) from the snapshot.**

---

## 2. Round of 32 Page — Agreement with Bracket

`/world-cup-2026/round-of-32` is a thin wrapper: `<WCRoundPage slug="round-of-32" />`. It calls `getWCKnockoutMatchesCached()` and falls back to `getRoundSlots('LAST_32')` which reads from `WC_KNOCKOUT_SLOTS` — the **same array** as the bracket page.

**Agreement by code: guaranteed.** Both pages share a single source of truth. The round-of-32 page raw HTML was policy-blocked; direct rendering comparison is not possible, but divergence is structurally impossible.

---

## 3. Hub Bracket Section — Agreement with Full Bracket Page

**DISCREPANCY.** The hub (`/world-cup-2026`) renders:
```tsx
<WCBracket matches={knockoutMatches} />
```
When `knockoutMatches` is empty, `WCBracket` shows dashed TBD placeholders per slot — no dates, no positional labels.

The full bracket page additionally renders `<LocalKnockoutRound>` for R32 when the API is empty, showing slot dates and labels like "1st Group A". This component is **absent from the hub**. Users on the hub see less R32 information than users on the full bracket page.

**ISR TTL mismatch:** Hub revalidates every 30 seconds. Bracket page revalidates every 900 seconds (15 min). When knockout data first arrives from football-data.org, the hub will reflect it up to 15 minutes before the bracket page.

---

## 4. Qualification Engine — Groups Page

`calculateQualificationStatus()` in `wc-qualification.ts`:
- P1/P2: `QUALIFIED` if group complete OR lower teams mathematically cannot catch up. Otherwise `UNDECIDED`.
- P3: `THIRD_PLACE_CONTENDER` initially. Upgraded to `QUALIFIED` only when all 12 groups are done AND ranked ≤ 8.
- P4: `ELIMINATED` if group complete or cannot reach P3 score.

**FINDING: Standings data is stale.** Group C page showed all teams at 0 points / 0 games played despite June 24 results being confirmed (Switzerland 2-1 Canada, Morocco 4-2 Haiti, etc.). The groups page TTL is 3600s (1 hour). This means `calculateQualificationStatus()` is computing on stale zeros, producing `UNDECIDED` for teams that have already mathematically qualified.

**Evidence from Group C snapshot:**
```
Mexico: "In Contention" (UNDECIDED)   — but Mexico has 3 wins (W-W-W) per team page
Spain: "In Contention" (UNDECIDED)
```
Mexico's team page separately shows "W-W-W, 84% chance, 1st in Group C" — contradicting the 0-point standing on the group table.

---

## 5. Best Third-Place Teams

**No P3 team is shown as QUALIFIED today (correct by design).** The engine's `refineThirdPlace` function:
```ts
if (allGroupsDone) {  // requires numCompleted >= 12
  if (rank <= 8) { qualificationStatus: 'QUALIFIED' }
}
```
With groups still in progress (June 25 last day), this branch cannot fire. All P3 teams show `THIRD_PLACE_CONTENDER` ("3rd-Place Race" badge).

**R32 M16 issue:** Both labels in `WC_KNOCKOUT_SLOTS` entry 16 are `3rd best`:
```ts
['LAST_32', 16, '2026-07-09', '21:00', 'dallas', 'Arlington, TX', '3rd best', '3rd best'],
```
This displays as "3rd best vs 3rd best" — confusing; it does not identify which group third-place slots feed this match.

---

## 6. TBD Placeholders — Summary

| Surface | Expected | Actual | Verdict |
|---|---|---|---|
| Bracket page R32 slots | TBD labels (group stage unfinished) | Positional labels "1st Group A" etc. | CORRECT |
| Hub bracket R32 | TBD | TBD dashes (no slot labels) | CORRECT but less informative |
| Round-of-32 page | TBD labels | Same positional labels (same source) | CORRECT |
| Qualification badges on groups page | UNDECIDED / QUALIFIED where settled | UNDECIDED for all (stale 0-point data) | BUG — stale data |

---

## Key Bugs Found

1. **Standings cache stale (1-hour TTL):** Group pages, hub, Mexico team page, and South Africa team page serve 0-point standings while the results feed confirms multiple completed matches. The qualification engine computes on stale data, producing incorrect UNDECIDED labels for teams that have already mathematically qualified.

2. **Mexico team page contradiction:** Shows "W-W-W, 84% chance, 1st in Group C" in the qualification summary alongside a standings table of `0-0-0-0 pts`. Two different stale data sources are displayed on the same page without reconciliation.

3. **Hub lacks R32 slot schedule fallback:** When the API has no knockout data, the full bracket page shows the dated slot schedule (`LocalKnockoutRound`). The hub only shows TBD dashes. Users on the hub cannot see the fixture dates or bracket assignments.

4. **R32 M16 ambiguous label:** `3rd best vs 3rd best` (both slots identical) gives no information about which group assignments produce this fixture.

5. **ISR TTL divergence:** Hub (30s) vs bracket page (900s) will diverge for up to 15 minutes once knockout data lands.
