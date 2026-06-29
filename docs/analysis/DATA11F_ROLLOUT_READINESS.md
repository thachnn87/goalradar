# DATA-11F Production Rollout Readiness
## GoalRadar · Hybrid Provider — Pre-Rollout Audit

Date: 2026-06-16T08:45Z

---

## ⚠️ SECURITY BLOCK — Must Resolve First

`CRON_SECRET` is stored in plain text inside `.env.local` as a comment
(line 14: `# Value=goalradar_cron_...`).

**Required before proceeding:**

```bash
# 1. Open .env.local and delete line 14 entirely (the # Value= comment line)
# 2. Add CRON_SECRET as an active variable:
CRON_SECRET=<paste value here>
# 3. Verify it's active, not commented:
grep "^CRON_SECRET=" .env.local
```

This is a local-only risk (`.env.local` is git-ignored) but eliminates future
accidental exposure. The production secret is unchanged — no rotation required
unless the value was previously logged or transmitted insecurely.

---

## 1. Deployment State

| Item | Value |
|------|-------|
| Current HEAD | `80424bbd42143aa45df89750670df26bddaa8fff` |
| Short ref | `80424bb` |
| Commit message | `feat(data): DATA-11B/C hybrid AF enrichment + DATA-10 minute-trace` |
| Push time | 2026-06-16T08:11Z |
| Production confirmed live | 08:12:37Z (401 on first endpoint probe) |
| Working tree | **Clean** — no uncommitted source changes |
| TypeScript | **0 errors** |

### DATA-11B Files (all in commit 80424bb)

| File | Lines | Status |
|------|-------|--------|
| `src/lib/af-id-map.ts` | 282 | ✅ Tracked, committed |
| `src/lib/match-snapshot.ts` | 663 | ✅ Modified, committed |
| `src/app/api/debug/hybrid-enrichment/[matchId]/route.ts` | 181 | ✅ Tracked, committed |
| `src/app/api/debug/hybrid-enrichment/refresh-lookup/route.ts` | 52 | ✅ Tracked, committed |

### DATA-11C Files (all in commit 80424bb)

| File | Lines | Status |
|------|-------|--------|
| `src/app/api/revalidate/match/[id]/route.ts` | 52 | ✅ Tracked, committed |

### DATA-10 Files (in commit 80424bb)

| File | Lines | Status |
|------|-------|--------|
| `src/app/api/debug/minute-trace/[id]/route.ts` | 281 | ✅ Tracked, committed |

---

## 2. Environment Variable Audit

### Local (.env.local)

| Variable | Present | Value | Notes |
|----------|---------|-------|-------|
| `ENABLE_AF_ENRICHMENT` | ✅ | `true` | Active, correct |
| `API_FOOTBALL_KEY` | ✅ | `<32 chars>` | Active |
| `CRON_SECRET` | ⚠️ | comment only | **Security issue** — commented `# Value=...`, not active |
| `REVALIDATE_SECRET` | ✅ | `<73 chars>` | Active |
| `KV_REST_API_URL` | ❌ | NOT SET | Blocks local enrichment |
| `KV_REST_API_TOKEN` | ❌ | NOT SET | Blocks local enrichment |
| `FOOTBALL_API_KEY` | ✅ | `<32 chars>` | football-data.org key, active |

### Production (Vercel) — inferred from endpoint behaviour

| Variable | Status | Evidence |
|----------|--------|----------|
| `CRON_SECRET` | ✅ Confirmed present | Endpoints return 401, not 500 (`CRON_SECRET is not set` error path) |
| `REVALIDATE_SECRET` | ✅ Confirmed present | `/api/revalidate` returns 401, not 500 |
| `KV_REST_API_URL` | ✅ Inferred present | Snapshot and live-score features work in production |
| `KV_REST_API_TOKEN` | ✅ Inferred present | Same inference |
| `API_FOOTBALL_KEY` | ⏳ Unconfirmed | Cannot verify without authenticated call |
| `ENABLE_AF_ENRICHMENT` | ❌ Not yet set | Must be added before rollout |

