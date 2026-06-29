# WC_DEAD_CODE.md — Dead Code Detection
**Sprint:** DATA-18WC.12 | **Date:** 2026-06-25

## Dead / Removed Functions (confirmed gone)

| Function | File (former) | Removed in | Safe to remove |
|---|---|---|---|
| `WC_GROUP_FIXTURES` | `src/lib/wc-fixtures.ts` | SEO-7 / DATA-9 | ✓ Already removed |
| `WC_ALL_FIXTURES` | `src/lib/wc-fixtures.ts` | SEO-7 / DATA-9 | ✓ Already removed |
| `getGroupFixtures()` | `src/lib/wc-fixtures.ts` | SEO-7 / DATA-9 | ✓ Already removed |
| `getTeamFixtures()` | `src/lib/wc-fixtures.ts` | SEO-7 / DATA-9 | ✓ Already removed |
| `positionToStatus()` | `src/lib/wc-qualification.ts` | DATA-18WC.7B | ✓ Already removed |
| `getStaticUpcomingMatches` | hub page.tsx | Recent cleanup | ✓ Already removed (comment confirms) |

---

## Potentially Dead Code (requires verification)

| Function / Export | File | Status | Notes |
|---|---|---|---|
| `isStaticFallback()` | `src/lib/wc-static-groups.ts:77` | **Likely dead** | Groups page uses `matchesPlayed` check directly; hub may also no longer call this. Verify with grep before removing. |
| `WCGroupFixture` interface | `src/lib/wc-fixtures.ts:20` | **Possibly dead** | Defined but group fixture data removed. Check if any page still imports this type. |
| `getStaticWCGroupTables()` dead path | `src/lib/wc-static-groups.ts:48` | Active (fallback) | Cannot remove — essential fallback when standings KV is empty. Keep. |

---

## Duplicate Logic (none confirmed)

No duplicate qualification calculation logic was found. `calculateQualificationStatus()` is the single implementation.

No duplicate standings builders were found. `getStaticWCGroupTables()` builds the skeleton; `getStandingsCached()` merges it with live data.

No duplicate bracket generators were found. `WC_KNOCKOUT_SLOTS` is the single source for bracket structure.

---

## Legacy Standings Merge

The merge in `getStandingsCached('WC')` has one subtle legacy concern:

```typescript
// DATA-18WC.4 comment:
// "football-data.org returns 'Group A' but static tables use 'GROUP_A'. Normalise..."
const toGroupKey = (g) =>
  (g ?? '').startsWith('GROUP_') ? (g ?? '') :
  'GROUP_' + (g ?? '').replace(/^Group\s*/i, '').trim().toUpperCase();
```

This normalization was added as a DATA-18WC.4 fix. It handles the known FD API format ("Group A"). However, if FD API returns a completely different format for WC 2026 (e.g., numeric group IDs), this code would silently produce GROUP_undefined or GROUP_1 which would not match the static skeleton's GROUP_A–GROUP_L keys. All groups would then fall back to static zeros.

**This may be the actual standing zero-state root cause** if FD API returns WC standings but with unexpected group field values.

---

## Summary

- Dead code: minimal — previous cleanups (SEO-7, DATA-9, DATA-18WC.7B) already removed legacy functions
- Duplicate logic: none
- At-risk: `isStaticFallback()` in wc-static-groups.ts may be unused; `WCGroupFixture` interface may be unused. Safe to audit and remove if grep confirms no callers.
