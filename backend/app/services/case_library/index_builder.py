from __future__ import annotations

import json
from pathlib import Path

from app.services.case_library.loader import load_case_markdown
from app.services.case_library.validator import validate_case_record


def _build_parameter_delta(
    symptom: dict[str, object],
    solution: dict[str, object],
) -> dict[str, dict[str, object]]:
    delta: dict[str, dict[str, object]] = {}
    for key, new_value in solution.items():
        delta[key] = {"old": symptom.get(key), "new": new_value}
    return delta


def build_case_index(library_dir: Path, media_dir: Path, output_file: Path) -> dict[str, object]:
    cases: list[dict[str, object]] = []

    for path in sorted(library_dir.glob("*.md")):
        media_root = media_dir / path.stem
        record = load_case_markdown(path, media_root)
        validate_case_record(record, media_root)

        item = record.model_dump()
        item["normalized_defect_category"] = record.defect_category.lower()
        item["printer_family"] = record.printer_model.split()[0].lower()
        item["materials_normalized"] = [record.filament_material.lower()]
        item["parameter_delta"] = _build_parameter_delta(record.symptom_parameters, record.solution_parameters)
        item["search_text"] = " ".join(
            [
                record.title,
                record.root_cause_analysis,
                record.solution_summary,
                record.source_question,
                record.source_answer,
                record.body,
            ]
        )
        cases.append(item)

    payload = {"cases": cases, "count": len(cases)}
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