---

## 3. Enrichment Execution Readiness

### Local

```
ENABLE_AF_ENRICHMENT = 'true'   ✅
AF_KEY_CONFIGURED    = true     ✅  (API_FOOTBALL_KEY set)
KV_ENABLED           = false    ❌  (KV_REST_API_URL not set)
─────────────────────────────────────
AF_ENRICHMENT_ENABLED = false
```

**Local enrichment: CANNOT FIRE**

Single prerequisite missing: `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
Pull from Vercel KV dashboard → Storage → your KV store → `.env.local` snippet.

### Production

```
ENABLE_AF_ENRICHMENT = not set  ❌  (must be added)
AF_KEY_CONFIGURED    = unknown  ⏳  (requires authenticated probe)
KV_ENABLED           = true     ✅  (inferred)
─────────────────────────────────────
AF_ENRICHMENT_ENABLED = false   (blocked by missing flag)
```

**Production enrichment: CANNOT FIRE** — `ENABLE_AF_ENRICHMENT` not yet set.

---

## 4. Endpoint Verification

All probed 2026-06-16T08:20Z against `https://www.goalradar.org`:

| Method | Endpoint | HTTP | Status |
|--------|----------|------|--------|
| GET | `/api/debug/hybrid-enrichment/537358` | 401 | ✅ EXISTS |
| GET | `/api/debug/hybrid-enrichment/537364` | 401 | ✅ EXISTS |
| GET | `/api/debug/hybrid-enrichment/537352` | 401 | ✅ EXISTS |
| POST | `/api/debug/hybrid-enrichment/refresh-lookup` | 401 | ✅ EXISTS |
| POST | `/api/revalidate/match/537358` | 401 | ✅ EXISTS |
| GET | `/api/debug/minute-trace/537391` | 401 | ✅ EXISTS |

All 6 return 401 (auth required), not 404. Every required endpoint is live.

---

## 5. Rollout Checklist

Work through these steps in order. Do not skip ahead.

---

### Step 0 — Fix security issue (local)

```bash
# Edit .env.local: delete the '# Value=goalradar_cron_...' comment line
# Then add as an active variable:
echo 'CRON_SECRET=<your_value>' >> .env.local

# Verify:
grep "^CRON_SECRET=" .env.local
# Expected: CRON_SECRET=goalradar_cron_...
```

---

### Step 1 — Add KV vars locally (optional — enables local dev verification)

Pull from Vercel dashboard → Storage → your KV instance → `.env.local` tab.
Add to `.env.local`:
```
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

Restart dev server. Local `AF_ENRICHMENT_ENABLED` becomes `true`.

---

### Step 2 — Confirm API_FOOTBALL_KEY in Vercel

```bash
export CRON_SECRET=<your_value>

curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); \
    process.stdin.on('end',()=>{ const j=JSON.parse(d); \
    console.log('apiFootballKeySet:', j.apiFootballKeySet, \
                '| kvEnabled:', j.kvEnabled, \
                '| enrichmentEnabled:', j.enrichmentEnabled); })"
```

**Expected:** `apiFootballKeySet: true | kvEnabled: true | enrichmentEnabled: false`

If `apiFootballKeySet: false`:
→ Add `API_FOOTBALL_KEY=<your_af_key>` to Vercel env (Settings → Environment Variables)
→ **Redeploy** (Vercel does NOT hot-reload new env vars on serverless — must redeploy)
→ Re-run this step

---

### Step 3 — Set ENABLE_AF_ENRICHMENT=true in Vercel

In Vercel Project Settings → Environment Variables:
- Key: `ENABLE_AF_ENRICHMENT`
- Value: `true`
- Environment: Production (and Preview if desired)

Then **trigger a redeploy** to guarantee all serverless instances pick up the new value:
```bash
# Either push a trivial commit, or use Vercel dashboard Redeploy button
# OR rely on cold-start pickup (takes effect within minutes on new requests, but not guaranteed immediately)
```

**Verify the flag is live:**
```bash
curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); \
    process.stdin.on('end',()=>{ const j=JSON.parse(d); \
    console.log('enrichmentEnabled:', j.enrichmentEnabled); })"
