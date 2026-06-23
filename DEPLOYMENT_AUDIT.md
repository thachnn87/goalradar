# DEPLOYMENT AUDIT — DATA-18OPS.2F

**Task:** DATA-18OPS.2F Deployment Verification
**Date:** 2026-06-23
**Method:** black-box production probing (git + HTTP). **No Vercel API token or
`gh` auth available** in this environment, so Vercel-internal records
(integration settings, branch mapping UI, build logs) are **inferred from
observed deploy behavior**, not read directly. Items requiring the dashboard are
marked ⚠️ DASHBOARD.

---

## Phase 1 — Versions

| Item | Value | Source |
|------|-------|--------|
| Latest GitHub commit (remote `main` HEAD) | **`165d33d`** | `git ls-remote origin refs/heads/main` |
| Latest local commit | `165d33d` | `git log` |
| Latest deployed code (verified live) | ≥ `093478f` (team fix) + `e245f8b` route present | endpoint markers (below) |
| Build id | ⚠️ DASHBOARD — not exposed in HTML; app-router homepage emits no `buildId`/static hash to read black-box |
| Deployment timestamp | ⚠️ DASHBOARD — Vercel response headers expose `x-vercel-id` (request id) + `Date`, not a build/commit timestamp |

Recent commits (committer time, +0700):

```
165d33d 10:46:50  docs(data18team1b): gate TEAM_READY
093478f 10:35:40  fix(data18team1b): deploy team warming + reader fallback
ca32441 10:33:34  docs(data18team1b): team cache audit
e245f8b 10:01:40  feat(debug): add /api/debug/team-cache
cb5f8d6 09:35:28  docs(data18b3e): live-source unification
37267d0 09:25:05  feat(data18b3e): unify WC live-state on SSOT
e288af2 09:03:33  feat(debug): add /api/debug/state-divergence
f91766f (06-22) 22:30  feat(wc-live-ssot)
```

### Per-commit endpoint markers (which commits' code is LIVE)

Each feature commit added a unique route; a 200 proves that commit's code is deployed.

| Commit | Marker route | HTTP | Code live? |
|--------|--------------|------|-----------|
| `f91766f` | `/api/debug/live-consistency` | 200 | ✅ |
| `e288af2` | `/api/debug/state-divergence` | 200 | ✅ |
| `37267d0` | `/api/debug/live-source-map` | 200 | ✅ |
| `e245f8b` | `/api/debug/team-cache` | 200 (after a transient `000` blip) | ✅ |
| `093478f` | `/teams/762-argentina` renders "Argentina" (not "Unavailable") | 200 | ✅ |

All probed feature commits are live. (`ca32441`, `165d33d`, `cb5f8d6`, `7284680`
are docs-only — no code signal to probe, but they sit between live code commits.)

---

## Phase 2 — GitHub → Vercel integration

**Verdict: HEALTHY (inferred).** Evidence: every code-bearing push to `main`
(`f91766f`, `e288af2`, `37267d0`, `093478f`) is reflected in production without
any manual deploy step. Pushes automatically produce live builds. ⚠️ DASHBOARD
confirmation of the Git connection record is not available via API here.

---

## Phase 3 — Branch / auto-deploy

| Setting | Observed value | Basis |
|---------|----------------|-------|
| Production branch | `main` | every `main` push goes to `www.goalradar.org` |
| Branch mapping | `main → production` | same |
| Auto-deploy | **Enabled** | pushes deploy with no manual trigger |
| Project | single correct project (`goalradar`) | `git remote` = `github.com/thachnn87/goalradar`; production domain serves the same app |

⚠️ DASHBOARD: exact project settings (ignored-build-step, deploy protection,
concurrency) are not readable without Vercel access; the above is inferred from
the fact that **multiple commits deployed automatically and correctly**.

---

## Phase 4 — Did production build `e245f8b`? **YES (code live), with a caveat**

- `e245f8b`'s route `/api/debug/team-cache` now returns **200** → its code IS in production.
- **But** for ~34 min after `e245f8b` was pushed (≈03:01Z) the route returned
  **404** (Vercel served a build lacking it). It only became 200 after the
  descendant `093478f` was pushed (≈03:35Z) and deployed within ~2 min.
- So `e245f8b`'s code reached production **via the later `093478f` build**, not a
  timely standalone `e245f8b` deployment. Whether a discrete `e245f8b` deployment
  record exists/failed/was-skipped is ⚠️ DASHBOARD-only.

See DEPLOYMENT_ROOT_CAUSE.md.

---

## Limitations

- No Vercel API token / `gh` auth → no build logs, deployment list, or settings UI.
- App-router homepage exposes no `buildId` → exact deployed SHA not black-box readable.
- Several `000`/DNS/`port 443` failures occurred during the session from the
  **local** network (also seen during `git push`), independent of Vercel.

**Phase 1–4 evidence complete. Pipeline auto-deploys `main`; all probed code is live.**
