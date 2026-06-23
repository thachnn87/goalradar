# DEPLOYMENT TIMELINE — DATA-18OPS.2F

**Date:** 2026-06-23
All times UTC. Commit times converted from committer time (+0700).

---

## Commit → deploy timeline

| Commit | Pushed (UTC) | Type | Marker route | Observed deploy outcome |
|--------|--------------|------|--------------|--------------------------|
| `f91766f` | 06-22 15:30 | code | `/api/debug/live-consistency` | LIVE (200) — validated later |
| `e288af2` | 02:03 | code | `/api/debug/state-divergence` | LIVE within minutes (200) |
| `7284680` | 02:11 | docs | — | (docs) |
| `37267d0` | 02:25 | code | `/api/debug/live-source-map` | **deployed ~2 min** — polled 404×6 then 200 |
| `cb5f8d6` | 02:35 | docs | — | (docs) |
| `e245f8b` | **03:01** | code | `/api/debug/team-cache` | **404 for ~34 min** (route absent in deployed build) |
| `ca32441` | 03:33 | docs | — | (docs) |
| `093478f` | **03:35** | code | `/teams/762-argentina`, team-cache | **deployed ~2 min**; team-cache → 200, Argentina renders |
| `165d33d` | 03:46 | docs | — | latest; remote HEAD |

---

## The `e245f8b` anomaly (the only irregular event)

```
03:01Z  push e245f8b (adds /api/debug/team-cache)
03:0xZ  GET /api/debug/team-cache → 404   ┐
  …                                       │  ~34 min: route absent from the
03:3xZ  GET /api/debug/team-cache → 404   ┘  deployed build (standalone e245f8b
                                             deploy did not land in this window)
03:35Z  push 093478f (descendant; includes team-cache route + team fix)
~03:37Z GET /api/debug/team-cache → 200       ← code now live via 093478f build
~03:37Z /teams/762-argentina renders "Argentina"
```

Later spot-check: team-cache returned a one-off `000` (local connection blip),
then `200, 200, 200` — confirming it is stably live and the `000` was network, not Vercel.

---

## Contrast: deploys immediately before and after were fast

- `37267d0` (02:25): live in ~2 min (404×6 during poll, then 200).
- `093478f` (03:35): live in ~2 min (team-cache + Argentina both 200).

Only `e245f8b` sat undeployed for ~34 min. This isolates the event to that single
commit/window rather than a persistent pipeline fault.

---

## Local-network noise (not Vercel)

During the session, several `git push` attempts and a few probes failed with
"Could not resolve host" / "Failed to connect to port 443" / HTTP `000`, each
succeeding on retry. These are **client-side** connectivity blips and are noted
so they are not misread as deployment failures.

**Timeline complete. One isolated ~34-min delay on `e245f8b`; all else deployed in ~minutes.**
