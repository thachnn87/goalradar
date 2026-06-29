# DATA-14B Production Cache Verification
## ESPN Enrichment — Post DATA-14A Snapshot Audit

Date: 2026-06-16
Code state: DATA-14A commit 64f88cf — **not yet deployed** (git push blocked from sandbox)
Verdict: **RED** — production serving stale/incomplete enrichment; deployment + cache flush required.

---

## 1. FD Match ID Lookup

All finished WC 2026 matches resolved from FD API:

| FD ID | Match | FD utcDate | ESPN ID | ESPN Date |
|-------|-------|-----------|---------|-----------|
| 537327 | Mexico 2–0 South Africa | 2026-06-11T19:00Z | — | — |
| 537345 | United States 4–1 Paraguay | 2026-06-13T01:00Z | 760417 | June 12 |
| 537351 | Germany 7–1 Curaçao | 2026-06-14T17:00Z | 760422 | June 14 |
| **537357** | **Netherlands 2–2 Japan** | **2026-06-14T20:00Z** | **760425** | **June 14** |
| **537352** | **Ivory Coast 1–0 Ecuador** | **2026-06-14T23:00Z** | **760423** | **June 14** |
| **537358** | **Sweden 5–1 Tunisia** | **2026-06-15T02:00Z** | **760424** | **June 14** |
| **537364** | **Iran 2–2 New Zealand** | **2026-06-16T01:00Z** | **760427** | **June 15** |

Netherlands vs Japan: FD utcDate `2026-06-14T20:00Z` → dateStr `20260614` → **direct ESPN match** (no prev-day fallback needed).

---

## 2. Production Snapshot State (verified via public pages)

| Match | Expected goals | Prod shows | Status |
|-------|---------------|-----------|--------|
| Ivory Coast 1–0 Ecuador | 1 | Amad Diallo 90' (1 goal) | ✅ CORRECT |
| Sweden 5–1 Tunisia | 6 | Ayari ×2, Isak, Gyökeres, Svanberg (5 goals) | ❌ STALE |
| Iran 2–2 New Zealand | 4 | Rezaeian 32', Just 54' (2 goals) | ❌ STALE |
| Netherlands 2–2 Japan | 4 | (no goal data in meta) | ❌ NOT ENRICHED |

---

## 3. Goal Completeness Verification

### Iran vs NZ (FD 537364) — Expected 4 goals

| Goal | Minute | Type | Prod visible? |
|------|--------|------|--------------|
| Elijah Just | 7' | type:173 Volley | ❌ Missing |
| Ramin Rezaeian | 32' | type:70 Goal | ✅ Present |
| Elijah Just | 54' | type:70 Goal | ✅ Present |
| Mohammad Mohebbi | 64' | type:137 Header | ❌ Missing |

**Root cause:** Old filter `type.id === '70'` captured only 2 of 4 goals. Volley and header types missed.

### Sweden vs Tunisia (FD 537358) — Expected 6 goals

| Goal | Minute | Type | Prod visible? |
|------|--------|------|--------------|
| Yasin Ayari | 7' | type:70 Goal | ✅ Present |
| Alexander Isak | 30' | type:70 Goal | ✅ Present |
| Omar Rekik | 43' | type:137 Header | ❌ Missing |
| Viktor Gyökeres | 59' | type:70 Goal | ✅ Present |
| Mattias Svanberg | 84' | type:70 Goal | ✅ Present |
| Yasin Ayari | 90' | type:70 Goal | ✅ Present |

**Root cause:** Same — Omar Rekik's header (type:137) not captured.

### Netherlands vs Japan (FD 537357) — Expected 4 goals

| Goal | Minute | Type | Prod visible? |
|------|--------|------|--------------|
| Virgil van Dijk | 51' | type:137 Header | ❌ Missing (never enriched) |
| Keito Nakamura | 57' | type:70 Goal | ❌ Missing (never enriched) |
| Crysencio Summerville | 64' | type:70 Goal | ❌ Missing (never enriched) |
| Daichi Kamada | 89' | type:137 Header | ❌ Missing (never enriched) |

