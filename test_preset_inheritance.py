import sys
import os
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.preset_inheritance_service import preset_inheritance_service

def test_identification_and_merge():
    print("--- 1. Testing Bambu Identification ---")
    bambu_sample = {
        "name": "Bambu Lab X1 Carbon 0.4 nozzle",
        "printer_model": "Bambu Lab X1 Carbon",
        "bbscfg": "v1.0"
    }
    info = preset_inheritance_service.identify_slicer_and_machine(bambu_sample)
    print(f"Info: {info}")
    
    # Test merge
    user_diff = {"nozzle_diameter": [0.6]} # User changed nozzle
    merged = preset_inheritance_service.get_full_preset(dict(bambu_sample, **user_diff), "printer")
    print(f"Merged Nozzle: {merged.get('nozzle_diameter')}")
    print(f"Base Param check (bed_shape): {merged.get('bed_shape')}")

    print("\n--- 2. Testing Orca Identification ---")
    orca_sample = {
        "name": "SoftFever A1 mini",
        "orca_printer": "true"
    }
    info = preset_inheritance_service.identify_slicer_and_machine(orca_sample)
    print(f"Info: {info}")
    merged = preset_inheritance_service.get_full_preset(orca_sample, "printer")
    print(f"Base Param check (gcode_flavor): {merged.get('gcode_flavor')}")

    print("\n--- 3. Testing Creality Identification ---")
    creality_sample = {
        "name": "Creality K1",
        "creality_printer": "true"
    }
    info = preset_inheritance_service.identify_slicer_and_machine(creality_sample)
    print(f"Info: {info}")
    merged = preset_inheritance_service.get_full_preset(creality_sample, "printer")
    print(f"Base Param check (printable_area): {merged.get('printable_area')}")

if __name__ == "__main__":
    test_identification_and_merge()
