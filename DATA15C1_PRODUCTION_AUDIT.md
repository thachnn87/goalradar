# DATA-15C.1 Production Audit
## ESPN Enrichment — Production Validation

Date: 2026-06-17
Verdict: **RED / BLOCKED** — DATA-15C (and DATA-14A/14B) are **not deployed**;
production has regressed to unenriched. Healing cannot be validated until deploy + revalidation.

---

## 0. Deployment Blocker (read first)

`git push origin main` fails from this environment: `Failed to connect to
github.com port 443`. The fixes for DATA-14A (scoringPlay goal filter + team-ID
resolution), DATA-14B (invalidate clears event cache), and DATA-15C (structured
negative cache + turkey alias) are **committed locally but not on production**.

Local commits ahead of deployed `main`:
```
842174b DATA-15C negative cache hardening
532f490 DATA-15B audit (docs)
582451c DATA-15A identity layer (dormant)
8830e09 DATA-14B invalidate clears ESPN event cache
64f88cf DATA-14A goal types + statistics team ID
```
The last code reached production at/around **DATA-13E** (`2a32c60`).

**Consequence:** every objective that asserts production behaviour after DATA-15C
(Objectives 1–2) is **blocked on deploy**. They are specified below with the exact
post-deploy validation, but cannot be marked GREEN today.

---

## 1. Objective 1/2 — Australia vs Turkey (FD 537346) healing

**Status: NOT HEALED (deploy-blocked).** Current production
`goalradar.org/match/537346-australia-vs-turkey`:

| Check | Required | Current production | Status |
|-------|----------|--------------------|--------|
| espnMatchId | 760421 | unverifiable (debug needs CRON_SECRET) | ⛔ |
| enrichmentApplied | true | **false** (page shows no goals) | ❌ |
| goalsCount > 0 | yes | **0** | ❌ |
| FAQ not "goalless" | yes | **says "goalless (0–0)"** on a 2-0 match | ❌ |

The DATA-15C turkey alias + structured-cache heal logic that fixes this is not yet
live. ESPN ground truth (verified, §3) confirms 760421 has 2 goals — so the heal
**will** succeed once deployed and revalidated.

---

## 2. Broader Production Regression (new finding)

Production enrichment has **broadly regressed since DATA-14B** (2026-06-16). Live
match-page meta descriptions checked 2026-06-17:

| Match | DATA-14B (yesterday) | Today (2026-06-17) |
|-------|----------------------|--------------------|
| Iran 2–2 New Zealand | 2 of 4 goals shown | **0 goals — "ended in a draw", FAQ goalless** |
| Sweden 5–1 Tunisia | 5 of 6 goals shown | **0 goals — FAQ goalless** |
| Ivory Coast 1–0 Ecuador | 1 of 1 (correct) | **0 goals — "won." no scorer** |
| Netherlands 2–2 Japan | 0 goals | **0 goals — FAQ goalless** |
| Germany 7–1 Curaçao | — | **0 goals — "won." no scorer** |
| Mexico 2–0 South Africa | — | **0 goals — "won." no scorer** |
| Spain 0–0 Cape Verde | — | 0 goals — goalless (**correct**, genuine 0-0) |

### Root cause

ESPN event caches (`goalradar:espn:event:{id}`) have a **12-hour TTL**. The
enriched data observed in DATA-14B came from those caches. ~24h later they have
expired. The deployed (pre-DATA-14A) `buildSnapshot` caches a FINISHED snapshot
for **7 days**; when a snapshot was (re)built in a window where the event cache had
expired and enrichment returned no rows, the **unenriched** snapshot got pinned for
7 days. Because a snapshot *exists*, no rebuild re-triggers enrichment.

This is exactly the failure mode DATA-14B's `invalidateMatchSnapshot` fix (clear
event cache on invalidate) was meant to break — also undeployed.

---

## 3. ESPN Ground Truth (what enrichment WILL produce once deployed)

Fetched live ESPN summaries for all 18 finished WC 2026 matches and parsed with the
**DATA-14A/15C production logic** (`scoringPlay===true` goals, positional assists,
card type IDs 94/95/96, subs type 76). Full table in
`DATA15C1_COVERAGE_MATRIX.md`. Headline:

- **18 / 18** matches: parsed goal count **exactly equals** the FD final score.
- Australia vs Turkey (537346): **2 goals, 1 assist, 1 card, 10 subs** — resolves
  to ESPN 760421 with the new alias.
- All 18 expose `rosters` (lineups available, not yet surfaced in UI).

The enrichment pipeline is **correct**; the gap is purely deployment + cache state.

---

## 4. Why production validation is blocked

| Need | Tool | Blocker |
|------|------|---------|
| Confirm espnMatchId/enrichmentApplied | `/api/debug/espn-enrichment/{id}` | requires `CRON_SECRET` (not available locally) |
| Heal stale snapshots | `POST /api/revalidate/match/{id}` | requires `CRON_SECRET` |
| Deploy the fixes | `git push origin main` | github.com unreachable from sandbox |

Read-only public-page inspection (used above) confirms the **current** state but
cannot drive a heal.

---

## 5. Post-Deploy Validation & Remediation (runbook)

Once `git push` succeeds and Vercel deploys, with `CRON_SECRET` in hand:

```bash
SECRET="<CRON_SECRET>"
BASE="https://goalradar.org"

# 1. Revalidate every finished WC match (clears snapshot + event cache via the
#    DATA-14B fix, forcing fresh enrichment with the DATA-14A/15C logic).
for id in 537327 537328 537333 537334 537339 537340 537345 537346 537351 \
          537352 537357 537358 537363 537364 537369 537370 537391 537392; do
  curl -s -X POST "$BASE/api/revalidate/match/$id?secret=$SECRET" >/dev/null
done

# 2. Confirm Australia vs Turkey healed.
curl -s "$BASE/api/debug/espn-enrichment/537346?secret=$SECRET" | jq \
  '{espnMatchId, enrichmentApplied, goalsCount, lookupReason}'
# Expect: espnMatchId="760421", enrichmentApplied=true, goalsCount=2, lookupReason=null

# 3. Confirm FAQ no longer says goalless on a scored match.
curl -sL "$BASE/match/537346-australia-vs-turkey" | grep -oiE "goalless|Detailed scorer information"
# Expect: NO "goalless"; (if still mid-rebuild) "Detailed scorer information" from the FAQ fix

# 4. Spot-check goal counts across matches against the coverage matrix.
```

Expected outcome: all 17 scored matches `enrichmentApplied=true` with goal counts
matching `DATA15C1_COVERAGE_MATRIX.md`; the one 0-0 (Spain) legitimately goalless.

---

## Verdict

| Objective | Status |
|-----------|--------|
| 1. 537346 heals after deploy | ⛔ BLOCKED (not deployed) |
| 2. espnMatchId/enrichmentApplied/goalsCount/FAQ | ⛔ BLOCKED (not deployed; currently all failing on prod) |
| 3. Audit finished matches | ✅ done (ESPN ground truth, 18/18) |
| 4. Coverage matrix | ✅ done (see matrix doc) |
| 5. FAQ fallback fix | ✅ implemented + tsc clean (see FAQ doc) |

**Production is currently RED** (broad enrichment regression) and the DATA-15C heal
is **not yet live**. The pipeline logic is verified correct; resolution requires
deploying the stacked DATA-14A→15C commits and running the §5 revalidation runbook.
This audit validated current ESPN enrichment only — no Team Identity, no Match
Identity, no new provider.
