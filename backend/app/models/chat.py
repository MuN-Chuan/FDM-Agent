from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
from app.models.diagnosis import ApiSettings, Modification


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list, description="Full conversation history")
    image_base64: Optional[str] = Field(None, description="Optional base64-encoded image for visual context")
    preset_data: Optional[Dict[str, Any]] = Field(None, description="Parsed preset data for context")
    api_settings: Optional[ApiSettings] = Field(None, description="Dynamic LLM provider settings")
    request_modifications: bool = Field(False, description="Whether user explicitly requests parameter modifications")


class ChatResponse(BaseModel):
    reasoning_markdown: str = Field(default="", description="AI response text")
    modifications: List[Modification] = Field(default_factory=list)


class FeedbackImage(BaseModel):
    name: str
    base64: str
    preview_url: Optional[str] = None


class ChatFeedbackRequest(BaseModel):
    session_id: Optional[str] = None
    assistant_message_id: str
    user_message_id: Optional[str] = None
    rating: Literal["up", "down"]
    feedback_text: Optional[str] = None
    feedback_images: List[FeedbackImage] = Field(default_factory=list)
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)
