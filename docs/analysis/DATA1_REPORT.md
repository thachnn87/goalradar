# DATA-1 Report — Live State Consistency
## GoalRadar · Sprint DATA-1

Generated: 2026-06-12
Audit (with measured production evidence): `DATA1_AUDIT.md`.

---

## Summary

The Mexico vs South Africa divergence had one root cause and one structural
weakness:

1. **Root cause:** the orchestrator cron fires every 30 min but fails in 1 s
   on every run — the **`CRON_SECRET` GitHub repository secret is not set**
   (PERF-9's manual step). No bulk list has ever been refreshed; only
   user-visited match snapshots are fresh.
2. **Structural weakness:** list surfaces (schedule / hub / homepage) had no
   path to fresher state between cron cycles, even though the per-match
   snapshots they could consult were already in KV.

## Changes

| File | Change |
|------|--------|
| `src/lib/match-state-overlay.ts` | NEW — `overlayMatchStates()`: forward-only (SCHEDULED→LIVE→FINISHED) snapshot overlay via one `kv.mget`; best-effort, returns input on any failure |
| `src/app/schedule/page.tsx` | overlay applied to the rendered list |
| `src/app/world-cup-2026/page.tsx` | overlay on upcoming feed (today/upcoming sections inherit) + live section (drops matches that have since FINISHED) |
| `src/app/page.tsx` | overlay on today list + WC upcoming |
| `src/components/WCCountdownBanner.tsx` | live-state CTA "Live scores →" now → `/live` (was `/world-cup-2026`) |

## Convergence model after the fix

| Scenario | Schedule / hub / homepage show correct state after |
|----------|----------------------------------------------------|
| Cron running (secret set) | one refresh cycle (≤ 30 min lists, ≤ 30–300 s ISR) — spec criterion ✅ |
| Cron down, match page visited by anyone | one ISR window: ≤ 300 s schedule, ≤ 30 s hub/homepage ✅ |
| Cron down, match never visited | lists stay as-is (no source of fresh data exists anywhere) — resolved by the secret |

No page can show "upcoming" for a match whose own page shows FULL TIME,
because the FULL TIME state lives in the exact snapshot the overlay reads.

## Constraint compliance

- **No provider increase** — overlay is `kv.mget` only; the live page's
  intentional provider path untouched.
- **No ISR regression** — all `revalidate` values unchanged
  (homepage/hub/live 30 s, schedule 300 s); no dynamic APIs added.
- **Build & type-check** — `tsc --noEmit` 0 errors; production build passes.

## Verification

- Production divergence measured and documented before the change (audit).
- Banner CTA verified in the running app while in LIVE state:
  `href="/live"` in served HTML.
- Overlay no-op safety verified (renders fine with KV disabled locally).
- Full production verification (all four surfaces showing FT 2–0) requires
  deploy + either one cron cycle **after the `CRON_SECRET` secret is set** or
  one match-page visit + ISR window.

## ⚠ Outstanding manual step (blocking, third reminder)

GitHub → repo **Settings → Secrets and variables → Actions → New repository
secret**: name `CRON_SECRET`, value = the Vercel `CRON_SECRET` env var.
Then Actions → "WC cache orchestrator" → Run workflow, and confirm the run
turns green. Until then the lists refresh only via the overlay healing path.
