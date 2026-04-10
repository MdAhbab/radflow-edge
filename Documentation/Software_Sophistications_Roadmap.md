# Software Sophistications Roadmap

## 1) Clinical Safety & Explainability
- Add per-prediction provenance: model version, pipeline mode, checksum of image, latency, and confidence calibration bucket.
- Add uncertainty flags: low-confidence thresholding and mandatory human review gates before critical actions.
- Add annotation explainability overlays: saliency confidence heatmap + region rationale text.

## 2) Workflow Intelligence
- SLA-aware queue orchestration: prioritize by triage + waiting time + specialist load.
- Smart escalation recommendation: trigger based on confidence, symptom severity, and historical deterioration trend.
- Adaptive worklist sorting: learned ranking from clinician interactions.

## 3) Data Model Maturity
- Introduce encounter-centric normalization (`patients`, `encounters`, `studies`, `triage_runs`, `report_versions`, `timeline_events`).
- Implement soft-delete retention policy with purge windows and legal hold tags.
- Add audit log immutability and row-level change snapshots.

## 4) Reliability Engineering
- Add background workers (Celery/RQ) for AI inference jobs and retries.
- Add structured logging + tracing (OpenTelemetry) across frontend/backend/model calls.
- Add health probes and startup readiness checks for each model backend.

## 5) Performance
- Add model warm pools and lazy preloading by active pipeline mode.
- Cache frequent reads (`system/status`, `worklist`, `escalation stats`) with short TTL.
- Add image tiling and progressive rendering for large radiographs.

## 6) Security & Compliance
- Add role-based access control (admin/specialist/nurse) and per-feature authorization.
- Encrypt PHI at rest and in transit; rotate secrets and enforce token expiry.
- Add consent tracking and purpose-of-use records in timeline events.

## 7) Product Experience
- Add offline-first sync queue with conflict resolution and reconciliation logs.
- Add per-patient longitudinal trend view of findings and confidence over time.
- Add one-click report export bundles (PDF + key findings + timeline snapshot).

## 8) Quality Assurance
- Add contract tests for all API schemas consumed by frontend cards/buttons.
- Add deterministic model smoke tests with fixture images and expected output envelopes.
- Add UI test suite for critical flows: New Report -> Case Review -> Escalation -> Specialist -> EHR.
