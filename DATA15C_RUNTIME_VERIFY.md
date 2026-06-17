# DATA-15C Runtime Verify
## Negative Cache Hardening — Verification

Date: 2026-06-17
Verdict: **GREEN** — alias fix resolves the false negative; backoff schedule and
suppression logic verified against the shipped module; `tsc` clean.

---

## Method

- Pure helpers (`espnNegBackoffSec`, `espnMissSuppressed`) and constants were
  imported and executed from the **actual shipped module**
  (`src/lib/espn-id-map.ts`) via `tsx` — not a re-implementation.
- Alias resolution was exercised by running `findEspnMatch`'s matching logic with
  the **updated** `ESPN_ALIASES` against the real ESPN scoreboard JSON for
  2026-06-14 (the Australia vs Türkiye fixture).
- Type safety: `npx tsc --noEmit` → 0 errors across all three changed files.

### Access note

The full resolver (`resolveEspnMatchId`) and the debug endpoint read/write live
KV. This environment has no KV credentials and no `CRON_SECRET` (established in
DATA-14B), so the end-to-end KV round-trip was not exercised here. The logic that
KV feeds — backoff gating, value classification, alias resolution — is verified
directly. Production verification commands are in §5.

---

## 1. Objective 6 — Australia vs Turkey resolves to ESPN 760421

```
norm("Turkey")  = "turkiye"
norm("Türkiye") = "turkiye"
Resolved ESPN ID: 760421
Expected: 760421  → PASS ✅
```

ESPN scoreboard 2026-06-14 contains `Australia [AUS] vs Türkiye [TUR]` as event
`760421`. With the `turkey → turkiye` alias, both FD and ESPN names normalise to
`turkiye`, so `findEspnMatch` matches. Before the fix this produced
`__NOT_FOUND__` (see DATA15B).

---

## 2. Objective 2/3 — Backoff schedule (shipped module)

```
ESPN_NEG_BACKOFF_SEC    = [900, 3600, 21600, 86400]
ESPN_NEG_RECORD_TTL_SEC = 604800 (7d)
ESPN_LEGACY_SENTINEL    = "__NOT_FOUND__"

espnNegBackoffSec(1..5) = 900, 3600, 21600, 86400, 86400
```

| Attempt | Backoff | Expected | Result |
|---------|---------|----------|--------|
| 1 | 900s (15m) | 15m | ✅ |
| 2 | 3600s (1h) | 1h | ✅ |
| 3 | 21600s (6h) | 6h | ✅ |
| 4 | 86400s (24h) | 24h | ✅ |
| 5+ | 86400s (24h) | 24h (cap) | ✅ |

---

## 3. Suppression window (`espnMissSuppressed`, shipped module)

| Scenario | Result | Expected |
|----------|--------|----------|
| attempt 1, +10 min | `true` (suppress) | true | ✅ |
| attempt 1, +16 min | `false` (retry) | false | ✅ |
| attempt 4, +23 h | `true` (suppress) | true | ✅ |
| attempt 4, +25 h | `false` (retry) | false | ✅ |

Confirms a miss is re-queried only after its escalating backoff window elapses.

---

## 4. Type safety

```
npx tsc --noEmit  → 0 errors
```

Files: `espn-id-map.ts`, `providers/espn.ts`, `debug/espn-enrichment/[matchId]/route.ts`.

---

## 5. Production verification (post-deploy, requires CRON_SECRET)

```bash
SECRET="<CRON_SECRET from Vercel dashboard>"

# (a) Heal the stale 537346 sentinel and rebuild
curl -X POST "https://goalradar.org/api/revalidate/match/537346?secret=$SECRET"

# (b) Inspect the lookup record — expect positive ESPN ID, no miss fields
curl -s "https://goalradar.org/api/debug/espn-enrichment/537346?secret=$SECRET" | jq \
  '{espnMatchId, lookupReason, lookupAttempts, lookupAgeSeconds, lookupTtlRemaining, goalsCount}'
# Expected after heal: espnMatchId="760421", lookupReason=null, goalsCount=2

# (c) Confirm the public page no longer says "goalless"
curl -sL "https://goalradar.org/match/537346-australia-vs-turkey" | grep -oiE "goalless|Goals:[^.<\"]{0,80}"
```

Expected debug shape for a *miss* (any genuinely-absent match), demonstrating the
new fields:
```json
{
  "espnMatchId": null,
  "lookupReason": "no-scoreboard-match",
  "lookupAttempts": 2,
  "lookupAgeSeconds": 5400,
  "lookupTtlRemaining": 600000,
  "nextRetryInSec": 1200
}
```

---

## Verdict: GREEN

| Objective | Status |
|-----------|--------|
| 1. Structured `LookupMiss` record | ✅ implemented |
| 2. Split positive/negative TTL (30d / 15m→1h→6h→24h) | ✅ verified |
| 3. Retry/backoff helper | ✅ verified (shipped module) |
| 4. Debug endpoint: real age, reason, attempts, ttlRemaining | ✅ implemented, tsc clean |
| 5. `turkey → turkiye` alias | ✅ |
| 6. Australia vs Turkey → ESPN 760421 | ✅ PASS |

Constraints respected: no Match Identity activation, no Snapshot V2, no Team
Identity migration. End-to-end KV round-trip deferred to production (no local KV);
all KV-independent logic verified.
