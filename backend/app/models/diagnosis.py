from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class Detection(BaseModel):
    label: str = Field(..., description="Detected defect class name (e.g., 'stringing', 'warping')")
    confidence: float = Field(..., description="Confidence score from the AI model (0.0 to 1.0)")

class PresetData(BaseModel):
    printer: Dict[str, Any] = Field(default_factory=dict, description="Machine preset parameters")
    filament: List[Dict[str, Any]] = Field(default_factory=list, description="Material preset parameters")
    process: Dict[str, Any] = Field(default_factory=dict, description="Process/quality preset parameters")

class ApiSettings(BaseModel):
    provider_id: Optional[str] = Field(None, description="Provider ID for official models")
    model_name: Optional[str] = Field(None, description="Model Name")
    is_custom: bool = Field(False, description="Whether using custom provider")
    custom_api_key: Optional[str] = Field(None, description="Custom provider API Key")
    custom_base_url: Optional[str] = Field(None, description="Custom provider Base URL")
    custom_provider_name: Optional[str] = Field(None, description="Custom provider name")

class DiagnosisRequest(BaseModel):
    detections: List[Detection] = Field(default_factory=list, description="List of defects detected by the vision model")
    description: Optional[str] = Field(None, description="User's supplementary verbal description of the problem")
    safety_constraints: Optional[str] = Field(None, description="User-defined safety constraints or hardware limitations")
    preset_data: PresetData = Field(default_factory=PresetData, description="Parsed preset JSON objects from frontend validation")
    api_settings: Optional[ApiSettings] = Field(None, description="Dynamic LLM provider settings from the frontend")
    request_modifications: bool = Field(False, description="Whether the user explicitly requests parameter optimization suggestions")

class Modification(BaseModel):
    name: str = Field(..., description="The internal parameter key name (e.g., 'retraction_distance')")
    category: str = Field(..., description="The category of the parameter: 'process', 'filament', or 'printer'")
    old: Any = Field(..., description="The original value from the user's preset")
    new: Any = Field(..., description="The new recommended value")
    range: str = Field(default="N/A", description="The safe/recommended physical range for this parameter")
    reason: str = Field(..., description="A clear, logical explanation for why this parameter should be changed")
    risk: str = Field(..., description="Risk level of the change: 'low', 'medium', or 'high'")

class MatchedCase(BaseModel):
    case_id: str
    title: str
    defect_category: str
    solution_summary: str
    source_url: str | None = None


class ParameterRecommendation(BaseModel):
    name: str
    category: str
    current: Any = None
    suggested: Any = None
    reason: str
    risk: str = "medium"


class DiagnosisResponse(BaseModel):
    reasoning_markdown: str = Field(..., description="Detailed markdown-formatted diagnostic report explaining the AI's thought process")
    modifications: List[Modification] = Field(default_factory=list, description="List of actionable parameter adjustments")
    detected_defects: List[Dict[str, Any]] = Field(default_factory=list)
    matched_cases: List[MatchedCase] = Field(default_factory=list)
    parameter_recommendations: List[ParameterRecommendation] = Field(default_factory=list)
