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
    """Request to process a model through the slicer engine (CLI-based, future use)."""
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


# ─── 3MF Parse / Modify workflow models ──────────────────────────

class ThreeMFParseResult(BaseModel):
    """Result of parsing a 3MF file's embedded presets."""
    job_id: str = Field(..., description="Server-side job ID to reference this 3MF")
    # Identification
    printer_settings_id: str = ""
    print_settings_id: str = ""
    filament_settings_id: str = ""
    printer_model: str = ""
    # Key preset summary for AI context
    summary: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted key preset fields for AI context (subset)"
    )
    full_settings: Dict[str, Any] = Field(
        default_factory=dict,
        description="Complete original project_settings.config JSON"
    )
    # Object / plate info
    objects: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="3D objects in the 3MF (name, id)"
    )
    plates: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Print plates in the 3MF"
    )


class ThreeMFModifyRequest(BaseModel):
    """Request to apply AI modifications to a previously uploaded 3MF."""
    job_id: str = Field(..., description="Job ID from the parse step")
    modifications: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="AI json_modifications to apply to the 3MF presets"
    )
    repack_only: bool = Field(
        False,
        description=(
            "Deprecated fallback switch. If True, modify project_settings.config and repack inline "
            "with Python ZIP logic. If False, the Client Agent is expected to call the local slicer "
            "CLI so the slicer application exports the final 3MF."
        ),
    )
