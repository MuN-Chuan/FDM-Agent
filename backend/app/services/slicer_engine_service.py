import asyncio
import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.models.slicer import (
    EngineInfo,
    SlicerEngine,
    SlicerJobRequest,
    SlicerJobResult,
    SlicerJobStatus,
)
from app.services.preset_inheritance_service import preset_inheritance_service


class SlicerEngineService:
    """
    Manages slicer engine plugins and dispatches processing jobs.

    Each job:
    1. Resolves full presets from user diffs via preset_inheritance_service
    2. Applies AI-generated modifications on top
    3. Writes temporary preset JSON files
    4. Invokes the slicer engine CLI in headless mode
    5. Returns the output 3MF/GCode file path
    """

    def __init__(self):
        # Resolve project root (4 levels up from backend/app/services/)
        self.project_root = Path(__file__).resolve().parents[3]
        self.plugins_dir = self.project_root / "plugins" / "slicer_engines"
        self.jobs_dir = self.project_root / "tmp" / "slicer_jobs"

        # Active jobs registry (in-memory; future: Redis/DB)
        self._jobs: Dict[str, SlicerJobResult] = {}

    # ─── Engine Discovery ───────────────────────────────────────────

    def get_available_engines(self) -> List[EngineInfo]:
        """Scan the plugins directory for installed slicer engines."""
        engines = []
        if not self.plugins_dir.exists():
            return engines

        for engine_dir in self.plugins_dir.iterdir():
            if not engine_dir.is_dir():
                continue
            meta_file = engine_dir / "engine.json"
            if not meta_file.exists():
                continue

            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta = json.load(f)

                exe_path = engine_dir / meta.get("executable", "")
                engines.append(EngineInfo(
                    name=meta.get("name", engine_dir.name),
                    engine_id=engine_dir.name,
                    version=meta.get("version", "unknown"),
                    executable=str(exe_path),
                    available=exe_path.exists(),
                    supports=meta.get("supports", ["stl", "3mf"]),
                ))
            except Exception as e:
                print(f"[SlicerEngine] Error reading {meta_file}: {e}")

        return engines

    def _get_engine_info(self, engine_id: str) -> Optional[EngineInfo]:
        """Get a specific engine's info."""
        for engine in self.get_available_engines():
            if engine.engine_id == engine_id:
                return engine
        return None

    # ─── Preset Processing ──────────────────────────────────────────

    def _resolve_full_presets(
        self,
        preset_data: Optional[Dict[str, Any]],
        modifications: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Resolve user preset diffs into full presets, then apply AI modifications.
        Returns dict with keys: printer, process, filament (list).
        """
        result = {"printer": {}, "process": {}, "filament": []}

        if not preset_data:
            return result

        # Step 1: Expand via inheritance chain
        if preset_data.get("printer"):
            result["printer"] = preset_inheritance_service.get_full_preset(
                preset_data["printer"], "printer"
            )
        if preset_data.get("process"):
            result["process"] = preset_inheritance_service.get_full_preset(
                preset_data["process"], "process"
            )
        if isinstance(preset_data.get("filament"), list):
            result["filament"] = [
                preset_inheritance_service.get_full_preset(f, "filament")
                for f in preset_data["filament"]
            ]
        elif isinstance(preset_data.get("filament"), dict):
            result["filament"] = [
                preset_inheritance_service.get_full_preset(
                    preset_data["filament"], "filament"
                )
            ]

        # Step 2: Apply AI modifications
        if modifications:
            result["process"] = self._apply_modifications(
                result["process"], modifications, "process"
            )
            result["printer"] = self._apply_modifications(
                result["printer"], modifications, "printer"
            )
            for i, fil in enumerate(result["filament"]):
                result["filament"][i] = self._apply_modifications(
                    fil, modifications, "filament"
                )

        return result

    @staticmethod
    def _apply_modifications(
        preset: Dict[str, Any],
        modifications: List[Dict[str, Any]],
        category: str,
    ) -> Dict[str, Any]:
        """Apply AI json_modifications to a preset dict."""
        if not preset or not modifications:
            return preset

        result = preset.copy()
        for mod in modifications:
            if mod.get("category") != category:
                continue

            key = mod.get("name")
            new_val = mod.get("new")
            if not key or new_val is None:
                continue

            # Type coercion: AI outputs are strings; match original value type
            if key in result:
                original = result[key]
                try:
                    if isinstance(original, bool):
                        new_val = str(new_val).lower() in ("true", "1", "yes")
                    elif isinstance(original, int):
                        new_val = int(float(new_val))
                    elif isinstance(original, float):
                        new_val = float(new_val)
                except (ValueError, TypeError):
                    pass

            result[key] = new_val

        return result

    # ─── Job Execution ──────────────────────────────────────────────

    def _write_preset_files(
        self, job_dir: Path, presets: Dict[str, Any]
    ) -> Dict[str, str]:
        """Write resolved presets to temporary JSON files. Returns paths dict."""
        paths = {}

        # Combine printer + process into settings file
        settings = {}
        if presets.get("printer"):
            settings.update(presets["printer"])
        if presets.get("process"):
            settings.update(presets["process"])

        if settings:
            settings_path = job_dir / "settings.json"
            with open(settings_path, "w", encoding="utf-8") as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            paths["settings"] = str(settings_path)

        # Write filament files
        filament_paths = []
        for i, fil in enumerate(presets.get("filament", [])):
            if fil:
                fil_path = job_dir / f"filament_{i}.json"
                with open(fil_path, "w", encoding="utf-8") as f:
                    json.dump(fil, f, ensure_ascii=False, indent=2)
                filament_paths.append(str(fil_path))

        if filament_paths:
            paths["filaments"] = ";".join(filament_paths)

        return paths

    def _build_cli_command(
        self,
        engine_info: EngineInfo,
        model_path: str,
        preset_paths: Dict[str, str],
        output_path: str,
        request: SlicerJobRequest,
    ) -> List[str]:
        """Build the CLI command list for the slicer engine."""
        cmd = [engine_info.executable]

        # Sandbox data directory
        sandbox_dir = self.plugins_dir / "sandbox"
        sandbox_dir.mkdir(parents=True, exist_ok=True)
        cmd.extend(["--datadir", str(sandbox_dir)])

        # Load settings (printer + process)
        if "settings" in preset_paths:
            cmd.extend(["--load_settings", preset_paths["settings"]])

        # Load filaments
        if "filaments" in preset_paths:
            cmd.extend(["--load_filaments", preset_paths["filaments"]])

        # Auto arrange
        if request.auto_arrange:
            cmd.extend(["--arrange", "1"])

        # Auto orient
        if request.auto_orient:
            cmd.extend(["--orient", "1"])

        # Slice
        if request.do_slice:
            cmd.extend(["--slice", "0"])

        # Output format
        if request.output_format == "gcode":
            cmd.append("--export_gcode")
        else:
            cmd.extend(["--export_3mf", output_path])

        # Input model
        cmd.append(model_path)

        return cmd

    async def process_job(
        self,
        model_path: str,
        request: SlicerJobRequest,
    ) -> SlicerJobResult:
        """
        Main entry point: process a model through the slicer engine.
        """
        job_id = str(uuid.uuid4())[:8]
        result = SlicerJobResult(job_id=job_id, status=SlicerJobStatus.PENDING)
        self._jobs[job_id] = result

        try:
            # 1. Find engine
            engine = self._get_engine_info(request.engine.value)
            if not engine or not engine.available:
                result.status = SlicerJobStatus.FAILED
                result.error = f"Engine '{request.engine.value}' not available. Install it in plugins/slicer_engines/{request.engine.value}/"
                return result

            # 2. Create job working directory
            job_dir = self.jobs_dir / job_id
            job_dir.mkdir(parents=True, exist_ok=True)

            # 3. Resolve and write presets
            presets = self._resolve_full_presets(
                request.preset_data, request.modifications
            )
            preset_paths = self._write_preset_files(job_dir, presets)

            # 4. Determine output path
            ext = "gcode" if request.output_format == "gcode" else "3mf"
            output_filename = f"output_{job_id}.{ext}"
            output_path = str(job_dir / output_filename)

            # 5. Build CLI command
            cmd = self._build_cli_command(
                engine, model_path, preset_paths, output_path, request
            )

            print(f"[SlicerEngine] Executing: {' '.join(cmd)}")
            result.status = SlicerJobStatus.RUNNING
            start = time.time()

            # 6. Execute
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(job_dir),
            )
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=300  # 5 min max
            )

            result.stdout = stdout_bytes.decode("utf-8", errors="replace")
            result.stderr = stderr_bytes.decode("utf-8", errors="replace")
            result.duration_seconds = round(time.time() - start, 2)

            if proc.returncode == 0 and os.path.exists(output_path):
                result.status = SlicerJobStatus.DONE
                result.output_filename = output_filename
            else:
                result.status = SlicerJobStatus.FAILED
                result.error = (
                    f"Engine exited with code {proc.returncode}. "
                    f"stderr: {result.stderr[:500]}"
                )

        except asyncio.TimeoutError:
            result.status = SlicerJobStatus.FAILED
            result.error = "Engine execution timed out (300s)"
        except Exception as e:
            result.status = SlicerJobStatus.FAILED
            result.error = str(e)

        self._jobs[job_id] = result
        return result

    # ─── Job Management ─────────────────────────────────────────────

    def get_job(self, job_id: str) -> Optional[SlicerJobResult]:
        return self._jobs.get(job_id)

    def get_job_output_path(self, job_id: str) -> Optional[Path]:
        """Get the absolute path to a job's output file."""
        job = self._jobs.get(job_id)
        if not job or not job.output_filename:
            return None
        path = self.jobs_dir / job_id / job.output_filename
        return path if path.exists() else None

    def cleanup_job(self, job_id: str) -> bool:
        """Remove a job's temporary directory and registry entry."""
        job_dir = self.jobs_dir / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
        self._jobs.pop(job_id, None)
        return True


# Singleton
slicer_engine_service = SlicerEngineService()
