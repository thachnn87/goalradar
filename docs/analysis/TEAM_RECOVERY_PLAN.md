# TEAM RECOVERY PLAN — DATA-18TEAM.1B Phase 6

**Task:** DATA-18TEAM.1B Phase 6
**Date:** 2026-06-23

> Supersedes the prior DATA-18TEAM.1 version of this file, which stated
> "Fix applied and validated." That claim was **false** — the fix was written
> to the working tree but never committed or deployed (see root cause). The
> stale claim is itself evidence of the failure mode.

---

## Proven root cause (Phase 5)

**The DATA-18TEAM.1 remediation was implemented in the working tree but never
committed or deployed.** Production runs the pre-fix committed code, which has:

1. **No team-warming** — orchestrator HEAD has no Phase 4; `refresh.ts` HEAD has
   no `extractTeamIdsFromStandings()`. Confirmed: a live production orchestrator
   run produced **0 team tasks** (rate-safe off, 0 failures).
2. **A KV-read-only reader** — `getTeamCached()` HEAD = `readKVOnly(key) ?? null`,
   no provider fallback.

→ Nothing writes `goalradar:/teams/{id}`, the reader can't self-heal, every team
page returns null → "Team Data Unavailable". Provider is healthy (`/v4/teams/762` → 200, Argentina).

The fix already exists, uncommitted, in 3 files (+126/−9):
`src/lib/api.ts`, `src/lib/refresh.ts`, `src/app/api/cron/orchestrator/route.ts`.
The new dependency `src/lib/wc-static-groups.ts` is already committed (build-safe).

---

## Smallest production-safe fix

**Commit and deploy the existing uncommitted DATA-18TEAM.1 work.** No new code is
needed — it is written, build-clean (`next build` exits 0) and type-clean (`tsc` clean).

| Requirement | How it's met |
|-------------|--------------|
| No manual KV edits | warming populates KV via the orchestrator cron + on-miss provider fallback |
| No breaking existing pages | additive only: provider fallback on miss, a new orchestrator phase, a WC standings static-merge; no existing signature changed |
| Works for all competitions | `extractTeamIdsFromStandings` covers WC, PL, PD, BL1, SA, FL1, CL; `getTeamCached` fallback is competition-agnostic |

### Recovery steps

1. **Review** `git diff HEAD -- src/lib/api.ts src/lib/refresh.ts src/app/api/cron/orchestrator/route.ts`
   to confirm it is the intended fix with no unrelated WIP. Note the `getStandingsCached`
   static-merge is bundled into the `api.ts` diff — keep it or split it out deliberately.
2. **Commit + push** the 3 files in one focused commit.
3. **Clear the deploy stall** (see Blocker) and confirm Vercel builds the new commit.
4. **Warm**: trigger `GET /api/cron/orchestrator` (Bearer CRON_SECRET) once post-deploy;
   the 30-min cron then maintains coverage. The new on-miss provider fallback also
   self-heals any team on first page hit.
5. **Verify** (table below).

---

## Validation (post-deploy)

| Check | Tool | Pass condition |
|-------|------|----------------|
| Reader fallback live | `GET /teams/762-argentina` | renders Argentina, not "Team Data Unavailable" |
| Warming runs | trigger orchestrator | response includes `team-*` tasks with `status:ok` |
| KV populated | `GET /api/debug/team-cache?secret=…&coverage=1` | `coverage.coveragePct` → 100 |
| 5-team matrix | re-run Phase 2 checks | all 5 render team data |
| Other competitions | spot-check a PL team page | renders |

---

## Risks / blockers

- ⚠️ **BLOCKER — deploy stall.** `/api/debug/team-cache` (commit `e245f8b`, pushed
  ~03:0x) has not deployed after 30+ min while older endpoints (`37267d0`,
  `e288af2`) serve 200, and a local build passes. Vercel appears not to be
  deploying new commits. **The team fix cannot reach production until this is
  resolved** — check the Vercel dashboard for failed/queued/paused deploys and the
  Git integration. Resolve before/with step 3.
- **24h team TTL vs 25-warm/run cap** — full coverage reached within ~1–2 runs and
  maintained; on-miss fallback covers gaps. Acceptable.
- **Provider rate limits** — free tier ~10 req/min; Phase 4 capped at 25/run with a
  6h min-interval and rate-safe guard. Sparse. Acceptable.

---

**Recovery = commit + deploy the existing uncommitted fix, then warm + verify.
Blocked first on resolving the Vercel deploy stall.**
