# Incident Response Playbook

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the truth model, endpoints, or evidence commands change.
Authority: Operational procedure. Subordinate to `docs/deployment/OPERATIONS.md` and `docs/architecture/DECISIONS.md`.

Canonical workflow for "production shows something wrong." Modeled on incident `WC-BRACKET-2026-07-11` (`docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md`). **Treat the production observation (screenshot/URL) as the source of truth until disproven.** Do not conclude "fixed" from local evidence alone.

Collect the seven truths in order. Each has explicit commands / URLs / evidence.

## 1. Repository Truth — what the code says
- `git ls-remote origin refs/heads/main refs/heads/<branch>`
- `git log --oneline origin/main -5`
- `git merge-base --is-ancestor <fixSHA> origin/main; echo $?` (0 = on main)
- **Evidence:** authoritative branch HEADs and whether the fix is on `main`.

## 2. Production Truth — what the live site renders
- Browser → target production URL; measure the DOM (see BRACKET_VALIDATION_RUNBOOK for the geometry probe).
- **Evidence:** the exact rendered structure, reproduced, compared to expectation.

## 3. Deployment Truth — how code reaches production
- `.vercel/repo.json` → project id / org id. `vercel.json` → deploy config (ignore step?).
- Production model: Vercel Git integration, `main` → production, auto-deploy (see `DEPLOYMENT_AUDIT.md`).
- **Evidence:** deploy mechanism; production branch; auto-deploy state.

## 4. Governance Truth — why code did or didn't ship
- `.github/workflows/` (deploy pipeline vs cron-only?); CODEOWNERS / branch-protection config present?
- Merge state: merge commit on `main`? PR open/merged/rejected?
- **Evidence:** whether a merge occurred and what gates exist. (Incident WC-BRACKET-2026-07-11 root cause lived here: never merged.)

## 5. Runtime Truth — what the deployed process computes
- Hit the relevant debug endpoint (e.g. `GET /api/debug/knockout-graph`) locally and on production; compare.
- **Evidence:** structured runtime output (validity, parent links). A 404 on production for a fix-only endpoint proves the fix is not deployed.

## 6. Render Truth — old vs new output
- Compare production DOM to a local build of the fix branch.
- **Evidence:** whether production output matches pre-fix or post-fix code. (Note: server-component changes do not alter client chunk hashes — do not rely on chunk diffing; use SSR output/behavior.)

## 7. Cache Truth — could a cache mask the truth?
- Response headers: `x-vercel-cache`, `age`, `x-nextjs-prerender`, `cache-control`.
- Repo: `revalidate` / `dynamic` / `unstable_cache` on the route.
- **Evidence:** whether stale ISR/edge cache could explain the observation. Data caches store data, not render order.

## Root Cause classification
State each conclusion as **Proven / Highly Likely / Probable / Unknown** (see postmortem §14). Separate evidence from inference. Name the missing evidence and the credential/dashboard/API that would supply it (see DEPLOYMENT_FORENSICS_RUNBOOK §Missing-evidence).

## Closure
Do not close until **Production Truth == Repository Truth**, verified by the objective criteria in the incident's postmortem §15 (redeploy, endpoint healthy, geometry correct, no regression).

## Cross-references
Postmortem: `docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md` · Integrity report: `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md` · Deployment audits: `docs/deployment/DEPLOYMENT_AUDIT.md`, `docs/deployment/DEPLOYMENT_ROOT_CAUSE.md` · Forensics: `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md` · Bracket validation: `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`.
