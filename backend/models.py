from pydantic import BaseModel
from typing import List, Optional

class Detection(BaseModel):
    label: str
    confidence: float

class DiagnosisRequest(BaseModel):
    detections: List[Detection] = []
    description: Optional[str] = None
    safety_constraints: Optional[str] = None
    preset_data: Optional[dict] = None

class Modification(BaseModel):
    name: str
    old: str
    new: str
    range: str
    reason: str
    risk: str  # 'low' | 'medium' | 'high'

class DiagnosisResponse(BaseModel):
    reasoning_markdown: str
    modifications: List[Modification]
