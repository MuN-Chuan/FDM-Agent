from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.diagnosis import DiagnosisRequest, DiagnosisResponse
from app.services.diagnosis_service import diagnosis_service

router = APIRouter(
    prefix="/api/diagnose",
    tags=["diagnosis"]
)

@router.post("", response_model=DiagnosisResponse)
async def create_diagnosis(request: DiagnosisRequest):
    """
    Handle incoming diagnosis requests combining visual detections, 
    user descriptions, and JSON preset parameters.
    """
    response = await diagnosis_service.analyze(
        detections=request.detections,
        description=request.description,
        safety_constraints=request.safety_constraints,
        preset_data=request.preset_data,
        api_settings=request.api_settings,
        request_modifications=request.request_modifications,
    )
    return response

@router.post("/stream")
async def create_diagnosis_stream(request: DiagnosisRequest):
    """
    Handle incoming diagnosis requests with streaming output.
    """
    return StreamingResponse(
        diagnosis_service.analyze_stream(
            detections=request.detections,
            description=request.description,
            safety_constraints=request.safety_constraints,
            preset_data=request.preset_data,
            api_settings=request.api_settings,
            request_modifications=request.request_modifications,
        ),
        media_type="text/event-stream"
    )

