
import io
import json
import zipfile
import sys
import os

# Add backend to path so we can import app
sys.path.append(os.path.abspath('.'))

from app.services import threemf_service

def test_repro():
    # 1. Create a dummy 3MF content
    settings = {
        "layer_height": ["0.2"],
        "seam_position": ["aligned"],
        "printer_model": "Bambu Lab X1 Carbon"
    }
    
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("Metadata/project_settings.config", json.dumps(settings))
        zf.writestr("3D/3dmodel.model", "<xml>...</xml>")
    
    original_bytes = buf.getvalue()
    
    # 2. Parse it
    parsed_settings = threemf_service.parse_3mf(original_bytes)
    print(f"Parsed settings: {parsed_settings}")
    
    # 3. Apply modifications
    mods = [
        {"name": "layer_height", "new": "0.12", "category": "process"},
        {"name": "seam_position", "new": "rear", "category": "process"}
    ]
    
    modified_settings = threemf_service.apply_modifications(parsed_settings, mods)
    print(f"Modified settings: {modified_settings}")
    
    # 4. Repack
    repacked_bytes = threemf_service.repack_3mf(original_bytes, modified_settings)
    
    # 5. Verify repacked content
    with zipfile.ZipFile(io.BytesIO(repacked_bytes)) as zf:
        new_config_raw = zf.read("Metadata/project_settings.config")
        new_config = json.loads(new_config_raw)
        print(f"Repacked settings in ZIP: {new_config}")
        
    # Check if applied
    assert new_config["layer_height"] == ["0.12"]
    assert new_config["seam_position"] == ["rear"]
    print("Verification SUCCESS: Parameters were modified in the ZIP!")

if __name__ == "__main__":
    try:
        test_repro()
    except Exception as e:
        print(f"Verification FAILED: {e}")
        import traceback
        traceback.print_exc()
