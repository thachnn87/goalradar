# WC_BRACKET_VALIDATION — DATA-18WC.5

**Date:** 2026-06-23

---

## Bracket data source

`src/components/WCBracket.tsx` receives `matches: Match[]` as a prop.
It does NOT call `getStandingsCached('WC')` or read standings from KV.
Hub page (`/world-cup-2026/page.tsx`) passes knockout matches via `getWCKnockoutMatchesCached()`.

**Standings dependency: NONE.** DATA-18WC.4 fix has no direct path to WCBracket rendering.

---

## Rounds rendered by WCBracket

```typescript
const ROUND_KEYS = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'] as const;

ROUND_MATCH_COUNT = {
  LAST_16: 8,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 2,
  FINAL: 1,
}
```

**LAST_32 (Round of 32) is NOT rendered by WCBracket.**

The WC 2026 format is: 48 teams → 32 qualify from groups → LAST_32 (16 matches) → LAST_16 (8 matches) → QF → SF → Final.
The bracket skips the first knockout round.

The `RouteToFinal` component in team pages DOES include LAST_32 in its stepper (line 107),
but the main bracket component on the hub page omits it.

---

## Current bracket state (2026-06-23)

Group stage is ongoing (Match Day 2 just completed for most groups).
No knockout matches exist in the API yet.

`byStage.LAST_16 = []` → renders 8 TBD placeholder cards (border-dashed)
`byStage.QUARTER_FINALS = []` → renders 4 TBD placeholder cards
`byStage.SEMI_FINALS = []` → renders 2 TBD placeholder cards
`byStage.FINAL = []` → renders 1 TBD placeholder card

No wrong qualifiers. No wrong seeds. All cards show "TBD".

---

## Link validity

`BracketMatchCard` only generates a `<Link>` when `match.id > 0` (real API id).
TBD placeholder divs have no links. No broken navigation possible from bracket.

---

## Finding: LAST_32 not in bracket

When Round of 32 begins (~1 July 2026), qualified teams will appear in LAST_32 matches
in the API. WCBracket will not show them. The bracket will continue showing:
- LAST_16 as TBD (until these matches are scheduled / played)
- QUARTER_FINALS, SEMI_FINALS, FINAL as TBD

This is a pre-existing design decision, not a regression from DATA-18WC.4.
The hub page and team pages use `RouteToFinal` which does include LAST_32 — so users can
track that round via team pages even though it's missing from the bracket diagram.

---

## Verdict

**BRACKET_VALIDATION: PASS (with finding)** — bracket correctly shows TBD for all rounds,
no wrong qualifiers, no standings dependency. Finding: LAST_32 round will not appear in
WCBracket when knockout begins (pre-existing design gap, not a regression).
