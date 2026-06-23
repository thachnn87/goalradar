# WC_QUALIFICATION_ENGINE — DATA-18WC.8B

**Date:** 2026-06-23  
**Status:** IMPLEMENTED ✅

---

## Purpose

Calculates and surfaces qualification status for all 48 teams across the FIFA World Cup 2026 group stage.  
Replaces hardcoded position-based color coding (P1/P2 = green) with a deterministic engine that accounts for:

- Mathematical certainty (safe lead vs. theoretically reachable)
- Best-8 third-place team selection (cross-group)
- Probability estimates when outcome is still uncertain

---

## Tournament Format

| Rule | Value |
|---|---|
| Groups | 12 (A–L) |
| Teams per group | 4 |
| Matches per team | 3 (round-robin) |
| Auto-qualifiers | Top 2 per group = 24 teams |
| Best-third qualifiers | 8 of 12 third-placed teams = 8 teams |
| Total to knockout | 32 teams |
| Eliminated | 4th-place (12) + worst 4 third-placed (4) = 16 teams |

---

## Status Definitions

| Status | Meaning | Display color |
|---|---|---|
| `QUALIFIED` | Mathematically certain to advance | Green |
| `ELIMINATED` | Mathematically certain to be knocked out | Red |
| `THIRD_PLACE_CONTENDER` | Currently 3rd; competing for best-8 spot | Yellow/Amber |
| `UNDECIDED` | Outcome still depends on remaining matches | Gray |

---

## Engine Logic

### Position 1 or 2 → QUALIFIED when:

All teams below position 2 cannot reach this team's current points even with maximum remaining wins:

```
max(P3.points + P3.remaining × 3, P4.points + P4.remaining × 3) < entry.points
```

Team's minimum future points = current points (football only adds points, never subtracts).

OR: Group is complete (all 3 games played per team).

Otherwise → **UNDECIDED** (P1: 84% probability, P2: 72%).

### Position 4 → ELIMINATED when:

Team cannot reach the current P3 team's points even with maximum wins:

```
entry.points + remaining × 3 < P3.points
```

OR: Group is complete.

Otherwise → **UNDECIDED** (7% probability).

### Position 3 → THIRD_PLACE_CONTENDER (default)

Refined by cross-group best-8 logic:

**If all 12 groups complete:**
- Rank all 12 P3 teams by: points → goal difference → goals for
- Rank ≤ 8 → **QUALIFIED**
- Rank > 8 → **ELIMINATED**

**If ≥ 8 groups complete AND this team's max achievable points < 8th-best completed P3 points:**
- → **ELIMINATED** (early)

**Otherwise:**
- → **THIRD_PLACE_CONTENDER** with estimated probability (see below)

### Third-place probability estimate

| Current rank (of known P3 teams) | Points | Probability |
|---|---|---|
| 1st–4th | ≥ 7 | 95% |
| 1st–4th | ≥ 6 | 88% |
| 1st–4th | ≥ 5 | 78% |
| 1st–4th | ≥ 4 | 68% |
| 5th–8th | ≥ 7 | 82% |
| 5th–8th | ≥ 6 | 68% |
| 5th–8th | ≥ 5 | 52% |
| 5th–8th | ≥ 4 | 40% |
| 5th–8th | ≥ 3 | 28% |
| 9th–12th | max ≥ 7 | 28% |
| 9th–12th | max ≥ 6 | 18% |
| 9th–12th | max ≥ 5 | 10% |
| 9th–12th | else | 4% |

---

## Output Shape

```typescript
export interface TeamQualification {
  teamId:                   number;   // football-data.org numeric ID (0 for static entries)
  teamName:                 string;
  group:                    string;   // 'A'–'L'
  position:                 number;   // 1–4
  qualificationStatus:      QualificationStatus;
  qualificationReason:      string;   // e.g. "Qualified — finished 2nd in Group G"
  qualificationProbability: number;   // 0.0–1.0
}
```

---

## API

```typescript
// Primary: compute for all teams
calculateQualificationStatus(groupTables: StandingTable[]): Map<number, TeamQualification>

// Lookup helpers
findQualByName(qualMap, teamName): TeamQualification | undefined
getGroupQualifications(qualMap, groupLetter): TeamQualification[]

// Fast fallback (no engine, position-only)
positionToStatus(position, playedGames): QualificationStatus

// Badge style constants for UI
QUAL_BADGE_STYLES[status]: QualBadgeStyle
```

---

## Files

| File | Role |
|---|---|
| `src/lib/wc-qualification.ts` | Engine implementation |
| `src/components/WCQualBadge.tsx` | Reusable badge/pill component |

---

## Surfaces

| Page | Integration |
|---|---|
| `/world-cup-2026` (Hub) | WCGroupTable receives `qualifications` map → per-row border and tint |
| `/world-cup-2026-standings` | GroupTable receives `qualMap` → status column + border-left + row tint |
| `/world-cup-2026/[group]` | WCGroupTable + TeamCard + QualificationSummary all use engine data |
| `/world-cup-2026/teams/[slug]` | Dedicated "Qualification Status" section with badge + reason |
| `/teams/[slug]` | "FIFA World Cup 2026" card when team is in WC (`runningCompetitions` check) |

---

## Edge Cases

| Case | Handling |
|---|---|
| Static skeleton entries (id=0) | Included in computation; synthetic negative IDs avoid collisions |
| Tournament not started (all 0 played) | UNDECIDED for all, probabilities from FIFA ranking not available (use position) |
| Cold KV (standings unavailable) | Empty map returned; UI falls back to position-based colors |
| Partial data (some groups missing) | Engine runs on available groups; missing groups produce no entries |
| Third-place with 0 games played | THIRD_PLACE_CONTENDER with low probability (position 3, no data) |
| Group complete but API sends only 1 group | Best-8 logic runs on available groups, defers QUALIFIED/ELIMINATED for 3rd until ≥8 done |
