
import io
import json
import zipfile
import sys
import os

def check_types(path):
    with zipfile.ZipFile(path, 'r') as zf:
        raw = zf.read("Metadata/project_settings.config")
        data = json.loads(raw.decode('utf-8'))
        
        for k in ["layer_height", "seam_position", "wall_loops"]:
            v = data.get(k)
            print(f"{k}: {v} ({type(v)})")

if __name__ == "__main__":
    check_types("test/test.3mf")
