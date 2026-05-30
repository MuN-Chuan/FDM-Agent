from __future__ import annotations

from pathlib import Path

from app.models.case_library import CaseMedia, CaseRecord
from app.services.case_library.parser import parse_case_markdown


def load_case_markdown(path: Path, media_dir: Path) -> CaseRecord:
    data, body = parse_case_markdown(path)
    slug = str(data.get("slug") or path.stem)
    cover_image = str(data.get("cover_image") or "")

    media_entries = [
        CaseMedia(**item) if isinstance(item, dict) else CaseMedia(kind="image", path=str(item))
        for item in data.get("media", [])
    ]
    if cover_image:
        media_entries.insert(0, CaseMedia(kind="image", path=str(Path(slug) / cover_image), caption="cover"))

    return CaseRecord(
        case_id=str(data.get("case_id") or path.stem),
        slug=slug,
        title=str(data.get("title") or path.stem),
        defect_category=str(data.get("defect_category") or "unknown"),
        tags=[str(item) for item in data.get("tags", [])],
        cover_image=str(Path(slug) / cover_image) if cover_image else "",
        media=media_entries,
        printer_model=str(data.get("printer_model") or ""),
        nozzle_diameter=str(data["nozzle_diameter"]) if data.get("nozzle_diameter") is not None else None,
        filament_brand=str(data["filament_brand"]) if data.get("filament_brand") is not None else None,
        filament_material=str(data.get("filament_material") or ""),
        filament_color=str(data["filament_color"]) if data.get("filament_color") is not None else None,
        slicer_name=str(data["slicer_name"]) if data.get("slicer_name") is not None else None,
        slicer_version=str(data["slicer_version"]) if data.get("slicer_version") is not None else None,
        profile_source=str(data["profile_source"]) if data.get("profile_source") is not None else None,
        symptom_parameters=dict(data.get("symptom_parameters", {})),
        solution_parameters=dict(data.get("solution_parameters", {})),
        root_cause_analysis=str(data.get("root_cause_analysis") or ""),
        solution_summary=str(data.get("solution_summary") or ""),
        source_url=str(data.get("source_url") or ""),
        source_platform=str(data.get("source_platform") or ""),
        source_author=str(data.get("source_author") or ""),
        source_question=str(data.get("source_question") or ""),
        source_answer=str(data.get("source_answer") or ""),
        license_note=str(data.get("license_note") or ""),
        collected_by=str(data.get("collected_by") or ""),
        review_status=str(data.get("review_status") or "draft"),
        body=body,
    )
