from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ChatFeedback, ChatMessageRecord, ChatSession
from app.db.session import get_db
from app.models.chat import ChatFeedbackRequest, ChatRequest
from app.schemas.session import SessionMetadata, SessionPayload, StoredMessage
from app.services.chat_service import chat_service
from app.services.rate_limit_service import build_rate_limit_dependency

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"]
)

chat_rate_limit = build_rate_limit_dependency(
    scope="chat",
    max_requests=settings.CHAT_RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.CHAT_RATE_LIMIT_WINDOW_SECONDS,
)
chat_stream_rate_limit = build_rate_limit_dependency(
    scope="chat-stream",
    max_requests=settings.CHAT_STREAM_RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.CHAT_STREAM_RATE_LIMIT_WINDOW_SECONDS,
)


class MessageResponse(BaseModel):
    message: str


@router.post("/stream")
async def create_chat_stream(
    request: ChatRequest,
    _: None = Depends(chat_stream_rate_limit),
):
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


@router.post("/feedback", response_model=MessageResponse)
def submit_chat_feedback(
    payload: ChatFeedbackRequest,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    user_message = payload.context_snapshot.get("user_message", {}) if isinstance(payload.context_snapshot, dict) else {}
    assistant_message = payload.context_snapshot.get("assistant_message", {}) if isinstance(payload.context_snapshot, dict) else {}

    feedback = ChatFeedback(
        user_id=None,
        session_id=payload.session_id,
        assistant_message_id=payload.assistant_message_id,
        user_message_id=payload.user_message_id,
        rating=payload.rating,
        user_message_content=str(user_message.get("content", "")),
        assistant_message_content=str(assistant_message.get("content", "")),
        assistant_thought=assistant_message.get("thought"),
        feedback_text=payload.feedback_text,
        feedback_images=[image.model_dump() for image in payload.feedback_images] if payload.feedback_images else None,
        context_snapshot=payload.context_snapshot,
    )
    db.add(feedback)
    db.commit()
    return MessageResponse(message="Feedback saved")


def _serialize_message(record: ChatMessageRecord) -> StoredMessage:
    return StoredMessage(
        id=record.id,
        role=record.role,
        content=record.content,
        thought=record.thought,
        modifications=record.modifications,
        isStreaming=record.is_streaming,
        imagePreviewUrl=record.image_preview_url,
        attachedFiles=record.attached_files,
        presetName=record.preset_name,
        usage=record.usage,
    )


def _serialize_session(session: ChatSession) -> SessionPayload:
    return SessionPayload(
        id=session.id,
        title=session.title,
        timestamp=session.timestamp,
        messages=[_serialize_message(message) for message in session.messages],
        modifications=session.modifications or [],
        selection=session.selection,
        bundle=session.bundle,
        presetFileName=session.preset_file_name,
    )


@router.get("/sessions", response_model=list[SessionMetadata])
def list_chat_sessions(
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    sessions = db.scalars(select(ChatSession).order_by(ChatSession.timestamp.desc())).all()
    return [
        SessionMetadata(id=session.id, title=session.title, timestamp=session.timestamp)
        for session in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionPayload)
def get_chat_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _serialize_session(session)


@router.put("/sessions/{session_id}", response_model=SessionPayload)
def upsert_chat_session(
    session_id: str,
    payload: SessionPayload,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if session is None:
        session = ChatSession(id=session_id, user_id=None)
        db.add(session)
        db.flush()

    session.title = payload.title
    session.timestamp = payload.timestamp
    session.preset_file_name = payload.presetFileName
    session.selection = payload.selection
    session.bundle = payload.bundle
    session.modifications = payload.modifications

    db.execute(delete(ChatMessageRecord).where(ChatMessageRecord.session_id == session.id))
    for index, message in enumerate(payload.messages):
        db.add(
            ChatMessageRecord(
                id=message.id,
                session_id=session.id,
                position=index,
                role=message.role,
                content=message.content,
                thought=message.thought,
                modifications=message.modifications,
                is_streaming=message.isStreaming,
                image_preview_url=message.imagePreviewUrl,
                attached_files=message.attachedFiles,
                preset_name=message.presetName,
                usage=message.usage,
            )
        )

    db.commit()
    db.refresh(session)
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    return _serialize_session(session)


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def delete_chat_session(
    session_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(select(ChatSession).where(ChatSession.id == session_id))
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    db.delete(session)
    db.commit()
    return MessageResponse(message="Session deleted")
