# FDM Agent Open Case Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the current project into a single-user open-source FDM defect case library and AI parameter optimization tool while preserving the 3MF CLI export path, JSON preset optimization, and custom model support.

**Architecture:** Split the system into a case-library pipeline and an optimization/execution pipeline. The case library is maintained as `Markdown + frontmatter` under `cases/library/`, compiled into `cases/generated/case-index.json`, and served through dedicated backend APIs. The AI chat and 3MF/JSON optimization flows consume that normalized index through a new optimization layer, while auth, developer console, and unrelated product surfaces are removed.

**Tech Stack:** FastAPI, SQLAlchemy, React 19, TypeScript, Vite, Vitest, pytest, JSZip, local `client-agent`

---

## File Structure Map

**Create**
- `C:\Users\27822\Documents\FDM Agent\cases\library\first-layer-under-extrusion.md`
- `C:\Users\27822\Documents\FDM Agent\cases\library\petg-stringing-hotend-temp.md`
- `C:\Users\27822\Documents\FDM Agent\cases\media\first-layer-under-extrusion\cover.jpg`
- `C:\Users\27822\Documents\FDM Agent\cases\media\petg-stringing-hotend-temp\cover.jpg`
- `C:\Users\27822\Documents\FDM Agent\cases\schema\case.schema.json`
- `C:\Users\27822\Documents\FDM Agent\cases\generated\.gitkeep`
- `C:\Users\27822\Documents\FDM Agent\backend\app\models\case_library.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\__init__.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\loader.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\parser.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\validator.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\index_builder.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\case_library\search.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\routers\case_library.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\optimization\__init__.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\optimization\case_matcher.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\optimization\prompt_builder.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\optimization\response_parser.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_case_library_index_builder.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_case_library_routes.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_optimization_prompt_builder.py`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\api\caseLibraryApi.ts`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\api\caseLibraryApi.test.ts`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\pages\CaseLibraryPage.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\pages\CaseLibraryPage.test.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\case-library\CaseFilterBar.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\case-library\CaseList.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\case-library\CaseDetailDrawer.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\case-library\types.ts`
- `C:\Users\27822\Documents\FDM Agent\scripts\build_case_index.py`
- `C:\Users\27822\Documents\FDM Agent\CONTRIBUTING.md`

**Modify**
- `C:\Users\27822\Documents\FDM Agent\backend\app\main.py:7-48`
- `C:\Users\27822\Documents\FDM Agent\backend\app\routers\chat.py:1-201`
- `C:\Users\27822\Documents\FDM Agent\backend\app\routers\diagnosis.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\diagnosis_service.py:1-263`
- `C:\Users\27822\Documents\FDM Agent\backend\app\db\models.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\models\chat.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_chat_feedback_routes.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_diagnosis_routes.py`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\App.tsx:1-85`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\components\layout\MainLayout.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\components\layout\Sidebar.tsx:1-224`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\pages\AIChatPage.tsx:1-200`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\api\api.ts:1-838`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\api\chatStorage.ts`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\api\chatStorage.test.ts`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\diagnosis\ApiSettingsModal.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\i18n\I18nProvider.tsx`
- `C:\Users\27822\Documents\FDM Agent\package.json`
- `C:\Users\27822\Documents\FDM Agent\README.md`
- `C:\Users\27822\Documents\FDM Agent\.gitignore`

