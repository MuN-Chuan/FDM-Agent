import json
import os
import re
from typing import Dict, Any, Optional, List

class PresetInheritanceService:
    def __init__(self):
        # Base directory for storing downloaded/cached base profiles
        self.base_profiles_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "resources", "base_profiles"
        )
        os.makedirs(self.base_profiles_dir, exist_ok=True)
        
        # Slicer Identification Keywords
        self.SLICER_KEYWORDS = {
            "creality": ["creality_printer", "Creality Print"],
            "bambu": ["bbscfg", "Bambu Studio", "BBL"],
            "orca": ["orca_printer", "OrcaSlicer", "SoftFever"]
        }
        
        # Machine Keywords for common brands - extracted for backend identification
        self.MACHINE_KEYWORDS = {
            "Bambu Lab": ["X1", "P1P", "P1S", "A1", "mini", "X1C", "X1E", "P1"],
            "Creality": ["K1", "Ender", "CR-10", "Sermoon", "Falcon", "Mage", "HALOT", "CR-M4", "K1 Max", "V3"],
            "Anycubic": ["Kobra", "Photon", "Vyper", "Mono", "Wash", "Cure", "Mega"],
            "Prusa": ["MK3", "MK4", "XL", "MINI", "SL1"],
            "Voron": ["v2", "v0", "Trident", "Switchwire", "Legacy"],
            "Elegoo": ["Neptune", "Mars", "Saturn", "Jupiter"],
            "Qiditech": ["X-Max", "X-Plus", "X-Smart"],
            "Flashforge": ["Adventurer", "Creator", "Guider", "Finder"],
            "AnkerMake": ["M5", "M5C"],
            "Flying Bear": ["Ghost", "Reborn"],
            "Artillery": ["Sidewinder", "Genius"]
        }

    def identify_slicer_and_machine(self, preset_data: Dict[str, Any]) -> Dict[str, str]:
        """
        Identify the slicer software and machine model from preset metadata.
        Returns a dict: {"slicer": "...", "brand": "...", "machine": "..."}
        """
        results = {"slicer": "unknown", "brand": "unknown", "machine": "unknown"}
        
        # 1. Identify Slicer
        # Check for specific keys or file formats
        preset_str = json.dumps(preset_data)
        
        for slicer, keywords in self.SLICER_KEYWORDS.items():
            if any(kw in preset_str for kw in keywords):
                results["slicer"] = slicer
                break
                
        # 2. Identify Machine/Brand
        # Try to find 'printer_model', 'name', or 'from' fields
        search_fields = ["printer_model", "name", "from", "inherits", "model_id"]
        
        extracted_text = ""
        for field in search_fields:
            # Check top level or nested
            val = self._find_value_recursive(preset_data, field)
            if val and isinstance(val, str):
                extracted_text += " " + val
                
        # Match brand
        for brand, keywords in self.MACHINE_KEYWORDS.items():
            if brand.lower() in extracted_text.lower() or any(kw.lower() in extracted_text.lower() for kw in keywords):
                results["brand"] = brand
                break
                
        # Extract specific machine model (fallback to whatever was in name if possible)
        # Simple heuristic: take the first 30 chars of the 'name' or 'printer_model'
        name_val = preset_data.get("name") or preset_data.get("printer_model")
        if name_val and isinstance(name_val, str):
            results["machine"] = name_val
            
        return results

    def _find_value_recursive(self, data: Any, key: str) -> Optional[Any]:
        if isinstance(data, dict):
            if key in data:
                return data[key]
            for v in data.values():
                res = self._find_value_recursive(v, key)
                if res: return res
        elif isinstance(data, list):
            for item in data:
                res = self._find_value_recursive(item, key)
                if res: return res
        return None

    def merge_presets(self, base: Dict[str, Any], user_diff: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge user_diff into base."""
        merged = base.copy()
        for k, v in user_diff.items():
            if k in merged and isinstance(merged[k], dict) and isinstance(v, dict):
                merged[k] = self.merge_presets(merged[k], v)
            else:
                merged[k] = v
        return merged

    def get_full_preset(self, user_preset: Dict[str, Any], category: str) -> Dict[str, Any]:
        """
        Identify the base profile, fetch it if needed, and merge.
        ONLY applies if user_preset is a non-empty dict containing some content.
        Category is 'printer', 'process', or 'filament'.
        """
        if not user_preset or not isinstance(user_preset, dict) or len(user_preset) <= 1:
            # If it's empty or just has one field like 'name', we don't 'invent' a full profile
            # to avoid tampering with the user's intended limited context.
            return user_preset

        info = self.identify_slicer_and_machine(user_preset)
        
        # If we couldn't even determine the slicer, we certainly don't merge
        if info["slicer"] == "unknown":
            return user_preset

        # Logic to find the 'base' profile
        base_filename = f"generic_{info['slicer']}_{category}.json"
        base_path = os.path.join(self.base_profiles_dir, info["slicer"], category, base_filename)
        
        if os.path.exists(base_path):
            try:
                with open(base_path, 'r', encoding='utf-8') as f:
                    base_data = json.load(f)
                # Deep merge: user_diff overrides base
                return self.merge_presets(base_data, user_preset)
            except Exception as e:
                print(f"[PresetService] Error loading base profile {base_path}: {e}")
        
        return user_preset

preset_inheritance_service = PresetInheritanceService()
