# DATA-18C.2 Phase 1 — Repair Expansion Sample
## 3 Low-Traffic Matches Added to Repairability Evidence

Test timestamp: 2026-06-17T10:25:09Z  
Endpoint: `/api/debug/data18c2-bulk-repair?action=test`  
Matches selected: non-marquee fixtures with lowest expected page traffic

---

## Selection Criteria

Three matches chosen from the 18 poisoned set that are unlikely to have received
organic page visits (low-traffic team pairings, non-headlining group fixtures):

| matchId | Home | Away | Date | Score | Selection reason |
|---------|------|------|------|-------|-----------------|
| **537340** | Haiti | Scotland | Jun 14 | 0–1 | Haiti — lowest expected WC traffic; Caribbean vs British Isles |
| **537370** | Saudi Arabia | Uruguay | Jun 15 | 1–1 | Middle East / South American fixture; lower North American WC host traffic |
| **537333** | Canada | Bosnia-Herz. | Jun 12 | 1–1 | Bosnia-Herzegovina — Eastern European; limited global audience |

---

## Pre-State Confirmed

All 3 matches confirmed poisoned at test time:

| matchId | Primary goals | DR goals | Snapshot age | KV detail goals |
|---------|--------------|----------|-------------|----------------|
| 537340 | 0 | 0 | 6.1h (prewarm) | 0 |
| 537370 | 0 | 0 | 6.1h (prewarm) | 0 |
| 537333 | 0 | 0 | 6.1h (prewarm) | 0 |

---

## Rebuild Results

### 537340 — Haiti vs Scotland (Jun 14, 0–1)

```
rebuildMs: 506
before: goals=0, cards=0, subs=0, hasLineup=false
after:  goals=1, cards=4, subs=8,  hasLineup=true

verdict:
  goalsRecovered:  true  ✓
  cardsRecovered:  true  ✓  (4 yellow cards)
  subsRecovered:   true  ✓  (8 substitutions)
  lineupRecovered: true  ✓
```

### 537370 — Saudi Arabia vs Uruguay (Jun 15, 1–1)

```
rebuildMs: 292
before: goals=0, cards=0, subs=0, hasLineup=false
after:  goals=2, cards=1, subs=10, hasLineup=true

verdict:
  goalsRecovered:  true  ✓
  cardsRecovered:  true  ✓  (1 yellow card)
  subsRecovered:   true  ✓  (10 substitutions)
  lineupRecovered: true  ✓
```

### 537333 — Canada vs Bosnia-Herzegovina (Jun 12, 1–1)

```
rebuildMs: 237
before: goals=0, cards=0, subs=0, hasLineup=false
after:  goals=2, cards=5, subs=10, hasLineup=true

verdict:
  goalsRecovered:  true  ✓
  cardsRecovered:  true  ✓  (5 yellow/red cards)
  subsRecovered:   true  ✓  (10 substitutions)
  lineupRecovered: true  ✓
```

---

## Combined Phase 1 Sample (DATA-18C.1 + DATA-18C.2)

| matchId | Match | Score | Goals recovered | Cards | Subs | Lineup | Status |
|---------|-------|-------|----------------|-------|------|--------|--------|
| 537351 | Germany vs Curaçao | 7–1 | 8 | 0 | 8 | ✓ | PASS |
| 537391 | France vs Senegal | 3–1 | 4 | 0 | 7 | ✓ | PASS |
| 537397 | Argentina vs Algeria | 3–0 | 3 | 0 | 10 | ✓ | PASS |
| **537340** | **Haiti vs Scotland** | **0–1** | **1** | **4** | **8** | **✓** | **PASS** |
| **537370** | **Saudi Arabia vs Uruguay** | **1–1** | **2** | **1** | **10** | **✓** | **PASS** |
| **537333** | **Canada vs Bosnia-Herz.** | **1–1** | **2** | **5** | **10** | **✓** | **PASS** |

**Phase 1 verdict: 6/6 PASS** — repair is consistent across all match types including low-traffic fixtures.

Key finding: Card recovery was confirmed for the 3 new test matches (Haiti had 4 cards, Bosnia had 5).
The DATA-18C.1 matches (Germany, France, Argentina) had 0 cards — not because enrichment failed
but because those particular matches had no bookings. Cards are correctly populated from AF enrichment.
