# DATA-18J.2 Phase 4 — Counter-Example Search (attempt to disprove E)

Date: 2026-06-17  **AUDIT ONLY.**

Each alternative that could produce a `goals=0` primary snapshot, tested against the observed
production fingerprint (all 5: `goals=0`, `detailAge==snapAge==37.9min`, ESPN cache holds events, DR
inferred enriched).

---

### CE-1 — `prewarmMatchSnapshotKVOnly` (hover/touch prewarm) wrote it
- Produces goals=0? Yes (assembleSnapshot, no enrichment).
- **Disproved by:** (a) it writes **only** the snapshot key — cannot make `detailAge==snapAge`;
  (b) it routes through `writeKVSnapshot` → downgrade guard reads DR (goals>0) → **rescues to goals>0**,
  so it could not leave goals=0 while DR is enriched; (c) it is per-user-hover (one match), cannot
  stamp 5 matches at an identical 37.9-min age.

### CE-2 — `buildSnapshot` wrote a goals=0 (enrichment failed)
- Produces goals=0? Only if **both** AF and ESPN fail. ESPN cache HIT was available → ESPN would succeed.
- **Disproved by:** ESPN cache populated ~14 h before the write; a real buildSnapshot at T-37.9m would
  have merged goals 3..8. Also buildSnapshot does not write the detail key (no `detailAge==snapAge`),
  and runs per-visit (no 5-match clustering). Excluded.

### CE-3 — repair cron produced this shape
- repair (`invalidateMatchSnapshot`) **deletes** `goalradar:match:{id}` + ESPN event cache; it never
  writes a snapshot. It cannot author a goals=0 snapshot.
- **Disproved by:** repair would also have **deleted the ESPN event cache** — but the cache is present
  (≈14 h old). So repair has not run on these recently. It is at most an *enabler* (empties the slot),
  not the writer. Excluded as author.

### CE-4 — DR restore produced goals=0
- DR is read in two places: the downgrade guard (writes DR's **enriched** copy → goals>0) and
  `getOrBuildMatchSnapshot`'s build-failure catch (returns DR but only on a thrown build — and DR is
  enriched). No DR path yields a goals=0 primary.
- **Disproved by:** `writeDRSnapshot` poison-guard refuses to store goals=0 DR; DR is never deleted by
  any path; so DR holds goals>0 and any restore would be goals>0. Excluded.

### CE-5 — race condition (non-seedMatch)
- The only relevant race is **seedMatch winning the empty slot before an organic buildSnapshot** —
  which is *part of* mechanism E, not a counter-example. No race among the guarded writers can deposit
  goals=0 past the DR rescue.
- Not a counter-example to E.

### CE-6 — competition.code ≠ 'WC' (no path ever enriches)
- If true, the ESPN event cache could never have been populated (`enrichMatchWithEspnEvents` runs only
  under `needsEnrichment`, which requires code==='WC'). But the ESPN cache **is** populated.
- **Disproved by** the existence of ESPN-cached events. Excluded.

---

## Result

No counter-example survives. Every alternative writer either (a) cannot write the snapshot at all
(repair), (b) would have enriched to goals>0 (buildSnapshot), (c) would have been rescued to goals>0 by
the downgrade guard (prewarmMatchSnapshotKVOnly, DR restore), or (d) cannot reproduce the observed
`detailAge==snapAge` + 5-match clustering (every per-request path).

**Root cause E stands: `seedMatch` is the writer.**
