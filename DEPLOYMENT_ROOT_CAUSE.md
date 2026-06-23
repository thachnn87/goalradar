# DEPLOYMENT ROOT CAUSE — DATA-18OPS.2F (Phases 4–5)

**Date:** 2026-06-23

---

## Question (Phase 4)

Did production ever build `e245f8b`? — **YES, its code is live**, but **not via a
timely standalone deployment**: the route was 404 for ~34 min after the push and
only became 200 after the descendant `093478f` deployed.

---

## Blocker classification (Phase 5)

The candidate blockers, tested against evidence:

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| **Disabled deploy** | ❌ ruled out | commits before (`37267d0`) and after (`093478f`) `e245f8b` auto-deployed in ~2 min |
| **Wrong branch** | ❌ ruled out | all pushes target `main`; production reflects `main` |
| **Wrong project** | ❌ ruled out | `www.goalradar.org` serves the repo's app; new routes appear |
| **Failed build (code error)** | ❌ ruled out | `e245f8b`'s code builds clean locally (`next build` exit 0) and shipped intact inside the `093478f` build |
| **Queue / delayed / superseded standalone deploy** | ✅ **most consistent** | `e245f8b` route 404 for ~34 min, then live once `093478f` (a superset) built |

### Why "queued / superseded", not "broken"

- A disabled/wrong-branch/wrong-project fault would block **every** commit. Many
  commits deployed normally in the same hour → the pipeline itself was working.
- The code is build-clean (proven by the `093478f` build that contains it) →
  not a code-level build failure.
- The symptom was isolated to one commit and self-resolved on the next push →
  consistent with a transient build-queue delay or a standalone deployment that
  was skipped/superseded by the descendant commit, which is normal Vercel
  behavior when a newer commit's build completes first.

### What cannot be proven black-box

Whether a discrete `e245f8b` deployment record exists and shows
`QUEUED`/`CANCELED`/`ERROR`/`READY` is only visible in the **Vercel dashboard /
API**, for which no token is available in this environment. The black-box
evidence (404→200 across the `093478f` push) bounds the conclusion: the standalone
`e245f8b` deploy did not serve traffic in its ~34-min window; the code is now live.

---

## Relationship to DATA-18TEAM.1B

The DATA-18TEAM.1B audit flagged a possible "deploy stall" as a risk. This audit
resolves it: the pipeline is **not** broken. The team-page outage there was caused
by the fix being **uncommitted** (never pushed), not by a deploy failure. The
`e245f8b` delay was a separate, transient, self-resolved event.

---

## Recommendation

- **No pipeline change required** — auto-deploy of `main` is healthy.
- For future certainty, obtain a **Vercel API token** (or `gh`/Vercel CLI auth)
  in the ops environment so deployment records (status, build id, commit, time)
  can be read directly instead of inferred. This would let a future
  `/api/debug/*` or CI step assert "deployed SHA == latest `main`".
- Optional: expose the deployed commit SHA in the app (e.g. `VERCEL_GIT_COMMIT_SHA`
  env at build → a `/api/debug/version` endpoint) so deploy/commit drift is
  directly verifiable black-box.

**Phase 5 complete. Blocker = transient queued/superseded standalone deploy of
`e245f8b`; pipeline healthy; code live.**
