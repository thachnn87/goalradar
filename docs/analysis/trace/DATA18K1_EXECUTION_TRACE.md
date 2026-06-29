# DATA-18K.1 Phase 1 — Self-Heal Execution Trace

Date: 2026-06-18  **AUDIT ONLY — no code changes.**

Subject: `getOrBuildMatchSnapshot` self-heal branch (match-snapshot.ts:613-659) and the functions it
reaches.

---

## Exact path (KV-hit → self-heal)

```
getOrBuildMatchSnapshot(id)                         [cache()-wrapped, match-snapshot.ts:613]
└─ readKVSnapshot(id)                               kv.get only                         :618
   └─ kvHit present
      ├─ pinnedUnenriched = FINISHED && score>0 && goals.length===0                     :627
      ├─ if pinnedUnenriched && KV_ENABLED:
      │   ├─ kv.set(`goalradar:repair-lock:${id}`, NX EX 1800)  → acquired? :632
      │   ├─ if acquired:
      │   │   ├─ buildSnapshot(id)                                                     :639
      │   │   │   ├─ readMatchDetailFromKV(id)        kv.get
      │   │   │   ├─ (miss) getMatchDetail(id)        provider (only if KV detail miss)
      │   │   │   ├─ enrichMatchWithAFEvents(match)   kv.get af cache / provider
      │   │   │   ├─ enrichMatchWithEspnEvents(match) kv.get espn cache / ESPN fetch
      │   │   │   ├─ readKVLiveMatches()              kv.get
      │   │   │   └─ assembleSnapshot()               *Cached KV reads (h2h/standings/…)
      │   │   ├─ writeKVSnapshot(id, rebuilt)         kv.set (+1 DR read iff goals=0)   :640
      │   │   ├─ writeDRSnapshot(id, rebuilt)         kv.set (poison-guarded)           :641
      │   │   └─ return rebuilt                                                         :643
      │   └─ catch → log, fall through (serve cached)                                   :644-650
      │   (lock not acquired → fall through, serve cached)                              :652
      └─ return kvHit                                                                   :658
```

---

## Recursion / re-entry analysis

**`grep getOrBuildMatchSnapshot src/lib`** → the symbol is **defined once** (match-snapshot.ts:613)
and is **never invoked** by `buildSnapshot`, `assembleSnapshot`, `writeKVSnapshot`, `writeDRSnapshot`,
`readKVSnapshot`, or any enrichment function. The only callers are page routes / debug endpoints
(external entry points).

**Call graph is a DAG:**
```
getOrBuildMatchSnapshot
   ├─ readKVSnapshot                 (leaf: kv.get)
   ├─ buildSnapshot
   │    ├─ readMatchDetailFromKV     (leaf)
   │    ├─ getMatchDetail            (provider — leaf w.r.t. this module)
   │    ├─ enrichMatchWith{AF,ESPN}  (leaf w.r.t. this module)
   │    ├─ readKVLiveMatches         (leaf)
   │    └─ assembleSnapshot → *Cached(leaf reads)
   ├─ writeKVSnapshot                (leaf: kv.get DR + kv.set)
   └─ writeDRSnapshot                (leaf: kv.set)
```
No node reaches back to `getOrBuildMatchSnapshot`. **No cycle exists ⇒ no recursion, no re-entry.**

**Within a single request:** `getOrBuildMatchSnapshot` is wrapped in React `cache()` (line 613), so
`generateMetadata` + page + deferred components share **one** execution — the self-heal branch runs
**at most once per request render**, never re-triggered by the sibling callers.

**After a successful heal:** the rebuilt snapshot has `goals>0`, so the very next read evaluates
`pinnedUnenriched = false` → branch skipped. The heal is **self-terminating**.

**After a failed heal (still goals=0):** the `repair-lock` (NX, EX 1800, **never deleted**) blocks any
further rebuild for that match for 30 min. The next eligible attempt is ≥30 min later — **rate-limited,
not looping.**

## Conclusion
No recursion, no re-entry, no infinite rebuild path. The branch executes ≤1 rebuild per request and
≤1 rebuild per match per 30 minutes; success disables the branch, failure defers it 30 min.
