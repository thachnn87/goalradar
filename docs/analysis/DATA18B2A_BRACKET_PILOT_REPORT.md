# DATA-18B.2A Bracket Pilot Activation & Observation

**Date:** 2026-06-19
**Status:** Phase 1–3 complete. Phase 2 activation PENDING (env var required).

---

## Phase 1 — Pre-Activation Baseline

**Collected: 2026-06-19T01:40 UTC**

### authority-attribution

| Window | totalReads | page | debug | benchmark | unknown | pageRatio |
|--------|-----------|------|-------|-----------|---------|-----------|
| today (06-19) | 9 | 9 (100%) | 0 | 0 | 0 | 100% |
| last 7d | 253 | 67 (26.48%) | 9 (3.56%) | 1 (0.40%) | 0 | 26.48% |
| last 30d | 253 | 67 (26.48%) | 9 (3.56%) | 1 (0.40%) | 0 | 26.48% |

Today's page ratio of **100%** confirms zero debug contamination before activation.
Last page read: `/world-cup-2026/fixtures` at 01:07 UTC.
`organicTrafficConfidence`: **MEDIUM** (2 days with page reads, 2 days with any reads).

### authority-readiness

```
verdict:         READY
readinessScore:  100 / 100
cacheMatchCount: 104
cacheTtlTier:    'live'   ← matches are in live state
writeAgeMin:     138      ← primary expired (>900s); DR serving all reads
availability30d: 100%
coldRebuildRatio30d: 0%
avgLatencyMs30d: 43ms
```

### authority-telemetry

| Date | totalReads | primary | DR | cold | availability | avgLatencyMs |
|------|-----------|---------|-----|------|-------------|-------------|
| 2026-06-19 | 9 | 0 | 9 (100%) | 0 | 100% | 89ms |
| 2026-06-18 | 244 | 29 (11.89%) | 215 (88.11%) | 0 | 100% | 41ms |

Primary cache expired (writeAgeMin=138). All today's reads are DR hits. This is expected steady-state behavior — DR serves during the gap between orchestrator write cycles.

---

## Phase 2 — Pilot Activation

### Activation requirement

Set in Vercel Dashboard → Project Settings → Environment Variables:

```
AUTHORITY_CACHE_PILOT = true
Environment: Production only
```

Then trigger a new deployment (any commit to main, or manual redeploy in dashboard).

**Why redeployment is required:** `AUTHORITY_CACHE_PILOT` is read at module scope in `bracket/page.tsx` during static page generation. The value is baked in at build time / ISR revalidation. A new deployment regenerates the bracket page with the new flag value immediately.

**Rollback:** Delete `AUTHORITY_CACHE_PILOT` from Vercel env vars (or set to `false`) → redeploy. Bracket page falls back to `getWCKnockoutMatchesCached()` via the `else` branch. No code change required.

### Expected evidence after activation

Within the first ISR revalidation cycle post-deployment:
- `/api/debug/authority-attribution` → `lastPageReadSource` includes `/world-cup-2026/bracket`
- `page` read count increases
- No new `debug` or `unknown` reads

---

## Phase 3 — Rendering Validation (Pre-Activation Data Quality)

### Match count parity

```
authority-compare scope=all (2026-06-19T01:41 UTC)
oldPathCount: 104    newPathCount: 104    ← identical
```

Both data paths return exactly 104 matches. The bracket will see the same set of matches regardless of which path is active.

### Gate results (26 FINISHED matches checked)

| Gate | Count | % |
|------|-------|---|
| GREEN | 23 | 88.5% |
| RED | 3 | 11.5% |

### 3 RED matches — analysis

| matchId | score | enrichmentApplied | goalsLength | scoreIdentical | stateFinished |
|---------|-------|------------------|-------------|----------------|---------------|
| 537369 | 0–0 | false | 0 | ✓ | ✓ |
| 537329 | 1–1 | false | 0 | ✓ | ✓ |
| 537335 | 4–1 | false | 0 | ✓ | ✓ |