**Root cause:** Match page exists and returns 200 but meta description has no goal data. KV snapshot either absent or 0 goals. No ESPN enrichment was triggered for this match.

---

## 4. Statistics Panel Source Verification

### Root cause of 0-0 statistics (confirmed from production HTML)

Production HTML for Iran vs NZ FAQ shows:
```
"Rezaeian 32' (New Zealand); Elijah Just 54' (New Zealand)."
```
Both goals attributed to New Zealand. Rezaeian is an Iran player. This confirms:

`g.team.id` (ESPN Iran ID=469) ≠ `match.homeTeam.id` (FD Iran ID) → all goals fall through to `awayS`

**Six locations in `src/app/match/[id]/page.tsx` that use `g.team.id === match.homeTeam.id`:**

| Line | Usage | Symptom |
|------|-------|---------|
| 189 | `GoalScorers` homeGoals filter | home team shows 0 goals in score header |
| 190 | `GoalScorers` awayGoals filter | all goals appear under away team |
| 728 | GoalsSection `isHome` | all events render on away side |
| 777 | BookingsSection `isHome` | all cards appear under away team |
| 813 | SubstitutionsSection `isHome` | all subs appear under away team |
| 844–859 | MatchStatistics all row values | shows 0-0 for everything |
| 1785 | FAQ scorer list `(home/away)` label | all scorers show away team name |

### Expected MatchStatistics after fix (Iran vs NZ)

| Stat | Iran (home) | New Zealand (away) |
|------|------------|-------------------|
| Goals | 2 | 2 |
| Yellow Cards | 1 | 0 |
| Red Cards | 0 | 0 |
| Substitutions | 4 | 5 |

**Fix:** `applyEspnEvents` in `espn-id-map.ts` now resolves ESPN team → FD team by normalized name. After deployment, all `g.team.id === match.homeTeam.id` comparisons will work correctly.

---

## 5. Revalidation Attempt

### Secrets

| Secret | Available locally | Works for |
|--------|------------------|-----------|
| `REVALIDATE_SECRET` | ✅ In `.env.local` | `/api/revalidate` ISR paths only |
| `CRON_SECRET` | ❌ Not in `.env.local` | `/api/debug/*`, `/api/revalidate/match/{id}` |

Both `POST /api/revalidate/match/{id}` and `GET /api/debug/espn-enrichment/{id}` require `CRON_SECRET`. Production values differ from local `.env.local`. Automated revalidation was not possible from this session.

### ISR-only revalidation (REVALIDATE_SECRET)

`POST /api/revalidate` with `{"paths":["/match/537358","/match/537364","/match/537357"]}` returns 401 — production REVALIDATE_SECRET also differs from local value.

### What revalidation alone would NOT fix

Even after `POST /api/revalidate/match/{id}` deletes the match snapshot and triggers `buildSnapshot()`:

```
buildSnapshot()
  → enrichMatchWithEspnEvents()
    → kv.get("goalradar:espn:event:{id}")  ← HIT (12h TTL, still warm)
    → returns OLD events (only type:70 goals)  ← stale data survives
```

The ESPN event cache (12h TTL) must also be cleared. `invalidateMatchSnapshot` previously only deleted the match snapshot key.

**Fix applied this session (DATA-14B):** `invalidateMatchSnapshot` now also deletes `goalradar:espn:event:{id}` so the next `buildSnapshot()` call gets fresh ESPN data:

```typescript
await Promise.all([
  kv.del(kvKey(matchId)),           // goalradar:match:{id}
  kv.del(espnEventKvKey(matchId)),  // goalradar:espn:event:{id}
]);
```

---

## 6. Code Changes Made (this session)

