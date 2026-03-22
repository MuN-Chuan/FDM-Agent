import io
import os
import shutil
import tempfile
import uuid
from typing import Dict, Any

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse

from app.models.slicer import (
    SlicerJobRequest, SlicerJobResult, EngineInfo,
    ThreeMFParseResult, ThreeMFModifyRequest,
)
from app.services.slicer_engine_service import slicer_engine_service
from app.services import threemf_service

router = APIRouter(
    prefix="/api/slicer",
    tags=["slicer"],
)

# ─── In-memory job store for 3MF jobs ────────────────────────────
# Maps job_id → { "original_bytes": bytes, "modified_bytes": bytes | None }
_threemf_jobs: Dict[str, Dict[str, Any]] = {}


# ══════════════════════════════════════════════════════════════════
# Legacy CLI engine endpoints (kept for future headless CLI use)
# ══════════════════════════════════════════════════════════════════

@router.get("/engines", response_model=list[EngineInfo])
def list_engines():
    """List all available slicer engine plugins."""
    return slicer_engine_service.get_available_engines()


@router.post("/process", response_model=SlicerJobResult)
async def process_model(
    request: SlicerJobRequest,
    model: UploadFile = File(..., description="Model file (STL/3MF/STEP)"),
):
    """
    Submit a model for processing through the slicer engine (CLI-based).
    Currently requires BambuStudio CLI binary in plugins/slicer_engines/bambu/bin/.
    """
    allowed_ext = {".stl", ".3mf", ".step", ".stp", ".obj"}
    _, ext = os.path.splitext(model.filename or "")
    if ext.lower() not in allowed_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_ext)}",
        )

    tmp_dir = tempfile.mkdtemp(prefix="slicer_upload_")
    safe_filename = f"model{ext.lower()}"
    tmp_model_path = os.path.join(tmp_dir, safe_filename)
    try:
        with open(tmp_model_path, "wb") as f:
            content = await model.read()
            f.write(content)
        result = await slicer_engine_service.process_job(tmp_model_path, request)
        return result
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.get("/jobs/{job_id}", response_model=SlicerJobResult)
def get_job_status(job_id: str):
    """Check the status of a CLI processing job."""
    job = slicer_engine_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found",
        )
    return job


@router.delete("/jobs/{job_id}")
def cleanup_job(job_id: str):
    """Clean up a CLI job's temporary files."""
    slicer_engine_service.cleanup_job(job_id)
    _threemf_jobs.pop(job_id, None)
    return {"message": f"Job '{job_id}' cleaned up"}


# ══════════════════════════════════════════════════════════════════
# 3MF Parse / Modify / Download workflow
# ══════════════════════════════════════════════════════════════════

