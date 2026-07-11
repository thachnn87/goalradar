# WC 2026 Knockout Graph — Source-of-Truth Audit

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update if the knockout data model or bracket rendering changes.

## Mission

Prove the World Cup knockout bracket derives every match's participants **only
from its two parent matches** — never from array index, position, sort order,
match id, date, or fixture order — and fix the architectural root cause of the
"Brazil/Norway + Mexico/England → Spain vs Belgium" corruption seen in the
bracket tree.

## Root cause

The authority feed (football-data.org) provides, for each knockout match, its
**actual participants** (real teams once known, `Winner R16 M5` placeholders
before) plus stage and score. It does **not** provide parent-match linkage, and
it numbers matches in **schedule order**, which is not their top-to-bottom
position in the bracket tree.

Example from production data: the semi-final is `France vs Spain`, so the QFs
`France/Morocco` and `Spain/Belgium` belong to the **same half** and must be
adjacent — yet their ids are `537383` and `537384` with `Norway/England`
(`537385`) numbered between them. Any renderer that ordered a column by **id /
date / array index** therefore placed a QF between the wrong pair of RO16
matches. That was the entire defect — a *positioning* bug in the renderer.

Audit finding (repository-wide grep for `winners[i]`, `[i+1]`, `[2*i]`,
`Math.floor`, `slice`, `chunk`, `i*2`): **no code anywhere propagates winners by
index.** Participants are always the authority's real match records. The single
tree-drawing component (`WCBracket`) was the only place ordering mattered, and
it previously sorted by date/id.

## Architecture

The knockout bracket is now an explicit **directed acyclic graph** built in the
source-of-truth layer: `buildKnockoutGraph()` in `src/lib/knockout-vm.ts`.

Every node carries explicit parent references:

```
matchId, stage, slot, matchNumber,
leftParentMatchId, rightParentMatchId,
leftParentSource, rightParentSource,   // 'winner-identity' | 'placeholder-label' | 'unresolved'
homeTeam, awayTeam, homeTeamId, awayTeamId,
winner, winnerTeamId, winnerTeam
```

Parent links are resolved **only** from:

1. **Winning-team identity** — the previous-round match whose winner is this
   side's team (played rounds). Primary, authoritative.
2. **Placeholder label** — `Winner R16 M5` / `Winner QF2` → the n-th match of
   the previous round by authority match number (upcoming rounds only).

Slot geometry is a pure **consequence** of the parent links: a DFS from the
final yields the base-round leaf order, and each earlier match is placed at its
subtree's first leaf. The renderer (`WCBracket`) consumes `graph.order[stage]`
verbatim and never reorders. If linkage is incomplete, the graph falls back to
authority id order and flags the gap (never silently guesses).

Validation asserts, per node: both parents resolve, both parents are from the
immediately-previous round, and (when decided) the two participants are exactly
the two parent winners.

## Integrity report (live data, `/api/debug/knockout-graph`)

```
complete: true   valid: true   issues: 0
rounds: LAST_32=16  LAST_16=8  QUARTER_FINALS=4  SEMI_FINALS=2  FINAL=1
```

### Parent → child map (winner propagation)

| Child (stage slot) | Left parent | Right parent |
|---|---|---|
| R16 s0 Paraguay/France | R32 Germany/Paraguay | R32 France/Sweden |
| R16 s1 Canada/Morocco | R32 South Africa/Canada | R32 Netherlands/Morocco |
| R16 s2 Portugal/Spain | R32 Portugal/Croatia | R32 Spain/Austria |
| R16 s3 USA/Belgium | R32 USA/Bosnia-H. | R32 Belgium/Senegal |
| R16 s4 Brazil/Norway | R32 Brazil/Japan | R32 Ivory Coast/Norway |
| R16 s5 Mexico/England | R32 Mexico/Ecuador | R32 England/Congo DR |
| R16 s6 Argentina/Egypt | R32 Argentina/Cape Verde | R32 Australia/Egypt |
| R16 s7 Switzerland/Colombia | R32 Switzerland/Algeria | R32 Colombia/Ghana |
| **QF s0 France/Morocco** | R16 Paraguay/France | R16 Canada/Morocco |
| **QF s1 Spain/Belgium** | R16 Portugal/Spain | R16 USA/Belgium |
| **QF s2 Norway/England** | **R16 Brazil/Norway** | **R16 Mexico/England** |
| **QF s3 Argentina/Switzerland** | R16 Argentina/Egypt | R16 Switzerland/Colombia |
| SF s0 France/Spain | QF France/Morocco | QF Spain/Belgium |
| SF s1 Winner QF3/QF4 | QF Norway/England | QF Argentina/Switzerland |
| FINAL s0 Winner SF1/SF2 | SF France/Spain | SF Winner QF3/QF4 |

All R32→R16 and R16→QF links resolved by `winner-identity`; SF/Final links for
undecided halves resolved by `placeholder-label`.

### Validations

| # | Rule | Result |
|---|---|---|
| 6 | Every QF participant originates only from its two RO16 parents | ✅ pass |
| 7 | Every SF participant originates only from its two QF parents | ✅ pass |
| 8 | Final originates only from its two SF parents | ✅ pass |
| 9 | No participant appears outside its ancestry (PARTICIPANT_MISMATCH) | ✅ 0 violations |

### Production-case spotlight (the exact screenshot chain)

```
Brazil vs Norway  → Norway   ┐
                             ├─► Quarter-final: Norway vs England   ✅
Mexico vs England → England  ┘

Portugal vs Spain → Spain    ┐
                             ├─► Quarter-final: Spain vs Belgium    ✅
USA vs Belgium    → Belgium  ┘
```

No Spain or Belgium appears in the Brazil/Norway–Mexico/England branch.

## Regression guard

`src/lib/__tests__/knockout-graph.test.ts` encodes this scenario, including the
crossing id order, and asserts the R16 column geometry (`[1,2,5,6,3,4,7,8]`, not
naive `[1..8]`), the Norway/England parentage, label-based resolution of the
upcoming half, and detection of an unresolvable participant. 8 tests, all green.

## Note on deployment

The fix lives on branch `fix/wc-knockout-schedule-dates`. Production
(`goalradar.org`) reflects it only after that branch is deployed; until then the
live site shows the pre-fix ordering.
