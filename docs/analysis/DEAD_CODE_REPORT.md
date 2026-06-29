# DEAD CODE REPORT
**Phase:** DATA-18WC.RESET Phase 3  
**Date:** 2026-06-25  
**Legend:** DELETE = safe to remove | ARCHIVE = keep for reference only | ACTIVE = still needed

---

## DC1 — Deprecated API Routes

**Description:** Three API route handlers marked `@deprecated` — merged into `/api/cron/orchestrator` during RATE-3 sprint. Still exist as files.

| File | Status | Action |
|---|---|---|
| `src/app/api/refresh/wc-fixtures/route.ts` | @deprecated (line 4) | **DELETE** |
| `src/app/api/cron/prewarm-worldcup/route.ts` | @deprecated (line 4) | **DELETE** |
| `src/app/api/refresh/standings/route.ts` | @deprecated (line 4) | **DELETE** |

**Risk:** Low. These routes likely return a deprecation notice if called. The orchestrator replaced all their functionality.

---

## DC2 — `fetchFromAPI()` Dead Function

**Description:** `fetchFromAPI()` in `src/lib/api.ts` at line 43. All functions now route through `providerManager`. This function is unreachable from any current code path.

| Symbol | Location | Action |
|---|---|---|
| `fetchFromAPI()` | `src/lib/api.ts:43` | **DELETE** |

**Risk:** Low. Removing it will cause a TypeScript compile error if anything imports it — confirming whether it's truly unused.

---

## DC3 — `/world-cup-2026/third-place-playoff` Duplicate Route

**Description:** A second third-place route that duplicates `/world-cup-2026/third-place`.

| File | Status | Action |
|---|---|---|
| `src/app/world-cup-2026/third-place-playoff/page.tsx` | Duplicate — same data, different slug | **DELETE** + add redirect |

**Risk:** Low if redirect is in place. Google may be indexing this URL — add a 301 redirect before deleting.

---

## DC4 — `PILOT_ENABLED` Residual References

**Description:** The `PILOT_ENABLED` const was removed from `bracket/page.tsx` in Sprint 15. The env var `AUTHORITY_CACHE_PILOT` remains in use inside `knockout-vm.ts`. The gate itself is not dead code.

| Symbol | Location | Status |
|---|---|---|
| `process.env.AUTHORITY_CACHE_PILOT` | `src/lib/knockout-vm.ts:108` | **ACTIVE** — production feature gate |
| `PILOT_ENABLED` const | `src/app/api/debug/authority-adoption/route.ts:35` | Still referenced as debug marker |

**Action:** None. Gate is still in use.

---

## DC5 — Legacy ESPN ID Sentinel Handling

**Description:** `__NOT_FOUND__` string sentinel from pre-DATA-15C era in `src/lib/espn-id-map.ts`.

| Symbol | Location | Status | Action |
|---|---|---|---|
| `__NOT_FOUND__` string handling | `src/lib/espn-id-map.ts:128, 146, 159` | Pre-DATA-15C legacy | **ARCHIVE** — low risk, not WC critical path |

---

## DC6 — `_path` Prop on Results Page

**Description:** `src/app/world-cup-2026/results/page.tsx` has a `_path` prop distinguishing `'legacy'` vs `'authority'` data sources. This was added during a migration that has since completed.

| Symbol | Location | Status | Action |
|---|---|---|---|
| `_path` prop | `src/app/world-cup-2026/results/page.tsx:47` | Migration artifact | **INVESTIGATE** — may be removable if migration is complete |

---

## DC7 — TODO/FIXME Markers (Non-WC critical path)

**Description:** Two TODO markers in `match-identity.ts` reference DATA-15B/C tasks.

| Location | Task | Status |
|---|---|---|
| `src/lib/match-identity.ts:204` | DATA-15B: Merge before identity write | **NOT WC CRITICAL** — lower priority |
| `src/lib/match-identity.ts:278` | DATA-15C: Provider resolver for absent provider ID | **NOT WC CRITICAL** — lower priority |

**Action:** Defer to separate sprint. Not part of RESET scope.

---

## DC8 — Import Comment Artifacts

**Description:** Leftover comments from removed imports.

| Location | Comment | Action |
|---|---|---|
| `src/app/world-cup-2026/page.tsx:28` | `// getStaticUpcomingMatches is no longer needed here...` | **DELETE** comment |

---

## Summary

| # | Description | Priority | Action |
|---|---|---|---|
| DC1 | Deprecated API routes (3 files) | HIGH | DELETE files |
| DC3 | third-place-playoff duplicate route | HIGH | DELETE + redirect |
| DC2 | fetchFromAPI() dead function | MEDIUM | DELETE function |
| DC8 | Stale import comments | LOW | DELETE comments |
| DC6 | _path migration artifact | LOW | Investigate |
| DC4 | PILOT gate | N/A | ACTIVE — do not touch |
| DC5, DC7 | Non-WC legacy items | DEFER | Out of RESET scope |