```

**Expected:** `enrichmentEnabled: true`

Do NOT proceed until this returns `true`.

---

### Step 4 — Seed the AF lookup table

```bash
curl -s -X POST \
  "https://www.goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET" \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c); \
    process.stdin.on('end',()=>{ const j=JSON.parse(d); \
    console.log('ok:', j.ok, '| count:', j.count, '| collisions:', j.collisions?.length ?? j.collisions); })"
```

**Expected:** `ok: true | count: ≥90 | collisions: 0`

If `ok: false`:
- `error: 'API_FOOTBALL_KEY not configured'` → Step 2 incomplete
- `error: 'KV not configured'` → production KV env vars missing (should not occur)
- HTTP 500 with other error → check Vercel function logs

---

### Step 5 — Invalidate existing snapshots for the 3 verification matches

Existing snapshots for these matches contain `goals: []` (built before enrichment
was enabled). The enrichment block only runs in `buildSnapshot()` on a KV miss.
These must be deleted so the next page request rebuilds them with enrichment.

```bash
for id in 537358 537364 537352; do
  RESULT=$(curl -s -X POST \
    "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET")
  echo "match $id: $(echo $RESULT | node -e "let d=''; process.stdin.on('data',c=>d+=c); \
    process.stdin.on('end',()=>{ try { const j=JSON.parse(d); \
    process.stdout.write(JSON.stringify({ok:j.ok,matchId:j.matchId})); } \
    catch(e) { process.stdout.write(d.slice(0,80)); } })" 2>/dev/null)"
done
```

**Expected for each:** `{"ok":true,"matchId":"537358"}` etc.

---

### Step 6 — Trigger snapshot rebuilds

Fetch each match page to force `buildSnapshot()` to run:

```bash
for id in 537358 537364 537352; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://www.goalradar.org/match/$id")
  echo "match $id: HTTP $CODE"
done
sleep 5
```

**Expected:** HTTP 200 for each. The 5-second wait allows the async KV write to complete.

---

### Step 7 — Verify enrichment applied

```bash
for id in 537358 537364 537352; do
  echo "=== match $id ==="
  curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/$id?secret=$CRON_SECRET" \
    | node -e "let d=''; process.stdin.on('data',c=>d+=c); \
      process.stdin.on('end',()=>{ const j=JSON.parse(d); \
      console.log(JSON.stringify({ \
        mappingKey: j.mappingKey, \
        afFixtureId: j.afFixtureId, \
        enrichmentApplied: j.enrichmentApplied, \
        snapshotGoalsCount: j.snapshotGoalsCount, \
        snapshotBookingsCount: j.snapshotBookingsCount, \
        snapshotSubsCount: j.snapshotSubsCount, \
        source: j.source \
      }, null, 2)); })"
done
```

**Expected results:**

| Match | Goals expected | `enrichmentApplied` | `source` |
|-------|---------------|---------------------|----------|
| 537358 Sweden vs Tunisia | 6 | `true` | `kv-cache` |
| 537364 Iran vs New Zealand | 4 | `true` | `kv-cache` |
| 537352 Ivory Coast vs Ecuador | 1 | `true` | `kv-cache` |

**If `enrichmentApplied: false` or `snapshotGoalsCount: 0`:**

Check `source` field:

| source | Diagnosis | Fix |
|--------|-----------|-----|
| `not-enabled` | Flag not propagated yet | Wait for redeploy / cold-start, re-run Steps 5–7 |
| `lookup-miss` | AF has different team name for this match | Check `mappingKey`, add alias to `CANONICAL_ALIASES` |
| `api-football-fresh` | Lookup present, events not fetched yet | Re-run Step 6 (snapshot rebuild) |
| `not-finished` | Match not FINISHED in KV | Should not occur for these matches |

---

### Step 8 — Safety gate check

If **all 3 matches** show `snapshotGoalsCount: 0` after completing Steps 5–7:

```bash
# Emergency disable:
# In Vercel dashboard: remove ENABLE_AF_ENRICHMENT or set to 'false'
# Then revalidate to restore unenriched snapshots:
for id in 537358 537364 537352; do
  curl -s -X POST "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET"
