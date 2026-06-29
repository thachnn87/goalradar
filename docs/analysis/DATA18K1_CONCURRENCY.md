# DATA-18K.1 Phase 3 — Concurrency Proof

Date: 2026-06-18  **AUDIT ONLY.**

Two KV locks exist on the snapshot path:

| Lock | Key | Where acquired | TTL | Released early? |
|------|-----|----------------|-----|-----------------|
| **Repair (DATA-18K)** | `goalradar:repair-lock:{id}` | KV-**hit** self-heal branch (match-snapshot.ts:632) | **1800 s** | No (cooldown by design) |
| **Build (PERF-6)** | `goalradar:lock:snapshot:{id}` | KV-**miss** cold-build path (match-snapshot.ts:675) | **60 s** | No (auto-expire) |

Both use `SET … NX EX` — atomic test-and-set in shared KV, authoritative across all Vercel instances.

---

## 1. Duplicate rebuilds

**Same entry path, same match:** `NX` guarantees exactly one acquirer. All other concurrent requests
get `null` and serve cached (repair branch) or wait-then-reread (build branch). → no duplicates within
a path.

**Cross-path race (the only window):** request X reads a KV **hit** with goals=0 (→ repair branch,
repair-lock, buildSnapshot); meanwhile the snapshot is evicted and request Y reads a **miss** (→ build
branch, build-lock, buildSnapshot). The two locks are **different keys**, so both can build the same
match **once** concurrently.
- Upper bound: **2 concurrent builds for one match**, in a narrow eviction-timing window.
- Both builds are **idempotent** (same KV detail + same ESPN cache → same enriched result); the second
  `writeKVSnapshot` simply rewrites an equivalent snapshot.
- Not a storm (bounded at 2), not corrupting (idempotent, both guarded).

**Within one request:** React `cache()` (line 613) collapses generateMetadata + page + deferred into a
single execution → no intra-request duplication.

---

## 2. Lock races

- `SET NX` is atomic; there is no check-then-set gap to race. Two callers cannot both "win."
- The repair branch does **not** touch the build-lock, and the build branch does **not** touch the
  repair-lock — they operate on disjoint keys with no shared critical section, so they cannot corrupt
  each other's state.
- Lock-acquire failures are swallowed (`.catch(() => null)`) → fail-safe to "serve cached," never an
  exception.

---

## 3. Deadlocks

Deadlock requires a circular hold-and-wait. Here:
- A request holds **at most one** of the two locks at a time (repair branch never enters the build
  branch in the same call — it `return`s before reaching line 661+; build branch is only reached on a
  KV miss, where the repair branch was never entered).
- Neither lock is acquired **while holding** the other → no nested acquisition → **no hold-and-wait**,
  hence **no circular wait**.
- Both locks have **TTL auto-expiry** (1800 s / 60 s) and are acquired non-blocking (`NX`, no spin) →
  even a crashed/killed holder cannot pin a lock; liveness is guaranteed regardless.

➡ **Deadlock is structurally impossible.**

---

## 4. Note on lock-not-released semantics

The repair-lock is intentionally **never deleted** — its 30-min TTL *is* the cooldown that bounds
rebuilds. This is correct: a successful heal makes the branch dormant (goals>0) so the lingering lock
is irrelevant; a failed heal must not be retried for 30 min. The build-lock's 60-s TTL likewise
auto-clears after a build completes or fails. No manual unlock path is needed, and none can leak.

## Conclusion
No duplicate-rebuild amplification (bounded at ≤2 in a rare eviction race, idempotent), no lock race
(atomic NX), no deadlock (no nested locks + TTL liveness).
