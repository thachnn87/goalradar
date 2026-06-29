# CRON_SECRET Usage Report
## GoalRadar · repository-wide audit (no code changes)

Generated: 2026-06-12
Searched: `CRON_SECRET`, `Authorization: Bearer`, `/api/cron/orchestrator`,
`secret=` across the whole repo (excluding `node_modules`/`.next`), plus
`.github/workflows/*`, `vercel.json`, `docs/`, and README (none exists).

---

## 1. Every place CRON_SECRET is referenced

### Server code — routes that VALIDATE the secret (7)

| Route | Auth helper | Accepts |
|-------|------------|---------|
| `/api/cron/orchestrator` | `isAuthorizedExternalRequest` | header **or** `?secret=` |
| `/api/cron/prewarm-worldcup` (deprecated, kept for old schedulers) | external | header or `?secret=` |
| `/api/refresh/wc-fixtures` (deprecated) | `isAuthorizedCronRequest` | header only |
| `/api/refresh/standings` (deprecated) | cron | header only |
| `/api/debug/prewarm-status` | external | header or `?secret=` |
| `/api/cache-stats` | inline `process.env.CRON_SECRET` check | header |
| `/api/newsletter/migrate` (one-shot migration) | inline check | header |

Shared helpers: `src/lib/refresh.ts` — `isAuthorizedCronRequest`
(header-only) and `isAuthorizedExternalRequest` (header or query param).
Both fail closed when the env var is unset.

### Callers that SEND the secret (1)

- **`.github/workflows/orchestrator-cron.yml`** — the only caller in the
  repo: `Authorization: Bearer ${{ secrets.CRON_SECRET }}` →
  `/api/cron/orchestrator`, every 30 min + manual dispatch. Fast-fails
  before curl when the GitHub secret is empty (current production state).

### Configuration / docs

- `.env.local.example:54` — `CRON_SECRET=your_random_secret_here` + a curl
  example for the newsletter migration.
- Sprint reports referencing it: `PERF9_AUDIT`, `DATA1_*`, `CRON_VERIFY_REPORT`,
  `PERF-3-REPORT`, `docs/RES-1-provider-dependency-audit.md` (curl example).
- **No README.md exists**; `docs/` has no deployment guide.

## 2. Is any external scheduler documented?

Only as **intent**, never as configuration:

- Code comments name "GitHub Actions / EasyCron / UptimeRobot" as the
  expected trigger (`orchestrator/route.ts:13`, `refresh.ts:316/336/361`);
  the `?secret=` query-param branch exists specifically for UptimeRobot.
- **No EasyCron/UptimeRobot/cron-job.org configuration exists anywhere in
  the repo**, and no doc records one being set up outside it. Production
  evidence (PERF-9: KV never seeded) confirms no external scheduler has
  ever successfully called the endpoint.

## 3. Can rotating CRON_SECRET break anything?

Rotation requires updating **two stores atomically**:

1. Vercel env `CRON_SECRET` (requires redeploy/env refresh to take effect),
2. GitHub repo secret `CRON_SECRET`.

Breakage surface if they diverge: all 7 routes above start rejecting the
old value — the orchestrator stops refreshing KV (the PERF-9 failure mode
returns), and any manual curl/debug tooling using the old value gets 401.
Nothing else depends on it: it is not used for signing, storage, or
user-facing features, and no third-party service holds it (per §2 — unless
an undocumented UptimeRobot/EasyCron job exists outside the repo, which
cannot be ruled out from the repo alone; the `?secret=` URL form means such
a job would embed the secret in its configured URL).

Rotation is therefore **safe and simple**: set the new value in Vercel →
redeploy → update the GitHub secret → run the workflow manually to confirm
green. No code changes needed.

## 4. Are Vercel Crons still enabled?

**No.** `vercel.json` is `{}` — the `crons` block was deliberately removed
(commits `f4a2401 "remove cron"`, `3969951 "remove vercel cron"`; the old
config survives only in the untracked `vercel-bak.json`, which targeted the
now-deprecated `/api/refresh/*` routes). Note: Vercel Cron requests carry
their own auth model; the current routes would 401 them anyway unless they
sent the Bearer header — re-enabling Vercel Crons would require either the
`?secret=` form in the cron path or handler changes.

## 5. Is GitHub Actions the only scheduler?

**Yes — the only one in the repo, and effectively the only one at all:**
`orchestrator-cron.yml` is the single workflow file, Vercel crons are gone,
and the cold production KV proves nothing else has ever authenticated. It
is currently non-functional solely because the GitHub repository secret
`CRON_SECRET` is unset (see `CRON_VERIFY_REPORT.md` for the fix and test
commands).
