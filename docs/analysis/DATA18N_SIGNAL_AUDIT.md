# DATA-18N Phase 1 — Signal Audit

Date: 2026-06-18

Objective: enumerate every KV/process signal that can predict degradation BEFORE
authority-drift, enrichment-health, or integrity-audit become RED.

---

## Signal 1 — Match Snapshot TTL Expiry

**KV key:** `goalradar:match:{id}`
**TTL rule:** `getSnapshotTtlSec()` — FINISHED = 7 days (604 800 s), default 15 min
**Source:** `src/lib/match-snapshot.ts:104`

**Predictive value:**
If a FINISHED snapshot is within 24 h of expiry it will evict before the next 24 h period.
After eviction, the next page request triggers a cold rebuild. If ESPN events are also
unavailable at that point, the self-heal path runs. If self-heal fails (provider down,
rate-safe active), the rebuilt snapshot will be unenriched → enrichment-health goes RED.

**Signal:** `ageMs > 6d 0h` → YELLOW risk. `ageMs > 6d 20h` → RED risk (expires within 4 h).

---

## Signal 2 — Disaster-Recovery Snapshot TTL

**KV key:** `goalradar:dr:match:{id}`
**TTL:** 30 days (2 592 000 s)
**Source:** `src/lib/match-snapshot.ts:85`

**Predictive value:**
The DR key is the downgrade guard's fallback. If DR also expires, the downgrade guard cannot
rescue an unenriched rebuild — the poisoned snapshot persists for 7 days.

For WC 2026 (started June 2026) the DR keys written on first enrichment expire ~30 days later.
Matches that completed early in the tournament reach their DR expiry ~mid-July 2026.

**Signal:** DR age > 25 days → YELLOW. DR absent entirely → RED risk (guard disabled).

---

## Signal 3 — ESPN Event Cache TTL

**KV key:** `goalradar:espn:event:{fdMatchId}`
**TTL:** 30 days (2 592 000 s)
**Source:** `src/lib/espn-id-map.ts:10,43`

**Predictive value:**
ESPN events are the enrichment source for goals, cards, subs, lineups.
If the event cache expires, the next snapshot rebuild must call ESPN directly.
If ESPN is unavailable at that moment, enrichment fails → goals=0 snapshot → self-heal triggered.

**Signal:** event cache age > 25 days → YELLOW (expiry approaching). Absent → must re-fetch.

---

## Signal 4 — ESPN Lookup ID Cache TTL

**KV key:** `goalradar:espn:lookup:{fdMatchId}`
**TTL:** 30 days (2 592 000 s)
**Source:** `src/lib/espn-id-map.ts:42`

**Predictive value:**
Without the lookup ID, enrichment cannot call ESPN at all (need the espn match ID first).
If absent AND ESPN scoreboard search fails, enrichment returns null → unrecoverable until lookup resolves.

**Signal:** lookup absent or > 25d → YELLOW. Combined with snapshot eviction = RED compound risk.

---

## Signal 5 — Authority Cache Freshness

**KV key:** `goalradar:wc:authority:v1`
**TTL tiers:** live=30s, today=300s, normal=900s
**DR TTL:** 7 days
**Source:** `src/lib/authority-cache.ts:49-54`

**Predictive value:**
Absent authority cache → authority-drift calls `readAuthorityCache()` which cold-rebuilds.
Cold rebuilds are in-memory only (no KV write). Every request to authority-drift causes a full rebuild.
Under load, this can exceed provider rate limits → rate-safe mode activates → all refreshes blocked.

**Signal:** absent + no DR → YELLOW. Absent for >1 h → potential rate-safe cascade risk.

---

## Signal 6 — Rate-Safe Mode

**KV key:** `goalradar:rate-safe:active`
**TTL:** dynamic (Retry-After from FD API, or manual)
**Source:** `src/lib/rate-safe.ts:48`

**Predictive value:**
If rate-safe mode is active, the orchestrator cron cannot refresh any KV feeds or snapshots.
Stale snapshots that expire during a rate-safe window will cold-rebuild on first user request,
calling the provider (which is rate-limited). Chain: rate-safe → snapshot eviction → failed rebuild
→ unenriched snapshot → enrichment-health RED.

