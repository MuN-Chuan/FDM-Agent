
import json
import zipfile

def dump_keys(path):
    with zipfile.ZipFile(path, 'r') as zf:
        raw = zf.read("Metadata/project_settings.config")
        data = json.loads(raw.decode('utf-8'))
        keys = list(data.keys())
        print(f"First 100 Keys: {keys[:100]}")
        
        # Check for specific keys the user mentioned or AI might use
        important_keys = ["layer_height", "seam_position", "wall_loops"]
        for k in important_keys:
            found = [key for key in keys if key.lower() == k.lower()]
            print(f"Search for '{k}': {found}")

if __name__ == "__main__":
    dump_keys("test/test.3mf")
