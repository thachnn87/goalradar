# CI/CD Pipeline Blueprint

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the pipeline design, branch model, or required checks change.
Authority: Architecture proposal. Subordinate to `docs/architecture/DECISIONS.md` and `docs/deployment/OPERATIONS.md`. **Design only — not an implementation and not an approved decision.** Promote to `DECISIONS.md` if adopted.

Target future pipeline for GoalRadar. Fills the gap identified in incident `WC-BRACKET-2026-07-11`: today the only GitHub Actions are external cron *triggers* — no build/test/deploy gating exists, so a verified fix can sit unmerged and a regression can reach `main` unchecked.

Established deployment substrate (do not redesign): Vercel Git integration, production branch `main`, auto-deploy on `main` push (`docs/deployment/DEPLOYMENT_AUDIT.md`). Vercel already builds previews for PRs and the production build for `main`. This blueprint adds **gates around** that substrate; it does not replace Vercel's build/deploy.

## Stage graph
```
Checkout → Install → Type Check → Lint → Unit Tests → Guardian → Knockout Graph Validation
   → Preview Deployment → Smoke Tests → [Production Approval] → Merge → (Vercel production build)
   → Production Verification → Incident Closure
```

## Stages
| Stage | Trigger | Purpose | Gate (blocks on) | Owner |
|---|---|---|---|---|
| Checkout | PR + push | fetch source | — | CI |
| Install | " | deterministic deps (`npm ci`) | install failure | CI |
| Type Check | " | `tsc --noEmit` | type errors | CI |
| Lint | " | style/static rules | lint errors (policy-dependent) | CI |
| Unit Tests | " | `jest` full suite | any failure | CI |
| Guardian | " | project contract checks | contract violation | CI |
| Knockout Graph Validation | " | `jest knockout-graph` + optional build-time graph assert | invalid graph | CI |
| Preview Deployment | PR | Vercel preview build | build error | Vercel |
| Smoke Tests | after preview | run `POST_DEPLOY_SMOKE_TEST_SPEC` against preview URL | smoke failure | CI |
| Production Approval | pre-merge | human review + required approvals | missing approval / red checks | maintainer |
| Merge | approved PR | place on `main` (deploy trigger) | protection rules | maintainer |
| (Vercel production build) | `main` push | build+deploy production | build error | Vercel |
| Production Verification | after deploy | smoke spec against `goalradar.org` + SHA check | verification failure | CI |
| Incident Closure | if closing incident | assert postmortem §15 criteria | unmet criteria | maintainer |

## Required checks (branch protection on `main`)
Type Check, Unit Tests, Guardian, Knockout Graph Validation, Preview Smoke — all green + ≥1 review before merge.

## Secrets / config needed (not provisioned here)
- `CRON_SECRET` (already used by debug/cron endpoints) for authenticated smoke calls.
- Vercel token (optional) for deployment-status polling and production-SHA assertion.
- GitHub branch-protection settings (repo admin).

## Non-goals
No change to Vercel's production branch or auto-deploy. No custom deploy runner. No rewrite of existing cron workflows (they remain external triggers).

Cross-references: `PRODUCTION_VERIFICATION_AUTOMATION.md`, `POST_DEPLOY_SMOKE_TEST_SPEC.md`, `OBSERVABILITY_GAP_ANALYSIS.md`, `ROADMAP_AUTOMATION.md`, `WC_BRACKET_POSTMORTEM_2026-07-11.md`.
