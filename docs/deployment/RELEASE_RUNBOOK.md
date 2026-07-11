# Release Runbook — feature branch → production

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the branch model, Vercel integration, CI, or verification endpoints change.
Authority: Operational procedure. Subordinate to `docs/deployment/OPERATIONS.md` and `docs/architecture/DECISIONS.md`.

Canonical, step-by-step production deployment. Established deployment model (evidence: `docs/deployment/DEPLOYMENT_AUDIT.md`): **Vercel Git integration, production branch `main`, auto-deploy enabled (~2 min), no manual deploy step.** Only `main` maps to the production domain `www.goalradar.org`; feature branches produce preview deployments only.

Checklist companion: `docs/deployment/PRODUCTION_READINESS_CHECKLIST.md`.

```
Developer → Feature Branch → PR → Review → CI → Merge → Vercel → Deployment → Verification → Incident Closure
```

## Step 1 — Developer / Feature Branch
- **Purpose:** isolate the change off `main`.
- **Owner:** developer.
- **Action:** branch from `main`; commit; `git push origin <branch>`.
- **Evidence:** `git rev-parse --abbrev-ref HEAD` ≠ `main`; `git ls-remote origin refs/heads/<branch>`.
- **Rollback:** delete branch; no production effect.

## Step 2 — PR
- **Purpose:** create the reviewable, mergeable unit and trigger a preview deployment.
- **Owner:** developer.
- **Action:** open PR `feature → main`.
- **Evidence:** PR URL; Vercel preview URL in PR checks.
- **Rollback:** close PR.

## Step 3 — Review
- **Purpose:** human correctness/scope gate.
- **Owner:** reviewer (maintainer).
- **Evidence:** ≥1 approval on the PR.
- **Rollback:** request changes; PR does not merge.

## Step 4 — CI
- **Purpose:** automated gate — `tsc --noEmit`, `jest`, guardian.
- **Owner:** CI (once configured; see postmortem preventive actions).
- **Evidence:** green checks on the PR commit SHA.
- **Rollback:** red check blocks merge.

## Step 5 — Merge
- **Purpose:** place the change on the production branch — the ONLY event that triggers a production deploy.
- **Owner:** maintainer.
- **Action:** merge PR into `main`.
- **Evidence:** `git merge-base --is-ancestor <fixSHA> origin/main` → exit 0 (YES); merge commit visible in `git log origin/main`.
- **Rollback:** `git revert <mergeSHA>` (new commit) → redeploys previous behavior.

## Step 6 — Vercel build
- **Purpose:** build the deployable artifact from the merged `main` commit.
- **Owner:** Vercel (automatic).
- **Evidence:** Vercel dashboard → project `goalradar-v2` → Deployments → build READY for the merged SHA. (Requires Vercel access — see DEPLOYMENT_FORENSICS_RUNBOOK.)
- **Rollback:** if build ERROR, previous production deployment stays live; fix forward or revert.

## Step 7 — Deployment (production)
- **Purpose:** promote the build to `www.goalradar.org`.
- **Owner:** Vercel (automatic on `main`).
- **Evidence:** production headers `server: Vercel`; new build serving; deployed SHA == merged SHA.
- **Rollback:** Vercel dashboard → promote previous deployment (instant), or `git revert` + redeploy.

## Step 8 — Verification
- **Purpose:** confirm Production Truth == Repository Truth.
- **Owner:** developer/maintainer.
- **Action:** run `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md` (SHA + cache) and `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md` (geometry + integrity) if bracket touched.
- **Evidence:** `/api/debug/knockout-graph` → 200 `valid:true`; DOM geometry correct; `x-vercel-cache` fresh.
- **Rollback:** if verification fails, promote previous deployment and reopen the incident.

## Step 9 — Incident Closure (only if releasing a fix for an open incident)
- **Purpose:** formally close the incident.
- **Owner:** maintainer.
- **Action:** tick every box in the postmortem §15; set postmortem status CLOSED; append to `.ai/CHANGELOG.md`.
- **Evidence:** completed closure checklist in `docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md`.

## Cache note
Bracket pages are ISR (`revalidate = 900`); the hub is `30`. A new deployment starts a fresh ISR namespace, so post-deploy the first request regenerates from new code — the old deployment's cache is not served. Render **order** is never cached as data; it is computed per render by `WCBracket` from the DAG. (Evidence: postmortem §5, integrity report.)
