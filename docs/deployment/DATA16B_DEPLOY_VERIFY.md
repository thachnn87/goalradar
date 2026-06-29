# DATA-16B Deployment Verification

Date: 2026-06-17
Phase: 1 of 7

---

## GitHub Push

```
git push origin main
→  33904fb..c4d4b85  main -> main
```

**Status: SUCCESS.** All 8 local commits (DATA-13E through DATA-16) are now on `origin/main`.

| Commit | Description |
|--------|-------------|
| `2a32c60` | DATA-13E: harden ESPN enrichment pipeline (debug endpoint source fix) |
| `64f88cf` | DATA-14A: fix missing goal types + statistics team ID mismatch |
| `8830e09` | DATA-14B: invalidateMatchSnapshot clears ESPN event cache |
| `582451c` | DATA-15A: canonical match identity layer (dormant skeleton) |
| `532f490` | DATA-15B: negative cache audit + team identity design (docs) |
| `842174b` | DATA-15C: harden ESPN negative cache (structured miss + backoff) |
| `9737eb1` | DATA-15C.1: FAQ never claims goalless on scored match |
| `c4d4b85` | DATA-16: snapshot reliability + ESPN lineups |

---

## Vercel Deployment Confirmation

| Signal | Evidence | Status |
|--------|----------|--------|
| `/api/debug/enrichment-health` → HTTP 401 | `{"error":"Unauthorized"}` | ✅ EXISTS |
| `/api/cron/repair-enrichment` → HTTP 401 | `{"error":"Unauthorized"}` | ✅ EXISTS |
| Old endpoint `/api/debug/espn-enrichment/537346` → responsive | 401 (auth-gated) | ✅ EXISTS |

Both DATA-16 endpoints were **not present before this deployment**. Their existence as auth-gated routes proves the DATA-16 code is live.

---

## CRON_SECRET Availability

`CRON_SECRET` is not in the local `.env.local` file (only `REVALIDATE_SECRET` is present, which is a different secret). Both authenticated endpoints return 401 without it.

**Action required (user):** retrieve `CRON_SECRET` from the Vercel dashboard → Environment Variables, then run the repair runbook in DATA16B_RECOVERY_REPORT.md.

---

## FAQ Fix Verification (DATA-15C.1)

Checked all 17 scored WC 2026 matches via public page HTML.

| Check | Result |
|-------|--------|
| Any scored match showing "ended goalless (0–0)" | **NONE** ✅ |
| Spain 0-0 Cape Verde showing "ended goalless" | **YES** ✅ (correct) |
| Scored matches showing "scorer information unavailable" | 16/17 (correct fallback) |
| Iraq vs Norway showing partial scorers | 2 names shown (partial enrichment) |

The DATA-15C.1 FAQ fix is confirmed live and working correctly.

---

## Endpoint Status Matrix

| Endpoint | Auth | HTTP | Status |
|----------|------|------|--------|
| `/api/debug/enrichment-health` | CRON_SECRET | 401 | ✅ Deployed |
| `/api/cron/repair-enrichment` | CRON_SECRET | 401 | ✅ Deployed |
| `/api/debug/espn-enrichment/{id}` | CRON_SECRET | 401 | ✅ Deployed |
| `/api/revalidate/match/{id}` | CRON_SECRET | 401 | ✅ Deployed |
| Public match pages | None | 200 | ✅ Serving |

---

## Verdict

**Deployment: GREEN.** All 8 commits are on GitHub and Vercel has deployed them (confirmed by DATA-16 endpoint existence). The full DATA-14A → DATA-16 fix stack is now live in production.

Production enrichment coverage remains at ~0% (1 partial match) due to stale KV snapshots from before the deploy. This is expected — coverage recovery requires CRON_SECRET to run the repair job.
