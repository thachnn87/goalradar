# Operations Architecture — the Five Truths

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Update when the deploy pipeline, caching model, or truth-verification method changes.
Authority: Conceptual reference. Subordinate to `docs/deployment/OPERATIONS.md` (authoritative operations state) and `docs/architecture/DECISIONS.md`. This document does not restate or override operations state; it maps how verification concepts relate.

Purpose: give responders a shared mental model so incidents like `WC-BRACKET-2026-07-11` never require rediscovering the pipeline from scratch. Each "truth" is independently verifiable (see `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md`).

## The pipeline (evidence-established)
```
 Repository            GitHub                 Vercel                    Browser
 ----------            ------                 ------                    -------
 feature branch  ─push→  origin/<branch>  ─────────────→  Preview deployment   (NOT production)
 merge to main   ─push→  origin/main      ─auto-deploy──→  Production build ─→ Edge/ISR cache ─→ HTML ─→ User
                                            (~2 min)
```
Only `main` maps to production (`www.goalradar.org`). Evidence: `docs/deployment/DEPLOYMENT_AUDIT.md`, `.vercel/repo.json` (project `goalradar-v2`).

## The five truths and how they relate
```
        REPOSITORY TRUTH ───(merge to main)───► DEPLOYMENT TRUTH ───(build+serve)───► PRODUCTION TRUTH
        what the code says       the gate that       which commit is live      what the live site
        (git, tests)             ships it            (Vercel)                   renders (DOM)
              │                                            │                          │
              │                                            ▼                          ▼
              └───────────────► RUNTIME TRUTH ◄──────── CACHE TRUTH ───────────────────┘
                    what the deployed process    what ISR/edge is serving
                    computes (debug endpoints)   (may lag ≤ revalidate)
```
- **Repository Truth** can be correct while **Production Truth** is wrong — if the code was never merged/deployed. This gap was the WC-BRACKET-2026-07-11 root cause.
- **Deployment Truth** is the bridge: a commit is live only after a `main` merge → Vercel build → serve.
- **Cache Truth** can make Production Truth *lag* the deployed code by up to `revalidate`, but a fresh deployment resets the ISR namespace. Caches store **data**, never render **order**; order is computed per render.
- **Runtime Truth** (debug endpoints) is the fastest cross-check: a 404 on a fix-only endpoint proves the deployed code lacks the fix, independent of caches.

## Invariants (do not violate)
1. Production changes ship **only** via merge to `main`; feature branches never reach the production domain.
2. "Verified locally" ≠ "verified in production" — always confirm Deployment + Production truth after a release.
3. Render correctness of the bracket is a pure function of code over data (the DAG), so no cache can hide or create the defect after a deploy.
4. Authority precedence for docs: `docs/PROJECT_CONTEXT.md` / `.ai/AI_RULES.md` → `docs/architecture/DECISIONS.md` → `docs/deployment/OPERATIONS.md` → this doc and the runbooks.

## Where each truth is verified
| Truth | Source of proof | Runbook section |
|---|---|---|
| Repository | `git ls-remote`, `merge-base`, tests | FORENSICS §Repository/GitHub |
| Deployment | Vercel dashboard / `v6/deployments` API | FORENSICS §Production SHA |
| Production | Browser DOM at production URL | BRACKET_VALIDATION §C |
| Runtime | `/api/debug/knockout-graph` | BRACKET_VALIDATION §A |
| Cache | response headers + route `revalidate` | FORENSICS §ISR/Edge |

## Cross-references
`docs/deployment/OPERATIONS.md` (authoritative ops state) · `docs/deployment/WC_BRACKET_POSTMORTEM_2026-07-11.md` · `docs/deployment/RELEASE_RUNBOOK.md` · `docs/deployment/INCIDENT_RESPONSE_PLAYBOOK.md` · `docs/deployment/DEPLOYMENT_FORENSICS_RUNBOOK.md` · `docs/worldcup/BRACKET_VALIDATION_RUNBOOK.md` · `docs/worldcup/WC_KNOCKOUT_GRAPH_AUDIT.md`.
