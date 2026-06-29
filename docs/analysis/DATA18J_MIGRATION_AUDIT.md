# DATA-18J Phase 4 — DATA-18E Migration Impact Audit

Date: 2026-06-17

**AUDIT ONLY.**

## Question
Did the authority-layer migration accidentally migrate the Match Detail Page?

## Answer: **NO. The Match Detail Page was never migrated.**

---

## Commits audited

| Commit | Title | Touched `match/[id]/page.tsx`? | Touched detail data path? |
|--------|-------|------------------------------|---------------------------|
| `1a4af33` | DATA-17 single WC authority layer | No | No — only listing pages + `api.ts` |
| `601a64d` | DATA-17 report (docs) | No | No (doc only) |
| `e32bcdc` | DATA-18B authority cache builder | No | No — `authority-cache.ts`, `api.ts`, tests |
| `1e6fd90` | DATA-18D canary activation | No | No — `results/page.tsx`, repair cron, debug |
| `c297766` | DATA-18D.2 enrichment regression window | No* | *touched `match-snapshot.ts` (poison guards) |
| `3c87eda` | DATA-18G monitoring endpoints | No | No — debug endpoints + docs |

\* `c297766` modified `src/lib/match-snapshot.ts` (DR poison-prevention guards), which **is** on the
detail path — but it **hardens** enrichment persistence; it did not migrate the page to the authority cache.

### Full file history of the detail page
```
git log --oneline -- src/app/match/[id]/page.tsx
c4d4b85 feat(reliability): DATA-16 snapshot enrichment reliability + ESPN lineups   ← last change
9737eb1 DATA-15C.1 ...
...
```
The most recent change to `match/[id]/page.tsx` is **`c4d4b85` (DATA-16)** — *before* the entire
DATA-17/18 authority programme. None of the six audited commits modified it.

### DATA-18E itself (commit `0c963a8`, not in the audited list)
`git show --name-only 0c963a8` migrated **only the six listing pages**:
```
world-cup-2026/[group]/page.tsx
world-cup-2026/fixtures/page.tsx
world-cup-2026/matches-today/page.tsx
world-cup-2026/matches-tomorrow/page.tsx
world-cup-2026/page.tsx
world-cup-2026/results/page.tsx
```
`match/[id]/page.tsx` is **absent** from that commit.

---

## Conclusion

The Match Detail Page still uses its original per-match snapshot architecture
(`getOrBuildMatchSnapshot` → `goalradar:match:{id}`), unchanged since DATA-16. The authority-cache
migration (DATA-17 → DATA-18E) **did not touch it**.

➡ **The migration is NOT the cause of the missing-events regression.** Root cause lies in the
snapshot enrichment/persistence path (see Phase 5).
