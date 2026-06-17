# DATA-18F Phase 5 — Production Validation

Date: 2026-06-17  
Status: **PENDING** — requires `AUTHORITY_CACHE_ENABLED=true` deployed

---

## Validation Scope

Five page types validated for all FINISHED WC 2026 matches:

| Page | URL Pattern | Data Source | Score Field Checked |
|------|-------------|-------------|---------------------|
| Hub | `/world-cup-2026` | `getWCAuthorityMatchesV2()` | `CanonicalMatch.score.fullTime` |
| Results | `/world-cup-2026/results` | `getWCAuthorityMatchesV2()` | `CanonicalMatch.score.fullTime` |
| Fixtures | `/world-cup-2026/fixtures` | `getWCAuthorityMatchesV2()` | `CanonicalMatch.score.fullTime` |
| Group | `/world-cup-2026/[group]` | `getWCAuthorityMatchesV2()` | `CanonicalMatch.score.fullTime` |
| Match Detail | `/match/[id]/[slug]` | `getOrBuildMatchSnapshot()` | `MatchSnapshot.match.score.fullTime` |

---

## Requirement

**0 score drift** across all finished WC matches.  
All listing pages must show the same score as the match detail page.

---

## Validation Method

### Step 1 — Gate checks (API endpoints)

```bash
# Authority-vs-snapshot drift
curl "https://www.goalradar.org/api/debug/authority-drift?secret=$CRON_SECRET"
# PASS: { verdict: "GREEN", red: 0 }

# Snapshot integrity
curl "https://www.goalradar.org/api/debug/data18d1-integrity-audit?secret=$CRON_SECRET"
# PASS: { overallVerdict: "PASS", fail: 0 }

# Authority-vs-legacy compare (scope=all)
curl "https://www.goalradar.org/api/debug/authority-compare?scope=all" \
  -H "x-internal-token: $INTERNAL_TOKEN"
# PASS: { gate: "GREEN", redCount: 0 }
```

### Step 2 — Sample spot-checks (benchmark matches)

For each of the 4 benchmark matches (537351, 537391, 537392, 537397):

| Check | Expected |
|-------|---------|
| Hub lists match with correct score | ✓ |
| Results page shows FT score | ✓ |
| Fixtures page shows FT score | ✓ |
| Group page shows FT score | ✓ |
| Match detail page score identical | ✓ |
| `enrichmentApplied=true` on authority | ✓ |
| `goals.length > 0` on authority | ✓ |

---

## Gate Results (to be populated post-deploy)

### authority-drift endpoint

| Metric | Required | Actual |
|--------|----------|--------|
| verdict | GREEN | (pending) |
| total | > 0 | (pending) |
| green | = total | (pending) |
| yellow | (informational) | (pending) |
| red | = 0 | (pending) |

### integrity-audit endpoint

| Metric | Required | Actual |
|--------|----------|--------|
| overallVerdict | PASS | (pending) |
| fail | = 0 | (pending) |
| warn | (informational) | (pending) |

### authority-compare?scope=all

| Metric | Required | Actual |
|--------|----------|--------|
| gate | GREEN | (pending) |
| redCount | = 0 | (pending) |

---

## Page Spot-Check Results (to be populated post-deploy)

### Match 537351 — Germany vs Curaçao (7–1)

| Page | Score Shown | Correct |
|------|------------|---------|
| Hub | (pending) | ✓ if 7–1 |
| Results | (pending) | ✓ if 7–1 |
| Fixtures | (pending) | ✓ if 7–1 |
| Group (Group A) | (pending) | ✓ if 7–1 |
| Match Detail | (pending) | ✓ if 7–1 |

### Match 537369 — Spain vs Cape Verde (0–0 draw)

| Page | Score Shown | Correct |
|------|------------|---------|
| Hub | (pending) | ✓ if 0–0 |
| Results | (pending) | ✓ if 0–0 |
| Match Detail | (pending) | ✓ if 0–0, goals=0, enrichmentApplied=true |

---

## Score Drift Requirement

**REQUIREMENT: 0 score drift across all pages and all finished matches.**

A score drift is defined as:
- Listing page shows score X–Y
- Match detail page shows score A–B
- X ≠ A or Y ≠ B

After DATA-18E Phase 4, all listing pages read from the same authority cache (`goalradar:wc:authority:v1`), which is built from match snapshots. Score drift is only possible if:
1. The authority cache was built before a score correction (resolved within 30 min by next cron)
2. A snapshot is missing from KV (detected by `authority-drift` endpoint)
3. KV storage limit exceeded (would also affect snapshot reads — immediately visible)

---

## Verdict (to be filled post-deploy)

| Gate | Requirement | Status |
|------|-------------|--------|
| authority-drift RED=0 | Required | PENDING |
| integrity-audit FAIL=0 | Required | PENDING |
| authority-compare GREEN | Required | PENDING |
| Hub scores correct | Required | PENDING |
| Results scores correct | Required | PENDING |
| Fixtures scores correct | Required | PENDING |
| Group scores correct | Required | PENDING |
| Match detail scores correct | Required | PENDING |

**Overall: PENDING**
