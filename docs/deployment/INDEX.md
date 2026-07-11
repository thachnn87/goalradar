# Deployment & Operations Documentation Index

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when a deployment/operations runbook or report is added, moved, or deprecated.
Authority: Folder index. Lower authority than `docs/INDEX.md`, `docs/deployment/OPERATIONS.md`, and `docs/architecture/DECISIONS.md`.

This folder holds production operations state, deployment audits, incident records, and operational runbooks.

## Authoritative operations state
- `docs/deployment/OPERATIONS.md` — current production operations, cache, KV, cron, provider notes. **Highest authority in this folder.**

## Production Operations Package (runbooks & checklists)
Standardized procedures created from incident `WC-BRACKET-2026-07-11` so forensic investigations are not re-run from scratch:
- `OPERATIONS_ARCHITECTURE.md` — the five truths (Repository / Deployment / Production / Runtime / Cache) and the pipeline model.
- `RELEASE_RUNBOOK.md` — step-by-step feature-branch → production, with owner/evidence/rollback per step.
- `PRODUCTION_READINESS_CHECKLIST.md` — mandatory YES/NO release gate (pre-dev → post-incident).
- `INCIDENT_RESPONSE_PLAYBOOK.md` — canonical "production looks wrong" workflow (collect the seven truths).
- `DEPLOYMENT_FORENSICS_RUNBOOK.md` — how to obtain each deployment fact without guessing (commands, URLs, credentials, evidence gaps).
- Bracket-specific validation: `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`.

## Automation roadmap (planning — design only, not approved decisions)
Plan to reduce manual production verification, derived from incident `WC-BRACKET-2026-07-11`:
- `OPERATIONS_MATURITY_ASSESSMENT.md` — 1–5 scores per dimension + the next highest-value improvement.
- `ROADMAP_AUTOMATION.md` — phased plan (Quick Wins → Deployment Visibility → Production Verification → Continuous Verification).
- `PRODUCTION_VERIFICATION_AUTOMATION.md` — checklist items classified Manual / Semi-automatic / Fully automatic.
- `CI_CD_PIPELINE_BLUEPRINT.md` — future GitHub Actions pipeline (architecture only).
- `POST_DEPLOY_SMOKE_TEST_SPEC.md` — automated smoke test specification.
- `OBSERVABILITY_GAP_ANALYSIS.md` — gaps that made this incident hard to prove, with priorities.

## Incident records
- `WC_BRACKET_POSTMORTEM_2026-07-11.md` — WC knockout bracket misrendering; formal postmortem (OPEN until §15 satisfied).

## Deployment audits (historical evidence)
- `DEPLOYMENT_AUDIT.md`, `DEPLOYMENT_ROOT_CAUSE.md`, `DEPLOYMENT_TIMELINE.md` — prior black-box deployment verifications; established the `main`→production auto-deploy model.
- `OPS_*.md`, `DATA18OPS2*.md`, `*_PRODUCTION_*.md` — historical operations validations. Evidence only; not current authority unless linked from `OPERATIONS.md`.

## Related
- Bracket integrity report: `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`.
- World Cup folder index: `docs/worldcup/INDEX.md`.

## Rule
Runbooks are procedures, not authority. If a runbook contains a still-current operational fact, promote the concise fact into `docs/deployment/OPERATIONS.md`; keep the runbook as the procedure.
