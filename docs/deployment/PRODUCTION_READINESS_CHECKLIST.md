# Production Readiness Checklist

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the release process, CI gates, or verification endpoints change.
Authority: Mandatory release checklist. Subordinate to `docs/deployment/OPERATIONS.md` and `docs/architecture/DECISIONS.md`.

Every item is objective and answerable **YES / NO**. A release may proceed to the next phase only when every item in the current phase is YES (or explicitly marked N/A with reason). Derived from incident `WC-BRACKET-2026-07-11` (`docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md`).

See also: `docs/deployment/RELEASE_RUNBOOK.md` (procedure), `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md` (how to obtain each evidence item), `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md` (bracket-specific checks).

## PRE-DEVELOPMENT
- [ ] Change scope written down and matches an authoritative doc (`docs/PROJECT_CONTEXT.md` / `.ai/CURRENT_SPRINT.md`) — YES/NO
- [ ] Affected production surfaces identified (routes, SSR/ISR, caches) — YES/NO
- [ ] A validation method exists for the change (test, endpoint, or DOM probe) — YES/NO

## PRE-PR
- [ ] Work is on a feature branch, not `main` — YES/NO
- [ ] `npx tsc --noEmit` PASS — YES/NO
- [ ] `npx jest` PASS (full suite) — YES/NO
- [ ] Guardian / contract checks PASS (if applicable) — YES/NO
- [ ] New regression test added for the fixed behavior — YES/NO
- [ ] Bracket: `buildKnockoutGraph` unit test PASS (if bracket touched) — YES/NO
- [ ] Commit(s) pushed to `origin/<feature-branch>` — YES/NO

## PRE-MERGE
- [ ] PR opened `feature → main` — YES/NO
- [ ] PR CI green (tsc, jest, guardian) — YES/NO
- [ ] Review approved (≥1) — YES/NO
- [ ] No unrelated files staged / working tree scope clean — YES/NO
- [ ] Preview deployment built successfully — YES/NO
- [ ] Preview verified for the changed surface (DOM/endpoint) — YES/NO

## PRE-DEPLOY
- [ ] Branch merged into `main` (merge commit present) — YES/NO
- [ ] Target commit SHA recorded — YES/NO
- [ ] `git merge-base --is-ancestor <fixSHA> origin/main` returns YES — YES/NO

## POST-DEPLOY
- [ ] Vercel production deployment READY for the merged SHA — YES/NO
- [ ] Production SHA verified == merged SHA (via `/api/version` or Vercel API) — YES/NO
- [ ] Debug/health endpoint healthy (`/api/debug/knockout-graph` → 200, `valid:true`) — YES/NO
- [ ] Browser geometry verified on production (see BRACKET_VALIDATION_RUNBOOK) — YES/NO
- [ ] `x-vercel-cache` served fresh HTML after deploy (no stale ISR) — YES/NO
- [ ] No new console/network errors on the changed page — YES/NO

## POST-INCIDENT (only when closing an incident)
- [ ] Incident closure criteria in the postmortem all satisfied — YES/NO
- [ ] Postmortem status updated to CLOSED — YES/NO
- [ ] Preventive actions filed as tracked tasks — YES/NO
- [ ] `.ai/CHANGELOG.md` updated — YES/NO
