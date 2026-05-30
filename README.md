# FDM Agent

FDM Agent is an open-source FDM defect case library plus AI-assisted slicing parameter optimizer.

This refactor keeps the parts that matter for printer diagnostics:

- AI diagnosis chat
- 3MF and JSON preset optimization
- custom AI model/provider configuration
- local desktop-enhanced workflow with `client-agent`
- modular case-library pipeline based on `Markdown + frontmatter -> generated JSON index`

## What It Solves

Most printer assistants stop at generic advice like "lower temperature" or "reduce speed". FDM Agent is structured to do better by grounding diagnosis in reusable defect cases and exposing more specific parameter reasoning.

Each case can include:

- defect category
- defect image or redistributable thumbnail
- printer model
- filament type
- slicer context and original parameters
- corrected parameters
- root-cause analysis
- original source link
- source platform and author
- original user question
- accepted or collected solution

## Repository Structure

```text
backend/                    FastAPI backend
frontend/                   React frontend
client-agent/               Local desktop helper for native 3MF workflows
cases/<slug>/docs/         Canonical markdown case files
cases/<slug>/media/        Case thumbnails and redistributable assets
cases/<slug>/runtime/      Per-case normalized JSON output
cases/schema/               Case schema
cases/case-index.json       Generated aggregated JSON index
scripts/build_case_index.py Case index builder
```

## Core Modules

- `backend/app/services/case_library/`
  - parses markdown cases
  - validates required fields
  - builds and loads the JSON index
  - serves case filters and case detail data
- `backend/app/services/optimization/`
  - matches relevant cases
  - builds diagnosis prompts with parameter context
  - parses structured AI output
- `backend/app/services/diagnosis_service.py`
  - orchestrates provider calls
  - merges case matches with AI output
  - returns structured parameter recommendations without coupling to 3MF execution

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- npm

### Install

```powershell
npm install
cd frontend; npm install
cd ..\backend; pip install -r requirements.txt
cd ..\client-agent; npm install
cd ..
```

### Build Case Index

```powershell
npm run build:cases
```

### Run Development Stack

```powershell
npm run dev
```

This starts:

- FastAPI backend on `http://127.0.0.1:8001`
- frontend dev server
- local `client-agent`

### Desktop Mode

```powershell
npm run desktop
```

## Verification

```powershell
npm run test:frontend
npm run test:backend
npm run build
```

## Case Library Workflow

1. Create a case directory under `cases/<slug>/`.
2. Put the markdown file under `cases/<slug>/docs/`.
3. Put the cover asset under `cases/<slug>/media/`.
4. Rebuild the index with `npm run build:cases`.
5. Verify the generated outputs in `cases/<slug>/runtime/case.json` and `cases/case-index.json`.

The canonical source of truth is markdown. Runtime APIs consume the generated per-case JSON files and the aggregated case index.

## Contribution Model

- human-maintained cases live in markdown
- runtime access uses generated JSON
- case-library and optimization modules stay decoupled
- future database, full-text, or vector retrieval changes should not require 3MF pipeline changes

See [CONTRIBUTING.md](./CONTRIBUTING.md) for case authoring rules.
