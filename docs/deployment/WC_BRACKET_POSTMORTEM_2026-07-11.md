# Incident Postmortem — WC 2026 Knockout Bracket Misrendering

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update only to correct a factual error or when the incident is formally closed (see §15).
Authority: Historical incident record. Lower authority than `docs/PROJECT_CONTEXT.md`, `.ai/AI_RULES.md`, `docs/architecture/DECISIONS.md`, and `docs/deployment/OPERATIONS.md`.

**Incident ID:** WC-BRACKET-2026-07-11 · **Status:** OPEN (fix verified, not in production) · **Severity:** Medium (public SEO surface; misleading visualization; underlying data correct)

Related documents:
- Integrity report: `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`
- Prior deployment audits: `docs/deployment/DEPLOYMENT_AUDIT.md`, `docs/deployment/DEPLOYMENT_ROOT_CAUSE.md`
- Runbooks: `docs/deployment/INCIDENT_RESPONSE_PLAYBOOK.md`, `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md`, `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`, `docs/deployment/RELEASE_RUNBOOK.md`, `docs/deployment/PRODUCTION_READINESS_CHECKLIST.md`

> Evidence vs inference is marked throughout; confidence is classified in §14.

## 1. Executive Summary
The FIFA World Cup 2026 knockout **bracket tree** on goalradar.org displays structurally incorrect pairings: quarter-final cards connect to the wrong pair of Round-of-16 matches (Brazil/Norway + Mexico/England visually feed "Spain vs Belgium" instead of "Norway vs England"). Match **data** is correct; only the visual tree geometry was wrong. Root cause: the bracket component ordered columns by match date/id and drew a phantom Round-of-32 column, instead of positioning matches by true parent-match linkage. A complete fix was developed, tested, and verified on 2026-07-11 but **has not reached production because it was never merged into `main`, and only `main` auto-deploys.**

## 2. Customer Impact
- **Who:** Visitors to `/world-cup-2026/bracket` and the bracket preview on `/world-cup-2026`. *(Proven — reproduced live.)*
- **What:** Connector lines imply incorrect advancement paths; a phantom empty R32 column of TBD placeholders is shown. *(Proven.)*
- **Not affected:** Match identities, scores, and the textual "All Knockout Matches" list are correct. *(Proven.)*
- **Nature:** Misleading, not data-corrupting.

## 3. Business Impact
- **Qualitative:** Trust/credibility risk on a flagship, tournament-timed SEO surface. *(Inference.)*
- **Quantitative:** **Unknown** — no traffic/ranking/revenue data was gathered.

## 4. Timeline (times +07)
| When | Event | Basis |
|---|---|---|
| Unknown; present on `main` ≤ 2026-07-02 | Bug present in `WCBracket` (date/id ordering + phantom column) | Proven present; introduction commit not traced |
| 2026-07-02 | `main` reaches `2dcf58f` (production lineage) | Proven |
| 2026-07-11 10:42–17:42 | Fix commits `d0aff22`, `6964064`, `dfd66b7`, `27f786e` | Proven |
| 2026-07-11 | Feature branch pushed (4 ahead / 0 behind `main`) | Proven |
| 2026-07-11 | Production investigation; live geometry reproduced defect; debug route 404 on prod | Proven |
| 2026-07-11 | Technical + process root cause identified | Proven |
| Now | Fix verified locally; NOT merged, NOT deployed | Proven |

## 5. Technical Root Cause
`WCBracket` ordered each round by `utcDate`/id and used a fixed 5-column layout starting at R32. The authority numbers matches in schedule order (not bracket geography) and supplies no parent linkage, so ordering by date/id placed matches between the wrong parents; the unparameterized start-round produced a phantom R32 column. Fix: explicit DAG (`buildKnockoutGraph`) with parent links from winning-team identity / `Winner R16 M5` labels, slot geometry following the links. *(Proven — see integrity report.)*

## 6. Process Root Cause
The fix was never merged into `main`; only `main` auto-deploys (Vercel Git integration), so the production trigger never fired. Contributing structural factor: no governance-as-code — no PR CI, no branch protection, no required checks. *(Proven — no merge commit; fixes not ancestors of `main`; `.github/` holds only cron workflows.)*

## 7. Why the Bug Survived
No pre-existing test asserted bracket parent-child correctness; no CI runs on push/PR; the defect is visual geometry that type-check/build cannot catch. *(Proven / consistent inference.)*

## 8. Why Monitoring Did Not Detect It
No post-deploy smoke/synthetic check for bracket integrity; the app exposes no deployed-commit identity, so repo↔production drift is invisible from the app; existing monitoring targets data/cache/scheduler health, not UI structural correctness. *(Proven / inference.)*

## 9. Detection Method
Human observation of the production screenshot, confirmed by black-box probing (live DOM geometry + 404 on the fix-only debug route). *(Proven.)*

## 10. Resolution
Not yet resolved in production. Code fix verified in repo/local (`tsc` clean; `jest` 72/72; graph `valid:true`; local geometry correct). Resolution requires merge → deploy → §15 checks. *(Fix-correctness: Proven; production resolution: pending.)*

## 11. Corrective Actions
**Short term:** open PR → merge to `main` → confirm auto-deploy → run §15 checks.
**Medium term:** PR CI (`tsc`, `jest`, guardian); branch protection on `main`; expose deployed SHA (`/api/version`).
**Long term:** post-deploy synthetic check on `/api/debug/knockout-graph`; written release process; standing Vercel/GitHub read access for forensics.

## 12. Preventive Actions
Structural-correctness tests as a permanent gate (`src/lib/__tests__/knockout-graph.test.ts`); CI on every PR/push; repo↔production drift visibility; governance-as-code (branch protection, CODEOWNERS).

## 13. Lessons Learned
1. "Verified in repo/local" ≠ "verified in production." 2. A green local build is meaningless for production without a deploy-identity signal. 3. Manual, unenforced merge/deploy is a single point of failure. 4. The production screenshot was correctly treated as source of truth.

## 14. Confidence Assessment
| Conclusion | Classification |
|---|---|
| Production renders the incorrect bracket | Proven |
| Data correct; defect is visual geometry only | Proven |
| Technical root cause = date/id ordering + phantom column | Proven |
| Fix correct locally | Proven |
| Production lacks the fix (any of 4 commits) | Proven |
| Deploy = Vercel Git integration, prod branch `main`, auto-deploy on | Proven |
| Process root cause = never merged | Proven |
| Production == `main`@`2dcf58f` exactly | Probable |
| "Merge rejected" did not occur | Highly Likely |
| Bug introduction date | Unknown |
| Quantified business impact | Unknown |

## 15. Incident Closure Criteria
- [ ] `fix/wc-knockout-schedule-dates` merged to `main` (`27f786e` is an ancestor of `main`).
- [ ] Production deployed from that `main` commit.
- [ ] `GET https://goalradar.org/api/debug/knockout-graph` → 200, `complete:true`, `valid:true`, `issues:[]`.
- [ ] Production geometry: QF "Norway vs England" between R16 Brazil/Norway & Mexico/England; QF "Spain vs Belgium" between Portugal/Spain & USA/Belgium.
- [ ] Phantom R32 column absent on `/world-cup-2026/bracket`.
- [ ] `tsc` clean + full `jest` green on merged `main`.
- [ ] (If adopted) post-deploy smoke check passing.

**Current state:** all criteria unmet — incident OPEN until Production Truth matches Repository Truth.
