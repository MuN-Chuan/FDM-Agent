# backend/app/routers/vision_router.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.dependencies.auth import get_current_user
from app.db.models import User

router = APIRouter(prefix="/api/agent/vision", tags=["vision"])


class VisionAnalyzeRequest(BaseModel):
    screenshot_base64: str
    task: str
    context: Optional[Dict[str, Any]] = {}


class VisionAnalyzeResponse(BaseModel):
    type: str
    action: Optional[str] = None
    x: Optional[int] = None
    y: Optional[int] = None
    description: Optional[str] = None
    error: Optional[str] = None


@router.post("/analyze")
async def analyze_screenshot(
    request: VisionAnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """Receive screenshot and invoke AI analysis"""
    from app.services.vision_service import VisionService

    try:
        service = VisionService()
        result = await service.analyze_screenshot(
            screenshot_base64=request.screenshot_base64,
            task=request.task,
            context=request.context or {}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
