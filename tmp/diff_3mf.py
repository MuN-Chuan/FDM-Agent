
import io
import json
import zipfile
import sys
import os

sys.path.append(os.path.abspath('backend'))
from app.services import threemf_service

def diff_3mf(original_path):
    with open(original_path, 'rb') as f:
        orig = f.read()
    
    settings = threemf_service.parse_3mf(orig)
    
    # 1. Create modifications
    mods = [
        {"name": "nozzle_temperature", "new": "235", "category": "filament"},
        {"name": "sparse_infill_density", "new": "15%", "category": "process"}
    ]
    
    # 2. Apply and repack
    modified_settings = threemf_service.apply_modifications(settings, mods)
    repacked = threemf_service.repack_3mf(orig, modified_settings)
    
    # 3. Read back from repacked
    with zipfile.ZipFile(io.BytesIO(repacked)) as zf:
        new_config_raw = zf.read("Metadata/project_settings.config")
        new_config = json.loads(new_config_raw)
        
    print("--- DIFF REPORT ---")
    for m in mods:
        name = m["name"]
        old_val = settings.get(name)
        new_val = new_config.get(name)
        print(f"Param: {name}")
        print(f"  Original in file: {old_val}")
        print(f"  Expected: {m['new']}")
        print(f"  Found in repacked: {new_val}")
        if str(new_val) == str(m['new']):
            print("  MATCH: SUCCESS")
        else:
            print("  MISMATCH: FAILURE")

if __name__ == "__main__":
    diff_3mf("test/test.3mf")
