# Codebase Boundaries

This repository mixes runnable application code, large preset resources, model assets, and reference materials. To keep future work predictable, treat each top-level area with a clear purpose.

## 1. Business code directories

These directories are the default place for new product changes.

- `frontend/src`
  Frontend business code only: pages, shared layout, API adapters, hooks, feature UI, and frontend tests.
- `backend/app`
  Backend business code only: FastAPI routers, services, schemas, auth, config, DB session, and SQLAlchemy models.
- `backend/alembic`
  Database schema migration files only.
- `backend/tests`
  Backend automated tests only.
- `frontend/public/models`
  Runtime model assets that are loaded by the frontend at execution time.

## 2. Runtime resource directories

These folders are used by the app at runtime, but they are not the default place for feature work.

- `backend/resources`
  Preset inheritance sources, base profiles, and slicer resource data. Edit only when preset mapping or inheritance behavior truly needs new source data.
- `frontend/public`
  Static assets used by the frontend build output.

## 3. Reference and material directories

These folders are reference material, not primary business code.

- `ai_model`
  Training and model-related material.
- `切片软件源码`
  Upstream slicer source snapshots used for study or extraction.
- `预设文件`
  Collected preset examples and analysis material.
- `项目信息`
  Product notes, deployment notes, and planning documents.
- `design-system`
  Design reference or experiments, not the main runtime frontend.

When adding new research or raw source material, prefer one of these directories instead of mixing it into `frontend/src` or `backend/app`.

## 4. Generated or local-only directories

Do not hand-edit these directories unless you are deliberately debugging build output.

- `frontend/dist`
- `frontend/node_modules`
- `__pycache__`
- temporary root files such as debug outputs and scratch bundles

## 5. Placement rules for new work

- New UI, page state, or browser-side logic goes in `frontend/src`.
- New API contracts, auth logic, database access, or backend orchestration goes in `backend/app`.
- New backend tests go in `backend/tests`.
- New frontend tests go next to the feature under `frontend/src/**/*.test.ts`.
- New documentation about code structure or contribution rules goes in `docs/`.
- New research, vendor source dumps, sample presets, or one-off analysis should not go into business code directories.

## 6. Guardrails for future changes

- Do not add product logic directly under the repository root.
- Do not add reference data under `frontend/src` or `backend/app`.
- Do not patch `backend/resources` just to work around a frontend bug; fix the consuming code first.
- If a file grows beyond a single clear responsibility, split it before adding another major concern.
- When the same parsing or transformation logic is needed in two places, move it to one shared implementation and wrap it rather than copy it.
