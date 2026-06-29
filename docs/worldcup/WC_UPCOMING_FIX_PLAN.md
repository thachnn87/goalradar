# WC_UPCOMING_FIX_PLAN.md — DATA-18WC.8A Enhancement Plan

**Date:** 2026-06-23  
**Context:** System works as designed. Optional enhancements below for robustness.

---

## Current Status: HEALTHY ✅

- Authority cache: 104 matches populated ✓
- Upcoming matches: 60 in authority ✓
- Orchestrator: Running every 30 min ✓
- DR fallback: 7-day TTL available ✓

**No emergency fix needed.** System is fault-tolerant and consistent.

---

## Optional Enhancements

### Enhancement 1: Manual Authority Refresh Endpoint
**Priority:** P1 | **Effort:** 15 min | **ROI:** High

Create `POST /api/debug/authority-cache-refresh?secret=$CRON_SECRET`
- Manually trigger authority builder
- Useful for post-deployment cold-start
- Avoid 30-min wait during testing

### Enhancement 2: Cold Build Retry Logic
**Priority:** P2 | **Effort:** 10 min | **ROI:** Medium

In `readAuthorityCache()`:
- On KV miss, trigger rebuild in background
- Serve DR fallback to current request
- Prevents empty array race condition

### Enhancement 3: Faster Refresh Cycle
**Priority:** P3 | **Effort:** N/A | **ROI:** Not recommended

30-min → 5-min: Cost-benefit poor (12× more API calls for tournament data).

---

## Decision

**No action required.** Enhancement 1 optional if you want faster recovery from post-deployment cold-start.

**Gate: WC_UPCOMING_FIXTURES_HEALTHY** ✅