| File | Change |
|------|--------|
| `src/lib/match-snapshot.ts` | `invalidateMatchSnapshot` now also deletes ESPN event cache |

TypeScript: `npx tsc --noEmit` → **0 errors**.

---

## 7. Required Manual Actions (after network access restored)

### Step 1 — Push and deploy

```
git push origin main
```

Vercel auto-deploys `main` branch. Wait ~2–3 minutes for build to complete.

### Step 2 — Revalidate affected matches (requires CRON_SECRET from Vercel dashboard)

```bash
SECRET="<CRON_SECRET from Vercel dashboard>"

# Iran vs New Zealand (stale: 2 of 4 goals)
curl -X POST "https://goalradar.org/api/revalidate/match/537364?secret=$SECRET"

# Sweden vs Tunisia (stale: 5 of 6 goals)
curl -X POST "https://goalradar.org/api/revalidate/match/537358?secret=$SECRET"

# Netherlands vs Japan (not enriched: 0 of 4 goals)
curl -X POST "https://goalradar.org/api/revalidate/match/537357?secret=$SECRET"
```

After deployment, `invalidateMatchSnapshot` deletes BOTH the match snapshot and the ESPN event cache. The next page load calls ESPN with the fixed `scoringPlay === true` filter and gets all goals.

### Step 3 — Verify (wait ~15s for ISR rebuild, then check)

Expected results after step 2:

| Match | Goal count | Scorer in meta | Stats panel |
|-------|-----------|----------------|-------------|
| Iran vs NZ | 4 | Just 7', Rezaeian 32', Just 54', Mohebbi 64' | Iran 2 – NZ 2 |
| Sweden vs Tunisia | 6 | Ayari ×2, Isak, Rekik, Gyökeres, Svanberg | Sweden 5 – Tunisia 1 |
| Netherlands vs Japan | 4 | van Dijk 51', Nakamura 57', Summerville 64', Kamada 89' | NED 2 – JPN 2 |

```bash
# Verify after rebuild:
curl -sL https://goalradar.org/match/537364-iran-vs-new-zealand | grep -oE "Just|Rezaeian|Mohebbi" | sort | uniq
curl -sL https://goalradar.org/match/537358-sweden-vs-tunisia | grep -oE "Rekik|Ayari|Isak|Gyök|Svanberg" | sort | uniq
curl -sL https://goalradar.org/match/537357-netherlands-vs-japan | grep -oE "van Dijk|Nakamura|Summerville|Kamada" | sort | uniq
```

---

## 8. Summary of All DATA-14A/14B Bugs

| Bug | Root cause | Fix | Deployed? |
|-----|-----------|-----|----------|
| Missing header/volley goals | `type.id === '70'` filter | `scoringPlay === true` | ❌ Pending push |
| Statistics panel all zeros | ESPN team IDs ≠ FD team IDs | `applyEspnEvents` team resolution | ❌ Pending push |
| FAQ scorer list wrong team | Same root cause | Same fix (resolveTeam) | ❌ Pending push |
| GoalsSection all goals on away side | Same root cause | Same fix | ❌ Pending push |
| Revalidation left stale ESPN event cache | `invalidateMatchSnapshot` only deleted match snapshot | Now also deletes ESPN event cache | ❌ Pending push |

---

## Verdict: RED

Production is serving stale enrichment. Three matches are affected:
- **Iran vs NZ** — 2 of 4 goals (50% complete)
- **Sweden vs Tunisia** — 5 of 6 goals (83% complete)
- **Netherlands vs Japan** — 0 of 4 goals (never enriched)

All goals and all statistics show wrong team attribution (all goals rendered under away team).

**Blockers:**
1. `git push origin main` — network not accessible from sandbox
2. `CRON_SECRET` — not in local `.env.local`; retrieve from Vercel dashboard

**Will be GREEN after:** code push → Vercel deploy → three `POST /api/revalidate/match/{id}` calls.
