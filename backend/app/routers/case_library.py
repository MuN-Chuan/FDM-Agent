from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

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
    try:
        return case_library_search.get_case(case_id)
    except KeyError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found") from error
