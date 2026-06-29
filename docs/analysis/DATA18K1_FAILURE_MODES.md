# DATA-18K.1 Phase 2 — Failure-Mode Simulations

Date: 2026-06-18  **AUDIT ONLY.**

Per-scenario accounting. "rebuild" = one `buildSnapshot` call. The 30-min `repair-lock` (NX EX 1800,
never released) is the hard ceiling: **≤1 rebuild per match per 30 min, globally** (KV is shared across
Vercel instances).

---

## Scenario A — goals=0, ESPN cache present  (the 5 target matches)

| Metric | Value |
|--------|-------|
| Rebuilds | **1** (then branch disabled — goals>0) |
| Provider calls | 0 (KV detail hit; ESPN from cache) |
| KV ops | ~1 get (snapshot) + 1 setNX (lock) + ~6 get (detail, ESPN cache, h2h/standings/upcoming/recent) + 1 set (primary) + 1 set (DR) ≈ **10** |
| Lock | repair-lock acquired, held 30 min (no further attempts needed) |
| User impact | One request pays ~build latency; events appear; all later reads are fast KV hits |

**Outcome:** heal succeeds, permanent. (Validated in production, DATA18K_PRODUCTION_VALIDATION.md.)

---

## Scenario B — goals=0, ESPN missing, AF missing

| Metric | Value |
|--------|-------|
| Rebuilds | **1 per 30 min** (lock-gated) |
| Provider calls | ≤1 ESPN fetch attempt + ≤1 AF lookup attempt per rebuild (both fail/empty) |
| KV ops | ~10 + 1 DR read in `writeKVSnapshot` (goals=0 path) |
| Lock | repair-lock held 30 min after each attempt |
| User impact | If **DR holds enriched copy** → `writeKVSnapshot` downgrade guard **rescues to goals>0** (heal succeeds despite both providers down). If DR also empty → snapshot stays score-only; retried in 30 min |

**Outcome:** best-effort. Either DR-rescue heals it, or it degrades gracefully (score-only) and retries
on a 30-min cadence. No escalation.

---

## Scenario C — ESPN timeout, 10 consecutive failures

| Metric | Value |
|--------|-------|
| Rebuilds | **1 per 30 min** → 10 failures span **≥4.5 hours**, never concurrent |
| Provider calls | ≤1 ESPN fetch per attempt; `getEspnMatchEvents` has its own internal timeout/retry bound; ESPN negative-cache/backoff (`nextRetryInSec`) further dampens repeat lookups |
| KV ops | ~10–11 per attempt, once per 30 min |
| Lock | repair-lock serializes to one attempt / 30 min regardless of traffic |
| User impact | score-only card until ESPN recovers or DR rescues; each failed attempt is caught → cached snapshot served, page never errors |

**Outcome:** 10 failures = 10 isolated attempts over hours, each one build. **No tight retry loop, no
storm.** The cooldown converts "consecutive failures" into a slow, bounded retry.

---

## Scenario D — 1000 concurrent requests

### Same pinned match
| Metric | Value |
|--------|-------|
| Rebuilds | **1** (only one request wins `setNX`; 999 get `null` → serve cached) |
| KV ops | ~1000 get (snapshot) + 1000 setNX (999 fail) + ~10 (the single build) |
| Lock | NX is atomic in shared KV → exactly one acquirer across all instances |
| User impact | 999 users get the cached (score-only) card instantly; 1 user pays the rebuild; after it lands, all get events |

### 1000 requests across N distinct pinned matches
| Metric | Value |
|--------|-------|
| Rebuilds | **≤1 per distinct match per 30 min** → bounded by **match count**, not request count (realistically ≤~20 finished WC matches) |
| Provider | ≤1 per match per 30 min |

**Outcome:** request volume cannot amplify rebuilds. The ceiling is (number of distinct pinned
matches) per 30 min, never a function of traffic.

---

## Cross-scenario invariants
- Every rebuild error is caught → cached snapshot served (`return kvHit`). The page **never** throws or
  hangs on a heal attempt.
- `repair-lock` is acquired with `.catch(() => null)`; a KV error during lock acquisition is treated as
  "not acquired" → serve cached. A KV blip cannot turn heal into an error.
- The branch is **dormant** for every healthy snapshot (`goals>0`), non-finished match, and 0–0 draw —
  zero added cost on the hot path.
