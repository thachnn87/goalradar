# Deployment Forensics Runbook

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the deploy platform, project ids, or evidence sources change.
Authority: Operational procedure. Subordinate to `docs/deployment/OPERATIONS.md`.

How to determine each deployment fact **from evidence, without guessing**. Every method lists the command/URL and, where evidence is not obtainable in this environment, the exact credential / owner / location that would supply it. Established in incident `WC-BRACKET-2026-07-11`; consistent with `docs/deployment/DEPLOYMENT_AUDIT.md`.

Project identity (from `.vercel/repo.json`): Vercel project `goalradar-v2`, id `prj_F7oEpatOnpG4O12NjxO6OLtOVKqI`, team `team_vyn860yhiHsgDcwVrHKFaUeR`, GitHub `github.com/thachnn87/goalradar`.

## Repository SHA (local)
- `git rev-parse HEAD` · `git log --oneline -5`.
- **Confidence:** Proven.

## GitHub main / branch HEAD (server-side, not local cache)
- `git ls-remote origin refs/heads/main` and `refs/heads/<branch>` — hits GitHub directly.
- `git merge-base --is-ancestor <SHA> origin/main; echo $?` (0 = present on main).
- **Confidence:** Proven.

## Production SHA (the hard one)
- **In-app (once implemented):** `GET https://goalradar.org/api/version` exposing `VERCEL_GIT_COMMIT_SHA`. *(Not yet implemented — see postmortem preventive action.)*
- **Vercel API:** `GET https://api.vercel.com/v6/deployments?projectId=prj_F7oEpatOnpG4O12NjxO6OLtOVKqI&target=production&limit=1&teamId=team_vyn860yhiHsgDcwVrHKFaUeR` → `deployments[0].meta.githubCommitSha`.
  - **Credential required:** Vercel API token (Bearer) with read on team `team_vyn860yhiHsgDcwVrHKFaUeR`. **Owner:** Vercel team member. **Location:** Vercel → Account → Tokens.
- **Dashboard:** Vercel → project `goalradar-v2` → Deployments → the *Current/Production* card shows branch + commit SHA + status.
- **Not usable:** production response headers expose `x-vercel-id` (request/PoP id) and `etag` (content hash) — **not** a commit SHA. `__NEXT_DATA__.buildId` is absent under App Router.
- **Confidence without the above:** the deployed SHA is **Probable** (inferred from behavior), not Proven.

## Vercel deployment record / build logs
- Dashboard → Deployments (list, status QUEUED/BUILDING/READY/ERROR, source branch, commit) or the `v6/deployments` API above.
- **Missing here:** no Vercel token / CLI / dashboard access in this environment.

## GitHub deployment / PR / protection
- PRs, deployments, branch protection: require `gh` CLI (not installed) or a GitHub token, or dashboard login.
- **Owner:** repo owner (`thachnn87`). **Location:** GitHub → Pull requests / Settings → Branches.

## ISR / Edge cache
- Production response headers (same-origin `fetch` in the browser, or `curl -sI`): `x-vercel-cache` (HIT/MISS/STALE), `age`, `x-nextjs-prerender`, `x-nextjs-stale-time`, `cache-control`, `etag`.
- Repo route directives: `revalidate` / `dynamic` / `unstable_cache` (bracket = `revalidate 900`).
- **Interpretation:** a fresh deployment resets ISR; stale HTML self-heals within `revalidate`. Data caches store data, not render order.

## Debug endpoint (runtime truth)
- `GET /api/debug/knockout-graph` (local and, once deployed, production). Gated by `CRON_SECRET` in prod; open in dev.
- **Signal:** 200 + `valid:true` = healthy; **404 = the commit adding the route is not deployed** (binary proof of drift).

## DOM geometry (render truth)
- Browser at the production URL; run the geometry probe in `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md`.
- **Signal:** each match's measured centre-Y equals the midpoint of its two parents' centre-Ys.

## Evidence-gap discipline
For any fact you cannot read directly, state: **what evidence is missing, what credential is required, who can provide it, and which dashboard/API contains it** — then classify the conclusion Proven / Highly Likely / Probable / Unknown. Never upgrade confidence beyond the evidence.

## Cross-references
`docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md`, `docs/deployment/DEPLOYMENT_AUDIT.md`, `docs/deployment/DEPLOYMENT_ROOT_CAUSE.md`, `docs/deployment/INCIDENT_RESPONSE_PLAYBOOK.md`, `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`.
