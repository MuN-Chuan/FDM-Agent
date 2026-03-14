import re
import json
import os

def extract_params(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    params = []
    current_param = None

    # Regex for add and add_nullable
    add_re = re.compile(r'this->add(?:_nullable)?\("([^"]+)",\s*([^)]+)\)')
    category_re = re.compile(r'def->category\s*=\s*(?:L\()?"([^"]+)"\)?')
    mode_re = re.compile(r'def->mode\s*=\s*(\w+)')
    tech_re = re.compile(r'def->printer_technology\s*=\s*(\w+)')
    
    # Matching default value is complex due to nested braces/parentheses. 
    # Let's use a simpler approach for the extraction script.
    default_re = re.compile(r'def->set_default_value\s*\(\s*new\s+ConfigOption\w+(?:<[^>]+>)?\s*[({](.*?)[)}]\s*\)', re.DOTALL)

    lines = content.split('\n')
    for i, line in enumerate(lines):
        match = add_re.search(line)
        if match:
            if current_param:
                params.append(current_param)
            current_param = {
                "key": match.group(1),
                "type": match.group(2),
                "category": None,
                "mode": "comSimple",
                "tech": "ptAny",
                "default": None,
                "label": None
            }
            continue
        
        if current_param:
            m = category_re.search(line)
            if m:
                current_param["category"] = m.group(1)
            
            m = mode_re.search(line)
            if m:
                current_param["mode"] = m.group(1)
            
            m = tech_re.search(line)
            if m:
                current_param["tech"] = m.group(1)
            
            m = default_re.search(line)
            if m:
                val = m.group(1).strip()
                # Remove L() macro
                val = re.sub(r'L\("([^"]+)"\)', r'\1', val)
                # Remove quotes
                val = val.strip('"')
                # Fix float suffixes: only 0.4f -> 0.4, not false -> alse
                val = re.sub(r'(\d+\.\d*)f', r'\1', val)
                current_param["default"] = val

    if current_param:
        params.append(current_param)
    
    return params

file_path = r"c:\Users\27822\Documents\FDM_AI_WEB\BambuStudio-master\src\libslic3r\PrintConfig.cpp"
all_params = extract_params(file_path)

filament_categories = ["Filament", "Cooling", "Temperature", "Material"]
# Process categories are usually related to print quality and geometry
process_categories = [
    "Layers and Perimeters", "Infill", "Support", "Speed", "Quality", 
    "Strength", "Brim", "Skirt", "Extrusion Width", "Advanced", "Others"
]
# Machine/Printer categories
printer_categories = ["Machine", "G-code", "Extruder", "Nozzle"]

filament_all = {}
process_all = {}
printer_all = {}

def clean_val(val):
    if val is None: return ""
    # Map Boolean strings
    if val.lower() == "true": return True
    if val.lower() == "false": return False
    
    # Map L("...")
    val = re.sub(r'L\("([^"]+)"\)', r'\1', val)
    # Remove quotes
    val = val.strip('"')
    
    # Map FloatOrPercent(10, true) -> "10%"
    m = re.match(r'FloatOrPercent\(([^,]+),\s*true\)', val)
    if m: return f"{m.group(1)}%"
    m = re.match(r'FloatOrPercent\(([^,]+),\s*false\)', val)
    if m: return m.group(1)
    
    # Map Vec2d(x, y) -> [x, y]
    m = re.match(r'Vec2d\(([^,]+),\s*([^)]+)\)', val)
    if m: 
        try: return [float(m.group(1)), float(m.group(2))]
        except: return val
    
    # Map (int) Casts
    val = re.sub(r'\(int\)\s*', '', val)
    
    return val

# Filter for User-Facing
for p in all_params:
    if p["mode"] == "comDevelop":
        continue
    if p["tech"] == "ptSLA":
        continue
    
    key = p["key"]
    # Filter out CLI-only flags which usually don't have a category or clear label
    if not p["category"] and p["mode"] == "comSimple" and key in ["help", "info", "debug", "version"]:
        continue

    val = clean_val(p["default"])
    cat = p["category"]
    
    if cat in filament_categories or key.startswith("filament_") or "nozzle_temperature" in key:
        filament_all[key] = val
    elif cat in printer_categories or "gcode" in key or "nozzle_" in key or "bed_" in key or "printer_" in key:
        printer_all[key] = val
    elif cat in process_categories or p["mode"] in ["comSimple", "comAdvanced"]:
        # Only include if it has a category or is a known print param
        if p["category"] or p["mode"] != "comSimple":
             process_all[key] = val
    else:
        # Final safety check for process
        if p["category"]:
            process_all[key] = val

# Save results with canonical names
output_dir = r"c:\Users\27822\Documents\FDM_AI_WEB\预设文件\底层预设"
with open(os.path.join(output_dir, "filament", "filament_base.json"), "w", encoding='utf-8') as f:
    json.dump(filament_all, f, indent=4, ensure_ascii=False)
with open(os.path.join(output_dir, "process", "process_base.json"), "w", encoding='utf-8') as f:
    json.dump(process_all, f, indent=4, ensure_ascii=False)
with open(os.path.join(output_dir, "printer", "printer_base.json"), "w", encoding='utf-8') as f:
    json.dump(printer_all, f, indent=4, ensure_ascii=False)

print(f"Final Cleaned Count - Filament: {len(filament_all)}, Process: {len(process_all)}")
