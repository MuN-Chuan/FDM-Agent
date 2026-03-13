from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.models.chat import ChatRequest
from app.services.chat_service import chat_service

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"]
)


@router.post("/stream")
async def create_chat_stream(request: ChatRequest):
    """
    Multi-turn conversational AI chat with streaming output.
    Supports optional image and preset context.
    """
    return StreamingResponse(
        chat_service.chat_stream(
            messages=request.messages,
            image_base64=request.image_base64,
            preset_data=request.preset_data,
            api_settings=request.api_settings,
            request_modifications=request.request_modifications
        ),
        media_type="text/event-stream"
    )
