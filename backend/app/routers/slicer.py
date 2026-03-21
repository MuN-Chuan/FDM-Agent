import os
import shutil
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.models.slicer import SlicerJobRequest, SlicerJobResult, EngineInfo
from app.services.slicer_engine_service import slicer_engine_service

router = APIRouter(
    prefix="/api/slicer",
    tags=["slicer"],
)


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
    Submit a model for processing through the slicer engine.

    Upload a model file along with preset data and AI modifications.
    The engine will apply presets, arrange, orient, and export a 3MF file.
    """
    # Validate file type
    allowed_ext = {".stl", ".3mf", ".step", ".stp", ".obj"}
    _, ext = os.path.splitext(model.filename or "")
    if ext.lower() not in allowed_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed_ext)}",
        )

    # Save uploaded file to a temporary location
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
        # Clean up the upload temp dir (job dir is separate)
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.get("/jobs/{job_id}", response_model=SlicerJobResult)
def get_job_status(job_id: str):
    """Check the status of a processing job."""
    job = slicer_engine_service.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found",
        )
    return job


@router.get("/jobs/{job_id}/download")
def download_job_output(job_id: str):
    """Download the processed output file (3MF or GCode)."""
    output_path = slicer_engine_service.get_job_output_path(job_id)
    if not output_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Output file for job '{job_id}' not found. Job may not be complete or has been cleaned up.",
        )

    media_type = (
        "application/vnd.ms-package.3dmanufacturing-3dmodel+xml"
        if output_path.suffix == ".3mf"
        else "application/octet-stream"
    )

    return FileResponse(
        path=str(output_path),
        filename=output_path.name,
        media_type=media_type,
    )


@router.delete("/jobs/{job_id}")
def cleanup_job(job_id: str):
    """Clean up a job's temporary files."""
    slicer_engine_service.cleanup_job(job_id)
    return {"message": f"Job '{job_id}' cleaned up"}
