# HSIL Database Design Blueprint

## Goals
- Support end-to-end clinical workflow from intake -> AI analysis -> escalation -> specialist review -> EHR retention.
- Remove frontend static assumptions by storing all card/button content as database-backed entities.
- Keep compatibility with current FastAPI + SQLite setup while enabling future migration to PostgreSQL.

## Current Core Tables (Implemented)
- `cases`
- `findings`
- `escalations`
- `system_stats`

## Recommended Expanded Data Model

### 1) patients (new)
Purpose: canonical patient identity and demographics shared across visits/cases.

Columns:
- `id` INTEGER PK
- `patient_uid` TEXT UNIQUE NOT NULL (human-readable ID, current `patient_id` target)
- `full_name` TEXT NOT NULL
- `age_years` INTEGER
- `sex` TEXT
- `dob` DATE NULL
- `phone` TEXT NULL
- `address` TEXT NULL
- `risk_factors` TEXT NULL
- `clinical_history` TEXT NULL
- `created_at` DATETIME
- `updated_at` DATETIME

Frontend/API mapping:
- New report form demographics
- Case review demographics/risk/history cards
- EHR patient list

### 2) encounters (new)
Purpose: each clinical encounter/visit linked to patient.

Columns:
- `id` INTEGER PK
- `patient_id` FK -> patients.id
- `encounter_code` TEXT UNIQUE
- `complaint` TEXT
- `provider_name` TEXT NULL
- `facility_name` TEXT NULL
- `status` TEXT (`open`, `closed`, `archived`)
- `created_at` DATETIME
- `updated_at` DATETIME

Frontend/API mapping:
- Worklist rows
- Case review header and complaint
- EHR timeline entries by encounter

### 3) studies (new)
Purpose: radiology study metadata + imaging file reference.

Columns:
- `id` INTEGER PK
- `encounter_id` FK -> encounters.id
- `study_type` TEXT (e.g. Chest X-Ray PA)
- `view_type` TEXT NULL
- `image_path` TEXT
- `acquired_at` DATETIME
- `uploaded_at` DATETIME
- `uploaded_by` TEXT NULL
- `created_at` DATETIME

Frontend/API mapping:
- Case review image viewer metadata
- Specialist review study information
- EHR report versions

### 4) triage_runs (new)
Purpose: one record per AI inference run; makes model usage auditable.

Columns:
- `id` INTEGER PK
- `study_id` FK -> studies.id
- `pipeline_mode` TEXT (`experiment1`, `experiment2`, `both`, `none`)
- `engine_used` TEXT
- `run_status` TEXT (`success`, `normal`, `failed`, `disabled`)
- `confidence` REAL
- `triage_color` TEXT
- `priority` TEXT
- `draft_report` TEXT
- `latency_ms` INTEGER
- `error_message` TEXT NULL
- `created_at` DATETIME

Frontend/API mapping:
- AI confidence card
- Model transparency/debug panel
- Settings pipeline stream (real events)

### 5) findings (existing -> evolve)
Purpose: structured finding outputs for each AI run.

Add/adjust columns:
- `triage_run_id` FK -> triage_runs.id (new)
- `finding_code` TEXT NULL (standardized code)
- `condition_name` TEXT (existing `disease` equivalent)
- `confidence` REAL
- `bbox_x1`, `bbox_y1`, `bbox_x2`, `bbox_y2` INTEGER NULL
- `severity` TEXT NULL
- `report_snippet` TEXT NULL
- `created_at` DATETIME

Frontend/API mapping:
- Case review annotations + key findings
- Specialist review annotations
- EHR evidence trail

### 6) vitals (new)
Purpose: keep vital edits normalized and versioned by encounter.

Columns:
- `id` INTEGER PK
- `encounter_id` FK -> encounters.id
- `temperature_c` REAL
- `heart_rate_bpm` INTEGER
- `blood_pressure` TEXT
- `resp_rate` INTEGER
- `spo2_percent` REAL
- `weight_kg` REAL
- `recorded_at` DATETIME
- `updated_at` DATETIME

Frontend/API mapping:
- Case review editable vitals (auto-save)
- Specialist review vitals card
- EHR timeline/value snapshots

