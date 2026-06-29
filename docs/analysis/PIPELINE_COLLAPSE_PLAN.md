# PIPELINE COLLAPSE PLAN
**Phase:** DATA-18WC.RESET Phase 4  
**Date:** 2026-06-25

---

## Goal

Collapse all parallel data pipelines into ONE pipeline per feature. No page assembles knockout data independently.

---

## Current State

| Pipeline | Active Consumers | Data Source |
|---|---|---|
| `buildKnockoutViewModel()` | bracket/page.tsx, WCRoundPage (x6) | authority:v1 or legacy KV |
| `getWCKnockoutMatchesCached()` direct | `world-cup-2026/page.tsx:324` (hub), `world-cup-2026-bracket/page.tsx:11` | legacy KV |

Two parallel knockout pipelines are active. The hub and SEO bracket page bypass the ViewModel.

---

## Target State

```
buildKnockoutViewModel()   ← ONE knockout pipeline
  ├─ bracket/page.tsx          ✓ DONE (Sprint 15)
  ├─ WCRoundPage (x6)          ✓ DONE (Sprint 15)
  ├─ world-cup-2026/page.tsx   ← FIX NEEDED
  └─ world-cup-2026-bracket/page.tsx  ← FIX NEEDED
```

---

## Changes Required

### Fix 1: Hub page (`src/app/world-cup-2026/page.tsx`)

**Current (line 324):**
```typescript
const [authorityResult, standingsResult, knockoutResult, liveResult] =
  await Promise.allSettled([
    getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026', sourceType: 'page' }),
    getStandingsCached('WC'),
    getWCKnockoutMatchesCached(),   // ← REMOVE
    getCurrentLiveMatches(),
  ]);
```

**After:**
```typescript
const [authorityResult, standingsResult, vmResult, liveResult] =
  await Promise.allSettled([
    getWCAuthorityMatchesV2(builtAt, { source: '/world-cup-2026', sourceType: 'page' }),
    getStandingsCached('WC'),
    buildKnockoutViewModel(),        // ← NEW
    getCurrentLiveMatches(),
  ]);
```

**Update usage (line 353):**
```typescript
// Before:
const knockoutMatches: Match[] =
  knockoutResult.status === 'fulfilled' ? knockoutResult.value.matches : [];

// After:
const bracketMatches: Match[] =
  vmResult.status === 'fulfilled' ? vmResult.value.bracketMatches : [];
```

**Update WCBracket call (line 547):**
```typescript
// Before:
<WCBracket matches={knockoutMatches} />

// After:
<WCBracket matches={bracketMatches} />
```

**Remove import (line 6):**
```typescript
// Remove this line:
getWCKnockoutMatchesCached,
```

**Add import:**
```typescript
import { buildKnockoutViewModel } from '@/lib/knockout-vm';
```

---

### Fix 2: SEO Bracket page (`src/app/world-cup-2026-bracket/page.tsx`)

**Current (line 11):**
```typescript
import { getWCKnockoutMatchesCached } from '@/lib/api';
import { isStaticMode, getStaticKnockoutSlots } from '@/data/worldcup/loader';
```

This page is a narrative SEO page (round descriptions + dates). It does NOT render a WCBracket tree. It shows match lists per round. Migrate its data fetch to `buildKnockoutViewModel()`.

**Actions:**
1. Replace `getWCKnockoutMatchesCached()` call with `buildKnockoutViewModel()`
2. Replace `isStaticMode` / `getStaticKnockoutSlots` usage with `vm.hasApiData` and `WC_KNOCKOUT_SLOTS`
3. Update ISR TTL from 21600 (6h) to 900 (15min) to match other knockout pages

---

## Post-Fix State

```
buildKnockoutViewModel()   ← ONE pipeline
  ├─ bracket/page.tsx          ✓
  ├─ WCRoundPage (x6)          ✓
  ├─ world-cup-2026/page.tsx   ✓ (after fix)
  └─ world-cup-2026-bracket/page.tsx  ✓ (after fix)
```

`getWCKnockoutMatchesCached()` remains as the underlying fetch inside `buildKnockoutViewModel()` when `AUTHORITY_CACHE_PILOT=false`. No page imports it directly.
