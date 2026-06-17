# DATA-16B Representative Match Validation

Date: 2026-06-17
Phase: 4 of 7

Matches validated: 537346, 537352, 537357, 537358, 537364

---

## Method

Evidence source: live production HTML from `https://www.goalradar.org/match/{slug}`.

The ESPN summary endpoint provides ground-truth expected values (from DATA-15C.1
coverage matrix). Production values are read from structured FAQ data and page HTML.

---

## 537346 — Australia vs Turkey (2–0)

**ESPN ground truth (from DATA-15C.1):** 2 goals, 1 assist, 1 card, 10 subs, lineups available

| Field | Expected | Production (pre-repair) | Status |
|-------|----------|------------------------|--------|
| Score | 2–0 | 2–0 (in title) | ✅ |
| Goal scorers | 2 names | "scorer information unavailable" | ❌ |
| Assists | 1 | — | ❌ |
| Cards | 1 yellow | — | ❌ |
| Subs | 10 | — | ❌ |
| Statistics | per-team counts | — | ❌ |
| Lineups | 11+bench per team | "not available" | ❌ |
| FAQ goalless claim | none | NONE ✅ | ✅ |
| ESPN ID (760421) | required | unknown (needs CRON_SECRET) | BLOCKED |

**Post-repair expected:** espnMatchId=760421, enrichmentApplied=true, goalsCount=2,
  lineups=11+14 players per team.
**Key test:** turkey→turkiye alias must resolve (DATA-15C).

---

## 537352 — Ivory Coast vs Ecuador (1–0)

**ESPN ground truth:** 1 goal, 1 assist, 4 cards, 9 subs, lineups available

| Field | Expected | Production (pre-repair) | Status |
|-------|----------|------------------------|--------|
| Score | 1–0 | 1–0 | ✅ |
| Goal scorers | 1 name | "scorer information unavailable" | ❌ |
| Cards | 4 yellows | — | ❌ |
| Subs | 9 | — | ❌ |
| Lineups | 11+bench | "not available" | ❌ |
| FAQ goalless | none | NONE ✅ | ✅ |

---

## 537357 — Netherlands vs Japan (2–2)

**ESPN ground truth:** 4 goals, 4 assists, 3 cards, 10 subs, lineups available

| Field | Expected | Production (pre-repair) | Status |
|-------|----------|------------------------|--------|
| Score | 2–2 | 2–2 | ✅ |
| Goal scorers | 4 names | "scorer information unavailable" | ❌ |
| Assists | 4 | — | ❌ |
| Cards | 3 | — | ❌ |
| Subs | 10 | — | ❌ |
| Lineups | 11+bench | "not available" | ❌ |
| FAQ goalless | none | NONE ✅ | ✅ |

**Note:** This was the primary DATA-14A test case for statistics team-ID fix.
Post-repair will confirm per-team stats are correct (not merged into one team).

---

## 537358 — Sweden vs Tunisia (5–1)

**ESPN ground truth:** 6 goals, 5 assists, 1 card, 10 subs, lineups available

| Field | Expected | Production (pre-repair) | Status |
|-------|----------|------------------------|--------|
| Score | 5–1 | 5–1 | ✅ |
| Goal scorers | 6 names | "scorer information unavailable" | ❌ |
| Assists | 5 | — | ❌ |
| Cards | 1 | — | ❌ |
| Subs | 10 | — | ❌ |
| Lineups | 11+bench | "not available" | ❌ |
| FAQ goalless | none | NONE ✅ | ✅ |

---

## 537364 — Iran vs New Zealand (2–2)

**ESPN ground truth:** 4 goals, 3 assists, 1 card, 9 subs, lineups available

| Field | Expected | Production (pre-repair) | Status |
|-------|----------|------------------------|--------|
| Score | 2–2 | 2–2 | ✅ |
| Goal scorers | 4 names | "scorer information unavailable" | ❌ |
| Assists | 3 | — | ❌ |
| Cards | 1 | — | ❌ |
| Subs | 9 | — | ❌ |
| Lineups | 11+bench | "not available" | ❌ |
| FAQ goalless | none | NONE ✅ | ✅ |

---

## Anomaly: 537392 Iraq vs Norway (partial enrichment)

Production shows Haaland 29' and Haaland 43'. Score is 1-4 (5 goals).
This is the pre-DATA-14A partial enrichment: type-70 goals only captured 2 of 5.
Post-repair, all 5 goals will be captured (`scoringPlay === true` filter).

---

## Verdict

**All 5 representative matches: FAIL (pre-repair).**
All show correct scores and no false "goalless" text. No enrichment (goals, assists,
cards, subs, statistics, lineups) is present in any of the 5 matches due to stale
KV snapshots from before the DATA-14A deploy.

Post-repair validation requires CRON_SECRET. Run the runbook in DATA16B_RECOVERY_REPORT.md,
then re-check these 5 matches using the verification commands in that document.