**Signal:** active → immediate HIGH risk flag. `expiresAt` determines exposure window.

---

## Signal 7 — Feed Freshness

**KV keys:** `goalradar:/competitions/WC/matches?status=FINISHED`, `…SCHEDULED,TIMED`
**Signal field:** `fetchedAt`
**Source:** `src/app/api/debug/feed-integrity/route.ts`

**Predictive value:**
Feed freshness is a lagging indicator today (feed-integrity already reads it). But the AGE RATE
predicts future integrity failures: if a feed hasn't been refreshed for >1 h, the orchestrator
cron is likely stalled. At 6 h: feed-integrity turns RED. At 12 h: snapshot prewarm data is stale.

**Signal:** age > 1h → YELLOW. age > 4h → HIGH predictive risk (RED threshold approaching).

---

## Signal 8 — Repair-Lock Presence (Self-Heal Frequency Proxy)

**KV key:** `goalradar:repair-lock:{id}` — SET NX EX 1800
**Source:** `src/lib/match-snapshot.ts:631`

**Predictive value:**
Each repair-lock indicates a self-heal was attempted within the last 30 min.
Multiple active repair-locks → repeated corruption or repeated evictions.
High self-heal frequency → systemic enrichment instability.

**Signal:** 1 active lock → INFO. 3+ active locks → YELLOW. 5+ → RED risk (widespread corruption).

---

## Signal 9 — Build-Lock Presence (Cold-Build Frequency Proxy)

**KV key:** `goalradar:lock:snapshot:{id}` — SET NX EX 60
**Source:** `src/lib/match-snapshot.ts:674`

**Predictive value:**
Build-lock presence means a cold build is in progress right now. Not alarming alone.
But 10+ build-locks simultaneously → request surge + cache miss storm → provider hammering.

**Signal:** 5+ active build locks → YELLOW. 10+ → RED risk.

---

## Signal 10 — Health Archive Trend (Trajectory)

**KV key:** `goalradar:health:archive` (ZSET, 30d)
**Source:** `src/lib/health-archive.ts`

**Predictive value:**
The archive records system health every N minutes. A trajectory of YELLOW records is a
leading indicator for RED. Specifically:
- 3+ consecutive YELLOW records → trending toward incident
- enrichment.unenriched rising across records → not yet RED but moving there
- drift.yellow count rising → enrichment drift before drift becomes score drift

**Signal:** last 3 consecutive YELLOWs → YELLOW predictive risk. Last 5 → RED predictive risk.

---

## Summary — Signal Matrix

| # | Signal | KV Key Pattern | Predictive Window | False-positive risk |
|---|--------|----------------|-------------------|---------------------|
| 1 | Snapshot TTL expiry | `goalradar:match:{id}` | 4–24 h | Low |
| 2 | DR snapshot expiry | `goalradar:dr:match:{id}` | 5–7 d | Low |
| 3 | ESPN event cache expiry | `goalradar:espn:event:{id}` | 5–7 d | Medium (ESPN rarely down) |
| 4 | ESPN lookup expiry | `goalradar:espn:lookup:{id}` | 5–7 d | Medium |
| 5 | Authority cache absent | `goalradar:wc:authority:v1` | Immediate | Medium |
| 6 | Rate-safe mode active | `goalradar:rate-safe:active` | TTL-bounded | Low |
| 7 | Feed stale | feed KV keys | 1–6 h | Low |
| 8 | Repair-lock count | `goalradar:repair-lock:*` | ≤ 30 min | Low |
| 9 | Build-lock count | `goalradar:lock:snapshot:*` | ≤ 60 s | High (transient) |
| 10 | Archive trajectory | `goalradar:health:archive` | 1–3 periods | Medium |

**Highest-value predictive signals for match event degradation (DATA-18K class bugs):**
Signals 1 + 3 + 6 — snapshot expiry + ESPN event expiry + rate-safe mode. These three together
represent the complete chain that leads to `enrichment-health=RED`.
