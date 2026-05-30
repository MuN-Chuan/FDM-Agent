from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.case_library.search import case_library_search


client = TestClient(app)


def test_list_cases_supports_filters(tmp_path: Path) -> None:
    index_file = tmp_path / "case-index.json"
    index_file.write_text(
        json.dumps(
            {
                "count": 2,
                "cases": [
                    {
                        "case_id": "case-001",
                        "title": "PETG Stringing",
                        "defect_category": "stringing",
                        "printer_model": "Creality K1C",
                        "filament_material": "PETG",
                        "search_text": "petg stringing wet filament",
                    },
                    {
                        "case_id": "case-002",
                        "title": "First Layer",
                        "defect_category": "first_layer",
                        "printer_model": "Bambu Lab A1",
                        "filament_material": "PLA",
                        "search_text": "first layer adhesion",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    original_index = case_library_search.index_file
    case_library_search.index_file = index_file
    try:
        response = client.get("/api/cases", params={"defect_category": "stringing", "filament_material": "PETG"})
    finally:
        case_library_search.index_file = original_index

    assert response.status_code == 200
    body = response.json()
    assert body["items"]
    assert all(item["defect_category"] == "stringing" for item in body["items"])
    assert all(item["filament_material"] == "PETG" for item in body["items"])
