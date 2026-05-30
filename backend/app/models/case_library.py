from __future__ import annotations

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
    nozzle_diameter: str | None = None
    filament_brand: str | None = None
    filament_material: str
    filament_color: str | None = None
    slicer_name: str | None = None
    slicer_version: str | None = None
    profile_source: str | None = None
    symptom_parameters: dict[str, object] = Field(default_factory=dict)
    solution_parameters: dict[str, object] = Field(default_factory=dict)
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
    body: str = ""
