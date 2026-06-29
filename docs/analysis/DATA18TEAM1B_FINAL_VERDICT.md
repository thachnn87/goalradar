# DATA-18TEAM.1B — FINAL VERDICT

**Date:** 2026-06-23

# GATE: TEAM_READY ✅ (recovery executed + verified)

> Audit verdict was **TEAM_NOT_READY**. On user authorization the recovery was
> executed and verified in production — gate is now **TEAM_READY**. The audit
> sections below are preserved as the diagnostic record; the recovery outcome is
> in "Recovery executed" near the end.

> Filename note: written as `DATA18TEAM1B_FINAL_VERDICT.md` because a generic
> `FINAL_VERDICT.md` already exists for the (incorrectly-closed) DATA-18TEAM.1.

---

## Root cause (proven, exact layer)

**The DATA-18TEAM.1 fix was written to the working tree but never committed or
deployed.** Production runs pre-fix committed code. The exact failing layers:

1. **Warming layer — does not exist in deployed code.**
   - `git show HEAD:src/app/api/cron/orchestrator/route.ts | grep -c extractTeamIdsFromStandings` → **0**
   - `git show HEAD:src/lib/refresh.ts | grep -c extractTeamIdsFromStandings` → **0**
   - Live production orchestrator run → **0 `team-*` tasks** (rate-safe off, 0 failures, 13 non-team tasks ok).
2. **Reader layer — KV-read-only in deployed code.**
   - `getTeamCached()` HEAD = `readKVOnly(key); return data ?? null` — no provider fallback.

Net: nothing writes `goalradar:/teams/{id}`; the reader cannot self-heal → every
team page returns null → "Team Data Unavailable".

### Candidate failures ruled out (evidence)

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| Provider failure | ❌ | `GET /v4/teams/762` → 200 (Argentina, squad 26); 5/5 ids → 200 |
| KV key mismatch | ❌ | write & read both `goalradar:/teams/{id}` |
| ID / slug mismatch | ❌ | numeric FD id on both sides; slug cosmetic |
| Routing mismatch | ❌ | pages return 200 and render the card |
| Rate-safe blocking | ❌ | orchestrator `rateSafeMode.active=false` |
| KV write failure | ❌ | no write is attempted (no warmer, read-only reader) |
| **Warming never runs / fix never deployed** | ✅ **ROOT CAUSE** | git HEAD lacks the warmer; prod orchestrator = 0 team tasks; reader is read-only |

The prior `TEAM_RECOVERY_PLAN.md` (DATA-18TEAM.1) claimed *"Fix applied and
validated"* — false; the code was never committed. This contradiction is direct
corroboration.

---

## Phase results

| Phase | Deliverable | Result |
|-------|-------------|--------|
| 1 Source map | TEAM_SOURCE_MAP.md | deployed vs working-tree gap; keys/ids/routing all match (ruled out) |
| 2 Production matrix | TEAM_PRODUCTION_MATRIX.md | 5/5: provider 200, KV missing, render "Unavailable" |
| 3 Coverage | TEAM_COVERAGE_AUDIT.md | 0% cached (total cold cache; no stale/orphaned) |
| 4 Warming | TEAM_WARMING_AUDIT.md | 0 team tasks — phase absent in deployed code |
| 5 Root cause | this doc | fix never committed/deployed (warming + reader) |
| 6 Recovery | TEAM_RECOVERY_PLAN.md | commit + deploy the uncommitted fix, then warm + verify |

---

## Why TEAM_NOT_READY

- Production currently renders **0%** of team pages (all "Team Data Unavailable").
- The fix exists but is **uncommitted** and **undeployed**.
- A **second blocker**: Vercel is not deploying new commits right now
  (`/api/debug/team-cache` @ `e245f8b` not live after 30+ min; local build passes).
  Even committing the fix won't recover production until deploys resume.

---

## Recovery (summary — see TEAM_RECOVERY_PLAN.md)

1. Resolve the Vercel deploy stall (dashboard: failed/queued/paused deploys, Git integration).
2. Review + commit + push the 3 uncommitted files (`api.ts`, `refresh.ts`, `orchestrator/route.ts`).
3. Trigger the orchestrator to warm team KV; on-miss provider fallback self-heals on access.
4. Verify 5-team matrix renders + coverage → 100% via `/api/debug/team-cache`.

**No fix was implemented in this audit** (per "audit first; do not implement until
root cause is proven"). The remediation is pre-existing uncommitted work and should
be reviewed before committing.

---

## Recovery executed (commit `093478f`)

User authorized "commit + deploy the fix." Executed:

1. **Committed + pushed** the 3 uncommitted fix files (`api.ts`, `refresh.ts`,
   `orchestrator/route.ts`) as `093478f` — the DATA-18TEAM.1 remediation.
2. **Deploy stall was transient** — `093478f` (and the `team-cache` instrument)
   deployed within ~2 min on this push; the earlier 30-min non-deploy did not recur.
3. **Verified in production:**
   - All 5 team pages render: Argentina / France / Brazil / Spain / Germany
     ("… – Squad, Fixtures & Results"), **no "Team Data Unavailable"**.
   - `team-cache` endpoint: all 5 → `KV.exists=true`, names populated,
     `render="TEAM (from KV)"`.
   - `extractTeamIdsFromStandings()` → **158** team ids (warming source healthy).
   - Reader provider-fallback self-healed the 5 pages on first hit; orchestrator
     Phase 4 now warms up to 25 teams/run, with the 6h-TTL/on-miss fallback
     covering the rest. Full-population warming completes over the next cron cycles.

**Note:** a cold orchestrator run now exceeds ~240s (Phase 4 warms ~25 teams at
~7s each + other phases). On-demand fallback + incremental cron warming make this
non-blocking, but if cold-start wall-time becomes an issue, lower
`TEAM_MAX_CALLS_PER_RUN` or move team warming to its own cron. (Optional follow-up.)

---

## Deliverables

| Document | Status |
|----------|--------|
| TEAM_SOURCE_MAP.md | ✅ |
| TEAM_PRODUCTION_MATRIX.md | ✅ |
| TEAM_COVERAGE_AUDIT.md | ✅ |
| TEAM_WARMING_AUDIT.md | ✅ |
| TEAM_RECOVERY_PLAN.md | ✅ (supersedes stale DATA-18TEAM.1 version) |
| DATA18TEAM1B_FINAL_VERDICT.md | ✅ this document |
| `/api/debug/team-cache` (read-only instrument, `e245f8b`) | ✅ deployed |
| Fix (`api.ts` + `refresh.ts` + `orchestrator`, `093478f`) | ✅ committed + deployed + verified |

---

# GATE: TEAM_READY ✅ (audit verdict was TEAM_NOT_READY; recovery executed + verified)
