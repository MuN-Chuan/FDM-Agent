# Contributing

## Scope

This repository accepts contributions for:

- new FDM defect cases
- case corrections and metadata improvements
- better structured parameter recommendations
- frontend and backend improvements that preserve modular boundaries

Do not couple case ingestion directly to 3MF execution logic. Keep these areas independent.

## Case Authoring Rules

Add each case under its own directory:

- `cases/<slug>/docs/`
- `cases/<slug>/media/`
- `cases/<slug>/runtime/`

Required fields:

- `case_id`
- `title`
- `slug`
- `defect_category`
- `printer_model`
- `filament_material`
- `slicer_name`
- `symptom_parameters`
- `solution_parameters`
- `root_cause_analysis`
- `solution_summary`
- `source_platform`
- `source_author`
- `source_question`
- `source_answer`

Required asset rule:

- `cover_image` must point to a file inside the same case directory's `media/`

Source rule:

- if the case is collected from the web, include the original post URL and author attribution
- only commit redistributable thumbnails or assets you have permission to include

## Build And Validate

Before opening a change, run:

```powershell
npm run build:cases
npm run test:backend
npm run test:frontend
npm run build
```

## Design Boundaries

- `cases/<slug>/docs/` is for human-maintained case content
- `cases/<slug>/runtime/` is for machine-readable per-case output
- `cases/case-index.json` is the aggregated runtime index
- `backend/app/services/case_library/` must stay data-focused
- `backend/app/services/optimization/` must stay diagnosis-focused
- 3MF and JSON optimization flows should consume structured recommendations, not markdown directly

## Naming

- use stable slugs
- keep `case_id` immutable once published
- prefer normalized material and printer naming where possible

## Pull Request Expectations

- describe the defect type being added or changed
- mention any source attribution updates
- note whether parameter deltas or normalization behavior changed
- include screenshots when frontend case-library UI changes
