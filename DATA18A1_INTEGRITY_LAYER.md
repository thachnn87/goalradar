# DATA-18A.1 Data Integrity Validation Layer Review

Date: 2026-06-17
Reviewer: Architecture review — no code changes.

---

## 1. Motivation

The `CanonicalMatch` object is composed from four independent data layers
(FD bulk, live cache, snapshot, ESPN enrichment). Each layer can be stale,
missing, or inconsistent with the others. Currently no runtime check validates
that the composed object is internally consistent.

Without an integrity layer:
- A `score.fullTime.home = 3` and `goals.filter(home).length = 2` would be
  served to pages without any logged warning.
- A `goals[0].team.id` that doesn't match `homeTeam.id` or `awayTeam.id`
  would reach the UI silently (DATA-14A bug class).
- A snapshot with FINISHED status serving events from a different match
  (unlikely but possible during a KV collision) would go undetected.

---

## 2. Proposed Integrity Model

```typescript
interface IntegrityResult {
  status: 'ok' | 'warning' | 'degraded';
  checks: IntegrityCheck[];
}

interface IntegrityCheck {
  id:       string;           // machine-readable identifier
  result:   'pass' | 'warn' | 'fail';
  message?: string;           // human-readable detail, present on warn/fail
}
```

### Status semantics

| Status | Meaning | Action |
|--------|---------|--------|
| `'ok'` | All checks passed. Object is fully consistent. | Serve to page. |
| `'warning'` | One or more non-critical checks failed. Object is usable but may have minor inconsistencies. | Serve to page; log warning. |
| `'degraded'` | A critical check failed. Object has a known data integrity problem. | Serve to page with reduced confidence; emit alert. |

`'degraded'` does NOT mean "don't serve" — the system serves the best data it has.
It means "flag this for operational review."

---

## 3. Check Catalogue

### C1 — Score vs Goal Count Consistency

```typescript
// For FINISHED matches with enrichment applied
const homeGoals = goals.filter(g => g.team.id === homeTeam.id).length;
const awayGoals = goals.filter(g => g.team.id === awayTeam.id).length;
const ftHome    = score.fullTime.home ?? 0;
const ftAway    = score.fullTime.away ?? 0;

if (homeGoals !== ftHome || awayGoals !== ftAway) → 'warn'
```

**Severity:** Warning (not fail) — own goals complicate attribution; ESPN may
log an own goal against the scoring team. A mismatch of ±1 is common and expected.
A mismatch of ±3 would be suspicious.

**Frequency:** Expected for ~5% of matches (own goals, penalty shootout goals
logged without team attribution).

### C2 — Event Team ID Reconciliation

```typescript
const validTeamIds = new Set([homeTeam.id, awayTeam.id]);
const unreconciled = [
  ...goals.filter(g => !validTeamIds.has(g.team.id)),
  ...cards.filter(c => !validTeamIds.has(c.team.id)),
  ...substitutions.filter(s => !validTeamIds.has(s.team.id)),
];
if (unreconciled.length > 0) → 'fail'
```

**Severity:** Fail — this is the DATA-14A bug class (ESPN team IDs not reconciled
to FD team IDs). If this check fires in production, goal scorers are attributed
to ghost teams and `g.team.id === match.homeTeam.id` filters break.

**Frequency:** Should be 0% after DATA-14A fix. If non-zero, it signals a regression.

### C3 — Score Completeness

```typescript
if (state === 'finished' && (score.fullTime.home === null || score.fullTime.away === null)) → 'fail'
```

**Severity:** Fail — a FINISHED match with null score is data corruption.

**Frequency:** Should be 0%. Observed only during FD API outages or race conditions.

### C4 — Event Duplicate Detection

```typescript
const eventKeys = goals.map(g => `${g.minute}:${g.scorer.id}`);
const hasDuplicates = new Set(eventKeys).size !== eventKeys.length;
if (hasDuplicates) → 'warn'
```

**Severity:** Warning — duplicate goals possible when ESPN data is re-applied to an
already-enriched snapshot (DATA-14A race condition class). Doubles the displayed
goal count.

**Frequency:** Expected near-zero. Was non-zero pre-DATA-14A fix.

### C5 — ESPN ID vs Enrichment Consistency

```typescript
if (espnMatchId !== undefined && !enrichmentApplied) → 'warn'
// ESPN ID resolved but no events found — possible false-positive resolution
```

