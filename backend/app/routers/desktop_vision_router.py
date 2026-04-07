from fastapi import APIRouter, Depends, HTTPException

from app.db.models import User
from app.dependencies.auth import get_current_user_or_desktop_vision_agent
from app.models.desktop_vision import DesktopVisionPlanRequest, DesktopVisionPlanResponse
from app.services.desktop_vision_service import DesktopVisionService


router = APIRouter(prefix="/api/agent/desktop-vision", tags=["desktop-vision"])


@router.post("/plan", response_model=DesktopVisionPlanResponse)
async def plan_desktop_vision(
    request: DesktopVisionPlanRequest,
    current_user: User | None = Depends(get_current_user_or_desktop_vision_agent),
):
    del current_user
    service = DesktopVisionService()
    try:
        return await service.plan(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
