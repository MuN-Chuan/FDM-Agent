import os
import json
from fastapi import APIRouter, HTTPException
from typing import Dict, List
from pathlib import Path

router = APIRouter(prefix="/api/presets", tags=["presets"])

# Robust path discovery: resources is at the same level as app/
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RESOURCES_DIR = BASE_DIR / "resources"

@router.get("/parameter_map")
async def get_parameter_map(slicer: str):
    """
    Returns a mapping of categories to available parameter keys for a given slicer.
    Categories: 'process', 'filament', 'printer'
    """
    slicer = slicer.lower()
    base_profiles_dir = RESOURCES_DIR / slicer / "base_profiles"
    
    if not base_profiles_dir.exists():
        raise HTTPException(status_code=404, detail=f"Slicer '{slicer}' resources not found")

    result = {
        "process": [],
        "filament": [],
        "printer": []
    }

    mapping = {
        "process_base.json": "process",
        "filament_base.json": "filament",
        "printer_base.json": "printer"
    }

    for filename, category in mapping.items():
        filepath = base_profiles_dir / filename
        if filepath.exists():
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        result[category] = list(data.keys())
            except Exception as e:
                # Silently log error to console for server debugging
                print(f"Error loading {filepath}: {e}")
                
    return result
