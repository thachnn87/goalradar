# DATA-18B.3B Phase 1 — Activation State

**Date:** 2026-06-19
**Checked At:** 2026-06-19T04:03–04:05 UTC
**Verdict: ACTIVATED**

---

## AUTHORITY_CACHE_PILOT Status

| Check | Value | Status |
|-------|-------|--------|
| Env var `AUTHORITY_CACHE_PILOT` | `true` | ✅ CONFIRMED |
| Bracket page executing authority path | Yes | ✅ CONFIRMED |
| `PILOT_ENABLED` constant in bracket | `true` | ✅ CONFIRMED |

**Confirmation method:** Attribution telemetry shows `/world-cup-2026/bracket` recorded a read via `readAuthorityCache()` at `2026-06-19T03:47:26.121Z`. This only occurs when `PILOT_ENABLED = process.env.AUTHORITY_CACHE_PILOT === 'true'` is true and the bracket page executes the authority path.

If the env var were false, the bracket would call `getWCKnockoutMatchesCached()` (legacy FD path) which does NOT call `readAuthorityCache()` and would not appear in authority attribution telemetry.

---

## ISR Coverage

| Route | Pilot Active | Last Read |
|-------|-------------|-----------|
| `/world-cup-2026` | Yes (pre-existing) | 2026-06-19T03:47:30 |
| `/world-cup-2026/results` | Yes (pre-existing) | 2026-06-19T03:47:30 |
| `/world-cup-2026/fixtures` | Yes (pre-existing) | 2026-06-19T03:47:29 |
| `/world-cup-2026/matches-today` | Yes (pre-existing) | 2026-06-19T03:47:29 |
| `/world-cup-2026/matches-tomorrow` | Yes (pre-existing) | 2026-06-19T03:47:29 |
| `/world-cup-2026/[group]` | Yes (pre-existing) | 2026-06-19T03:47:25 |
| `/world-cup-2026/bracket` | **YES — NEW (pilot)** | **2026-06-19T03:47:26** |

**ISR coverage: 7/7 routes (100%)**

---

## Bracket Path Execution

When `AUTHORITY_CACHE_PILOT=true`, bracket page executes:
```typescript
const builtAt = new Date().toISOString();
const data = await getWCAuthorityMatchesV2(builtAt, {
  source: '/world-cup-2026/bracket',
  sourceType: 'page',
});
allWCMatches = data.matches.map(canonicalToMatch);
```

The `source: '/world-cup-2026/bracket'` attribution confirms which path ran. This is exactly what appears in the telemetry `lastSource` field.

**Bracket executed authority path at 03:47:26 UTC — 543ms cold rebuild (DR staleness guard active due to stale DR, orchestrator cron down).**

---

## Pre-Activation Baseline

Prior to pilot activation (before today, 2026-06-18):
- Bracket was on legacy `getWCKnockoutMatchesCached()` path
- 0 bracket reads appeared in authority attribution telemetry
- ISR coverage was 6/7 routes (85.7%)

After activation (2026-06-19):
- Bracket on authority path
- 1 bracket read logged
- ISR coverage now 7/7 routes (100%)
