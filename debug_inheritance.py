import os
import sys
import json

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.services.preset_inheritance_service import preset_inheritance_service

def debug_inheritance():
    results = []
    
    # 1. Test Slicer Identification
    bambu_preset = {"name": "Test", "setting_id": "bbscfg_test"}
    info = preset_inheritance_service.identify_slicer_and_machine(bambu_preset)
    results.append(f"Slicer Identification (Bambu): {info['slicer']}")
    
    # 2. Test Multi-Level Inheritance (Filament)
    user_filament = {
        "name": "My Custom PLA",
        "inherits": "Generic PLA @BBL X1C",
        "nozzle_temperature": [220]
    }
    
    full_filament = preset_inheritance_service.get_full_preset(user_filament, "filament", slicer="bambu")
    
    results.append("\n--- Filament Inheritance Result ---")
    results.append(f"Bed Temp: {full_filament.get('hot_plate_temp')} (Expected: [60])")
    results.append(f"Nozzle Temp: {full_filament.get('nozzle_temperature')} (Expected: [220])")
    
    # 3. Test Process Inheritance
    user_process = {
        "name": "0.20mm My Custom",
        "inherits": "0.20mm Standard @BBL X1C",
        "wall_loops": 4
    }
    
    full_process = preset_inheritance_service.get_full_preset(user_process, "process", slicer="bambu")
    
    results.append("\n--- Process Inheritance Result ---")
    results.append(f"Layer Height: {full_process.get('layer_height')} (Expected: 0.2)")
    results.append(f"Wall Loops: {full_process.get('wall_loops')} (Expected: 4)")
    results.append(f"Infill: {full_process.get('sparse_infill_density')} (Expected: 15%)")
    
    # Write to file
    with open("debug_results.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(results))

if __name__ == "__main__":
    debug_inheritance()
