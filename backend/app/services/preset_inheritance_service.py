import json
import os
import re
from typing import Dict, Any, Optional, List

class PresetInheritanceService:
    def __init__(self):
        # Resolve project root (4 levels up from backend/app/services/preset_inheritance_service.py)
        self.project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        
        # Base directory for absolute defaults (The Hardcoded Bottom)
        self.absolute_base_dir = os.path.join(
            self.project_root, "backend", "resources", "base_profiles", "absolute_base"
        )
        
        # Source directory for brand/category/specific bases (BambuStudio profiles)
        self.studio_profiles_dir = os.path.join(
            self.project_root, "BambuStudio-master", "resources", "profiles"
        )

        # Slicer Identification Keywords
        self.SLICER_KEYWORDS = {
            "creality": ["creality_printer", "Creality Print"],
            "bambu": ["bbscfg", "Bambu Studio", "BBL"],
            "orca": ["orca_printer", "OrcaSlicer", "SoftFever"]
        }
        
        # Machine Keywords for common brands
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
        """Identify slicer, brand and machine from preset metadata."""
        results = {"slicer": "unknown", "brand": "unknown", "machine": "unknown"}
        preset_str = json.dumps(preset_data)
        
        for slicer, keywords in self.SLICER_KEYWORDS.items():
            if any(kw in preset_str for kw in keywords):
                results["slicer"] = slicer
                break
                
        search_fields = ["printer_model", "name", "from", "inherits", "model_id"]
        extracted_text = ""
        for field in search_fields:
            val = self._find_value_recursive(preset_data, field)
            if val and isinstance(val, str):
                extracted_text += " " + val
                
        for brand, keywords in self.MACHINE_KEYWORDS.items():
            if brand.lower() in extracted_text.lower() or any(kw.lower() in extracted_text.lower() for kw in keywords):
                results["brand"] = brand
                break
                
        name_val = preset_data.get("name") or preset_data.get("printer_model")
        if name_val and isinstance(name_val, str):
            results["machine"] = name_val
            
        return results

    def _find_value_recursive(self, data: Any, key: str) -> Optional[Any]:
        if isinstance(data, dict):
            if key in data: return data[key]
            for v in data.values():
                res = self._find_value_recursive(v, key)
                if res: return res
        elif isinstance(data, list):
            for item in data:
                res = self._find_value_recursive(item, key)
                if res: return res
        return None

    def merge_presets(self, base: Dict[str, Any], user_diff: Dict[str, Any]) -> Dict[str, Any]:
        """Deep merge: user_diff values override base values."""
        merged = base.copy()
        for k, v in user_diff.items():
            if k in merged and isinstance(merged[k], dict) and isinstance(v, dict):
                merged[k] = self.merge_presets(merged[k], v)
            else:
                merged[k] = v
        return merged

    def _get_profile_path(self, name: str, category: str, brand: str = "BBL") -> Optional[str]:
        """Locate a profile JSON file by name within the studio profiles tree."""
        if not name: return None
        if not name.endswith(".json"): name += ".json"
        
        # Priority 1: Brand directory (e.g. BBL/filament/name.json)
        brand_path = os.path.join(self.studio_profiles_dir, brand, category, name)
        if os.path.exists(brand_path): return brand_path
        
        # Priority 2: Relative to category if name is already a partial path
        # (Though usually it's just the filename)
        
        # Priority 3: Search all brands if necessary (sometimes inherits across brands)
        for b in os.listdir(self.studio_profiles_dir):
            if os.path.isdir(os.path.join(self.studio_profiles_dir, b)):
                search_path = os.path.join(self.studio_profiles_dir, b, category, name)
                if os.path.exists(search_path): return search_path
                
        return None

    def _load_inheritance_chain(self, start_data: Dict[str, Any], category: str, brand: str) -> List[Dict[str, Any]]:
        """
        Recursively trace the inheritance chain from top to bottom.
        Returns a list of data dicts ordered from MOST BASE to MOST SPECIFIC.
        """
        chain = [start_data]
        current = start_data
        visited = set()

        while True:
            inherits = current.get("inherits")
            if not inherits or inherits in visited:
                break
            
            visited.add(inherits)
            path = self._get_profile_path(inherits, category, brand)
            if not path:
                # If we can't find the parent in the studio tree, stop
                break
                
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    current = json.load(f)
                    chain.append(current)
            except Exception as e:
                print(f"[PresetService] Error loading inherited profile {inherits}: {e}")
                break
        
        # Add the 'Absolute Base' at the very bottom
        abs_base_name = f"{category}_base.json"
        abs_base_path = os.path.join(self.absolute_base_dir, abs_base_name)
        if os.path.exists(abs_base_path):
            try:
                with open(abs_base_path, 'r', encoding='utf-8') as f:
                    abs_base = json.load(f)
                    chain.append(abs_base)
            except: pass

        # Return reversed so it's Bottom -> Top
        return list(reversed(chain))

    def get_full_preset(self, user_preset: Dict[str, Any], category: str) -> Dict[str, Any]:
        """Generate a complete preset by merging along the inheritance chain."""
        if not user_preset or not isinstance(user_preset, dict):
            return user_preset

        info = self.identify_slicer_and_machine(user_preset)
        brand_dir = "BBL" # Default to BBL for BambuStudio based slicers
        
        # Map detected brand to directory name if possible
        if "creality" in info["brand"].lower(): brand_dir = "Creality"
        elif "anycubic" in info["brand"].lower(): brand_dir = "Anycubic"
        
        # 1. Load the full chain (Absolute -> Common -> Category -> Specific -> User)
        chain = self._load_inheritance_chain(user_preset, category, brand_dir)
        
        # 2. Iterative deep merge
        result = {}
        for layer in chain:
            result = self.merge_presets(result, layer)
            
        return result

preset_inheritance_service = PresetInheritanceService()
