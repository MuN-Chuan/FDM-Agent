
import zipfile
import json

def analyze_plate_json(path):
    with zipfile.ZipFile(path, 'r') as zf:
        raw = zf.read("Metadata/plate_1.json")
        data = json.loads(raw.decode('utf-8'))
        
        print("--- PLATE_1.JSON KEYS ---")
        print(list(data.keys()))
        
        # Search for any key that looks like a slicer parameter
        # Typically these are nested or at top level
        for k, v in data.items():
            if isinstance(v, (str, int, float, list)):
                print(f"{k}: {v}")
            elif isinstance(v, dict):
                print(f"{k}: (dict with {len(v)} keys)")

        # Deep search for layer_height as substring
        raw_str = raw.decode('utf-8')
        if "layer_height" in raw_str:
            print("FOUND 'layer_height' in raw string of plate_1.json")
            # Find context
            idx = raw_str.find("layer_height")
            print(f"Context: {raw_str[idx-20:idx+50]}")

if __name__ == "__main__":
    analyze_plate_json("test/test.3mf")
