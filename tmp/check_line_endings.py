
import io
import json
import zipfile
import sys
import os

sys.path.append(os.path.abspath('backend'))
from app.services import threemf_service

def check_line_endings(path):
    with open(path, 'rb') as f:
        orig = f.read()
    
    settings = threemf_service.parse_3mf(orig)
    modified_settings = threemf_service.apply_modifications(settings, [{"name": "layer_height", "new": "0.13"}])
    repacked = threemf_service.repack_3mf(orig, modified_settings)
    
    with zipfile.ZipFile(io.BytesIO(repacked)) as zf:
        new_raw = zf.read("Metadata/project_settings.config")
        print(f"Repacked starts with: {repr(new_raw[:50])}")
        if b'\r\n' in new_raw:
            print("Contains CRLF")
        else:
            print("Contains only LF")

if __name__ == "__main__":
    check_line_endings("test/test.3mf")