**Delete**
- `C:\Users\27822\Documents\FDM Agent\backend\app\routers\auth.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\dependencies\auth.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\schemas\auth.py`
- `C:\Users\27822\Documents\FDM Agent\backend\app\services\auth_service.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_auth_routes.py`
- `C:\Users\27822\Documents\FDM Agent\backend\tests\test_dev_routes.py`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\components\auth\AuthModal.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\pages\DeveloperDashboard.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\DeveloperApp.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\developer-main.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\developer\components\DeveloperAuthPanel.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\developer\components\DeveloperFeedbackPanel.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\developer\components\DeveloperMetricCard.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\developer\components\DeveloperModelConfigPanel.tsx`
- `C:\Users\27822\Documents\FDM Agent\frontend\src\features\developer\components\DeveloperSessionPanel.tsx`

### Task 1: Remove Auth and Convert the App to Single-User Local Mode

**Files:**
- Delete: `backend/app/routers/auth.py`, `backend/app/dependencies/auth.py`, `backend/app/schemas/auth.py`, `backend/app/services/auth_service.py`, `backend/tests/test_auth_routes.py`
- Modify: `backend/app/main.py:7-48`, `backend/app/routers/chat.py:1-201`, `backend/app/db/models.py`, `backend/app/models/chat.py`, `backend/tests/test_chat_feedback_routes.py`
- Modify: `frontend/src/App.tsx:1-85`, `frontend/src/api/api.ts:75-125`, `frontend/src/api/chatStorage.ts`, `frontend/src/api/chatStorage.test.ts`
- Delete: `frontend/src/components/auth/AuthModal.tsx`
- Test: `backend/tests/test_chat_feedback_routes.py`, `frontend/src/api/chatStorage.test.ts`

- [ ] **Step 1: Write the failing backend test for anonymous local chat sessions**

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_chat_sessions_can_be_saved_without_authentication():
    payload = {
        "id": "chat-1",
        "title": "Local session",
        "timestamp": 1,
        "messages": [{"id": "m1", "role": "user", "content": "hello"}],
        "modifications": [],
        "selection": None,
        "bundle": None,
        "presetFileName": None,
    }

    response = client.put("/api/chat/sessions/chat-1", json=payload)

    assert response.status_code == 200
    assert response.json()["id"] == "chat-1"
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run: `cd backend && pytest tests/test_chat_feedback_routes.py::test_chat_sessions_can_be_saved_without_authentication -v`
Expected: FAIL with `401 Unauthorized` or an import error caused by `get_current_user`.

- [ ] **Step 3: Implement local-session backend behavior and remove auth router wiring**

```python
# backend/app/main.py
from app.routers import case_library, chat, diagnosis, presets, slicer

