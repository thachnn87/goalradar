# LIVE_DATASET_TRACE.md
## DATA-18WC.LIVE.TRUTH — Phase 1: Live Dataset Trace

---

## 1. Core Live Match Functions

### `getLiveMatches()` — `src/lib/api.ts:182`
| Field | Value |
|-------|-------|
| Input | none |
| Output | `{ matches: Match[] }` — all competitions |
| Cache | L1 in-memory (30s) → L2 Vercel KV `goalradar:live:matches` (30s) → L3 provider |
| TTL | 30 seconds |
| Callers | `/live` page |

### `getWCLiveMatches()` — `src/lib/api.ts:189`
| Field | Value |
|-------|-------|
| Input | none |
| Output | `{ matches: Match[] }` — WC only (filtered from shared KV key) |
| Cache | Same KV key as `getLiveMatches()` — `goalradar:live:matches` (30s) |
| TTL | 30 seconds |
| Callers | `getWCLiveMatchesCached()` |

### `getWCLiveMatchesCached()` — `src/lib/api.ts:580`
| Field | Value |
|-------|-------|
| Input | none |
| Output | `{ matches: Match[] }` — WC live only |
| Cache | `getWCLiveMatches()` + React.cache() dedup |
| TTL | 30 seconds |
| Callers | `getCurrentLiveMatches()` in `wc-live-ssot.ts` |

### `getCurrentLiveMatches()` — `src/lib/wc-live-ssot.ts:29` ← **SSOT**
| Field | Value |
|-------|-------|
| Input | none |
| Output | `Match[]` — WC live only |
| Cache | `getWCLiveMatchesCached()` — same 30s KV |
| TTL | 30 seconds |
| Callers | Home, Hub, Schedule (WC), WC-Results |

### `getLiveMatchIdSet()` — `src/lib/wc-live-ssot.ts:44`
| Field | Value |
|-------|-------|
| Input | none |
| Output | `Set<number>` — live match IDs |
| Cache | Delegates to `getCurrentLiveMatches()` |
| TTL | 30 seconds |
| Callers | Schedule, WC-Results |

---

## 2. KV Cache Keys

| Key | TTL | Content | Writer |
|-----|-----|---------|--------|
| `goalradar:live:matches` | 30s | All IN_PLAY/PAUSED matches | `fetchLiveCached()` in `live-cache.ts` |
| `goalradar:dr:live:matches` | 7 days | Disaster-recovery live snapshot | `kvSetDR()` in `live-cache.ts` |
| `goalradar:authority:v1` | 5 min | WC authority canonical matches | Orchestrator / `getWCAuthorityMatchesV2()` |

---

## 3. Authority Source

### `getWCAuthorityMatchesCached()` / `getWCAuthorityMatchesV2()` — `src/lib/api.ts`
| Field | Value |
|-------|-------|
| Input | none / (builtAt, context) |
| Output | `{ matches: CanonicalMatch[] }` — ALL WC matches (any status) |
| Cache | KV `goalradar:authority:v1` |
| TTL | **5 minutes** |
| Status field | `CanonicalMatch.state: 'live' | 'finished' | 'scheduled' | 'cancelled'` |
| Callers | Hub, Home, Group pages, Bracket, Team pages |

---

## 4. Page-by-Page Live Source Inventory

| Page | Live Source | Correct? | ISR revalidate |
|------|------------|----------|----------------|
| `/live` | `getLiveMatches()` → KV 30s | ✅ | 30s |
| `/` (Home) | `getCurrentLiveMatches()` KV 30s **+ liveStrays from authority 5min** | ❌ **DIVERGES** | 30s |
| `/world-cup-2026` (Hub) | `getCurrentLiveMatches()` KV 30s, SSOT-gated | ✅ | 30s |
| `/schedule` | `getCurrentLiveMatches()` + `getLiveMatchIdSet()` | ✅ (logic) | 300s ⚠️ |
| `/world-cup-2026-results` | `getLiveMatchIdSet()` | ✅ (logic) | 300s ⚠️ |
| `/world-cup-2026-schedule` | `getCurrentLiveMatches()` | ✅ (logic) | 300s ⚠️ |
| `/world-cup-2026/[group]` | Authority `classifyMatchState()` only | ⚠️ no SSOT gate | 3600s |
| `/world-cup-2026/teams/[slug]` | None (no live badge) | N/A | 3600s |

**Legend:**
- ✅ Reads from SSOT live cache (30s KV)
- ❌ Merges SSOT with authority status filter (5-min stale possible)
- ⚠️ Correct logic but ISR revalidate ≥ 300s means page-level cache can lag

---

## 5. The `classifyMatchState()` Function — `src/lib/match-classify.ts`

Used to bucket authority matches by day. Recognizes `'live'` bucket for:
- `CanonicalMatch.state === 'live'`
- `Match.status === 'IN_PLAY' || 'PAUSED'`

**Critical constraint**: `wc-live-ssot.ts` comment explicitly says:
> "Do NOT derive live state by filtering the authority cache (state === 'live')"

The Hub correctly follows this — line 346 demotes authority-live matches absent from SSOT to `'finished'`. The Home page violates this rule via `liveStrays`.
