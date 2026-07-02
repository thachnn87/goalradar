# Analysis Documentation Index

Status: Current
Owner: Project maintainer
Last Reviewed: 2026-06-29
Update Trigger: Update when analysis reports are promoted, superseded, archived, or newly generated.
Authority: Folder index. Lower authority than `docs/INDEX.md`.

This folder contains historical audits, traces, matrices, validation reports, and implementation analysis.

## Current Authoritative Documents

No file in `docs/analysis/` is currently the global source of truth.

Use these current documents instead:

- `docs/PROJECT_CONTEXT.md`
- `.ai/AI_RULES.md`
- `docs/architecture/DECISIONS.md`
- `docs/seo/CANONICAL_MAP.md`
- `docs/deployment/OPERATIONS.md`
- `docs/business/REVENUE_READINESS.md`

## Historical Reports

Files such as `DATA*_*.md`, `API_USAGE_REPORT.md`, and other audit reports are historical evidence. They may contain useful facts, traces, and rationale, but they may also describe older architecture, older route states, or completed remediation work.

## Archived Analysis Subfolders

- `docs/analysis/runtime/`: runtime findings and validation output.
- `docs/analysis/trace/`: trace reports and source-flow evidence.
- `docs/analysis/graph/`: graph and dependency analysis.
- `docs/analysis/matrix/`: matrix-style audits and comparison reports.

## Promotion Rule

When a historical report contains information that is still current, promote a concise version into the relevant authoritative document and leave the report as evidence.

Do not make new work decisions from this folder alone.
