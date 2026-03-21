# Codebase Boundaries

This repository mixes business code, runtime preset resources, model assets, reference materials, and local/generated files. To keep future work predictable, every change should start by choosing the right directory boundary.

The current product entry point is the AI chat experience. Diagnostic capability still exists in the codebase, but the diagnosis page is no longer the primary navigation entry.

## 1. Business code directories

These directories are the default destination for real product work.

- `frontend/src`
  Frontend business code only: application entry, layout, chat UI, auth UI, i18n, frontend hooks, API adapters, and frontend tests.
- `backend/app`
  Backend business code only: FastAPI app setup, routers, services, schemas, auth dependencies, configuration, DB session management, and SQLAlchemy models.
- `backend/tests`
  Backend automated tests only.
- `frontend/public/models`
  Runtime ONNX model assets loaded by the frontend.

## 2. Current frontend structure boundary

The frontend is now centered around the chat flow.

- `frontend/src/App.tsx`
  App shell, auth modal mounting, current user state, and page selection.
- `frontend/src/pages/AIChatPage.tsx`
  Main orchestration page for chat, attachments, preset upload, defect recognition entry, streaming responses, and preset export.
- `frontend/src/components/chat/ChatMessageList.tsx`
  Assistant/user message rendering, thought folding, parameter suggestion card, and preset download action.
- `frontend/src/components/chat/ChatComposer.tsx`
  Input box, upload actions, model picker, and send controls.
- `frontend/src/features/chat/useChatSessionState.ts`
  Local chat session state and persistence.
- `frontend/src/features/chat/chatSessionTypes.ts`
  Shared typed chat session structures.
- `frontend/src/features/diagnosis/usePresetParser.ts`
  The single frontend entry point for preset parsing.
- `frontend/src/features/diagnosis/presetParserUtils.ts`
  Shared pure parsing and validation rules.
- `frontend/src/i18n/I18nProvider.tsx`
  Chinese/English language switching and shared UI copy.

Rule:

- New chat behavior should be added to the existing chat structure instead of creating a second primary flow elsewhere.
- New preset parsing logic should reuse `usePresetParser.ts` and shared utils instead of being copied into pages.

## 3. Current backend structure boundary

The backend still owns auth, diagnosis, preset mapping, and LLM orchestration.

- `backend/app/main.py`
  FastAPI entrypoint and startup wiring.
- `backend/app/routers/auth.py`
  Password login, email-code login, email-code registration, logout, refresh, and current user APIs.
- `backend/app/routers/chat.py`
  Streaming chat APIs.
- `backend/app/routers/diagnosis.py`
  Diagnosis APIs retained for the diagnostic flow.
- `backend/app/routers/presets.py`
  Preset mapping and related endpoints.
- `backend/app/services/auth_service.py`
  Auth, verification code, invite-code validation, token logic, and user-related account operations.
- `backend/app/services/chat_service.py`
  LLM chat streaming orchestration.
- `backend/app/services/diagnosis_service.py`
  Diagnosis request construction and result parsing.
- `backend/app/services/preset_inheritance_service.py`
  Preset inheritance recovery and full parameter reconstruction.
- `backend/app/db/models.py`
  User, refresh token, chat session, chat record, and email verification code models.
- `backend/app/db/migration.py`
  Lightweight startup migration patch logic.

Rule:

- New backend product behavior belongs in routers/services/schemas under `backend/app`, not in root scripts or ad-hoc helpers.

## 4. Runtime resource directories

These folders are required at runtime, but they are not the normal place for feature work.

- `backend/resources`
  Preset inheritance sources, slicer profiles, and mapping resources.
- `frontend/public`
  Static frontend assets used by the built app.

Rule:

- Do not edit `backend/resources` to work around a UI or API bug unless the source data itself is truly wrong.

## 5. Reference and material directories

These directories are for research, archived material, or reference snapshots, not active business code.

- `ai_model`
  Model and training-related materials.
- `切片软件源码`
  Upstream slicer source snapshots for study and extraction.
- `预设文件`
  Collected preset examples, source bundles, and analysis materials.
- `项目信息`
  Project notes, structure docs, planning notes, and operational context.
- `docs`
  Repository-level engineering guidance and boundary documents.
- `design-system`
  Design experiments or reference work, not the production frontend.

Rule:

- New raw materials, one-off analysis, or vendor source dumps should go here instead of mixing into `frontend/src` or `backend/app`.

## 6. Generated and local-only files

These files are not business source code and should not be committed as part of normal feature work.

- `frontend/dist`
- `frontend/node_modules`
- `__pycache__`
- `*.pyc`
- local databases such as `backend/fdm_ai_web.db`
- temporary debug outputs, scratch bundles, and local logs

These patterns are now covered by `.gitignore`. If they appear in Git again, treat that as a repository hygiene regression and clean them before merging.

## 7. Placement rules for new work

- New page UI, layout behavior, browser-side state, and frontend copy go in `frontend/src`.
- New chat session state should stay in the typed chat/session modules rather than raw `any` structures.
- New API contracts, auth logic, database access, and backend orchestration go in `backend/app`.
- New backend tests go in `backend/tests`.
- New frontend tests should live beside the related feature under `frontend/src/**/*.test.ts`.
- New documentation about architecture, boundaries, or contribution rules goes in `docs/` or `项目信息/` depending on audience.
- New i18n-visible copy should be wired through `frontend/src/i18n/I18nProvider.tsx`.

## 8. Guardrails for future changes

- Do not add new product logic directly under the repository root.
- Do not create a second main entry flow that duplicates the AI chat page.
- Do not keep duplicated preset parsing logic in multiple pages or hooks.
- Do not hand-edit build outputs, caches, or local databases.
- If a file no longer has one clear responsibility, split it before adding another major concern.
- If a change touches chat session structure, verify the frontend types, local storage shape, API contract, and any backend schema assumptions together.
- If a change adds user-visible UI text, update both supported languages instead of hardcoding one language in a component.

## 9. Minimum verification after changes

Because test coverage is still intentionally small, run targeted verification after meaningful changes.

- Frontend: `npm run build`
- Frontend: `npm test`
- Backend: `python -m pytest`
- Spot-check the AI chat main flow when chat, auth, preset parsing, or assistant rendering changes

## 10. Current maintenance priorities

- Keep `AIChatPage.tsx` focused on orchestration and push reusable logic downward.
- Continue moving legacy hardcoded UI strings into the i18n layer.
- Preserve the “business code vs. reference material” boundary.
- Keep the hidden diagnosis page from drifting into a second independently evolving primary product flow.
