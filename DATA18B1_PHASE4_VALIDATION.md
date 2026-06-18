# DATA-18B.1 Phase 4 — Production Validation

**Date:** 2026-06-18  
**Task:** DATA-18B.1 Authority Cache Pilot Migration  
**Phase:** 4 of 6 — Production validation (requires AUTHORITY_CACHE_PILOT=true)

---

## Pre-Activation: Regression Check (PILOT_ENABLED=false)

Before activating the pilot, confirmed the bracket page still renders correctly on the old path.

**Production check (2026-06-18, deployment 00a7ce9):**

```
GET https://www.goalradar.org/world-cup-2026/bracket
HTTP 200 | x-vercel-cache=PRERENDER | body=216065b
PASS: 'Knockout Bracket' found in body
```

Old path is intact. Pilot gate correctly defaults to `getWCKnockoutMatchesCached()` when `AUTHORITY_CACHE_PILOT` is unset.

---

## Activation Steps

To activate the pilot:

1. Vercel dashboard → goalradar project → Settings → Environment Variables
2. Add: `AUTHORITY_CACHE_PILOT = true` (Production environment)
3. Trigger a new deployment (or wait for next push to main to pick up the new env var)
4. Once deployed: ISR cache for bracket page refreshes on next request (up to 21600s, or purge via Vercel dashboard)

To force immediate cache refresh: Vercel dashboard → Deployments → latest deployment → Functions → `/world-cup-2026/bracket` → Purge ISR cache.

---

## Validation Protocol (run after AUTHORITY_CACHE_PILOT=true is deployed)

### Check 1: Bracket page still renders (no regression)

```powershell
$r = Invoke-WebRequest -Uri "https://www.goalradar.org/world-cup-2026/bracket" -MaximumRedirection 5 -TimeoutSec 30
"HTTP $($r.StatusCode) | cache=$($r.Headers['x-vercel-cache'])"
if ($r.Content -match "Knockout Bracket") { "PASS: bracket heading found" }
if ($r.Content -match "Round of 32") { "PASS: R32 section present" }
```

**Expected:** HTTP 200, "Knockout Bracket" present, "Round of 32" present.

### Check 2: Authority telemetry shows new reads

```powershell
$r = Invoke-WebRequest -Uri "https://www.goalradar.org/api/debug/authority-telemetry?secret=<CRON_SECRET>" -TimeoutSec 30
$r.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
```

**Expected:** `today.totalReads` increments when bracket page is requested (pilot path calls `readAuthorityCache()`). `coldRebuilds` remains 0.

### Check 3: Pilot path source confirmation

The bracket page (with PILOT_ENABLED=true) calls `getWCAuthorityMatchesV2` which calls `readAuthorityCache()`. Each call increments the telemetry counter. After requesting the bracket page once (force ISR revalidation), telemetry `drHits` or `primaryHits` should increment by 1.

### Check 4: Rollback test

```
1. Set AUTHORITY_CACHE_PILOT = false (or delete) in Vercel env vars
2. Redeploy / wait for propagation
3. Bracket page requests → telemetry drHits does NOT increment (old path active)
4. Bracket still renders correctly
```

**Expected:** Seamless rollback, no user-visible impact.

---

## Validation Results

*(To be filled in after AUTHORITY_CACHE_PILOT=true is deployed)*

| Check | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Bracket page renders | HTTP 200 | — | — |
| "Knockout Bracket" heading | Present | — | — |
| "Round of 32" section | Present | — | — |
| Authority telemetry | drHits increments | — | — |
| Cold rebuild | 0 | — | — |
| Rollback | Old path resumes | — | — |

---

## Current State

**Deployment:** `00a7ce9` pushed to main on 2026-06-18. Vercel deployment in progress.

**Flag status:** `AUTHORITY_CACHE_PILOT` not yet set in Vercel → old path active.

**Blocking:** Phase 4 validation requires user to set `AUTHORITY_CACHE_PILOT=true` in Vercel dashboard.

**Ready to validate:** All validation commands prepared above. Once flag is active, Phase 4 completes and Phase 5 (24h burn-in) begins.