### 7) escalations (existing -> evolve)
Purpose: specialist handoff state machine.

Keep existing + add:
- `encounter_id` FK -> encounters.id
- `specialist_notes` TEXT (already implemented)
- `assigned_to` TEXT
- `status` TEXT (`awaiting`, `in-review`, `returned`, `finalized`)
- `priority` TEXT
- `ai_triage` TEXT
- `confidence` REAL
- `created_at`, `updated_at`

Frontend/API mapping:
- Escalations queue, Start Review, Return Queue
- Specialist Review action buttons
- EHR timeline escalation events

### 8) report_versions (new)
Purpose: version-controlled finalized/edited reports per encounter.

Columns:
- `id` INTEGER PK
- `encounter_id` FK -> encounters.id
- `version_no` INTEGER
- `source` TEXT (`ai`, `specialist_edit`, `manual`)
- `report_body` TEXT
- `approved_by` TEXT NULL
- `is_final` BOOLEAN
- `created_at` DATETIME

Frontend/API mapping:
- EHR report list + View button
- Specialist review edit/finalize workflow
- Case review report card history toggle (future)

### 9) timeline_events (new)
Purpose: single event stream for EHR timeline UI.

Columns:
- `id` INTEGER PK
- `patient_id` FK -> patients.id
- `encounter_id` FK -> encounters.id NULL
- `event_type` TEXT (`report_version`, `escalation`, `specialist_note`, `status_change`, `upload`)
- `title` TEXT
- `details` TEXT
- `status` TEXT NULL
- `confidence` REAL NULL
- `created_at` DATETIME

Frontend/API mapping:
- EHR timeline panel (already implemented; currently synthesized on read)

### 10) users (new)
Purpose: user identity/roles for accountability.

Columns:
- `id` INTEGER PK
- `display_name` TEXT
- `email` TEXT UNIQUE
- `role` TEXT (`nurse`, `specialist`, `admin`)
- `facility` TEXT
- `created_at` DATETIME

Frontend/API mapping:
- Welcome/login profile
- Attribution for notes, finalization, approvals

### 11) audit_log (new)
Purpose: immutable action trail.

Columns:
- `id` INTEGER PK
- `user_id` FK -> users.id NULL
- `entity_type` TEXT
- `entity_id` TEXT
- `action` TEXT
- `before_json` TEXT NULL
- `after_json` TEXT NULL
- `created_at` DATETIME

Frontend/API mapping:
- Admin diagnostics
- Compliance trail for deletions/edits/finalizations

## API Alignment Plan

Existing APIs can be evolved without immediate breaking changes:
- `/api/v1/cases` -> compose from `encounters + studies + latest triage_run + latest vitals`.
- `/api/v1/findings/{patientId}` -> return findings tied to latest triage run for active encounter.
- `/api/v1/escalations` -> map directly to escalation state table.
- `/api/v1/ehr/{patientId}/timeline` -> eventually read from `timeline_events` directly.

New suggested APIs:
- `GET /api/v1/patients/{patientId}`
- `GET /api/v1/patients/{patientId}/encounters`
- `GET /api/v1/encounters/{encounterId}/report-versions`
- `POST /api/v1/encounters/{encounterId}/report-versions`
- `GET /api/v1/encounters/{encounterId}/vitals`
- `PUT /api/v1/encounters/{encounterId}/vitals`

## Migration Strategy
1. Add new tables in parallel with existing schema.
2. Dual-write during transition:
   - continue writing current `cases/findings/escalations`
   - also write new normalized tables.
3. Read-path migration feature flags per endpoint.
4. Backfill old rows into normalized tables.
5. Decommission duplicated legacy columns after stable cutover.

## Why this structure fits current UI/buttons/cards
- Worklist: `encounters + latest triage_run` (dynamic counts and statuses)
- Case Review: demographics/vitals/history from `patients + vitals + encounters`
- AI cards/annotations: `triage_runs + findings`
- Escalation actions: `escalations`
- Specialist finalization: `report_versions + escalations.specialist_notes`
- EHR list + timeline + view report: `patients + report_versions + timeline_events`
- Settings real-time stream: `timeline_events` + queue metrics from encounter statuses