**Severity:** Warning — ESPN resolved a match but returned no events. May indicate
a match resolution collision (wrong ESPN event mapped to this FD match).

### C6 — State vs Score Consistency

```typescript
if (state === 'scheduled' && (score.fullTime.home !== null || score.fullTime.away !== null)) → 'warn'
// A scheduled match shouldn't have a fullTime score
```

**Severity:** Warning — stale FD data (match finished but bulk SCHEDULED feed
hasn't been refreshed yet). Serves as an early indicator that the feed is stale.

---

## 4. Storage Cost

### Option A: Store integrity in `CanonicalMatch`

```typescript
interface CanonicalMatch {
  // ... existing fields ...
  integrity: IntegrityResult;
}
```

**Cost:** ~100–300 bytes per match in JSON (check array with 6 entries, most
passing). For 104 matches × 200 bytes = ~20 KB added to the authority cache payload.
Negligible.

**Benefit:** Every consumer — pages, monitoring, shadow comparison — can inspect
integrity without a separate call.

### Option B: Compute integrity on read, don't store

Run `validateCanonicalMatch(m)` at page render time, log warnings, don't store.

**Cost:** ~0.1ms CPU per match × 104 = ~10ms per authority cache read. Negligible.

**Drawback:** Integrity warnings are ephemeral (logs only). Can't be observed in
shadow comparisons or stored for trend analysis.

### Option C: Integrity in a separate sidecar key

```
goalradar:wc:integrity:{matchId}  → IntegrityResult  (short TTL, ~5 min)
```

**Cost:** 104 additional KV writes per refresh cycle. Not worth it at this scale.

**Recommendation: Option A** — store in `CanonicalMatch`. The 20 KB overhead is
trivial, and every consumer benefits without extra KV reads.

---

## 5. Runtime Cost

`validateCanonicalMatch()` is a pure function operating on the already-built
`CanonicalMatch` object. All inputs are in-memory.

| Check | Operation | Cost |
|-------|-----------|------|
| C1 (score vs goals) | Array filter × 2 | O(n) where n = goals.length ≈ 5–10 |
| C2 (team IDs) | Set lookup × all events | O(n) |
| C3 (score completeness) | 2 null checks | O(1) |
| C4 (duplicate events) | Set construction | O(n) |
| C5 (ESPN vs enrichment) | 2 boolean checks | O(1) |
| C6 (state vs score) | 1 state + 2 null checks | O(1) |
| **Total** | — | <0.5ms for 104 matches |

Operationally free.

---

## 6. Operational Benefit

| Benefit | Without integrity layer | With integrity layer |
|---------|------------------------|---------------------|
| DATA-14A regression detection | No (silently wrong UI) | C2 fires immediately |
| Score correction staleness | No (wrong score displayed) | C1 fires (mismatch) |
| ESPN collision detection | No | C5 fires |
| Shadow comparison (S2) | Manual diff only | Machine-readable diff of integrity.status |
| Oncall alerting | Manual log grep | `status === 'degraded'` → alert threshold |

---

## 7. Integration Point

`validateCanonicalMatch()` should be called inside `buildCanonicalMatch()` as the
last step, after all fields are resolved:

```typescript
const match: CanonicalMatch = { ...allFields };
match.integrity = validateCanonicalMatch(match);
return match;
```

Or as a separate function called by the authority cache builder:

```typescript
const matches = await buildAllCanonicalMatches(...);
return matches.map(m => ({ ...m, integrity: validateCanonicalMatch(m) }));
```

The second approach keeps `buildCanonicalMatch()` pure (no validation side effects).

---

## 8. Recommendation

**Add the integrity layer in S1** (alongside `buildCanonicalMatch()`, before any
page reads the canonical object). This costs nothing at S0 and provides immediate
value in S2 shadow validation — the shadow comparison endpoint can diff
`integrity.status` between old and new paths rather than doing manual field-by-field
comparison.

Add `integrity: IntegrityResult` to `CanonicalMatch`. Implement `validateCanonicalMatch()`
as a pure function. Store `'ok' | 'warning' | 'degraded'` status as a searchable
field in production logs.

**Minimum viable integrity layer for DATA-18B:**
- C2 (team ID reconciliation) — C2 fails → DATA-14A regression; must detect
- C3 (score completeness) — C3 fails → serve no score; must detect  
- C1 (score vs goal count) — C1 warns → common, useful for monitoring

C4, C5, C6 are low-priority for DATA-18B; add in DATA-18C or later.
