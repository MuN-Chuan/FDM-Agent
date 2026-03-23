
import io
import json
import zipfile
import sys
import os

sys.path.append(os.path.abspath('backend'))
from app.services import threemf_service

def test_real_repack(path):
    if not os.path.exists(path):
        print("File not found!")
        return
        
    with open(path, 'rb') as f:
        original_bytes = f.read()
        
    # 1. Parse
    settings = threemf_service.parse_3mf(original_bytes)
    print(f"Original layer_height: {settings.get('layer_height')}")
    
    # 2. Modify
    mods = [{"name": "layer_height", "new": "0.13"}]
    modified_settings = threemf_service.apply_modifications(settings, mods)
    print(f"Modified layer_height: {modified_settings.get('layer_height')}")
    
    # 3. Repack
    repacked_bytes = threemf_service.repack_3mf(original_bytes, modified_settings)
    
    # 4. Verify
    with zipfile.ZipFile(io.BytesIO(repacked_bytes)) as zf:
        new_raw = zf.read("Metadata/project_settings.config")
        new_data = json.loads(new_raw)
        print(f"Verify in ZIP: {new_data.get('layer_height')}")
        
    if new_data.get('layer_height') == "0.13":
        print("SUCCESS")
    else:
        print("FAILURE")

if __name__ == "__main__":
    test_real_repack("test/test.3mf")
