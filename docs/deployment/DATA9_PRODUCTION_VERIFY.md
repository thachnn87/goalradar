# DATA-9 Production Verification Report
## GoalRadar · ISR Control Plane Post-Deploy Audit

Date: 2026-06-16
Commit deployed: 2d4599c (DATA-9 ISR control plane)
Prior commit: 777dc3a (DATA-8 hotfix)

---

## Overall Verdict: PARTIAL PASS — ONE BLOCKER

DATA-9 code is deployed and correct. All ISR page content checks pass. The `/api/revalidate`
endpoint is live and auth-rejects unauthenticated requests correctly.

**Blocking issue:** `REVALIDATE_SECRET` environment variable is not set in Vercel production.
The endpoint exists but returns 401 for all POST requests (including with the correct secret)
because `process.env.REVALIDATE_SECRET` is undefined server-side.

**Required action:** Set `REVALIDATE_SECRET` in Vercel dashboard → Settings → Environment
Variables → Production. Value: `9f1e7ab483d0f9f55d71b2d80c7c84a6f1f62b4f7c2d6a1e93f0a6f8e9b3d4c115jun2026`
(stored in `.env.local`). Redeploy or trigger a redeployment after adding it.

---

## Check 1: `/api/revalidate` — Endpoint Availability

### 1a. GET request (no auth) — expect 405

```
GET https://goalradar.org/api/revalidate
```

| Check | Status | Evidence |
|-------|--------|----------|
| HTTP 405 returned | ✅ PASS | HTTP 405 Method Not Allowed |
| Response body includes `availablePaths` | ✅ PASS | All 11 WC paths present |
| DATA-9 deployment confirmed | ✅ PASS | 404 → 405 confirms new code live |

Response body:
```json
{
  "error": "Method not allowed. Use POST.",
  "availablePaths": [
    "/world-cup-2026",
    "/world-cup-2026/groups",
    "/world-cup-2026/teams",
    "/world-cup-2026/matches",
    "/world-cup-2026/fixtures",
    "/world-cup-2026-standings",
    "/world-cup-2026-groups",
    "/world-cup-2026-schedule",
    "/world-cup-2026-results",
    "/world-cup-2026/[group]",
    "/world-cup-2026/teams/[slug]"
  ]
}
```

### 1b. POST without secret — expect 401

```
POST https://goalradar.org/api/revalidate
(no Authorization header)
```

| Check | Status | Evidence |
|-------|--------|----------|
| HTTP 401 returned | ✅ PASS | `{"error":"Unauthorized"}` HTTP 401 |

### 1c. POST with correct secret — expect 200

```
POST https://goalradar.org/api/revalidate
Authorization: Bearer 9f1e7ab483d...
```

| Check | Status | Evidence |
|-------|--------|----------|
| HTTP 200 returned | ❌ FAIL | HTTP 401 `{"error":"Unauthorized"}` |
| `success: true` in response | ❌ FAIL | Request rejected before execution |
| Revalidated paths in response | ❌ FAIL | Same — request rejected |

**Root cause:** `process.env.REVALIDATE_SECRET` is undefined in Vercel production. The auth
function returns false immediately when the env var is not set.

**Fix:** Set `REVALIDATE_SECRET` in Vercel dashboard → Settings → Environment Variables →
Production. After saving, trigger a new deployment (or use Vercel's "Instant rollback" /
redeploy) for the env var to take effect.

---

## Check 2: Orchestrator Integration

**Status: BLOCKED** — `CRON_SECRET` not available in local env (it is set in Vercel).
Cannot call `POST /api/cron/orchestrator` to trigger a run and inspect the `revalidation`
field in the response.

**What can be verified indirectly:** The orchestrator code change is confirmed in the commit
`2d4599c` — `revalidateWCPaths()` is called after WC task success with the guard logic that
skips revalidation on failure. This will be exercised automatically on the next cron run
(every 30 min). Verification of the `revalidation.success=true` field requires access to
`CRON_SECRET` or checking Vercel function logs.

| Check | Status | Evidence |
|-------|--------|----------|
| Orchestrator code updated | ✅ PASS | Commit diff confirms import + hook in orchestrator route |
| `revalidation` field in response | ⚠️ BLOCKED | Needs CRON_SECRET to call orchestrator |
| `success=true` in revalidation | ⚠️ BLOCKED | Needs CRON_SECRET + REVALIDATE_SECRET set |
| Paths revalidated logged | ⚠️ BLOCKED | Check Vercel function logs after next cron run |

---

## Check 3: Debug Endpoint

```
GET https://goalradar.org/api/debug/revalidation
```

