# Operations Maturity Assessment

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-07-11
Update Trigger: Re-score after each roadmap phase lands or after the next incident.
Authority: Assessment snapshot. Subordinate to `docs/deployment/OPERATIONS.md` and `docs/architecture/DECISIONS.md`.

Scores GoalRadar 1–5 per dimension. **Scale:** 1 = ad-hoc/absent, 2 = manual/undocumented, 3 = defined/documented, 4 = automated/measured, 5 = optimized/continuous. Every score cites evidence from incident `WC-BRACKET-2026-07-11` only — no speculation.

| Dimension | Score | Evidence |
|---|---|---|
| Release Management | **2** | Manual, unenforced merge; verified fix stranded on a feature branch; no PR process (`.github/` = cron only). |
| Deployment | **3** | Vercel Git integration, `main`→production auto-deploy, ~2 min, documented healthy (`DEPLOYMENT_AUDIT.md`, `DEPLOYMENT_ROOT_CAUSE.md`). Rollback path exists (promote) but untested here. |
| Observability | **2** | No production SHA, no version/health endpoint, drift invisible from the app; deploy identity only via dashboard (unavailable). |
| Incident Response | **2 → 3 (with this package)** | Incident required a long multi-round manual forensic investigation; now standardized by the playbook + forensics runbook, but not yet automated. |
| Monitoring | **1** | Bracket defect undetected until a human screenshot; no post-deploy smoke or synthetic UI check; monitoring targets data/cache/scheduler only. |
| Governance | **2** | No branch protection, no CODEOWNERS, no required checks, no governance-as-code; "merged" is a manual step. |
| Documentation | **4** | Strong authority model + indexes; now a full operations package with cross-referenced runbooks and a postmortem. |
| Automation | **2** | CI limited to external cron triggers; no build/test/deploy gating; verification is manual. |

**Composite picture:** documentation is the clear strength (4); everything that depends on *enforcement and automation* (Release Management, Governance, Monitoring, Automation, Observability) sits at 1–2. The incident is explained precisely by this shape: excellent ability to *describe* the system, weak ability to *gate* and *observe* it.

## Next highest-value improvement
**Ship `/api/version` (deployed commit + build time), then add PR CI (`tsc`/`jest` incl. the knockout-graph test) with branch protection on `main`.**

Justification from incident evidence only:
- The two root causes were (a) *process* — the fix was never merged to `main` (no enforced gate), and (b) *observability* — repo↔production drift was unprovable from the app, which is what turned a one-line answer ("not deployed") into a multi-phase forensic investigation.
- `/api/version` is **Low** effort and directly closes the single most expensive gap (G1/G2): it makes "is the fix live and which commit?" answerable in one request, and unblocks an automated drift alarm (G8).
- PR CI + branch protection is **Low–Med** effort and closes the process root cause (G4/G5): it makes "merged to production" an enforced, evidence-bearing gate and would have caught the bracket regression before merge.

Together they raise Observability, Release Management, Governance, and Automation from 1–2 toward 3–4 at the lowest cost, and are Phase 1–2 of `ROADMAP_AUTOMATION.md`.

Cross-references: `WC_BRACKET_POSTMORTEM_2026-07-11.md`, `OBSERVABILITY_GAP_ANALYSIS.md`, `ROADMAP_AUTOMATION.md`, `CI_CD_PIPELINE_BLUEPRINT.md`, `OPERATIONS_ARCHITECTURE.md`.
