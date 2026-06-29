# DATA-18F Phase 4 — Auto Repair Proposal

Date: 2026-06-17  
Status: **DOCUMENT ONLY — NOT ACTIVATED**

---

## Purpose

Describes the recovery path for each drift scenario detected by `/api/debug/authority-drift`.  
No new code is activated. No existing logic is changed.

---

## Scenario 1: Authority.score ≠ Snapshot.score

### Detection
`/api/debug/authority-drift` returns `severity: RED`, `scoreDrift: true`  
`[DriftScan] DRIFT matchId=<id> reason="score drift: authority=3-1 snapshot=0-0" severity=RED`

### Root Cause (most likely)
1. Authority cache was built from a snapshot that was later repaired (score corrected)
2. Snapshot was deleted and rebuilt from a stale SCHEDULED/TIMED feed entry
3. FINISHED feed entry has wrong score (upstream FD data issue)

### Recovery Path
```
Step 1 — Invalidate the diverged snapshot:
  DELETE goalradar:match:{matchId}
  DELETE goalradar:dr:match:{matchId}

Step 2 — Force snapshot rebuild on next page request:
  GET /match/{matchId} (any user request triggers rebuild)
  OR call /api/debug/integrity-repair?matchIds={matchId} directly

Step 3 — Rebuild authority cache:
  POST /api/cron/orchestrator (triggers writeAuthorityCache if AUTHORITY_CACHE_ENABLED)
  OR wait for next 30-min cron cycle

Step 4 — Verify:
  GET /api/debug/authority-drift → match must show GREEN
  GET /api/debug/authority-compare?scope=all → gate must be GREEN
```

### Guard already in place (DATA-18D.2)
`writeDRSnapshot()` refuses to write `score>0, goals=0` — prevents the worst poisoning case.  
DR downgrade guard in `writeKVSnapshot()` promotes enriched DR over unenriched rebuild.

---

## Scenario 2: Authority.state ≠ Snapshot.state

### Detection
`severity: RED`, `stateDrift: true`  
`reason="state drift: authority=finished snapshot=scheduled"`

### Root Cause (most likely)
1. Snapshot was rebuilt from a SCHEDULED feed entry (match finished but FINISHED feed not yet consumed)
2. Authority cache is stale — built before FD updated the match status

### Recovery Path
```
Step 1 — Force authority cache rebuild:
  POST /api/cron/orchestrator  (reads live feed + FINISHED feed → correct state)

Step 2 — Force snapshot rebuild:
  DELETE goalradar:match:{matchId}
  Trigger rebuild via page request or /api/debug/integrity-repair

Step 3 — Verify:
  GET /api/debug/authority-drift → state drift must be gone
```

### Why this is transient
The orchestrator cron runs every 30 min. State drift between SCHEDULED → FINISHED resolves within one cron cycle. The authority cache TTL is 900s (15 min), so at most 15 min exposure after cron runs.

---

## Scenario 3: Authority.enrichmentApplied ≠ Snapshot.enrichmentApplied

### Detection
`severity: YELLOW`, `enrichmentDrift: true`  
`reason="enrichment drift: authority=true snapshot=false"`

### Root Cause
1. Authority cache was built from a pre-enrichment snapshot
2. Snapshot was later enriched (by repair-enrichment cron or manual repair)
3. Authority cache not yet rebuilt after snapshot enrichment

### Recovery Path
```
Step 1 — Rebuild authority cache:
  POST /api/cron/orchestrator
  (rebuilds from current snapshots — picks up enrichment)

Step 2 — Verify:
  GET /api/debug/authority-drift → enrichmentDrift must be false
```

### Why this is non-critical (YELLOW)
Enrichment drift does not cause wrong scores on listing pages.  
Goals/cards/substitutions are used only on match detail pages (which read from snapshots directly, not authority cache).  
Listing pages only display score and state — both are FD-authoritative and unaffected.

---

## Scenario 4: Goals count drift

### Detection
`severity: YELLOW`, `goalsCountDrift: true`  
`reason="goals drift: authority=3 snapshot=4"`

### Root Cause
Same as Scenario 3 — authority cache built from a different snapshot state than current.

### Recovery Path
Same as Scenario 3 — rebuild authority cache to sync with current snapshots.

---

## Auto-Trigger Proposal (NOT ACTIVATED)

The following would complete the auto-repair loop if activated:

```typescript
// In /api/cron/drift-scan/route.ts, after drift detection:
if (red > 0) {
  // Trigger integrity-repair for RED matches
  for (const entry of driftEntries.filter(d => d.severity === 'RED')) {
    await kv.del(`goalradar:match:${entry.matchId}`);
    await kv.del(`goalradar:dr:match:${entry.matchId}`);
    // Next page request or next orchestrator run rebuilds
  }
  // Trigger authority cache rebuild
  await writeAuthorityCache(new Date().toISOString());
}
```

**Why not activated:**  
- Auto-delete + rebuild during an active scan could produce a brief window of missing snapshots
- Requires careful rate-limit management (FD API: 7s/request)
- Manual repair via `/api/debug/integrity-repair` is safer and provides a review step
- The 04:00 UTC `repair-enrichment` cron already handles YELLOW scenarios automatically

---

## Recommended Manual Response Matrix

| Drift Type | Severity | Manual Action | Deadline |
|------------|----------|---------------|----------|
| Score drift | RED | Run `/api/debug/integrity-repair?matchIds={id}` immediately | < 1 hour |
| State drift | RED | Trigger orchestrator cron manually | < 1 hour |
| Snapshot missing | RED | Check KV storage limits; run prewarm | < 1 hour |
| Enrichment drift | YELLOW | None — next orchestrator cycle repairs | Next 30 min |
| Goals count drift | YELLOW | None — next orchestrator cycle repairs | Next 30 min |
| Lineup missing | YELLOW | None — `repair-enrichment` cron at 04:00 UTC | Next morning |
