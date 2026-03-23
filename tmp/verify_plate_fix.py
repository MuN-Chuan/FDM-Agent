
import io
import json
import zipfile
import sys
import os

sys.path.append(os.path.abspath('backend'))
from app.services import threemf_service

def verify_full_repack(path):
    with open(path, 'rb') as f:
        orig = f.read()
    
    # 1. Parse
    settings = threemf_service.parse_3mf(orig)
    
    # 2. Modify layer_height (exists in both project and plate)
    mods = [{"name": "layer_height", "new": "0.15"}]
    modified_settings = threemf_service.apply_modifications(settings, mods)
    
    # 3. Repack
    repacked = threemf_service.repack_3mf(orig, modified_settings)
    
    # 4. Verify
    with zipfile.ZipFile(io.BytesIO(repacked)) as zf:
        # Check Project Settings (Global)
        proj_raw = zf.read("Metadata/project_settings.config")
        proj_data = json.loads(proj_raw)
        print(f"Project layer_height: {proj_data.get('layer_height')}")
        
        # Check Plate Settings (Object override)
        plate_raw = zf.read("Metadata/plate_1.json")
        plate_data = json.loads(plate_raw)
        obj_val = plate_data["bbox_objects"][0].get("layer_height")
        print(f"Plate Object layer_height: {obj_val}")
        
    if proj_data.get('layer_height') == "0.15" and obj_val == 0.15:
        print("VERIFICATION SUCCESS")
    else:
        print("VERIFICATION FAILURE")

if __name__ == "__main__":
    verify_full_repack("test/test.3mf")
