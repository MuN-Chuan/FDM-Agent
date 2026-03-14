import json
import os
import re
from typing import Dict, Any, Optional, List

class PresetInheritanceService:
    def __init__(self):
        self.base_profiles_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "resources", "base_profiles"
        )
        os.makedirs(self.base_profiles_dir, exist_ok=True)
        
        # Slicer Identification Keywords
        self.SLICER_KEYWORDS = {
            "creality": ["creality_printer", "Creality Print", "Creality"],
            "bambu": ["bbscfg", "Bambu Studio", "BBL"],
            "orca": ["orca_printer", "OrcaSlicer", "SoftFever", "Orca"]
        }
        
        # Registry Mapping: slicer -> registry_filename
        self.REGISTRY_FILES = {
            "bambu": "BBL.json",
            "creality": "Creality.json",
            "orca": "SoftFever.json"
        }
        
        self.registries = {}
        self._load_all_registries()

    def _load_all_registries(self):
        for slicer, filename in self.REGISTRY_FILES.items():
            path = os.path.join(self.base_profiles_dir, slicer, filename)
            if os.path.exists(path):
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        self.registries[slicer] = json.load(f)
                except Exception as e:
                    print(f"[PresetService] Error loading registry {path}: {e}")

    def identify_slicer_and_machine(self, preset_data: Dict[str, Any]) -> Dict[str, str]:
        results = {"slicer": "unknown", "brand": "unknown", "machine": "unknown"}
        preset_str = json.dumps(preset_data)
        
        # 1. Identify Slicer
        for slicer, keywords in self.SLICER_KEYWORDS.items():
            if any(kw in preset_str for kw in keywords):
                results["slicer"] = slicer
                break
        
        # 2. Extract specific machine/name
        results["machine"] = preset_data.get("name") or preset_data.get("printer_model") or "unknown"
        return results

    def _find_in_registry(self, slicer: str, name: str, category: str) -> Optional[str]:
        """Find the sub_path for a given preset name in the brand registry."""
        registry = self.registries.get(slicer)
        if not registry:
            return None
            
        list_key = f"{category}_list" if category != "printer" else "machine_model_list"
        if category == "printer" and "machine_list" in registry:
            # Check machine_list first for specific instances, then model_list
            for item in registry.get("machine_list", []):
                if item.get("name") == name: return item.get("sub_path")

        for item in registry.get(list_key, []):
            if item.get("name") == name:
                return item.get("sub_path")
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

    def get_full_preset(self, user_preset: Dict[str, Any], category: str, slicer: Optional[str] = None, depth: int = 0) -> Dict[str, Any]:
        """
        Recursively reconstruct the full preset by following the 'inherits' chain.
        """
        if depth > 10: return user_preset # Prevention of circular inheritance
        
        if not user_preset or not isinstance(user_preset, dict):
            return user_preset

        inherits_name = user_preset.get("inherits")
        if not inherits_name:
            return user_preset

        # Identify slicer once, prefer hint if provided
        if not slicer or slicer == "unknown":
            info = self.identify_slicer_and_machine(user_preset)
            slicer = info["slicer"]
        
        # Try to find parent in registry
        parent_data = {}
        parent_sub_path = None
        
        if slicer != "unknown":
            parent_sub_path = self._find_in_registry(slicer, inherits_name, category)
        
        # If not in registry, maybe it's a "common" file reference
        if not parent_sub_path:
            # Check common folder
            common_path = os.path.join(self.base_profiles_dir, "common", f"{inherits_name}.json")
            if os.path.exists(common_path):
                parent_sub_path = os.path.join("..", "common", f"{inherits_name}.json")

        if parent_sub_path:
            # Resolve the actual file path
            if slicer != "unknown" and not parent_sub_path.startswith(".."):
                base_path = os.path.join(self.base_profiles_dir, slicer, parent_sub_path)
            else:
                # If it's relative with .. or slicer is unknown, it's already a relative path from base_profiles_dir
                # But wait, if it's in 'common', we can just use the absolute path we already found
                if not parent_sub_path.startswith(".."):
                    base_path = os.path.join(self.base_profiles_dir, parent_sub_path)
                else:
                    # Resolve relative path
                    base_path = os.path.abspath(os.path.join(self.base_profiles_dir, slicer if slicer != "unknown" else "", parent_sub_path))
                
            if os.path.exists(base_path):
                try:
                    with open(base_path, 'r', encoding='utf-8') as f:
                        parent_raw = json.load(f)
                    # Recursively get parent's full content
                    parent_data = self.get_full_preset(parent_raw, category, slicer=slicer, depth=depth + 1)
                except Exception as e:
                    print(f"[PresetService] Error loading parent {inherits_name} from {base_path}: {e}")

        if parent_data:
            return self.merge_presets(parent_data, user_preset)
        
        return user_preset

preset_inheritance_service = PresetInheritanceService()

preset_inheritance_service = PresetInheritanceService()
