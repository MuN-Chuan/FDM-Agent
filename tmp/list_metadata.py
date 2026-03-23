
import zipfile

def list_metadata(path):
    with zipfile.ZipFile(path, 'r') as zf:
        for name in zf.namelist():
            if name.startswith("Metadata/") and (name.endswith(".config") or name.endswith(".xml") or name.endswith(".json")):
                print(f"File: {name}")
                content = zf.read(name).decode('utf-8', errors='ignore')
                print(f"Content (first 200 chars): {content[:200]}")
                print("-" * 20)

if __name__ == "__main__":
    list_metadata("test/test.3mf")
