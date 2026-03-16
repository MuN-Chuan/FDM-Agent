from __future__ import annotations

from pydantic import BaseModel, Field


class StoredMessage(BaseModel):
    id: str
    role: str
    content: str
    thought: str | None = None
    modifications: list | None = None
    isStreaming: bool | None = None
    imagePreviewUrl: str | None = None
    attachedFiles: list | None = None
    presetName: str | None = None
    usage: dict | None = None


class SessionMetadata(BaseModel):
    id: str
    title: str
    timestamp: int


class SessionPayload(SessionMetadata):
    messages: list[StoredMessage] = Field(default_factory=list)
    modifications: list = Field(default_factory=list)
    selection: dict | None = None
    bundle: dict | None = None
    presetFileName: str | None = None
