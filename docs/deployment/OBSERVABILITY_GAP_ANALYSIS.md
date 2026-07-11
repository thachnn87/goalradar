# Observability Gap Analysis

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when a gap is closed or a new gap is discovered during an incident.
Authority: Analysis reference. Subordinate to `docs/deployment/OPERATIONS.md`.

Everything that was hard or impossible to prove during incident `WC-BRACKET-2026-07-11`, why it slowed the investigation, and the improvement that closes it. Each gap is a fact established during the incident — no speculation.

Legend — Current Risk / Future Improvement / Priority.

## G1 — No production commit SHA
- **Evidence:** repo grep for `VERCEL_GIT_COMMIT_SHA`/version endpoint → 0 hits; production headers expose only `x-vercel-id` (request id) and `etag` (content hash), never a commit SHA; `__NEXT_DATA__.buildId` absent (App Router).
- **Current Risk:** repo↔production drift is unprovable from the app; "is the fix live?" required indirect inference. **High.**
- **Future Improvement:** `/api/version` exposing `VERCEL_GIT_COMMIT_SHA` (+ build time). **Priority: High.**

## G2 — No version/health endpoint for deploy identity
- **Evidence:** the only runtime probe available was `/api/debug/knockout-graph` (feature-specific); a 404 proved *absence* of a commit but not *which* commit is live.
- **Current Risk:** deploy identity only knowable via Vercel dashboard/API. **High.**
- **Future Improvement:** lightweight `/api/version` (see G1) returning commit, branch, build time. **Priority: High.**

## G3 — No deployment visibility from outside Vercel
- **Evidence:** no Vercel token / CLI / dashboard access in the investigation environment; deployment list, build logs, and status were unreadable.
- **Current Risk:** exact deployed SHA classified only "Probable"; forensic certainty blocked. **Med.**
- **Future Improvement:** standing read-only Vercel token stored as a repo secret for CI/forensics; document its scope. **Priority: Med.**

## G4 — No PR CI
- **Evidence:** `.github/workflows/` contains only cron triggers; nothing runs `tsc`/`jest`/guardian on PR or push.
- **Current Risk:** regressions (incl. structural bracket bugs) can merge unchecked; the original bug had no automated gate. **High.**
- **Future Improvement:** GitHub Actions on `pull_request` (see `CI_CD_PIPELINE_BLUEPRINT.md`). **Priority: High.**

## G5 — No branch protection / required checks
- **Evidence:** no branch-protection config in-repo; server-side rules unverifiable without GitHub auth; the fix sat on a feature branch with no enforced merge gate.
- **Current Risk:** "merged to production" is manual and unenforced — the incident's process root cause. **High.**
- **Future Improvement:** protect `main`: required checks + ≥1 review. **Priority: High.**

## G6 — No post-deploy verification / synthetic monitoring
- **Evidence:** the bracket defect went undetected until a human screenshot; monitoring targets data/cache/scheduler health, not UI structural correctness; no post-deploy smoke exists.
- **Current Risk:** structural regressions reach users silently. **High.**
- **Future Improvement:** post-deploy smoke (`POST_DEPLOY_SMOKE_TEST_SPEC.md`) + alert on `valid=false`. **Priority: High.**

## G7 — No deployment/audit endpoint
- **Evidence:** determining branch/auto-deploy relied on inference from behavior (documented in `DEPLOYMENT_AUDIT.md`), not a first-class signal.
- **Current Risk:** every deployment question restarts a forensic exercise. **Med.**
- **Future Improvement:** `/api/version` (G1) plus this documentation package already reduce this materially. **Priority: Med.**

## G8 — No repo↔production drift alarm
- **Evidence:** drift (fix present in repo, absent in prod) was detectable only by manual probing.
- **Current Risk:** silent drift between merged code and live site. **Med.**
- **Future Improvement:** CI job comparing `origin/main` HEAD to `/api/version` commit; alert on mismatch. **Priority: Med (depends on G1).**

## Priority summary
High: G1, G2, G4, G5, G6. Med: G3, G7, G8. G1/G2 are the cheapest high-value closures and unblock G8.

Cross-references: `WC_BRACKET_POSTMORTEM_2026-07-11.md`, `DEPLOYMENT_FORENSICS_RUNBOOK.md`, `ROADMAP_AUTOMATION.md`, `CI_CD_PIPELINE_BLUEPRINT.md`.
