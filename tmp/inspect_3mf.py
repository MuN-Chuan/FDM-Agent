
import io
import json
import zipfile
import sys
import os

sys.path.append(os.path.abspath('backend'))

def inspect_3mf(path):
    print(f"Inspecting: {path}")
    if not os.path.exists(path):
        print("File not found!")
        return
        
    with zipfile.ZipFile(path, 'r') as zf:
        namelist = zf.namelist()
        print(f"Files in ZIP: {namelist[:10]}...")
        
        config_path = "Metadata/project_settings.config"
        if config_path in namelist:
            raw = zf.read(config_path)
            try:
                data = json.loads(raw.decode('utf-8'))
                print(f"Total keys in config: {len(data)}")
                print(f"Sample keys: {list(data.keys())[:15]}")
                
                # Check for common keys
                search_keys = ["layer_height", "seam_position", "wall_loops"]
                for k in search_keys:
                    print(f"  {k}: {data.get(k)}")
            except Exception as e:
                print(f"Failed to parse config: {e}")
        else:
            print(f"MISSING: {config_path}")

if __name__ == "__main__":
    inspect_3mf("test/test.3mf")
