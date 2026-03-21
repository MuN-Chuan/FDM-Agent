from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum


class SlicerEngine(str, Enum):
    BAMBU = "bambu"
    ORCA = "orca"
    PRUSA = "prusa"


class EngineInfo(BaseModel):
    """Metadata about a discovered slicer engine plugin."""
    name: str = Field(..., description="Human readable engine name")
    engine_id: str = Field(..., description="Engine identifier (e.g. 'bambu')")
    version: str = Field("unknown", description="Engine version")
    executable: str = Field(..., description="Path to the engine executable")
    available: bool = Field(True, description="Whether the engine binary exists")
    supports: List[str] = Field(default_factory=lambda: ["stl", "3mf"])


class SlicerJobRequest(BaseModel):
    """Request to process a model through the slicer engine."""
    engine: SlicerEngine = Field(SlicerEngine.BAMBU, description="Which slicer engine to use")
    preset_data: Optional[Dict[str, Any]] = Field(None, description="Parsed preset data (printer/process/filament)")
    modifications: List[Dict[str, Any]] = Field(default_factory=list, description="AI json_modifications to apply")
    auto_arrange: bool = Field(True, description="Auto-arrange models on plate")
    auto_orient: bool = Field(True, description="Auto-orient models for best printing")
    do_slice: bool = Field(False, description="Whether to run the slicer (costly)")
    output_format: str = Field("3mf", description="Output format: 3mf or gcode")


class SlicerJobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class SlicerJobResult(BaseModel):
    """Result of a slicer engine processing job."""
    job_id: str
    status: SlicerJobStatus = SlicerJobStatus.PENDING
    output_filename: Optional[str] = None
    stdout: str = ""
    stderr: str = ""
    duration_seconds: float = 0.0
    error: Optional[str] = None
