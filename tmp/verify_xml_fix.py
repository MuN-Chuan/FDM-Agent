
import io
import json
import zipfile
import sys
import os
import xml.etree.ElementTree as ET

sys.path.append(os.path.abspath('backend'))
from app.services import threemf_service

def verify_xml_repack(path):
    with open(path, 'rb') as f:
        orig = f.read()
    
    # 1. Parse
    settings = threemf_service.parse_3mf(orig)
    
    # 2. Modify layer_height (exists in model_settings.config as 0.28)
    mods = [{"name": "layer_height", "new": "0.12"}]
    modified_settings = threemf_service.apply_modifications(settings, mods)
    
    # 3. Repack
    repacked = threemf_service.repack_3mf(orig, modified_settings)
    
    # 4. Verify
    with zipfile.ZipFile(io.BytesIO(repacked)) as zf:
        # Check Project Settings (Global)
        proj_raw = zf.read("Metadata/project_settings.config")
        proj_data = json.loads(proj_raw)
        print(f"Project layer_height: {proj_data.get('layer_height')}")
        
        # Check Model Settings (XML Override)
        xml_raw = zf.read("Metadata/model_settings.config")
        root = ET.fromstring(xml_raw)
        # Find the metadata for layer_height
        found_val = None
        for meta in root.findall(".//metadata"):
            if meta.get("key") == "layer_height":
                found_val = meta.get("value")
                print(f"XML Metadata layer_height: {found_val}")
        
    if proj_data.get('layer_height') == "0.12" and found_val == "0.12":
        print("VERIFICATION SUCCESS (XML)")
    else:
        print(f"VERIFICATION FAILURE: Project={proj_data.get('layer_height')}, XML={found_val}")

if __name__ == "__main__":
    verify_xml_repack("test/test-2.3mf")
