from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import ChatMessageRecord, ChatSession, User
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.chat import ChatRequest
from app.schemas.auth import MessageResponse
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    sessions = db.scalars(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.timestamp.desc())
    ).all()
    return [
        SessionMetadata(id=session.id, title=session.title, timestamp=session.timestamp)
        for session in sessions
    ]


@router.get("/sessions/{session_id}", response_model=SessionPayload)
def get_chat_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _serialize_session(session)


@router.put("/sessions/{session_id}", response_model=SessionPayload)
def upsert_chat_session(
    session_id: str,
    payload: SessionPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if session is None:
        session = ChatSession(id=session_id, user_id=current_user.id)
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
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    return _serialize_session(session)


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
def delete_chat_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _: None = Depends(chat_rate_limit),
):
    session = db.scalar(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    db.delete(session)
    db.commit()
    return MessageResponse(message="Session deleted")
