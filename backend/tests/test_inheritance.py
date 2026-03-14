import os
import sys
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.preset_inheritance_service import preset_inheritance_service

def test_inheritance():
    print("--- Starting Inheritance Tests ---")
    
    # 1. Test Slicer Identification
    bambu_preset = {"name": "Test", "setting_id": "bbscfg_test"}
    info = preset_inheritance_service.identify_slicer_and_machine(bambu_preset)
    print(f"Slicer Identification (Bambu): {info['slicer']} (Expected: bambu)")
    
    # 2. Test Multi-Level Inheritance
    # User -> Registry (Generic PLA) -> Common (fdm_filament_common)
    user_filament = {
        "name": "My Custom PLA",
        "inherits": "Generic PLA @BBL X1C",
        "nozzle_temperature": [220]
    }
    
    full_preset = preset_inheritance_service.get_full_preset(user_filament, "filament", slicer="bambu")
    
    print("\n--- Inheritance Result ---")
    print(f"Final Name: {full_preset.get('name')}")
    print(f"Inherited Temperature (Common): {full_preset.get('bed_temperature')} (Expected: [60])")
    print(f"Overridden Temperature (User): {full_preset.get('nozzle_temperature')} (Expected: [220])")
    print(f"Inherited Fan (Common): {full_preset.get('fan_speed')} (Expected: 100)")
    
    # Check if we successfully traversed to common
    success = (full_preset.get('bed_temperature') == [60] and 
               full_preset.get('nozzle_temperature') == [220] and
               full_preset.get('fan_speed') == 100)
               
    if success:
        print("\n✅ Inheritance test PASSED")
    else:
        print("\n❌ Inheritance test FAILED")

if __name__ == "__main__":
    test_inheritance()
