# DATA-18G Phase 5 — World Cup Operational SLOs

Date: 2026-06-17  
Effective: Upon `AUTHORITY_CACHE_ENABLED=true` deployment

---

## SLO 1 — Score Accuracy

**Target: 99.99%**

### Definition
A score is accurate if the score displayed on any WC listing page (Hub, Results, Fixtures, Group, Matches Today, Matches Tomorrow) matches the score in the FD authority source for all FINISHED matches.

### Measurement
`/api/debug/authority-drift` RED count = 0.  
`/api/debug/authority-compare?scope=all` gate = GREEN.

### Error budget
99.99% over a 90-day tournament = **~8.6 minutes** of score inaccuracy allowed.

### Mechanisms guaranteeing SLO

| Mechanism | Protects Against |
|-----------|-----------------|
| `writeDRSnapshot()` poison guard | Unenriched DR (score>0, goals=0) never written |
| Prewarm SKIP-DR guard | Prewarm never writes unenriched DR |
| Downgrade guard in `writeKVSnapshot()` | Promotes enriched DR over unenriched rebuild |
| Authority cache built from FD results feed | Score source is always FD, never ESPN/AF |
| `drift-scan` nightly at 04:30 UTC | Detects any score drift within 24h |
| `repair-enrichment` cron at 04:00 UTC | Fixes unenriched snapshots daily |

### SLO breach conditions
- Score drift in authority cache: `authority-drift` RED > 0
- Authority cache absent: `authority-freshness` source = 'absent'
- FD API returning wrong scores (upstream issue — outside GoalRadar control)

---

## SLO 2 — Authority Freshness

**Target: < 15 minutes** (p99 staleness)

### Definition
The authority cache (`goalradar:wc:authority:v1`) must be no older than 15 minutes for any page request during the tournament. The maximum acceptable age is 1.5× TTL:
- Normal tier (no live/today matches): TTL=900s → max age = 1350s = **22.5 min**
- Today tier (today's matches): TTL=300s → max age = 450s = **7.5 min**
- Live tier (IN_PLAY/PAUSED): TTL=30s → max age = 45s = **45 seconds**

### Measurement
`/api/debug/authority-freshness` stale = false.

### Error budget
< 1% of page requests served from a stale cache (ageSec > ttlSec × 1.5).

### Mechanisms guaranteeing SLO

| Mechanism | Freshness Guarantee |
|-----------|-------------------|
| Orchestrator cron every 30 min | Normal tier always refreshed within 30 min |
| Live tier TTL = 30s | Live scores never more than 30s stale |
| DR copy (7-day TTL) | Serves as fallback if primary evicted |
| Cold rebuild on miss | If both primary and DR absent, rebuilt on next request |

### SLO breach conditions
- Orchestrator cron stalled > 30 min (YELLOW at 1h, RED at 6h per feed-integrity)
- `AUTHORITY_CACHE_ENABLED=false` set accidentally
- Vercel KV storage limit exceeded

---

## SLO 3 — Enrichment Coverage

**Target: > 95%** of FINISHED scored matches have enrichmentApplied=true

### Definition
For every FINISHED WC match with scoreTotal > 0, the authority cache must have:
- `enrichmentApplied = true`
- `goals.length > 0`
- `goals.length === scoreTotal` (exact goal event count)

### Measurement
`/api/debug/enrichment-health` enrichmentRate ≥ 95%.  
`/api/debug/data18d1-integrity-audit` fail = 0.

### Error budget
5% of scored matches may be temporarily unenriched = up to 5 matches in a 104-match tournament.

### Mechanisms guaranteeing SLO

| Mechanism | Coverage Guarantee |
|-----------|-------------------|
| Prewarm enrichment (DATA-18D.2) | First snapshot is enriched if AF available |
| `repair-enrichment` cron at 04:00 UTC | Catches any unenriched snapshots within 24h |
| DR poison prevention | Unenriched state never persists > 7 days in DR |
| `FIRST_BUILD_UNENRICHED` log | Makes unenriched snapshots visible in Vercel logs |

### SLO breach conditions
- AF API (`api-football.com`) down for > 24h (both prewarm and repair fail)
- `ENABLE_AF_ENRICHMENT=false` set accidentally
- More than 5 matches simultaneously unenriched

### Enrichment coverage formula
```
enrichmentRate = (FINISHED matches with enrichmentApplied=true) / (FINISHED matches with scoreTotal > 0)
```

---

## SLO Summary Table

| SLO | Metric | Target | Measurement Endpoint | Breach |
|-----|--------|--------|---------------------|--------|
| Score Accuracy | authority-drift RED | = 0 | `/api/debug/authority-drift` | RED verdict |
| Score Accuracy | authority-compare GREEN | redCount = 0 | `/api/debug/authority-compare?scope=all` | RED |
| Authority Freshness | cache age | < 15 min (p99) | `/api/debug/authority-freshness` | stale = true |
| Authority Freshness | source | 'primary' | `/api/debug/authority-freshness` | source = 'dr' or 'absent' |
| Enrichment Coverage | enrichmentRate | ≥ 95% | `/api/debug/enrichment-health` | < 95% |
| Enrichment Coverage | integrity-audit fail | = 0 | `/api/debug/data18d1-integrity-audit` | fail > 0 |

---

## Monitoring Schedule

| Time (UTC) | Action | Endpoint |
|------------|--------|---------|
| 04:00 daily | repair-enrichment cron | `/api/cron/repair-enrichment` |
| 04:30 daily | drift-scan cron | `/api/cron/drift-scan` |
| Every 30 min | orchestrator cron | `/api/cron/orchestrator` |
| On-demand | Full health check | `/api/debug/worldcup-health` |
| On-demand | Score drift check | `/api/debug/authority-drift` |
| On-demand | Feed integrity | `/api/debug/feed-integrity` |

---

## Alerting Thresholds

| Condition | Severity | Response |
|-----------|----------|---------|
| authority-drift RED > 0 | **PAGE** | Run integrity-repair immediately |
| authority-freshness stale + source=dr | **PAGE** | Check orchestrator cron |
| enrichment-health unenriched > 5% | Alert | Will self-heal by 04:00 UTC |
| feed-integrity RED | Alert | Check orchestrator cron |
| worldcup-health RED | **PAGE** | Triage via subsystem endpoints |
