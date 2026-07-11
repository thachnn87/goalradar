# Post-Deploy Smoke Test Specification

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when endpoints, cache directives, or bracket geometry rules change.
Authority: Test specification. Subordinate to `docs/deployment/OPERATIONS.md`. Design only — no implementation here.

Defines the automated checks that must run against a deployment (preview and production) so post-deploy verification stops being manual. Each check lists inputs, expected output, and failure criteria. Grounded in incident `WC-BRACKET-2026-07-11`. Validation detail for the bracket lives in `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`.

Base URL: preview URL (from Vercel) or `https://goalradar.org`. Authenticated checks pass `?secret=$CRON_SECRET`.

## S1 — Graph integrity endpoint
- **Input:** `GET {base}/api/debug/knockout-graph`
- **Expected:** HTTP 200; JSON `summary.complete=true`, `summary.valid=true`, `issues=[]`; all `report.6_8_parentageValidations[].pass=true`; `report.9_ancestryViolations=[]`.
- **Fail if:** non-200, `valid=false`, any parentage `pass=false`, or any ancestry violation.

## S2 — 404 detection (deploy presence)
- **Input:** same endpoint.
- **Expected:** not 404.
- **Fail if:** 404 → the commit adding the endpoint is not deployed (drift). Binary proof.

## S3 — Production SHA
- **Input:** `GET {base}/api/version` *(depends on the version endpoint — see OBSERVABILITY_GAP_ANALYSIS)*.
- **Expected:** `commit` equals the SHA under test (merged `main` SHA).
- **Fail if:** mismatch, or endpoint absent (treat as "cannot verify" — warn, not silent pass).

## S4 — Bracket geometry (DOM)
- **Input:** headless load of `{base}/world-cup-2026/bracket`; run the geometry probe from `BRACKET_VALIDATION_RUNBOOK §C`.
- **Expected:** each round-N match centre-Y == midpoint of its two round-(N-1) parents; QF "Norway vs England" between R16 Brazil/Norway & Mexico/England; QF "Spain vs Belgium" between Portugal/Spain & USA/Belgium; no phantom R32 column on this page.
- **Fail if:** any match not at its parents' midpoint, or a phantom empty column present.

## S5 — ISR freshness
- **Input:** response headers of `{base}/world-cup-2026/bracket`.
- **Expected:** page served; after a fresh deploy, `x-vercel-cache` not serving pre-deploy content (a new deployment resets the ISR namespace).
- **Fail if:** stale content persists beyond one `revalidate` window (900 s) post-deploy.

## S6 — Edge cache / availability
- **Input:** headers `server`, `x-vercel-cache`, status.
- **Expected:** `server: Vercel`; 2xx; HIT/MISS/STALE observed (not error).
- **Fail if:** 5xx or origin unreachable.

## S7 — DOM validation (no client errors)
- **Input:** headless console + network capture on the changed page.
- **Expected:** no console errors; no failed same-origin requests.
- **Fail if:** any console error or failed critical request.

## Aggregate criteria
- **Preview gate:** S1, S2, S4, S6, S7 must pass (S3/S5 production-only).
- **Production gate:** all of S1–S7 (S3 warns if version endpoint absent).
- **Alerting:** on production, S1 `valid=false` or S4 failure pages the on-call (see `ROADMAP_AUTOMATION` Phase 4).

Cross-references: `BRACKET_VALIDATION_RUNBOOK.md`, `CI_CD_PIPELINE_BLUEPRINT.md`, `DEPLOYMENT_FORENSICS_RUNBOOK.md`, `WC_KNOCKOUT_GRAPH_AUDIT.md`.