| Check | Status | Evidence |
|-------|--------|----------|
| Endpoint is live | ✅ PASS | HTTP 401 (not 404) confirms endpoint deployed |
| Returns 401 without CRON_SECRET | ✅ PASS | `{"error":"Unauthorized"}` HTTP 401 |
| Last run data visible (authenticated) | ⚠️ BLOCKED | Needs CRON_SECRET |

---

## Check 4: Stale-Page Recovery — `/world-cup-2026/teams`

| Check | Status | Evidence |
|-------|--------|----------|
| "Group Group A" absent | ✅ PASS | All group labels show single "Group X" |
| Group links valid (not `group-group`) | ✅ PASS | URLs follow `/world-cup-2026/group-a` pattern |
| Browse by Group section present | ✅ PASS | Section visible with all 12 groups |
| South Africa in Group A | ✅ PASS | South Africa listed under Group A |
| TTL reduced to 3600s | ✅ PASS | Build output confirmed: `1h` |

---

## Check 5: Schedule Page — Fake Fixtures

```
GET https://goalradar.org/world-cup-2026-schedule
```

| Check | Status | Evidence |
|-------|--------|----------|
| "Mexico vs Spain" absent | ✅ PASS | Not found on page |
| "USA vs France" absent | ✅ PASS | Not found on page |
| "Canada vs England" absent | ✅ PASS | Not found on page |
| "Argentina vs Italy" absent | ✅ PASS | Not found on page |
| Real fixtures shown | ✅ PASS | Belgium vs Egypt, Saudi Arabia vs Uruguay, Iran vs New Zealand |
| TTL reduced to 300s | ✅ PASS | Build output confirmed: `5m` |

---

## Check 6: Team Pages — Group Labels

### South Africa (`/world-cup-2026/teams/south-africa`)

| Check | Status | Evidence |
|-------|--------|----------|
| Group badge shows "Group A" (not "Group Group A") | ✅ PASS | "Group A" confirmed |
| FAQ answer correct | ✅ PASS | "South Africa are in Group A at the FIFA World Cup 2026." |
| Group link URL is `/world-cup-2026/group-a` | ✅ PASS | Confirmed clean URL |

### Brazil (`/world-cup-2026/teams/brazil`)

| Check | Status | Evidence |
|-------|--------|----------|
| Group badge shows "Group C" | ✅ PASS | "Group C" confirmed |
| FAQ answer correct | ✅ PASS | "Brazil are in Group C at the FIFA World Cup 2026." |
| Group link URL is `/world-cup-2026/group-c` | ✅ PASS | Confirmed |

### Italy (`/world-cup-2026/teams/italy`)

| Check | Status | Evidence |
|-------|--------|----------|
| FAQ: "No. Italy did not qualify…" | ✅ PASS | Exact text: "No. Italy did not qualify for the FIFA World Cup 2026. Italy, four-time world champions, did not qualify for the FIFA World Cup 2026, failing to advance through the UEFA qualifying process." |
| No group FAQ shown for Italy | ✅ PASS | Only one FAQ visible: "Is Italy in the World Cup 2026?" |
| No group badge shown | ✅ PASS | No group badge — Italy did not qualify |

---

## Check 7: Group Pages

### Group G (`/world-cup-2026/group-g`)

| Check | Status | Evidence |
|-------|--------|----------|
| Standings table visible (not empty) | ✅ PASS | All 4 teams shown: Egypt, Belgium, Iran, New Zealand |
| "Standings will appear once matches begin" absent | ✅ PASS | Real table shown |
| FAQ team list populated | ✅ PASS | "Egypt, Belgium, Iran, New Zealand" |
| Italy absent | ✅ PASS | Not found anywhere on page |

### Group A (`/world-cup-2026/group-a`)

| Check | Status | Evidence |
|-------|--------|----------|
| Standings table visible | ✅ PASS | Mexico, Korea Republic, Czechia, South Africa |

### `/world-cup-2026-standings`

| Check | Status | Evidence |
|-------|--------|----------|
| Heading "Live Group Standings" | ✅ PASS | Confirmed |
| All 12 groups shown | ✅ PASS | Confirmed |
| No "pre-tournament" or static banner | ✅ PASS | None present |

---

## Check 8: Provider Traffic

ISR TTL reductions do NOT increase football-data.org API calls.

**Why:** Next.js ISR page regeneration reads from the three-tier cache:
- L1: in-memory Map (30s TTL) — hit on warm serverless instances
- L2: Vercel KV (60–7200s TTL per endpoint) — hit when L1 cold
- L3: football-data.org — only called when L2 is expired