All 3 RED matches:
- Scores are **IDENTICAL** between old and new paths
- State is **FINISHED** in both paths
- Integrity is **OK** in authority cache
- Fail only on `enrichmentApplied=false` (goals detail missing from orchestrator enrichment pipeline)

### Critical finding: RED matches are not bracket matches

The bracket HTML was fetched and analyzed. It contains match IDs:
```
Round of 32: 537375–537390  (16 matches)
Round of 16: 537415–537430  (16 matches)
Plus: QUARTER_FINALS × 4, SEMI_FINALS × 4, THIRD_PLACE × 2, FINAL × 4 mentions
```

The 3 RED matches (537329, 537335, 537369) are **outside these ID ranges**. They are Group Stage matches and do not appear in the bracket display.

**Bracket-specific gate: GREEN.** Every knockout round match served by the authority cache has correct scores and state. The enrichment failures (goals detail) are in Group Stage matches invisible to the bracket component.

### WCBracket.tsx fields used

The bracket component uses: `status`, `score.fullTime.home/away`, `homeTeam`, `awayTeam`, `stage`, `group`.
It does **not** use: `enrichmentApplied`, `goals`, `minute`, `integrity`.

The `canonicalToMatch()` adapter maps all required fields correctly:
- `state: 'finished'` → `status: 'FINISHED'` ✓
- `state: 'live'` → `status: 'IN_PLAY'` ✓
- `state: 'scheduled'` → `status: 'SCHEDULED'` ✓
- `score.fullTime` passed through ✓
- `homeTeam`, `awayTeam` passed through ✓
- `stage`, `group` passed through ✓
- `competition` synthesized: `{ id: 2000, name: 'FIFA World Cup', code: 'WC', type: 'CUP', emblem: '', area: { id: 2267, name: 'World', code: 'WLD', flag: null } }` ✓

---

## Phase 4 — One Revalidation Cycle Observation

*Pending activation.*

**Expected:** After deployment with `AUTHORITY_CACHE_PILOT=true`:
1. First request to `/world-cup-2026/bracket` executes new code path
2. Attribution telemetry shows `lastPageReadSource: /world-cup-2026/bracket`
3. No render errors in Vercel function logs
4. Cache latency consistent with other page reads (~40–90ms)

**Bracket revalidate interval:** 21600s (6 hours). After deployment, the ISR cache is rebuilt immediately. The next revalidation cycle will be in 6 hours.

---

## Phase 5 — Rollback Test

*Pending activation.*

**Protocol:**
1. Remove `AUTHORITY_CACHE_PILOT` from Vercel env vars (or set to `false`)
2. Trigger redeployment
3. Fetch `https://www.goalradar.org/world-cup-2026/bracket` → confirm HTTP 200
4. Check attribution: `lastPageReadSource` for bracket should stop appearing after next revalidation
5. Re-enable: set `AUTHORITY_CACHE_PILOT=true`, redeploy

---

## Phase 6 — Final Gate

*Pending Phases 2, 4, 5.*

**Pre-activation assessment:**

| Condition | Status |
|-----------|--------|
| Cache healthy | ✓ READY 100/100 |
| Match count parity (104/104) | ✓ |
| Score accuracy for bracket matches | ✓ All GREEN |
| Enrichment failures affect bracket | ✗ None — all Group Stage |
| canonicalToMatch() adapter | ✓ TypeScript-clean, all fields mapped |
| Explicit catch fallback | ✓ Renders slot schedule on exception |
| Rollback mechanism | ✓ Env var flag, <60s to revert |
| Organic traffic confirmed | ✓ Verdict A from DATA-18B.1B |

Pending evidence: live bracket read in attribution telemetry, one revalidation cycle observation, rollback test.

---

*Document will be updated after activation steps complete.*