@router.post("/parse-3mf", response_model=ThreeMFParseResult)
async def parse_3mf(
    file: UploadFile = File(..., description="Bambu/Orca 3MF project file"),
):
    """
    Upload a 3MF file and extract its embedded preset parameters.

    Returns a summary of key preset fields for AI context, plus a job_id
    that can be used to reference the 3MF for subsequent modification.
    """
    if not (file.filename or "").lower().endswith(".3mf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .3mf files are supported for preset extraction",
        )

    file_bytes = await file.read()

    try:
        settings = threemf_service.parse_3mf(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    summary = threemf_service.extract_summary(settings)
    object_info = threemf_service.get_3mf_object_info(file_bytes)

    job_id = str(uuid.uuid4())
    _threemf_jobs[job_id] = {
        "original_bytes": file_bytes,
        "settings": settings,
        "modified_bytes": None,
    }

    return ThreeMFParseResult(
        job_id=job_id,
        printer_settings_id=str(settings.get("printer_settings_id", "")),
        print_settings_id=str(settings.get("print_settings_id", "")),
        filament_settings_id=str(
            (settings.get("filament_settings_id") or [settings.get("default_filament_profile", "")])[0]
            if isinstance(settings.get("filament_settings_id"), list)
            else settings.get("filament_settings_id", "")
        ),
        printer_model=str(settings.get("printer_model", "")),
        summary=summary,
        full_settings=threemf_service.filter_gcode(settings),
        objects=object_info.get("objects", []),
        plates=object_info.get("plates", []),
    )


@router.post("/modify-3mf")
async def modify_3mf(request: ThreeMFModifyRequest):
    """
    Apply AI modifications to a previously parsed 3MF and generate a download.

    - If repack_only=True (default): modifies project_settings.config in-place (pure Python).
    - If repack_only=False: requires the Client Agent to handle BambuStudio CLI repack.

    Returns a download token (same job_id) for GET /api/slicer/download-3mf/{job_id}.
    """
    job = _threemf_jobs.get(request.job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"3MF job '{request.job_id}' not found. Please re-upload the file.",
        )

    settings = job["settings"]
    modified_settings = threemf_service.apply_modifications(settings, request.modifications)

    if request.repack_only:
        modified_bytes = threemf_service.repack_3mf(job["original_bytes"], modified_settings)
        _threemf_jobs[request.job_id]["modified_bytes"] = modified_bytes
        _threemf_jobs[request.job_id]["settings"] = modified_settings
        return {
            "job_id": request.job_id,
            "status": "done",
            "applied": modified_settings.get("_ai_modifications_applied", []),
            "skipped": modified_settings.get("_ai_modifications_skipped", []),
            "download_url": f"/api/slicer/download-3mf/{request.job_id}",
        }
    else:
        # Client Agent will handle CLI repack — store modified settings for it to retrieve
        _threemf_jobs[request.job_id]["settings"] = modified_settings
        _threemf_jobs[request.job_id]["pending_cli_repack"] = True
        return {
            "job_id": request.job_id,
            "status": "pending_cli_repack",
            "message": "Client Agent should call GET /api/slicer/agent/settings/{job_id} "
                       "then POST /api/slicer/agent/upload-result/{job_id}",
            "applied": modified_settings.get("_ai_modifications_applied", []),
            "skipped": modified_settings.get("_ai_modifications_skipped", []),
        }


@router.get("/download-3mf/{job_id}")
def download_3mf(job_id: str):
    """
    Download the modified 3MF file produced by the modify-3mf endpoint.
    """
    job = _threemf_jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"3MF job '{job_id}' not found",
        )
    modified_bytes = job.get("modified_bytes")
    if not modified_bytes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"3MF for job '{job_id}' is not yet ready. "
                   "Call POST /api/slicer/modify-3mf first.",
        )

    return StreamingResponse(
        io.BytesIO(modified_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="modified_{job_id[:8]}.3mf"',
            "Content-Length": str(len(modified_bytes)),
        },
    )


# ──────────────────────────────────────────────────────────────────
# Client Agent support endpoints
# ──────────────────────────────────────────────────────────────────

@router.get("/agent/original/{job_id}")
def agent_get_original(job_id: str):
    """
    Client Agent endpoint: Download the original 3MF bytes so the agent
    can pass it to BambuStudio CLI for full repack.
    """
    job = _threemf_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    return StreamingResponse(
        io.BytesIO(job["original_bytes"]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="original_{job_id[:8]}.3mf"',
        },
    )


@router.get("/agent/settings/{job_id}")
def agent_get_settings(job_id: str):
    """
    Client Agent endpoint: Get the modified project_settings.config JSON
    so the agent can write it into the 3MF before calling CLI.
    """
    job = _threemf_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return job["settings"]


@router.post("/agent/upload-result/{job_id}")
async def agent_upload_result(
    job_id: str,
    file: UploadFile = File(..., description="The repacked 3MF from BambuStudio CLI"),
):
    """
    Client Agent endpoint: Upload the BambuStudio CLI-repacked 3MF result.
    After this the user can download via GET /api/slicer/download-3mf/{job_id}.
    """
    job = _threemf_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    result_bytes = await file.read()
    _threemf_jobs[job_id]["modified_bytes"] = result_bytes
    _threemf_jobs[job_id]["pending_cli_repack"] = False

    return {
        "job_id": job_id,
        "status": "done",
        "size_bytes": len(result_bytes),
        "download_url": f"/api/slicer/download-3mf/{job_id}",
    }


@router.get("/jobs/{job_id}/download")
def download_job_output(job_id: str):
    """Download processed output (legacy CLI engine endpoint)."""
    output_path = slicer_engine_service.get_job_output_path(job_id)
    if not output_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output file for job '{job_id}' not found. Job may not be complete.",
        )
    media_type = (
        "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
        if output_path.suffix == ".3mf"
        else "application/octet-stream"
    )
    return FileResponse(path=str(output_path), filename=output_path.name, media_type=media_type)
