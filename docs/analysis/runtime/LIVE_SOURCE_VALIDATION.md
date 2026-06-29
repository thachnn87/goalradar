# LIVE SOURCE VALIDATION — DATA-18B.3E Phase 5

**Task:** DATA-18B.3E LIVE-SOURCE-UNIFICATION
**Date:** 2026-06-23 ~02:30 UTC
**Deploy:** `37267d0`

---

## Manifest check — `/api/debug/live-source-map`

```
verdict: LIVE_SOURCE_UNIFIED
checks:  { allLivePagesUseSSOT: true,
           anyPageUsesAuthorityForLive: false,
           anyPageRequiresSnapshotForLive: false }
ssot:    { currentLiveMatchIds: [], currentLiveCount: 0 }
```

Every live-rendering page reports `usesSSOT=true, usesAuthority=false,
usesSnapshot=false`.

---

## Cross-source state at validation time — `/api/debug/state-divergence`

```
authority.source = primary   authority.liveCount = 0
liveCache.liveCount = 0       liveCache.ageSec = 18 (fresh)
distribution: authority {scheduled:61, finished:43}
              snapshot  {scheduled:61, finished:43}
divergences: []   (0 RED, 0 YELLOW)
```

Authority and the SSOT now agree (both 0 live). Norway vs Senegal finished
between deploy steps (42→43 finished).

---

## Rendered-page validation

Each page fetched from production; HTML stripped to text; counted LIVE badges
and located the two target matches.

| Page | URL | LIVE badges | France vs Iraq | Norway vs Senegal | Verdict |
|------|-----|-------------|----------------|-------------------|---------|
| WC Results | `/world-cup-2026-results` | **0** (stats "Live Now=0") | 3–0 **FT**, Recent Results | 3–2 **FT**, Recent Results | ✅ |
| Results | `/world-cup-2026/results` | — (308 → WC Results) | folds to WC Results | folds to WC Results | ✅ |
| Today | `/world-cup-2026/matches-today` | **0** (FT=7) | not today | present, **FT** (Finished Today) | ✅ |
| Live | `/live` | **0** | not live | not live | ✅ |
| Hub | `/world-cup-2026` | **0** (FT=10) | present, **FT** (Recent Results) | present, **FT** | ✅ |
| Schedule | `/schedule?competition=WC` | **0** (FT=43) | present | present | ✅ |

### Headline result

`/world-cup-2026-results` stats strip: `Played=43, Goals=131, Live Now=0`.
**France vs Iraq — the match that was stuck in "Live Now" — now renders `3–0 FT`
in Recent Results, and the live count is 0.** The reported bug is fixed.

All pages agree: zero matches rendered live (matching SSOT `currentLiveCount=0`),
and both target matches render `FT` everywhere they appear.

---

## Limitation / honesty note

At validation time the SSOT had **0 live matches** (Norway vs Senegal finished
just as the deploy completed), so I could not observe a *currently-live* match
rendering live across pages. What was validated:

1. The previously-divergent match (France vs Iraq) now shows FT with Live Now=0
   — i.e. the exact bug condition is resolved.
2. No page renders any LIVE badge while the SSOT is empty (no authority-derived
   false-live anywhere).
3. The live decision is structurally bound to `liveMatchIds.has(id)` in code
   (Phase 3) and confirmed by the `live-source-map` manifest.

The live-direction (SSOT says live → all pages show live) follows from the same
single code path but was not exercised against a live fixture in this window.
The next live match will exercise it; `/api/debug/live-source-map` +
`/api/debug/state-divergence` give a one-call recheck.

**Phase 5 complete. Gate: LIVE_SOURCE_UNIFIED.**
