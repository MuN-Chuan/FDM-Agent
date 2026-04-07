from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


DesktopVisionTask = Literal["home_printer", "move_axis"]
DesktopVisionActionType = Literal["click", "double_click", "type", "hotkey", "scroll", "wait"]
DesktopVisionStatus = Literal["continue", "done", "failed"]
DesktopVisionVerificationMode = Literal["screen_change", "target_state", "none"]


class DesktopVisionScreen(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded PNG screenshot")
    width: int = Field(..., gt=0, description="Window width in pixels")
    height: int = Field(..., gt=0, description="Window height in pixels")
    window_title: str = Field(..., min_length=1, description="Captured window title")


class DesktopVisionHistoryStep(BaseModel):
    step: int = Field(..., ge=1)
    action: DesktopVisionActionType
    result: str = Field(..., min_length=1)
    x: Optional[int] = None
    y: Optional[int] = None
    reason: Optional[str] = None


class DesktopVisionPlanRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    task: DesktopVisionTask
    step: int = Field(..., ge=1)
    screen: DesktopVisionScreen
    history: list[DesktopVisionHistoryStep] = Field(default_factory=list)
    allowed_actions: list[DesktopVisionActionType] = Field(default_factory=list)

    @field_validator("allowed_actions")
    @classmethod
    def validate_allowed_actions(cls, value: list[DesktopVisionActionType]) -> list[DesktopVisionActionType]:
        if not value:
            raise ValueError("allowed_actions must not be empty")
        return value


class DesktopVisionAction(BaseModel):
    type: DesktopVisionActionType
    reason: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    x: Optional[int] = None
    y: Optional[int] = None
    text: Optional[str] = None
    key: Optional[str] = None
    delta: Optional[int] = None
    duration_ms: Optional[int] = Field(None, ge=0)

    @model_validator(mode="after")
    def validate_coordinates(self) -> "DesktopVisionAction":
        if self.type in {"click", "double_click"}:
            if self.x is None or self.y is None:
                raise ValueError(f"{self.type} requires x and y")
        if self.type == "scroll" and self.delta is None:
            raise ValueError("scroll requires delta")
        if self.type == "type" and not self.text:
            raise ValueError("type requires text")
        if self.type == "hotkey" and not self.key:
            raise ValueError("hotkey requires key")
        return self


class DesktopVisionVerification(BaseModel):
    mode: DesktopVisionVerificationMode = "none"
    expectation: str = Field(..., min_length=1)


class DesktopVisionPlanResponse(BaseModel):
    status: DesktopVisionStatus
    message: Optional[str] = None
    action: Optional[DesktopVisionAction] = None
    verification: Optional[DesktopVisionVerification] = None

    @model_validator(mode="after")
    def validate_status_payload(self) -> "DesktopVisionPlanResponse":
        if self.status == "continue" and self.action is None:
            raise ValueError("continue status requires action")
        if self.status == "continue" and self.verification is None:
            raise ValueError("continue status requires verification")
        return self
