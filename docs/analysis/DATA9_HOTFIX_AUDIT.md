# DATA9 Hotfix Audit
## Next.js 16 Route Handler Params Type — Pre-Fix Findings

Date: 2026-06-16
Triggered by: Vercel build failure on commit 1afdc41

---

## Build Error

```
Type '{ params: Promise<{ id: string; }>; }'
is not assignable to type
'{ params: { id: string; }; }'
```

File: `src/app/api/debug/match-state/[id]/route.ts`

Root cause: Next.js 16 changed dynamic route `params` from a plain object
`{ id: string }` to a Promise `Promise<{ id: string }>`. Route handlers must
destructure and `await params` before accessing fields.

---

## Audit — All Dynamic Route Handlers Under `src/app/api/`

Searched for `{ params }` destructuring in all `route.ts` files:

```
src/app/api/calendar/[matchId]/route.ts
src/app/api/live-score/[matchId]/route.ts
src/app/api/newsletter/confirm/[token]/route.ts
src/app/api/prewarm/match/[id]/route.ts
src/app/api/debug/match-state/[id]/route.ts
```

### Status per file

| File | Pattern found | Already Next.js 16? | Action needed |
|------|--------------|---------------------|---------------|
| `calendar/[matchId]/route.ts` | `params: Promise<{ matchId: string }>` | ✅ Yes | None |
| `live-score/[matchId]/route.ts` | `params: Promise<{ matchId: string }>` | ✅ Yes | None |
| `newsletter/confirm/[token]/route.ts` | `params: Promise<{ token: string }>` | ✅ Yes | None |
| `prewarm/match/[id]/route.ts` | `params: Promise<{ id: string }>` | ✅ Yes | None |
| `debug/match-state/[id]/route.ts` | `params: { id: string }` | ❌ No — old pattern | **Fix required** |

Only one file needed updating: the new `match-state` debug endpoint added in
commit `1afdc41`. All pre-existing route handlers were already using the correct
Next.js 16 `Promise<>` syntax.