app.include_router(diagnosis.router)
app.include_router(chat.router)
app.include_router(case_library.router)
app.include_router(presets.router)
app.include_router(slicer.router)
```

```python
# backend/app/routers/chat.py
@router.get("/sessions", response_model=list[SessionMetadata])
def list_chat_sessions(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    sessions = db.scalars(select(ChatSession).order_by(ChatSession.timestamp.desc())).all()
    return [SessionMetadata(id=session.id, title=session.title, timestamp=session.timestamp) for session in sessions]


@router.put("/sessions/{session_id}", response_model=SessionPayload)
def upsert_chat_session(
    session_id: str,
    payload: SessionPayload,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if session is None:
        session = ChatSession(id=session_id)
        db.add(session)
        db.flush()
    ...
```

```tsx
// frontend/src/App.tsx
import { MainLayout } from './components/layout/MainLayout'
import { AIChatPage } from './pages/AIChatPage'
import { CaseLibraryPage } from './pages/CaseLibraryPage'
import { I18nProvider } from './i18n/I18nProvider'

export type AppPage = 'chat' | 'cases'

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('chat');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  return (
    <I18nProvider>
      <MainLayout
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currentSessionId={currentSessionId}
        onSessionChange={setCurrentSessionId}
      >
        {currentPage === 'cases'
          ? <CaseLibraryPage />
          : <AIChatPage currentSessionId={currentSessionId} onSessionChange={setCurrentSessionId} />}
      </MainLayout>
    </I18nProvider>
  )
}
```

- [ ] **Step 4: Run the backend test to verify it passes**

Run: `cd backend && pytest tests/test_chat_feedback_routes.py::test_chat_sessions_can_be_saved_without_authentication -v`
Expected: PASS

- [ ] **Step 5: Write the failing frontend test that the app no longer renders auth UI**

```ts
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from '../App';

describe('App', () => {
  it('renders the case library navigation without auth modal triggers', () => {
    render(<App />);
    expect(screen.getByText('案例库')).toBeInTheDocument();
    expect(screen.queryByText('登录')).toBeNull();
  });
});
```

- [ ] **Step 6: Run the frontend test to verify it fails**

Run: `cd frontend && npm test -- src/App.test.tsx`
Expected: FAIL because `App` still depends on `AuthModal` or renders auth-only actions.

- [ ] **Step 7: Remove auth methods from the frontend API client and chat storage**

```ts
// frontend/src/api/api.ts
export const api = {
  async listChatSessions(): Promise<SessionMetadata[]> {
    const response = await fetch(`${BASE_URL}/api/chat/sessions`, defaultFetchOptions);
    if (!response.ok) {
      throw new Error('Failed to fetch chat sessions');
    }
    return response.json();
  },
  async saveChatSession(id: string, payload: SessionPayload): Promise<SessionPayload> {
    const response = await fetch(`${BASE_URL}/api/chat/sessions/${id}`, {
      ...defaultFetchOptions,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Failed to save chat session');
    }
    return response.json();
  },
}
```

```ts
// frontend/src/api/chatStorage.test.ts
it('uses backend sessions without auth state', async () => {
  vi.spyOn(api, 'listChatSessions').mockResolvedValue([{ id: 'chat-1', title: 'Local', timestamp: 1 }]);
  const sessions = await chatStorage.listSessions();
  expect(sessions).toEqual([{ id: 'chat-1', title: 'Local', timestamp: 1 }]);
});
```

- [ ] **Step 8: Run the frontend tests to verify they pass**

Run: `cd frontend && npm test -- src/App.test.tsx src/api/chatStorage.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/main.py backend/app/routers/chat.py backend/app/db/models.py backend/app/models/chat.py backend/tests/test_chat_feedback_routes.py frontend/src/App.tsx frontend/src/api/api.ts frontend/src/api/chatStorage.ts frontend/src/api/chatStorage.test.ts
git rm backend/app/routers/auth.py backend/app/dependencies/auth.py backend/app/schemas/auth.py backend/app/services/auth_service.py backend/tests/test_auth_routes.py frontend/src/components/auth/AuthModal.tsx
git commit -m "refactor: remove auth and switch to local single-user mode"
```

### Task 2: Remove Developer Surfaces and Rebuild Navigation Around Chat + Case Library

**Files:**
- Modify: `frontend/src/components/layout/MainLayout.tsx`, `frontend/src/components/layout/Sidebar.tsx:1-224`, `frontend/src/i18n/I18nProvider.tsx`
- Delete: `frontend/src/pages/DeveloperDashboard.tsx`, `frontend/src/DeveloperApp.tsx`, `frontend/src/developer-main.tsx`, `frontend/src/features/developer/components/*`
- Create: `frontend/src/pages/CaseLibraryPage.tsx`
- Test: `frontend/src/pages/CaseLibraryPage.test.tsx`

- [ ] **Step 1: Write the failing test for the new navigation shell**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Sidebar } from '../components/layout/Sidebar';

describe('Sidebar', () => {
  it('shows chat and case library as the only primary tools', () => {
    render(
      <Sidebar currentPage="chat" currentSessionId={null} onNavigate={() => {}} onSessionChange={() => {}} />
    );

    expect(screen.getByText('AI诊断')).toBeInTheDocument();
    expect(screen.getByText('案例库')).toBeInTheDocument();
    expect(screen.queryByText('订阅')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- src/pages/CaseLibraryPage.test.tsx`
Expected: FAIL because the current sidebar still renders disabled preset/subscription items and the case page does not exist.

- [ ] **Step 3: Replace the sidebar nav with the new open-source IA**

```tsx
// frontend/src/components/layout/Sidebar.tsx
const navItems: SidebarNavItem[] = [
  {
    icon: MessageSquareQuote,
    labelKey: 'sidebar.chat',
    page: 'chat',
    isActive: currentPage === 'chat',
    onClick: () => onNavigate('chat'),
  },
  {
    icon: BookOpen,
    labelKey: 'sidebar.caseLibrary',
    page: 'cases',
    isActive: currentPage === 'cases',
    onClick: () => onNavigate('cases'),
  },
];

<h1 className="truncate font-heading text-lg font-bold tracking-tight text-green-950">FDM Agent</h1>
```

```tsx
// frontend/src/pages/CaseLibraryPage.tsx
export const CaseLibraryPage: React.FC = () => {
  return (
    <section className="flex h-full flex-col gap-4 p-6">
      <header>
        <h2 className="font-heading text-2xl font-bold text-slate-900">FDM 缺陷案例库</h2>
        <p className="text-sm text-slate-600">按缺陷、打印机、耗材和切片参数筛选开源案例。</p>
      </header>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        案例列表将在后续任务接入真实 API。
      </div>
    </section>
  );
};
```

- [ ] **Step 4: Run the navigation test to verify it passes**

Run: `cd frontend && npm test -- src/pages/CaseLibraryPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/MainLayout.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/pages/CaseLibraryPage.tsx frontend/src/i18n/I18nProvider.tsx
git rm frontend/src/pages/DeveloperDashboard.tsx frontend/src/DeveloperApp.tsx frontend/src/developer-main.tsx frontend/src/features/developer/components/DeveloperAuthPanel.tsx frontend/src/features/developer/components/DeveloperFeedbackPanel.tsx frontend/src/features/developer/components/DeveloperMetricCard.tsx frontend/src/features/developer/components/DeveloperModelConfigPanel.tsx frontend/src/features/developer/components/DeveloperSessionPanel.tsx
git commit -m "refactor: remove developer surfaces and rebuild app navigation"
```

### Task 3: Add the Markdown Case Library, Schema, and JSON Index Builder

**Files:**
- Create: `cases/library/*.md`, `cases/schema/case.schema.json`, `cases/generated/.gitkeep`, `scripts/build_case_index.py`
- Create: `backend/app/models/case_library.py`, `backend/app/services/case_library/*.py`
- Test: `backend/tests/test_case_library_index_builder.py`
- Modify: `.gitignore`, `README.md`

- [ ] **Step 1: Write the failing backend test for Markdown-to-index compilation**

```python
from pathlib import Path

from app.services.case_library.index_builder import build_case_index


def test_build_case_index_reads_markdown_cases(tmp_path: Path):
    library = tmp_path / "library"
    media = tmp_path / "media"
    generated = tmp_path / "generated"
    library.mkdir()
    media.mkdir()
    generated.mkdir()
    (media / "case-001").mkdir()
    (media / "case-001" / "cover.jpg").write_bytes(b"jpg")
    (library / "case-001.md").write_text(
        "---\n"
        "case_id: case-001\n"
        "slug: case-001\n"
        "title: First layer under extrusion\n"
        "defect_category: first_layer\n"
        "cover_image: cover.jpg\n"
        "printer_model: Bambu Lab A1\n"
        "filament_material: PLA\n"
        "symptom_parameters: { first_layer_speed: 60 }\n"
        "solution_parameters: { first_layer_speed: 25 }\n"
        "root_cause_analysis: nozzle too high\n"
        "solution_summary: reduce first layer speed\n"
        "source_url: https://example.com/post/1\n"
        "source_platform: forum\n"
        "source_author: maker\n"
        "source_question: why is the first layer thin\n"
        "source_answer: slow down first layer\n"
        "license_note: internal summary with source link\n"
        "collected_by: codex\n"
        "review_status: reviewed\n"
        "---\n"
        "\n"
        "Detailed notes.\n",
        encoding="utf-8",
    )

    index = build_case_index(library, media, generated / "case-index.json")

    assert index["cases"][0]["case_id"] == "case-001"
    assert index["cases"][0]["parameter_delta"]["first_layer_speed"] == {"old": 60, "new": 25}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tests/test_case_library_index_builder.py::test_build_case_index_reads_markdown_cases -v`
Expected: FAIL with `ModuleNotFoundError` for `app.services.case_library.index_builder`.

- [ ] **Step 3: Implement the schema, parser, validator, and index builder**

```python
# backend/app/models/case_library.py
from pydantic import BaseModel, Field


class CaseMedia(BaseModel):
    kind: str
    path: str
    caption: str | None = None


class CaseRecord(BaseModel):
    case_id: str
    slug: str
    title: str
    defect_category: str
    tags: list[str] = Field(default_factory=list)
    cover_image: str
    media: list[CaseMedia] = Field(default_factory=list)
    printer_model: str
    filament_material: str
    symptom_parameters: dict[str, object]
    solution_parameters: dict[str, object]
    root_cause_analysis: str
    solution_summary: str
    source_url: str
    source_platform: str
    source_author: str
    source_question: str
    source_answer: str
    license_note: str
    collected_by: str
    review_status: str
    body: str
```

```python
# backend/app/services/case_library/index_builder.py
import json
from pathlib import Path

from app.services.case_library.loader import load_case_markdown
from app.services.case_library.validator import validate_case_record


def _build_parameter_delta(symptom: dict[str, object], solution: dict[str, object]) -> dict[str, dict[str, object]]:
    delta: dict[str, dict[str, object]] = {}
    for key, new_value in solution.items():
        delta[key] = {"old": symptom.get(key), "new": new_value}
    return delta


def build_case_index(library_dir: Path, media_dir: Path, output_file: Path) -> dict[str, object]:
    cases = []
    for path in sorted(library_dir.glob("*.md")):
        record = load_case_markdown(path, media_dir / path.stem)
        validate_case_record(record)
        item = record.model_dump()
        item["normalized_defect_category"] = record.defect_category.lower()
        item["printer_family"] = record.printer_model.split()[0].lower()
        item["parameter_delta"] = _build_parameter_delta(record.symptom_parameters, record.solution_parameters)
        item["search_text"] = " ".join([record.title, record.root_cause_analysis, record.solution_summary, record.source_question])
        cases.append(item)

    payload = {"cases": cases, "count": len(cases)}
    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
```

```python
# scripts/build_case_index.py
from pathlib import Path

from backend.app.services.case_library.index_builder import build_case_index


ROOT = Path(__file__).resolve().parents[1]
build_case_index(
    ROOT / "cases" / "library",
    ROOT / "cases" / "media",
    ROOT / "cases" / "generated" / "case-index.json",
)
```

- [ ] **Step 4: Run the new backend test to verify it passes**

Run: `cd backend && pytest tests/test_case_library_index_builder.py -v`
Expected: PASS

- [ ] **Step 5: Build the real repository index**

Run: `python scripts/build_case_index.py`
Expected: `cases/generated/case-index.json` is written with `count >= 2`.

- [ ] **Step 6: Commit**

```bash
git add cases backend/app/models/case_library.py backend/app/services/case_library backend/tests/test_case_library_index_builder.py scripts/build_case_index.py README.md .gitignore
git commit -m "feat: add markdown case library and json index builder"
```

### Task 4: Add Backend Case Library APIs and Frontend Case Browser

**Files:**
- Create: `backend/app/routers/case_library.py`, `backend/tests/test_case_library_routes.py`
- Create: `frontend/src/api/caseLibraryApi.ts`, `frontend/src/features/case-library/types.ts`, `frontend/src/features/case-library/CaseFilterBar.tsx`, `frontend/src/features/case-library/CaseList.tsx`, `frontend/src/features/case-library/CaseDetailDrawer.tsx`
- Modify: `frontend/src/pages/CaseLibraryPage.tsx`, `frontend/src/api/api.ts`
- Test: `backend/tests/test_case_library_routes.py`, `frontend/src/api/caseLibraryApi.test.ts`, `frontend/src/pages/CaseLibraryPage.test.tsx`

- [ ] **Step 1: Write the failing API route test**

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_list_cases_supports_filters():
    response = client.get("/api/cases", params={"defect_category": "stringing", "filament_material": "PETG"})

    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert all(item["defect_category"] == "stringing" for item in body["items"])
```

- [ ] **Step 2: Run the backend route test to verify it fails**

Run: `cd backend && pytest tests/test_case_library_routes.py::test_list_cases_supports_filters -v`
Expected: FAIL with `404 Not Found`

- [ ] **Step 3: Implement the backend router and search layer**

```python
# backend/app/routers/case_library.py
from fastapi import APIRouter, Query

from app.services.case_library.search import case_library_search


router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("")
def list_cases(
    defect_category: str | None = Query(default=None),
    printer_model: str | None = Query(default=None),
    filament_material: str | None = Query(default=None),
    query: str | None = Query(default=None),
):
    return case_library_search.list_cases(
        defect_category=defect_category,
        printer_model=printer_model,
        filament_material=filament_material,
        query=query,
    )


@router.get("/{case_id}")
def get_case(case_id: str):
    return case_library_search.get_case(case_id)
```

```python
# backend/app/services/case_library/search.py
class CaseLibrarySearch:
    def __init__(self, index_file: Path) -> None:
        self.index_file = index_file

    def _load(self) -> list[dict[str, object]]:
        payload = json.loads(self.index_file.read_text(encoding="utf-8"))
        return payload["cases"]

    def list_cases(self, defect_category: str | None, printer_model: str | None, filament_material: str | None, query: str | None) -> dict[str, object]:
        items = self._load()
        if defect_category:
            items = [item for item in items if item["defect_category"] == defect_category]
        if printer_model:
            items = [item for item in items if item["printer_model"] == printer_model]
        if filament_material:
            items = [item for item in items if item["filament_material"] == filament_material]
        if query:
            needle = query.lower()
            items = [item for item in items if needle in item["search_text"].lower()]
        return {"items": items, "count": len(items)}
```

- [ ] **Step 4: Run the backend route tests to verify they pass**

Run: `cd backend && pytest tests/test_case_library_routes.py -v`
Expected: PASS

- [ ] **Step 5: Write the failing frontend browser tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { api } from '../api/caseLibraryApi';
import { CaseLibraryPage } from './CaseLibraryPage';

describe('CaseLibraryPage', () => {
  it('renders fetched cases and filters', async () => {
    vi.spyOn(api, 'listCases').mockResolvedValue({
      count: 1,
      items: [{ case_id: 'case-001', title: 'PETG Stringing', defect_category: 'stringing', filament_material: 'PETG' }],
    });

    render(<CaseLibraryPage />);

    expect(await screen.findByText('PETG Stringing')).toBeInTheDocument();
    expect(screen.getByLabelText('缺陷分类')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the frontend tests to verify they fail**

Run: `cd frontend && npm test -- src/api/caseLibraryApi.test.ts src/pages/CaseLibraryPage.test.tsx`
Expected: FAIL because the API client and page components do not exist yet.

- [ ] **Step 7: Implement the frontend case browser**

```ts
// frontend/src/api/caseLibraryApi.ts
import { BASE_URL } from './api';

export const caseLibraryApi = {
  async listCases(filters: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await fetch(`${BASE_URL}/api/cases?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to load cases');
    return response.json();
  },
  async getCase(caseId: string) {
    const response = await fetch(`${BASE_URL}/api/cases/${caseId}`);
    if (!response.ok) throw new Error('Failed to load case');
    return response.json();
  },
}
```

```tsx
// frontend/src/pages/CaseLibraryPage.tsx
export const CaseLibraryPage: React.FC = () => {
  const [filters, setFilters] = useState({ defect_category: '', printer_model: '', filament_material: '', query: '' });
  const [cases, setCases] = useState<CaseListItem[]>([]);

  useEffect(() => {
    void caseLibraryApi.listCases(filters).then((data) => setCases(data.items));
  }, [filters]);

  return (
    <section className="flex h-full flex-col gap-4 p-6">
      <CaseFilterBar filters={filters} onChange={setFilters} />
      <CaseList items={cases} />
    </section>
  );
};
```

- [ ] **Step 8: Run the frontend tests to verify they pass**

Run: `cd frontend && npm test -- src/api/caseLibraryApi.test.ts src/pages/CaseLibraryPage.test.tsx`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/case_library.py backend/app/services/case_library/search.py backend/tests/test_case_library_routes.py frontend/src/api/caseLibraryApi.ts frontend/src/api/caseLibraryApi.test.ts frontend/src/pages/CaseLibraryPage.tsx frontend/src/pages/CaseLibraryPage.test.tsx frontend/src/features/case-library
git commit -m "feat: add case library api and browser"
```

### Task 5: Refactor Diagnosis Into Case-Enhanced Structured Optimization Output

**Files:**
- Create: `backend/app/services/optimization/case_matcher.py`, `backend/app/services/optimization/prompt_builder.py`, `backend/app/services/optimization/response_parser.py`, `backend/tests/test_optimization_prompt_builder.py`
- Modify: `backend/app/services/diagnosis_service.py:1-263`, `backend/app/routers/diagnosis.py`, `frontend/src/pages/AIChatPage.tsx:1-200`, `frontend/src/api/api.ts`
- Test: `backend/tests/test_optimization_prompt_builder.py`, `backend/tests/test_diagnosis_routes.py`

- [ ] **Step 1: Write the failing prompt-builder test**

```python
from app.services.optimization.prompt_builder import build_optimization_prompt


def test_prompt_builder_includes_matched_cases_and_parameter_context():
    prompt = build_optimization_prompt(
        description="PETG stringing",
        detections=[{"label": "stringing", "confidence": 0.98}],
        matched_cases=[{"case_id": "case-002", "title": "PETG Stringing", "solution_summary": "Drop nozzle temp and dry filament"}],
        printer={"nozzle_temperature": 255},
        process={"retraction_length": 0.8},
        filament=[{"filament_type": "PETG"}],
        request_modifications=True,
    )

    assert "case-002" in prompt
    assert "retraction_length" in prompt
    assert "detected_defects" in prompt
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && pytest tests/test_optimization_prompt_builder.py::test_prompt_builder_includes_matched_cases_and_parameter_context -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement the optimization layer and structured parser**

```python
# backend/app/services/optimization/prompt_builder.py
import json


def build_optimization_prompt(*, description, detections, matched_cases, printer, process, filament, request_modifications):
    contract = {
        "detected_defects": [],
        "evidence": [],
        "matched_cases": [],
        "root_cause_hypotheses": [],
        "parameter_recommendations": [],
        "non_parameter_actions": [],
        "export_payload": {"modifications": []},
        "explanation_markdown": "",
    }
    return (
        "你是FDM缺陷案例库诊断助手。\n"
        f"用户描述: {description}\n"
        f"视觉检测: {json.dumps(detections, ensure_ascii=False)}\n"
        f"匹配案例: {json.dumps(matched_cases, ensure_ascii=False)}\n"
        f"Printer: {json.dumps(printer, ensure_ascii=False)}\n"
        f"Process: {json.dumps(process, ensure_ascii=False)}\n"
        f"Filament: {json.dumps(filament, ensure_ascii=False)}\n"
        f"request_modifications={request_modifications}\n"
        f"必须输出合法JSON，结构为: {json.dumps(contract, ensure_ascii=False)}"
    )
```

```python
# backend/app/services/optimization/response_parser.py
def parse_structured_response(payload: dict[str, object]) -> DiagnosisResponse:
    export_payload = payload.get("export_payload", {})
    modifications = [Modification(**item) for item in export_payload.get("modifications", [])]
    return DiagnosisResponse(
        reasoning_markdown=payload.get("explanation_markdown", ""),
        modifications=modifications,
        detected_defects=payload.get("detected_defects", []),
        matched_cases=payload.get("matched_cases", []),
        parameter_recommendations=payload.get("parameter_recommendations", []),
    )
```

```python
# backend/app/services/diagnosis_service.py
matched_cases = case_matcher.match_cases(detections=detections, description=description, preset_data=preset_data)
user_prompt = build_optimization_prompt(
    description=description,
    detections=[item.model_dump() for item in detections],
    matched_cases=matched_cases,
    printer=preset_data.printer,
    process=preset_data.process,
    filament=preset_data.filament,
    request_modifications=request_modifications,
)
```

- [ ] **Step 4: Run the prompt builder and diagnosis tests to verify they pass**

Run: `cd backend && pytest tests/test_optimization_prompt_builder.py tests/test_diagnosis_routes.py -v`
Expected: PASS

- [ ] **Step 5: Update the chat UI to render matched cases and structured recommendations**

```ts
// frontend/src/api/api.ts
export interface StructuredRecommendation {
  name: string;
  current: string | number | null;
  suggested: string | number | null;
  reason: string;
}

export interface DiagnosisResponse {
  reasoning_markdown: string;
  modifications: Modification[];
  matched_cases?: { case_id: string; title: string; solution_summary: string }[];
  parameter_recommendations?: StructuredRecommendation[];
}
```

```tsx
// frontend/src/pages/AIChatPage.tsx
if (chunk.type === 'done') {
  const nextMods = (chunk.modifications || []) as Modification[];
  setMessages((current) =>
    current.map((message) =>
      message.id === assistantId
        ? {
            ...message,
            isStreaming: false,
            modifications: nextMods,
            matchedCases: chunk.matched_cases || [],
            parameterRecommendations: chunk.parameter_recommendations || [],
          }
        : message,
    ),
  );
}
```

- [ ] **Step 6: Run the frontend build to verify type safety**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/optimization backend/app/services/diagnosis_service.py backend/app/routers/diagnosis.py backend/tests/test_optimization_prompt_builder.py backend/tests/test_diagnosis_routes.py frontend/src/api/api.ts frontend/src/pages/AIChatPage.tsx
git commit -m "feat: add case-enhanced structured optimization output"
```

### Task 6: Seed Open-Source Documentation, Model Config Cleanup, and End-to-End Verification

**Files:**
- Modify: `frontend/src/features/diagnosis/ApiSettingsModal.tsx`, `package.json`, `README.md`, `CONTRIBUTING.md`
- Create: sample case markdown and media already listed in Task 3
- Test: `backend/tests/test_case_library_index_builder.py`, `backend/tests/test_case_library_routes.py`, `backend/tests/test_diagnosis_routes.py`, `backend/tests/test_threemf_service.py`, `frontend/src/api/caseLibraryApi.test.ts`, `frontend/src/pages/CaseLibraryPage.test.tsx`, `frontend/src/api/chatStorage.test.ts`

- [ ] **Step 1: Write the failing docs/config test by asserting the build script exists in package.json**

```python
import json
from pathlib import Path


def test_package_json_exposes_case_index_build_script():
    package_json = json.loads(Path("package.json").read_text(encoding="utf-8"))
    assert "build:cases" in package_json["scripts"]
```

- [ ] **Step 2: Run the docs/config test to verify it fails**

Run: `cd backend && pytest tests/test_migration.py::test_package_json_exposes_case_index_build_script -v`
Expected: FAIL because the assertion target does not exist yet.

- [ ] **Step 3: Add repository-level docs, scripts, and config cleanup**

```json
// package.json
{
  "scripts": {
    "dev": "concurrently -n back,front,agent -c blue,green,yellow \"cd backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001\" \"cd frontend && npm run dev\" \"cd client-agent && node src/index.js\"",
    "build": "python scripts/build_case_index.py && cd frontend && npm run build",
    "build:cases": "python scripts/build_case_index.py",
    "start": "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001"
  }
}
```

```md
# README.md

## What This Project Is

FDM Agent is an open-source FDM defect case library and AI optimization workstation.

## Core Features

- Open case library stored as Markdown + frontmatter
- AI diagnosis grounded in matched public cases
- JSON preset optimization
- 3MF native CLI export through `client-agent`
- Custom model provider support

## Build the Case Index

```bash
python scripts/build_case_index.py
```
```

```md
# CONTRIBUTING.md

## Add a New Case

1. Copy an existing file from `cases/library/`
2. Fill every frontmatter field
3. Add media under `cases/media/<slug>/`
4. Run `python scripts/build_case_index.py`
5. Verify `cases/generated/case-index.json` changes
```

- [ ] **Step 4: Run the targeted config test to verify it passes**

Run: `cd backend && pytest tests/test_migration.py::test_package_json_exposes_case_index_build_script -v`
Expected: PASS

- [ ] **Step 5: Run the backend verification suite**

Run: `cd backend && pytest tests/test_case_library_index_builder.py tests/test_case_library_routes.py tests/test_diagnosis_routes.py tests/test_threemf_service.py -v`
Expected: PASS

- [ ] **Step 6: Run the frontend verification suite**

Run: `cd frontend && npm test -- src/api/caseLibraryApi.test.ts src/pages/CaseLibraryPage.test.tsx src/api/chatStorage.test.ts`
Expected: PASS

- [ ] **Step 7: Run the production frontend build**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 8: Run the repository build entrypoint**

Run: `npm run build`
Expected: PASS with the case index rebuilt first and the frontend bundle emitted under `frontend/dist`.

- [ ] **Step 9: Commit**

```bash
git add package.json README.md CONTRIBUTING.md frontend/src/features/diagnosis/ApiSettingsModal.tsx cases/generated/case-index.json
git commit -m "docs: publish open-source workflow and verification commands"
```

## Self-Review

### Spec coverage

- Remove auth and developer console: covered by Task 1 and Task 2
- Preserve AI page, 3MF, JSON optimization, custom models: covered by Task 1, Task 5, and Task 6
- Add modular case library with Markdown source + JSON index: covered by Task 3 and Task 4
- Mixed filtering by defect, printer, filament, and parameters: covered by Task 4
- AI output must be more specific and case-grounded: covered by Task 5
- Keep case library and execution pipeline independent: covered by Task 3, Task 4, and Task 5
- Open-source docs and contribution flow: covered by Task 6

No spec gaps found.

### Placeholder scan

- No `TODO`, `TBD`, “implement later”, or “similar to Task N” placeholders remain.
- Every task includes concrete file paths, test commands, and implementation snippets.

### Type consistency

- Frontend app page union uses `'chat' | 'cases'` consistently.
- Backend case routes are consistently namespaced under `/api/cases`.
- Structured AI response consistently uses `matched_cases`, `parameter_recommendations`, and `export_payload`.

No naming mismatches found.
