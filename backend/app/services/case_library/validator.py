from __future__ import annotations

from pathlib import Path

from app.models.case_library import CaseRecord


REQUIRED_FIELDS = (
    "case_id",
    "slug",
    "title",
    "defect_category",
    "cover_image",
    "printer_model",
    "filament_material",
    "root_cause_analysis",
    "solution_summary",
    "source_url",
    "source_platform",
    "source_author",
    "source_question",
    "source_answer",
    "license_note",
    "collected_by",
    "review_status",
)


def validate_case_record(record: CaseRecord, media_root: Path) -> None:
    for field_name in REQUIRED_FIELDS:
        value = getattr(record, field_name)
        if value in ("", None, []):
            raise ValueError(f"{record.slug} is missing required field: {field_name}")

    if not record.symptom_parameters:
        raise ValueError(f"{record.slug} must include symptom_parameters")
    if not record.solution_parameters:
        raise ValueError(f"{record.slug} must include solution_parameters")

    cover_path = media_root / Path(record.cover_image).name
    if not cover_path.exists():
        raise ValueError(f"{record.slug} is missing cover image: {cover_path.name}")
