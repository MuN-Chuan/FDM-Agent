
import sys
import os
import io
import json
import zipfile

# Add backend to path to import services
sys.path.append(os.path.abspath("backend"))

from app.services.threemf_service import repack_3mf, apply_modifications

def verify_sync_fix():
    print("Testing Parameter Synchronization Fix...")
    
    # 1. Load original test-2.3mf
    with open("test/test-2.3mf", "rb") as f:
        original_bytes = f.read()
    
    # 2. Extract original settings
    with zipfile.ZipFile(io.BytesIO(original_bytes)) as zf:
        orig_config = json.loads(zf.read("Metadata/project_settings.config").decode("utf-8"))
    
    print(f"Original retraction_speed: {orig_config.get('retraction_speed')}")
    print(f"Original filament_retraction_speed: {orig_config.get('filament_retraction_speed')}")
    
    # 3. Simulate AI modifications (only changing printer-level key)
    modifications = [
        {"name": "retraction_speed", "old": "30", "new": "45", "category": "printer"},
        {"name": "retraction_length", "old": "0.8", "new": "1.2", "category": "printer"},
        {"name": "wipe_distance", "old": "2", "new": "5", "category": "printer"}
    ]
    
    # 4. Apply modifications (triggers sync)
    modified_settings = apply_modifications(orig_config, modifications)
    
    print("\nAfter apply_modifications (Sync check):")
    print(f"Modified retraction_speed: {modified_settings.get('retraction_speed')}")
    print(f"Modified filament_retraction_speed: {modified_settings.get('filament_retraction_speed')}")
    
    # Check if filament_retraction_speed was automatically added to applied list
    applied = modified_settings.get("_ai_modifications_applied", [])
    print(f"Applied keys: {applied}")
    
    assert "filament_retraction_speed" in applied
    assert modified_settings.get("filament_retraction_speed") == ["45"]
    assert modified_settings.get("filament_retraction_length") == ["1.2"]
    assert modified_settings.get("filament_wipe_distance") == ["5"]
    
    # 5. Repack 3MF
    modified_bytes = repack_3mf(original_bytes, modified_settings)
    
    # 6. Verify contents of the new 3MF
    with zipfile.ZipFile(io.BytesIO(modified_bytes)) as zf:
        final_config = json.loads(zf.read("Metadata/project_settings.config").decode("utf-8"))
        
        print("\nFinal 3MF project_settings.config check:")
        print(f"retraction_speed: {final_config.get('retraction_speed')}")
        print(f"filament_retraction_speed: {final_config.get('filament_retraction_speed')}")
        
        assert final_config.get("retraction_speed") == ["45"]
        assert final_config.get("filament_retraction_speed") == ["45"]
        
        # Verify CRLF line endings
        raw_config = zf.read("Metadata/project_settings.config")
        if b"\r\n" in raw_config:
            print("Verified: CRLF line endings preserved.")
        else:
            print("Warning: CRLF line endings missing!")
            
    print("\nSUCCESS: Parameter synchronization and 3MF repacking verified!")

if __name__ == "__main__":
    try:
        verify_sync_fix()
    except Exception as e:
        print(f"Verification FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
