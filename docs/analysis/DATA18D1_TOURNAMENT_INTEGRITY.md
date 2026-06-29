# DATA-18D.1 Phase 3 — Tournament Integrity Audit
## Per-Match Validation: Score vs Goals vs Lineups vs Substitutions

Endpoint: `/api/debug/data18d1-integrity-audit`  
To run: `curl "https://www.goalradar.org/api/debug/data18d1-integrity-audit?secret=$CRON_SECRET" | jq .`

---

## Validation Checks (Per Match)

| Check | Logic | Pass Condition |
|-------|-------|----------------|
| `snapshotPresent` | KV snapshot exists | `snap !== null` |
| `noGoalsMissing` | Scored match must have goal events | `scoreTotal === 0 OR goals.length > 0` |
| `goalsMatchScore` | Total goals = total score | `goals.length === ftHome + ftAway` |
| `homeGoalsMatch` | Home goal count attribution | `homeGoals === ftHome` (with OG correction) |
| `awayGoalsMatch` | Away goal count attribution | `awayGoals === ftAway` (with OG correction) |
| `lineupPresent` | Both lineup arrays populated | `lineups.home.players.length > 0 AND lineups.away.players.length > 0` |
| `subsPresent` | Substitutions exist for scored match | `WARN if substitutions.length === 0 and scoreTotal > 0` |

Note on own goals: Goal events with `type === 'OWN_GOAL'` are attributed to the opposing team in the count, matching FD score convention.

---

## Expected Results

Based on DATA-18C.2 Phase 2 (all 18 matches repaired) and Phase 3 (unenriched=0):

**All 20 FINISHED WC 2026 matches should PASS.**

| matchId | Match | Score | Expected |
|---------|-------|-------|----------|
| 537327 | USA vs Panama | 1–0 | PASS |
| 537328 | Mexico vs Jamaica | 2–1 | PASS |
| 537333 | Canada vs Bosnia-Herz. | 1–1 | PASS |
| 537334 | Colombia vs Ivory Coast | 1–0 | PASS |
| 537339 | Brazil vs Morocco | 2–0 | PASS |
| 537340 | Haiti vs Scotland | 0–1 | PASS |
| 537345 | Spain vs South Korea | 3–0 | PASS |
| 537346 | Portugal vs Ghana | 1–0 | PASS |
| 537351 | Germany vs Curaçao | 7–1 | PASS |
| 537352 | Japan vs Nicaragua | 2–0 | PASS |
| 537357 | England vs Honduras | 3–1 | PASS |
| 537358 | Netherlands vs Panama | 1–0 | PASS |
| 537363 | Italy vs Algeria | 2–1 | PASS |
| 537364 | Ecuador vs Cameroon | 1–0 | PASS |
| 537369 | Spain vs Cape Verde | 0–0 | PASS (0-0, no goals needed) |
| 537370 | Saudi Arabia vs Uruguay | 1–1 | PASS |
| 537391 | France vs Senegal | 3–1 | PASS |
| 537392 | Norway vs Iraq | 3–2 | PASS |
| 537397 | Argentina vs Algeria | 3–0 | PASS |
| 537398 | (latest) | TBD | PASS |

**WARN cases (acceptable):**
- `subsPresent=warn` is acceptable if a match genuinely had 0 substitutions. This is extremely rare in modern football but theoretically possible.

---

## Actual Results

*(Run the endpoint after deployment and paste results here)*

```
curl "https://www.goalradar.org/api/debug/data18d1-integrity-audit?secret=$CRON_SECRET" | jq '{overallVerdict, pass, warn, fail, failedMatches, warnMatches}'
```

```json
{ "PASTE_AUDIT_OUTPUT_HERE": true }
```

---

## Remediation

If `fail > 0`: Run `integrity-repair` endpoint to automatically fix:
```
curl "https://www.goalradar.org/api/debug/integrity-repair?secret=$CRON_SECRET"
```

Then re-run the integrity audit to confirm `overallVerdict = "PASS"`.

---

## Phase 3 Verdict

PENDING — run endpoint after deployment and fill in results above.

Required for Phase 5 gate: `overallVerdict = "PASS"` (FAIL count = 0).
WARN count > 0 is acceptable if the warns are for 0-0 draws or genuinely no-substitution matches.
