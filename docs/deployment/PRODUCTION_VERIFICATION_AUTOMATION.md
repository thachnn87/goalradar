# Production Verification Automation

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when a checklist item's automation status changes or CI is added.
Authority: Planning reference. Subordinate to `docs/deployment/OPERATIONS.md` and `docs/architecture/DECISIONS.md`.

Classifies every item in `docs/deployment/PRODUCTION_READINESS_CHECKLIST.md` by automation potential. Effort/priority are qualitative (Low/Med/High) — no velocity data exists to justify numeric estimates. Grounded in incident `WC-BRACKET-2026-07-11`.

Legend — **Manual** (human judgement), **Semi-automatic** (script/CI produces evidence, human decides), **Fully automatic** (CI enforces, no human step).

## PRE-PR
| Item | Class | Current method | Future automation | Effort | Priority |
|---|---|---|---|---|---|
| `tsc --noEmit` PASS | Fully automatic | run locally | CI required check on PR | Low | High |
| `jest` PASS | Fully automatic | run locally | CI required check | Low | High |
| Guardian PASS | Fully automatic | run locally | CI required check | Low | Med |
| Regression test added | Semi-automatic | reviewer confirms | coverage/diff heuristic flags missing test | Med | Med |
| Bracket graph test PASS | Fully automatic | `jest knockout-graph` | CI required check | Low | High |
| Pushed to feature branch | Fully automatic | `git push` | branch-name lint in CI | Low | Low |

## PRE-MERGE
| Item | Class | Current method | Future automation | Effort | Priority |
|---|---|---|---|---|---|
| PR opened `feature → main` | Manual | human | (intentional human action) | — | — |
| PR CI green | Fully automatic | none today | GitHub Actions on `pull_request` | Med | High |
| Review approved | Manual | human | required-reviewers rule enforces presence | Low | High |
| Scope clean | Semi-automatic | human diff read | CI diff/path allowlist warning | Med | Low |
| Preview built | Fully automatic | Vercel auto | already automatic | — | — |
| Preview verified | Semi-automatic | manual DOM/endpoint | preview smoke tests (see SMOKE spec) | Med | High |

## PRE-DEPLOY
| Item | Class | Current method | Future automation | Effort | Priority |
|---|---|---|---|---|---|
| Merged into `main` | Manual | human merge | (intentional gate) | — | — |
| Target SHA recorded | Fully automatic | manual | CI records merge SHA | Low | Med |
| `merge-base --is-ancestor` YES | Fully automatic | manual command | CI assertion | Low | Med |

## POST-DEPLOY
| Item | Class | Current method | Future automation | Effort | Priority |
|---|---|---|---|---|---|
| Vercel deployment READY | Semi-automatic | dashboard | deploy webhook / API poll | Med | Med |
| Production SHA == merged SHA | Fully automatic (once `/api/version` exists) | not possible today | version endpoint + CI assert | Low | **High** |
| Debug endpoint healthy | Fully automatic | manual `curl` | post-deploy smoke job | Low | High |
| Browser geometry verified | Semi-automatic | manual DOM probe | headless DOM smoke test | Med | High |
| ISR served fresh | Semi-automatic | header read | smoke checks `x-vercel-cache`/`age` | Low | Med |
| No console/network errors | Semi-automatic | manual | headless error capture | Med | Med |

## POST-INCIDENT
| Item | Class | Current method | Future automation | Effort | Priority |
|---|---|---|---|---|---|
| Closure criteria satisfied | Semi-automatic | manual review | smoke job asserts objective criteria | Med | Med |
| Postmortem status CLOSED | Manual | human | — | — | — |
| Preventive actions filed | Manual | human | — | — | — |
| CHANGELOG updated | Manual | human | commit template reminder | Low | Low |

## Summary
Highest-leverage conversions (Manual/none → Fully automatic, Low effort, High priority): **PR CI** (tsc/jest/guardian/bracket test), **`/api/version` for SHA verification**, **post-deploy smoke** on `/api/debug/knockout-graph`. See `docs/deployment/ROADMAP_AUTOMATION.md`.

Cross-references: `PRODUCTION_READINESS_CHECKLIST.md`, `CI_CD_PIPELINE_BLUEPRINT.md`, `POST_DEPLOY_SMOKE_TEST_SPEC.md`, `OBSERVABILITY_GAP_ANALYSIS.md`, `WC_BRACKET_POSTMORTEM_2026-07-11.md`.
