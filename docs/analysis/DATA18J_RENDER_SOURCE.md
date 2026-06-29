# DATA-18J Phase 3 — Render Source Determination

Date: 2026-06-17

**AUDIT ONLY.**

## Question
Which source does the Match Detail Page render events from?
- A) `snapshot.goals`
- B) `canonicalMatch.goals`
- C) authority cache only

## Answer: **A — `snapshot.match.goals`** (the per-match KV snapshot)

---

## Evidence

The page (`src/app/match/[id]/page.tsx`) obtains data exclusively via
`getOrBuildMatchSnapshot(id)` and binds `const match = snapshot.match` (page.tsx:2172, 2275).
Events render from `match.goals` / `match.bookings` / `match.substitutions` / `match.lineups`
where `match` is `snapshot.match: MatchDetail`.

```
GoalsSection         ← match.goals          (page.tsx:716)
BookingsSection      ← match.bookings        (page.tsx:762)
SubstitutionsSection ← match.substitutions   (page.tsx:801)
LineupsSection       ← match.lineups         (page.tsx:909)
```

- **NOT B** — there is no `CanonicalMatch` on this page. `CanonicalMatch.goals` is only used by
  the WC **listing** pages (hub/fixtures/results/group/today/tomorrow) via `getWCAuthorityMatchesV2`.
- **NOT C** — the detail page never calls `readAuthorityCache` / `getWCAuthorityMatchesV2`
  (`git grep` in `match/[id]/page.tsx` → empty).

---

## Why the page shows score but no events

`snapshot.match` carries **both** the score (FD) and the events arrays. In production the persisted
snapshot has correct score but **empty events arrays** (Phase 2). Each events component returns `null`
on an empty array, so:

- Score hero renders (2–1) ✅
- Goals / Cards / Subs / Lineups sections render nothing ❌

This is the rendered behaviour confirmed on `https://www.goalradar.org/match/537328`
(HTML contains "South Korea", "Czech", and the 2–1 score; contains **no** Goals/Substitutions/Lineups
sections — they are deferred and render empty because the snapshot arrays are empty).

The render source is **correct**; the data inside `snapshot.match` is what is missing. The defect is
upstream of rendering (snapshot content), not in the render binding.
