# DATA-16B UI Verification

Date: 2026-06-17
Phase: 5 of 7

Evidence: production HTML from all 18 WC 2026 match pages.

---

## Section Presence — Pre-Repair

| Section | Detection method | 537346 | 537352 | 537357 | 537358 | 537364 |
|---------|-----------------|--------|--------|--------|--------|--------|
| Score | Title "X–Y" | ✅ 2-0 | ✅ 1-0 | ✅ 2-2 | ✅ 5-1 | ✅ 2-2 |
| Goal Scorers (section) | `<GoalsSection>` visible | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assists | Part of goal list | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cards | `<BookingsSection>` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Substitutions | `<SubstitutionsSection>` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Statistics | `<MatchStatistics>` | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lineups | "not available" shown | ⚠️ stub | ⚠️ stub | ⚠️ stub | ⚠️ stub | ⚠️ stub |

**GoalsSection, BookingsSection, SubstitutionsSection** return `null` when events are empty —
they don't render at all. Lineups renders the stub ("not available from current data provider").

---

## False "Goalless" Text Check (all 18 matches)

| Check | Result |
|-------|--------|
| Any scored match (score > 0) showing "ended goalless (0–0)" | **NONE** ✅ |
| Spain 0-0 Cape Verde showing "ended goalless" | **YES** ✅ (correct) |

Confirmed across all 18 matches. The DATA-15C.1 FAQ fix is fully live and working.

---

## Pre-Repair UI Pass/Fail

| Section | Status | Note |
|---------|--------|------|
| Score | ✅ PASS | All 18 scores correct in titles |
| Goal Scorers | ❌ FAIL | No goals in KV snapshots |
| Assists | ❌ FAIL | No assist data |
| Cards | ❌ FAIL | No booking data |
| Substitutions | ❌ FAIL | No sub data |
| Statistics | ❌ FAIL | Requires events; all zero |
| Lineups | ❌ FAIL | Stub shown; awaits enrichment |
| FAQ no-false-goalless | ✅ PASS | DATA-15C.1 fix confirmed |

---

## Post-Repair Expected UI (from ESPN ground truth, DATA-15C.1 matrix)

| Match | Goals | Scorers | Subs | Cards | Lineups |
|-------|-------|---------|------|-------|---------|
| Australia vs Turkey | 2 | 2 names + times | 10 | 1 yellow | 11+bench each |
| Ivory Coast vs Ecuador | 1 | 1 name | 9 | 4 yellows | 11+bench each |
| Netherlands vs Japan | 4 | 4 names | 10 | 3 yellows | 11+bench each |
| Sweden vs Tunisia | 6 | 6 names | 10 | 1 yellow | 11+bench each |
| Iran vs New Zealand | 4 | 4 names | 9 | 1 yellow | 11+bench each |

Note: The `LineupsSection` component (DATA-16) renders starters in formation order
(formationPlace 1–11) then bench, with jersey numbers and position abbreviations.
After repair, all 18 matches will show starting XI of both teams.

---

## Specific UI Regression Check

1. **No "goalless (0-0)" on scored match**: CONFIRMED across all 17 scored matches.
2. **Stats panel not all-zero**: Post-repair will confirm; pre-repair all-zero due to empty events.
3. **Lineups not showing "not available"**: Post-repair will replace stub with real data.
4. **FAQ scorer answer**: Post-repair will show "Goals: [name] [minute]' ([team]); ..." format.
