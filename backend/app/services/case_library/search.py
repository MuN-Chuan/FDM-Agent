from __future__ import annotations

import json
from pathlib import Path


class CaseLibrarySearch:
    def __init__(self, index_file: Path) -> None:
        self.index_file = index_file

    def _load(self) -> list[dict[str, object]]:
        if not self.index_file.exists():
            return []
        payload = json.loads(self.index_file.read_text(encoding="utf-8"))
        return payload.get("cases", [])

    def list_cases(
        self,
        defect_category: str | None = None,
        printer_model: str | None = None,
        filament_material: str | None = None,
        query: str | None = None,
    ) -> dict[str, object]:
        items = self._load()
        if defect_category:
            items = [item for item in items if item.get("defect_category") == defect_category]
        if printer_model:
            items = [item for item in items if item.get("printer_model") == printer_model]
        if filament_material:
            items = [item for item in items if item.get("filament_material") == filament_material]
        if query:
            needle = query.lower()
            items = [item for item in items if needle in str(item.get("search_text", "")).lower()]
        return {"items": items, "count": len(items)}

    def get_case(self, case_id: str) -> dict[str, object]:
        for item in self._load():
            if item.get("case_id") == case_id:
                return item
        raise KeyError(case_id)


ROOT = Path(__file__).resolve().parents[4]
case_library_search = CaseLibrarySearch(ROOT / "cases" / "case-index.json")
