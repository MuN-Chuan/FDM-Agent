from __future__ import annotations

from app.models.diagnosis import Detection, PresetData
from app.services.case_library.search import case_library_search


class CaseMatcher:
    def match_cases(
        self,
        *,
        detections: list[Detection],
        description: str | None,
        preset_data: PresetData,
        limit: int = 3,
    ) -> list[dict[str, object]]:
        cases = case_library_search._load()
        if not cases:
            return []

        query_terms = {detection.label.lower() for detection in detections}
        if description:
            query_terms.update(token.lower() for token in description.split() if len(token) > 3)
        if preset_data.filament:
            material = str(preset_data.filament[0].get("filament_type") or preset_data.filament[0].get("name") or "")
            if material:
                query_terms.add(material.lower())

        ranked: list[tuple[int, dict[str, object]]] = []
        for item in cases:
            haystack = " ".join(
                [
                    str(item.get("defect_category", "")),
                    str(item.get("title", "")),
                    str(item.get("search_text", "")),
                    str(item.get("filament_material", "")),
                ]
            ).lower()
            score = sum(1 for term in query_terms if term and term in haystack)
            if score > 0:
                ranked.append((score, item))

        ranked.sort(key=lambda pair: pair[0], reverse=True)
        return [
            {
                "case_id": str(item["case_id"]),
                "title": str(item["title"]),
                "defect_category": str(item["defect_category"]),
                "solution_summary": str(item.get("solution_summary", "")),
                "source_url": str(item.get("source_url", "")),
            }
            for _, item in ranked[:limit]
        ]


case_matcher = CaseMatcher()
