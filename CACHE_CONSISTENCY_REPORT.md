# Cache Consistency Report
## GoalRadar · full cache-layer audit (no code changes)

Generated: 2026-06-12
Files audited: `cache.ts`, `kv-cache.ts`, `api.ts`, `live-cache.ts`,
`match-snapshot.ts`, `match-state-overlay.ts`, `prewarm/worldcup.ts`,
orchestrator route, page `revalidate` values.

---

## 1. Every cache layer

| Layer | Where | Scope | Written by |
|-------|-------|-------|-----------|
| **ISR / edge HTML** | Vercel CDN per URL | whole page | Next.js on regeneration |
| **L1 in-memory** (`withCache`) | per lambda instance | API payloads | first call per instance |
| **L2 KV bulk lists** | `goalradar:/competitions/…` | upcoming/recent/today/finished lists | orchestrator `refreshEndpoint` ONLY |
| **L2 KV live cache** | `goalradar:live:matches` | in-play matches | orchestrator `refreshLiveMatches` + `/live` page provider path |
| **L2 KV match snapshots** | `goalradar:match:{id}` | per-match composite | prewarm cron + every match-page visit + PERF-8 prewarm hints |
| **DR keys** | `goalradar:dr:*` | disaster recovery | alongside each successful write (7–30 d) |
| **Static bundles** | `src/data/worldcup/*` | last-resort fallback | build time |

## 2. Every TTL

| Cache | TTL |
|-------|-----|
| L1: LIVE 30 s · MATCH 60 s · FIXTURES 900 s · STANDINGS 3 600 s · WC 21 600 s | per `cache.ts` |
| Live cache (L1+KV) | 30 s |
| Snapshot, hot tiers (live/today/next-24h) | 1 920 s (32 min, PERF-10) |
| Snapshot, next-72h | 7 200+1 920 s · future 43 200+1 920 s · finished 7 d |
| Snapshot write-time TTL (`getSnapshotTtlSec`): FINISHED 7 d · UPCOMING min(6 h, kickoff+5 min) · post-kickoff 60 s | match-snapshot.ts |
| Bulk list KV (`refreshEndpoint`) | per-endpoint stale values (FIXTURES 1 800 s, WC 43 200 s, STANDINGS 7 200 s) |
| ISR: homepage/hub/live 30 s · match 60 s · schedule 300 s · results 900 s | page files |

## 3. Every refresh cadence

| What | Cadence |
|------|---------|
| Orchestrator (lists, live cache, prewarm) | designed 30 min via GitHub Actions; **measured ~2 h** (GitHub schedule throttling) — see OPS-1 |
| Prewarm tiers (PERF-10) | hot (live/today/next-24h): every cycle · next-72h: 2 h · future: 12 h · finished: only-if-missing |
| Match snapshots, on-demand | every match-page visit when KV snapshot absent/expired (self-healing) |
| Prewarm hints (PERF-8) | hover/touch/viewport + top-10 list seeding — KV-only, cannot create entries from nothing |
| ISR regeneration | per page `revalidate` (30–900 s) |

## 4. Every overlay path (DATA-2)

`overlayMatchStates` (one `kv.mget` of snapshots, forward-only
`mergeSnapshotState`: SCHEDULED→LIVE→FINISHED, fresher score while live)
runs at the **exit** of: `getUpcomingMatchesCached`,
`getRecentMatchesCached`, `getTodayMatchesCached`,
`getWCKnockoutMatchesCached`, `getWCResultsCached`,
`getWCLiveMatchesCached` (+ FINISHED filter). It runs outside L1, so
overlay freshness is bound only by page ISR — never by list TTLs.
Limit: the overlay can **fix the state of listed matches**, it cannot
**add or remove entries** from a stale list (except dropping finished
matches from the live list).

## 5. Every source of truth

| Data | Authoritative source |
|------|---------------------|
| Match state + score | **per-match snapshot** (DATA-2) — beats any list |
| List membership (which matches appear where) | bulk list KV → orchestrator |
| Live match set | live cache (30 s) overlaid by snapshots |
| Standings | standings KV → orchestrator |
| Kickoff times / fixtures skeleton | bulk lists, static bundle fallback |

---

## "Mexico 2–0 South Africa finishes now" — propagation timeline

Assumption: tournament traffic means the match page is visited within
seconds of FT (this visit is the trigger that builds the FINISHED snapshot;
the PERF-8 viewport/hover hints cannot, since live matches bypass snapshots).

| Surface | Mechanism | Time to show FT 2–0 |
|---------|-----------|---------------------|
| **Match page** | live status bypasses the snapshot cache; the post-FT snapshot rebuild happens on the first render after ISR expiry | **≤ ~60 s** (ISR 60 s) — this visit also writes the FINISHED snapshot to KV |
| **Live page** | live cache TTL 30 s + ISR 30 s; match drops out / shows FT before dropping | **≤ ~60 s** |
| **Hub** | snapshot written (above) → overlay on next ISR regen (30 s) | **≤ ~90 s** (60 s match-page chain + 30 s hub ISR) |
| **Schedule** | same overlay, ISR 300 s | **≤ ~6 min** (60 s + 300 s) |
| **Results page** | needs the match to APPEAR in the finished/recent list — overlay can't add entries → waits for the orchestrator's list refresh | **≤ ~30 min with a healthy 30-min cron; currently hours** (cron throttled to ~2 h and zero green runs yet — OPS-1) |
| Hub "recent results" section | same dependency as Results | same as Results |

**Worst-case divergence window after DATA-2:** a finished match can be
*absent* from Results for up to one orchestrator cycle, but **no surface can
display a contradictory state** (upcoming/LIVE) once the snapshot exists —
the exact failure mode reported in DATA-1 is structurally closed.

**Single remaining lever:** orchestrator cadence (OPS-1 actions: first green
run + optional UptimeRobot 30-min trigger).
