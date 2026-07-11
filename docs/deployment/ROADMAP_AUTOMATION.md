# Automation Roadmap

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update as phases are delivered or re-prioritized.
Authority: Planning reference. Subordinate to `docs/architecture/DECISIONS.md` and `docs/deployment/OPERATIONS.md`. Not an approved commitment; promote adopted items to `DECISIONS.md`/`CURRENT_SPRINT.md`.

Phased plan to reduce manual production verification after every deployment. Complexity / Business Value / Risk Reduction are qualitative (Low/Med/High) — no velocity data exists to justify numbers. Every item traces to a gap in `OBSERVABILITY_GAP_ANALYSIS.md` or a checklist item in `PRODUCTION_VERIFICATION_AUTOMATION.md`.

## Phase 1 — Quick Wins
Goal: make drift provable and regressions catchable at lowest cost.
| Item | Addresses | Complexity | Business Value | Risk Reduction |
|---|---|---|---|---|
| `/api/version` endpoint (commit + build time) | G1, G2, G7 | Low | High | High |
| PR CI: `tsc` + `jest` (incl. knockout-graph test) | G4 | Low–Med | High | High |
| Document required `CRON_SECRET` secret for smoke | S1/S3 auth | Low | Med | Med |

## Phase 2 — Deployment Visibility
Goal: know exactly what is live, automatically.
| Item | Addresses | Complexity | Business Value | Risk Reduction |
|---|---|---|---|---|
| Branch protection on `main` (required checks + review) | G5 | Low | High | High |
| Guardian added to PR CI | G4 | Low | Med | Med |
| CI drift check: `origin/main` HEAD vs `/api/version` | G8 | Med | Med | High |
| Read-only Vercel token as repo secret (forensics/status) | G3 | Low | Med | Med |

## Phase 3 — Production Verification
Goal: replace manual post-deploy checks with automated smoke.
| Item | Addresses | Complexity | Business Value | Risk Reduction |
|---|---|---|---|---|
| Post-deploy smoke S1–S7 (`POST_DEPLOY_SMOKE_TEST_SPEC.md`) | G6 | Med | High | High |
| Headless bracket geometry test (S4) | G6 | Med | High | High |
| Preview smoke as a PR required check | G4, G6 | Med | Med | Med |

## Phase 4 — Continuous Verification
Goal: catch drift and structural regressions without a human trigger.
| Item | Addresses | Complexity | Business Value | Risk Reduction |
|---|---|---|---|---|
| Scheduled synthetic run of smoke against production | G6, G8 | Med | High | High |
| Alerting on `knockout-graph valid=false` / geometry fail | G6 | Med | High | High |
| Auto-file incident from failed synthetic (links playbook) | IR | High | Med | Med |

## Sequencing rationale
Phase 1 is prerequisite: `/api/version` unblocks SHA verification (checklist POST-DEPLOY) and drift alarms (G8), and PR CI is the missing gate the incident exposed. Phases build strictly on prior phases; nothing in Phase 3–4 is worth doing before Phase 1 exists.

Cross-references: `OBSERVABILITY_GAP_ANALYSIS.md`, `PRODUCTION_VERIFICATION_AUTOMATION.md`, `CI_CD_PIPELINE_BLUEPRINT.md`, `POST_DEPLOY_SMOKE_TEST_SPEC.md`, `OPERATIONS_MATURITY_ASSESSMENT.md`, `WC_BRACKET_POSTMORTEM_2026-07-11.md`.
