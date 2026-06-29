# DATA-11E Environment Audit
## GoalRadar · Hybrid Provider — Environment Readiness Audit

Date: 2026-06-16T08:30Z
Audited commit: 80424bb

---

## ⚠️ SECURITY FINDING — Action Required Before Continuing

**`CRON_SECRET` is present in plain text inside `.env.local` as a comment.**

```
# Value=goalradar_cron_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Even though `.env.local` is git-ignored, keeping production secrets in
comment lines creates risk:
- Accidental commits (`.gitignore` overrides, `git add -f`, IDE sync)
- Local filesystem exposure (backups, shared dev machines)
- Log or debug output that echoes file contents

**Required action before proceeding with DATA-11D rollout:**

1. Remove the `# Value=...` comment from `.env.local`
2. Set `CRON_SECRET` as an active variable: `CRON_SECRET=<value>` (uncommented)
3. Rotate the secret if it was ever logged or shared in an insecure channel

**This audit does not use or reveal the secret value found.**

---

## 1. Variable Inventory

### ENABLE_AF_ENRICHMENT

| Attribute | Value |
|-----------|-------|
| Consumed by | `src/lib/af-id-map.ts:42` |
| Evaluation | Module-level const at cold-start (`process.env.ENABLE_AF_ENRICHMENT === 'true'`) |
| Build-time required | No — runtime only |
| Default | OFF (`undefined !== 'true'`) |
| Missing behaviour | **Silent disable** — `AF_ENRICHMENT_ENABLED = false`, no error, no log |
| Stale flag risk | Yes — if set to `'true'` before API_FOOTBALL_KEY or KV are configured, it evaluates to false silently |

### API_FOOTBALL_KEY

| Attribute | Value |
|-----------|-------|
| Consumed by | `src/lib/providers/api-football.ts:258`, `src/lib/providers/manager.ts:51`, `src/lib/af-id-map.ts:33` |
| Evaluation | Two independent checks: `AF_KEY_CONFIGURED` in af-id-map.ts and in manager.ts |
| Build-time required | No — runtime only |
| Default | `''` (empty string fallback in `fetchRaw`) |
| Missing behaviour | api-football sends `x-apisports-key: ''` → HTTP 200 with `errors: { token: "..." }` body → `ApiUnavailableError` thrown → `enrichMatchWithAFEvents` catches and returns unenriched match (best-effort). **Silent graceful degradation.** |
| Enrichment guard | `refreshAfLookupTable()` throws explicitly: `'API_FOOTBALL_KEY not configured'`. Other paths fail silently. |

### CRON_SECRET

| Attribute | Value |
|-----------|-------|
| Consumed by | `src/lib/refresh.ts:319,347`, 8 API route files directly |
| Evaluation | Runtime only — checked per-request |
| Build-time required | No |
| Default | Not set → all CRON-protected endpoints return 401 (fail closed) |
| Missing behaviour | **Fail closed** — `'[Auth] CRON_SECRET is not set — cron endpoint denied.'` logged, returns false. 401 returned to caller. |
| Routes protected | `/api/cache-stats`, `/api/cron/orchestrator`, `/api/debug/*`, `/api/revalidate/match/[id]`, `/api/newsletter/migrate` |
| Dev bypass | `NODE_ENV === 'development'` → auth skipped on all CRON_SECRET-protected routes |

### REVALIDATE_SECRET

| Attribute | Value |
|-----------|-------|
| Consumed by | `src/app/api/revalidate/route.ts:26` only |
| Evaluation | Runtime only — checked per-request |
| Build-time required | No |
| Default | Not set → POST /api/revalidate always returns 401 (fail closed) |
| Missing behaviour | **Fail closed** — 401 |
| Note | Different secret from CRON_SECRET — `/api/revalidate` (ISR paths) uses REVALIDATE_SECRET; `/api/revalidate/match/[id]` (KV delete) uses CRON_SECRET. Two separate auth scopes. |

---

## 2. File Consumption Map

| Variable | File | Line(s) | Purpose |
|----------|------|---------|---------|
| `ENABLE_AF_ENRICHMENT` | `src/lib/af-id-map.ts` | 42 | Feature flag in `AF_ENRICHMENT_ENABLED` const |
| `API_FOOTBALL_KEY` | `src/lib/af-id-map.ts` | 33–34 | `AF_KEY_CONFIGURED` const |
| `API_FOOTBALL_KEY` | `src/lib/providers/api-football.ts` | 258 | `fetchRaw` header value |
| `API_FOOTBALL_KEY` | `src/lib/providers/manager.ts` | 51–52 | `AF_KEY_CONFIGURED` const (failover gate) |
| `CRON_SECRET` | `src/lib/refresh.ts` | 319, 347 | Shared auth helpers `isCronAuth`, `isExternalAuth` |
| `CRON_SECRET` | 8 route files | various | Inline `isAuthorized()` checks |
| `REVALIDATE_SECRET` | `src/app/api/revalidate/route.ts` | 26 | ISR revalidation endpoint auth |

