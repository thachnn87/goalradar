# Bracket Validation Runbook

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the knockout data model, `buildKnockoutGraph`, `WCBracket`, or the debug endpoint changes.
Authority: Operational procedure. Subordinate to `docs/PROJECT_CONTEXT.md`, `docs/architecture/DECISIONS.md`, and `docs/deployment/OPERATIONS.md`. Complements the integrity report `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`.

How to validate the WC knockout bracket end-to-end — parent graph, winner propagation, geometry — locally and on production. Established in incident `WC-BRACKET-2026-07-11`.

## Model (why validation is graph-based)
The authority feed provides each match's real participants + stage + score, **no parent linkage**, and numbers matches in schedule order (not bracket geography). Correctness therefore means: every match's participants originate **only** from its two parent matches — derived from winning-team identity (played) or `Winner R16 M5` / `Winner QF2` labels (upcoming). Never from id/date/array index. Implementation: `buildKnockoutGraph()` in `src/lib/knockout-vm.ts`; renderer `src/components/WCBracket.tsx` consumes `graph.order` only.

## A. Integrity endpoint (fastest, authoritative)
`GET /api/debug/knockout-graph` (dev: open; prod: `?secret=$CRON_SECRET`). Expect:
- `summary.complete: true`, `summary.valid: true`, `issues: []`.
- `report.6_8_parentageValidations` all `pass:true`:
  - Every **Quarter Final** participant originates only from its two **Round of 16** parents.
  - Every **Semi Final** participant originates only from its two **Quarter Final** parents.
  - The **Final** originates only from its two **Semi Finals**.
- `report.9_ancestryViolations: []` (no participant outside its ancestry).
- `report.productionCaseSpotlight`: QF "Norway vs England" ← RO16 Brazil/Norway + Mexico/England; QF "Spain vs Belgium" ← Portugal/Spain + USA/Belgium.

## B. Per-stage checks (what each validation means)
- **Round of 32:** base column; each match is a real fixture (or group-position label pre-draw). No parents.
- **Round of 16:** each participant is the winner of a specific R32 match (identity) or a `Winner R32 Mn` label.
- **Quarter Final:** both participants are the two winners of its two RO16 parents.
- **Semi Final:** both participants are the two winners of its two QF parents.
- **Final:** both participants are the two winners of the two SF parents.
- **Parent graph:** `report.2_parentChildMap` — each child lists `leftParent`/`rightParent` with source `winner-identity` or `placeholder-label`; never `unresolved` on a decided round.
- **Winner propagation:** `report.3_winnerPropagationChain` — each finished match's winner `feedsInto` exactly one next-round matchId.

## C. Geometry check (render truth, DOM)
Load the page (`/world-cup-2026/bracket` or `/world-cup-2026`), then in the browser console measure each column's cards:
```js
(() => {
  const s = document.querySelector('#bracket-heading')?.closest('section') || document;
  const cols = [...s.querySelectorAll('div')].filter(d => /height:\s*\d{3,4}px/.test(d.getAttribute('style')||'') && d.querySelector('a[href^="/match/"]'));
  return JSON.stringify(cols.map(c => [...c.querySelectorAll('a[href^="/match/"]')].map(a => {
    const r=a.getBoundingClientRect(), cr=c.getBoundingClientRect();
    return {y: Math.round(r.top-cr.top+r.height/2), t: a.textContent.replace(/\s+/g,' ').trim().slice(0,32)};
  }).sort((x,y)=>x.y-y.y)));
})()
```
**Pass criterion:** each round-N match's centre-Y equals the midpoint of its two feeder matches in round N-1. Screenshot case: QF "Norway vs England" sits exactly between R16 "Brazil vs Norway" and "Mexico vs England"; QF "Spain vs Belgium" sits between "Portugal vs Spain" and "USA vs Belgium". No phantom R32 column on `/world-cup-2026/bracket` (it starts at Round of 16).

## D. Regression tests
`npx jest src/lib/__tests__/knockout-graph.test.ts` — encodes the exact crossing case (QF ids out of bracket order), asserts R16 geometry order `[1,2,5,6,3,4,7,8]`, Norway/England parentage, label resolution of the upcoming half, and detection of an unresolvable participant. Full suite: `npx jest`.

## E. Smoke (post-deploy)
`curl -s "https://goalradar.org/api/debug/knockout-graph?secret=$CRON_SECRET" | jq '.summary'` → expect `complete:true, valid:true, issueCount:0`. Alert if `valid:false`.

## Cross-references
Integrity report: `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md` · Postmortem: `docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md` · Forensics: `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md` · Release: `docs/deployment/RELEASE_RUNBOOK.md`.