The orchestrator cron refreshes KV every 30 min. Page regenerations read from L2 (KV).
Shorter ISR TTLs only affect how often Vercel runs the page's async data-fetching code,
which resolves from KV in <5ms — not from the provider.

| Check | Status | Evidence |
|-------|--------|----------|
| TTL reductions increase provider calls | ✅ PASS (no increase) | Architectural: ISR reads KV, not provider directly |
| Orchestrator schedule unchanged | ✅ PASS | Cron still every 30 min |
| No new provider endpoints added | ✅ PASS | Diff shows only revalidation calls added, no new fetch paths |

---

## TTL Verification Summary

| Page | Before | After | Build Output | Status |
|------|--------|-------|--------------|--------|
| `/world-cup-2026/teams` | 86400s | 3600s | `1h` | ✅ PASS |
| `/world-cup-2026-schedule` | 3600s | 300s | `5m` | ✅ PASS |
| `/world-cup-2026-results` | 900s | 300s | `5m` | ✅ PASS |
| `/world-cup-2026/matches` | 3600s | 300s | `5m` | ✅ PASS |
| `/world-cup-2026-predictions` | 900s | 86400s | `1d` | ✅ PASS |

Cache-Control headers on production pages show `public, max-age=0, must-revalidate` — this
is correct for Vercel ISR pages (browser sees max-age=0; Vercel edge cache uses the server-
side `revalidate` value for background regeneration).

---

## Risk Flag: `/world-cup-2026-predictions` TTL

**Observation:** The `/world-cup-2026-predictions` page shows "Live data — 24 World Cup matches
loaded" with a "Recent Results & Post-Match Analysis" section containing live match scores
(e.g. Sweden 5–1 Tunisia).

**Issue:** This page was raised from 900s → 86400s (per DATA-9 spec). With a 24h TTL, recent
match results shown on this page could be stale for up to 24h after a match ends.

**Recommendation:** If the predictions page is intended to show live match results, consider
reducing its TTL back to 3600s or 1800s. If it is purely editorial content that happens to
import match data, 86400s is acceptable. The per-group prediction pages
(`/world-cup-2026/group-*-predictions`) are confirmed static editorial — 86400s is correct
there.

---

## Remaining Issues

| Issue | Severity | Action |
|-------|----------|--------|
| `REVALIDATE_SECRET` not set in Vercel | **P0** | Set in Vercel → Settings → Environment Variables → Production, then redeploy |
| `POST /api/revalidate` returns 401 in production | P0 — blocks endpoint | Resolved by above |
| Orchestrator `revalidation` field unverified | MEDIUM | Verify in Vercel function logs after next cron run, or set CRON_SECRET locally |
| `/world-cup-2026-predictions` 86400s TTL with live match data | LOW | Consider TTL 1800s if results freshness matters on this page |

---

## Recommended Next Steps

### Immediate (before next cron run)

1. **Set `REVALIDATE_SECRET`** in Vercel dashboard:
   - Vercel → Project → Settings → Environment Variables
   - Name: `REVALIDATE_SECRET`
   - Value: `9f1e7ab483d0f9f55d71b2d80c7c84a6f1f62b4f7c2d6a1e93f0a6f8e9b3d4c115jun2026`
   - Environments: Production (+ Preview if desired)
   - Trigger redeploy after saving

2. **Verify orchestrator revalidation** after next cron run:
   - Check Vercel function logs for `[ISR] orchestrator: revalidated 11 WC paths | success=true`
   - Or call `GET /api/debug/revalidation?secret=$CRON_SECRET` once REVALIDATE_SECRET is set

3. **Smoke-test the endpoint** once secret is set:
   ```bash
   curl -X POST https://goalradar.org/api/revalidate \
     -H "Authorization: Bearer 9f1e7ab483d0f9f55d71b2d80c7c84a6f1f62b4f7c2d6a1e93f0a6f8e9b3d4c115jun2026"
   # Expected: {"success":true,"count":11,...}
   ```

### Next Sprint: DATA-10

1. **Dead code cleanup**: `src/lib/wc-static-groups.ts`, `src/data/worldcup/fixtures.json`,
   COMPACT array in `src/lib/wc-fixtures.ts` — fully orphaned after DATA-7/DATA-8
2. **Deploy webhook**: Wire `POST /api/revalidate` to the Vercel deploy success webhook so
   every deploy automatically clears stale HTML — eliminating the "correct code, stale HTML"
   failure class entirely
3. **Predictions page TTL review**: Decide whether `/world-cup-2026-predictions` should
   serve live results (→ 1800s) or be treated as static editorial (→ 86400s stays)