**Note:** `AF_KEY_CONFIGURED` is independently computed in two places — `af-id-map.ts` and `manager.ts`. Both evaluate `process.env.API_FOOTBALL_KEY` the same way. No shared constant. If the variable name ever changes, both must be updated.

---

## 3. Build-Time vs Runtime

All four variables are **runtime-only**. None are inlined at build time (`NEXT_PUBLIC_` prefix absent). Vercel picks them up from environment at cold-start. Changing them in Vercel dashboard takes effect on the next cold-start (next deployment or after the current function instance reuses expire — typically within minutes, worst case up to 26 hours on Vercel's hobby tier).

**Implication for rollout:** After setting `ENABLE_AF_ENRICHMENT=true` in Vercel, a re-deployment is NOT strictly required but **is the safest way** to guarantee all running function instances pick up the new value immediately.

---

## 4. Local Environment Matrix

| Variable | Local Present | Value | Effect |
|----------|--------------|-------|--------|
| `ENABLE_AF_ENRICHMENT` | ✅ YES | `true` | Flag set correctly |
| `API_FOOTBALL_KEY` | ✅ YES | `<32 chars>` | AF calls can be made |
| `KV_REST_API_URL` | ❌ NO | — | `KV_ENABLED = false` |
| `KV_REST_API_TOKEN` | ❌ NO | — | `KV_ENABLED = false` |
| `CRON_SECRET` | ⚠️ COMMENT ONLY | — | Debug endpoints require dev mode |
| `REVALIDATE_SECRET` | ✅ YES | `<73 chars>` | `/api/revalidate` works locally |

**`AF_ENRICHMENT_ENABLED` evaluation on local dev server:**

```
ENABLE_AF_ENRICHMENT = 'true'   ✅
AF_KEY_CONFIGURED    = true     ✅
KV_ENABLED           = false    ❌  ← KV_REST_API_URL missing
─────────────────────────────────────
AF_ENRICHMENT_ENABLED = false   ← enrichment CANNOT fire locally
```

---

## 5. Production Environment Matrix

| Variable | Production Required | Confirmed Present | Notes |
|----------|--------------------|--------------------|-------|
| `ENABLE_AF_ENRICHMENT` | Required = `'true'` | ⏳ Unconfirmed | Must be set before rollout |
| `API_FOOTBALL_KEY` | Required | ⏳ Unconfirmed | Without it, all AF calls silently degrade |
| `KV_REST_API_URL` | Required | ✅ Inferred present | KV features (snapshots, live cache) work in production |
| `KV_REST_API_TOKEN` | Required | ✅ Inferred present | Same inference |
| `CRON_SECRET` | Required | ✅ Confirmed | Endpoints return 401, not 500 — secret is set |
| `REVALIDATE_SECRET` | Required | ✅ Confirmed | `/api/revalidate` returns 401, not 500 |

**KV inference:** The production site serves match snapshots and live scores correctly. Both require KV reads. Therefore KV_REST_API_URL and KV_REST_API_TOKEN are present in production.

**API_FOOTBALL_KEY inference:** Production site uses AF as failover provider. The DATA-11B debug endpoint reports `apiFootballKeySet` — this can be confirmed with one authenticated call.

---

## 6. Hybrid Activation Path — Step-by-Step Env Dependency

```
refreshAfLookupTable()
├── Guard: KV_ENABLED → false → throws 'KV not configured'  [stops here if KV absent]
├── Guard: AF_KEY_CONFIGURED → false → throws 'API_FOOTBALL_KEY not configured'
└── Calls ApiFootballProvider.getAllMatches('WC')
    └── fetchRaw: sends x-apisports-key header
        ├── Key empty → HTTP 200 + json.errors → ApiUnavailableError thrown → refreshAfLookupTable throws
        └── Key valid → HTTP 200 + matches array → table written to KV

resolveAfFixtureId(match)
├── Guard: KV_ENABLED → false → returns null (silent)
└── kv.get(AF_LOOKUP_KV_KEY)
    ├── Table absent → returns null + warning log
    └── Key miss → returns null + warning log

enrichMatchWithAFEvents(match)  [called from buildSnapshot()]
├── kv.get(af:events:{fdId}) → HIT → apply cached events (0 AF API calls)
├── MISS → resolveAfFixtureId(match) → null → return match unchanged
└── MISS + afId found → ApiFootballProvider.getMatch(afId) [2 AF API calls]
    ├── throws → catch → return match unchanged (best-effort)
    └── success → kv.set(af:events:{fdId}, events, 7d) + return enriched match

buildSnapshot()  [in match-snapshot.ts]
├── Guard: AF_ENRICHMENT_ENABLED → false → skip enrichment block entirely
├── Guard: match.status !== 'FINISHED' → skip
├── Guard: match.competition?.code !== 'WC' → skip
├── Guard: goals.length > 0 → skip (respect future FD Tier 2 data)
└── Calls enrichMatchWithAFEvents(match)

GoalScorers / GoalsSection
└── Reads match.goals from the snapshot
    ├── Empty array → component renders empty / fallback UI
    └── AF-enriched array → component renders scorer names + minutes
```

**Failure behaviour summary:**

| Failure | Behaviour | Visible to user? |
|---------|-----------|-----------------|
| `ENABLE_AF_ENRICHMENT` not set | Enrichment block skipped silently | No — empty events as before |
| `API_FOOTBALL_KEY` not set | `refreshAfLookupTable()` throws (500 from endpoint); `enrichMatchWithAFEvents()` returns unenriched match | No for enrichment; Yes for lookup endpoint (500) |
| `KV` not configured | All functions return null/skip silently | No |
| AF lookup table not seeded | `resolveAfFixtureId()` returns null → `enrichMatchWithAFEvents()` returns unenriched | No — empty events as before |
| AF API call fails | `enrichMatchWithAFEvents()` catches error, returns unenriched match | No |

All failures degrade gracefully — the page always renders, just without enriched event data.

---

## 7. Can Enrichment Execute Locally Today?

**No.** Three conditions must ALL be true for `AF_ENRICHMENT_ENABLED = true`:

```
ENABLE_AF_ENRICHMENT === 'true'   ✅  (set in .env.local)
AF_KEY_CONFIGURED = true           ✅  (API_FOOTBALL_KEY set in .env.local)
KV_ENABLED = true                  ❌  (KV_REST_API_URL absent from .env.local)
```

The single blocker is **KV**. To enable local enrichment:
```
KV_REST_API_URL=<vercel-kv-url>
KV_REST_API_TOKEN=<vercel-kv-token>
```
These can be pulled from the Vercel KV dashboard under your project's Storage tab.
Once added, restarting the Next.js dev server will allow full enrichment locally.

---

## 8. Pre-Rollout Verification Gaps

Before executing DATA-11D Phase 2–5, confirm these two unknowns:

| Unknown | Confirm by |
|---------|-----------|
| `API_FOOTBALL_KEY` set in Vercel | `GET /api/debug/hybrid-enrichment/537358?secret=...` → `apiFootballKeySet: true` |
| `ENABLE_AF_ENRICHMENT=true` set in Vercel | Same response → `enrichmentEnabled: true` |

If either is false, enrichment cannot fire regardless of code state.

---

## Final Verdict: YELLOW

| Dimension | Status | Reason |
|-----------|--------|--------|
| Code deployed | ✅ GREEN | Commit 80424bb live on production |
| Production KV | ✅ GREEN | Inferred present (live features work) |
| Production CRON_SECRET | ✅ GREEN | 401 confirmed |
| API_FOOTBALL_KEY in production | ⏳ YELLOW | Unconfirmed — needs 1 authenticated call |
| ENABLE_AF_ENRICHMENT in production | ⏳ YELLOW | Not yet set — required to arm enrichment |
| Local KV | ❌ RED (local only) | KV_REST_API_URL absent; enrichment cannot fire in dev |
| CRON_SECRET local | ⚠️ SECURITY | Present in .env.local as comment — must be moved to active variable or removed |

**Production is ready for rollout once:**
1. ⚠️ CRON_SECRET comment removed from `.env.local` (security hygiene)
2. `API_FOOTBALL_KEY` confirmed in Vercel (`apiFootballKeySet: true` in debug response)
3. `ENABLE_AF_ENRICHMENT=true` set in Vercel env

**Local verification is incomplete** — KV not configured. Runtime verification of enrichment must happen via production endpoints.