done
```

---

### Step 9 — Visual confirmation

Open in browser:
- `https://www.goalradar.org/match/537358` (Sweden vs Tunisia — expect 6 scorers)
- `https://www.goalradar.org/match/537364` (Iran vs New Zealand — expect 4 scorers)
- `https://www.goalradar.org/match/537352` (Ivory Coast vs Ecuador — expect 1 scorer)

**Check on each page:**
- GoalScorers component: shows player names + minutes (e.g. `Isak 23'`)
- GoalsSection: visible with team attribution
- BookingsSection: visible (if AF returned bookings)
- SubstitutionsSection: visible (if AF returned substitutions)

---

### Step 10 — Schedule daily lookup refresh (optional)

The lookup table TTL is 24h. For tournaments running >24h, add a daily refresh
to the cron orchestrator or set a Vercel cron:

```bash
# Manual daily refresh (run once per day):
curl -s -X POST \
  "https://www.goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"
```

Or add to `vercel.json` crons (do NOT touch `vercel.json` — per project constraints).
Alternative: add a call to `refreshAfLookupTable()` inside the existing cron orchestrator
at `/api/cron/orchestrator` — this is a future task, not required for initial rollout.

---

## 6. Final Verdict: YELLOW

| Dimension | Status | Blocker |
|-----------|--------|---------|
| Code deployed | ✅ GREEN | — |
| All endpoints live | ✅ GREEN | — |
| TypeScript | ✅ GREEN | 0 errors |
| Working tree | ✅ GREEN | Clean |
| Production KV | ✅ GREEN | Inferred present |
| Production CRON_SECRET | ✅ GREEN | Confirmed (401 responses) |
| Local security | ⚠️ YELLOW | CRON_SECRET in `.env.local` comment — Step 0 |
| Production API_FOOTBALL_KEY | ⏳ YELLOW | Unconfirmed — verify in Step 2 |
| Production ENABLE_AF_ENRICHMENT | ❌ YELLOW | Not set — required in Step 3 |
| Local KV | ❌ YELLOW | KV_REST_API_URL missing — local enrichment blocked (Step 1, optional) |

**Safe to run DATA-11D rollout?** **YES — after Step 0** (security fix).

Steps 2–9 ARE the rollout. Step 0 is the only prerequisite that must happen
before starting. Step 1 (local KV) is optional and does not block production.

---

## Quick-Start (after Step 0)

```bash
export CRON_SECRET=<your_value>

# Step 2: confirm key
curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET" | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('keySet:',j.apiFootballKeySet,'kvEnabled:',j.kvEnabled);})"

# Step 3: set ENABLE_AF_ENRICHMENT=true in Vercel, then confirm:
curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/537358?secret=$CRON_SECRET" | \
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('enrichmentEnabled:',j.enrichmentEnabled);})"

# Step 4: seed lookup
curl -s -X POST "https://www.goalradar.org/api/debug/hybrid-enrichment/refresh-lookup?secret=$CRON_SECRET"

# Steps 5-6: invalidate + rebuild
for id in 537358 537364 537352; do
  curl -s -X POST "https://www.goalradar.org/api/revalidate/match/$id?secret=$CRON_SECRET" > /dev/null
  curl -s -o /dev/null "https://www.goalradar.org/match/$id"
done
sleep 5

# Step 7: verify
for id in 537358 537364 537352; do
  curl -s "https://www.goalradar.org/api/debug/hybrid-enrichment/$id?secret=$CRON_SECRET" | \
    node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.fdMatchId,'goals:',j.snapshotGoalsCount,'applied:',j.enrichmentApplied,'source:',j.source);})"
done
```
