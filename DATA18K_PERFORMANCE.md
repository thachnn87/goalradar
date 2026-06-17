# DATA-18K Phase 4 — Safety / Performance Analysis

Date: 2026-06-18

Analysis of the added cost of Phase 1 (guarded prewarm writes) and Phase 2 (self-heal on read).

---

## 1. Additional KV reads

### Phase 1 (prewarm write guard)
`writeKVSnapshot` performs **one extra KV read (DR) only** when about to write a FINISHED scored
snapshot with `goals=0` (the downgrade-guard branch). For enriched writes (`goals>0`) there is **zero**
extra read. So the added read is bounded to the *degraded* case the fix exists for — at most once per
prewarm seed of an unenriched finished match.

### Phase 2 (self-heal read)
Per page request the added work is:
- **+1 cheap field check** on the already-read snapshot (no KV).
- **+1 KV write (NX lock)** *only when* the snapshot is `FINISHED && score>0 && goals=0`.
- For the overwhelming majority of requests (enriched snapshots, non-finished, 0-0), the branch is
  skipped → **zero added KV ops**.

| Request type | Added KV ops (Phase 2) |
|--------------|------------------------|
| Enriched FINISHED snapshot | 0 |
| Non-finished / 0–0 | 0 |
| Pinned unenriched, lock free | 1 (SET NX) + rebuild writes |
| Pinned unenriched, lock held | 1 (SET NX, fails) → serve cached |

---

## 2. Additional rebuild rate

- Rebuilds happen **only** for matches that are pinned unenriched **and** only when the 30-min lock is
  free. Upper bound: **1 rebuild per match per 30 minutes**, regardless of traffic.
- For the current incident: 5 matches → at most 5 rebuilds in any 30-min window, then **zero** once
  healed (the snapshot becomes `goals>0`, so the branch no longer fires).
- Steady state (no pinned matches): **0 extra rebuilds**. The mechanism is self-extinguishing.

Worst-case pathological scenario (ESPN cache also gone AND ESPN lookup failing, so a rebuild can't
enrich): the match stays unenriched and re-attempts at most once / 30 min / match — bounded, not a
storm.

---

## 3. Lock effectiveness

`SET goalradar:repair-lock:{id} '1' NX EX 1800`:
- **NX** → only the first concurrent request acquires; all others fall straight through to serving the
  cached snapshot. No thundering herd even under a traffic spike to a pinned match.
- **EX 1800** → caps retry cadence at one rebuild / 30 min even across separate requests and across
  Vercel function instances (KV is shared) — complements the existing per-build `goalradar:lock:snapshot:{id}`
  (60 s) that dedups concurrent cold builds.
- Failure-safe: lock `SET` errors are swallowed (`.catch(() => null)`) → treated as "not acquired" →
  serve cached. A KV blip cannot turn the heal path into an error path.

---

## 4. Latency impact

- Healthy path: **+~1 boolean check**, negligible (<1 µs), no network.
- Heal path (first hit on a pinned match): that single request pays a full `buildSnapshot`
  (~hundreds of ms, KV-detail + ESPN-cache hits; provider only if KV detail missing). All later
  requests for that match are fast KV hits. This cost is paid **once per match per incident**, by one
  request, and is the price of self-repair.

---

## Conclusion

Both changes are **opt-in by data shape**: cost is incurred only for genuinely-corrupted snapshots and
is hard-bounded by the 30-min NX lock. Healthy traffic sees no measurable change. The mechanism
self-extinguishes once snapshots are healed. Safe to deploy.
