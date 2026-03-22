import asyncio
import httpx
import json
import os
from pathlib import Path

BASE_URL = "http://localhost:8000"
TEST_FILE = Path(r"c:\Users\27822\Documents\FDM_AI_WEB\test\test.3mf")

async def test_3mf_workflow():
    if not TEST_FILE.exists():
        print(f"Error: Test file not found at {TEST_FILE}")
        return

    print("=== Testing 3MF Upload and Parse ===")
    async with httpx.AsyncClient() as client:
        try:
            # 1. Upload and Parse
            with open(TEST_FILE, "rb") as f:
                files = {"file": ("test.3mf", f, "application/octet-stream")}
                response = await client.post(f"{BASE_URL}/api/slicer/parse-3mf", files=files)
            
            if response.status_code != 200:
                print(f"Parse API failed: {response.status_code}")
                print(response.text)
                return
                
            parse_result = response.json()
            job_id = parse_result.get("job_id")
            
            print(f"Success! Job ID: {job_id}")
            print("Summary:")
            print(json.dumps(parse_result.get("summary", {}), indent=2, ensure_ascii=False))

            # 2. Modify
            print("\n=== Testing 3MF Modify ===")
            modify_req = {
                "job_id": job_id,
                "modifications": [
                    {"name": "layer_height", "new": 0.16, "category": "process"}
                ],
                "repack_only": True
            }
            
            response = await client.post(f"{BASE_URL}/api/slicer/modify-3mf", json=modify_req)
            if response.status_code != 200:
                print(f"Modify API failed: {response.status_code}")
                print(response.text)
                return
                
            modify_result = response.json()
            print(f"Modify Status: {modify_result.get('status')}")
            
            if modify_result.get("status") == "done":
                # 3. Download
                print("\n=== Testing 3MF Download ===")
                response = await client.get(f"{BASE_URL}/api/slicer/download-3mf/{job_id}")
                if response.status_code == 200:
                    out_file = Path("test_modified.3mf")
                    out_file.write_bytes(response.content)
                    print(f"Success! Downloaded modified file to {out_file.absolute()}")
                    print(f"File size: {out_file.stat().st_size} bytes")
                else:
                    print(f"Download failed: {response.status_code}")
                
        except httpx.ConnectError:
            print(f"Error: Could not connect to {BASE_URL}. Is the backend running?")
            
if __name__ == "__main__":
    asyncio.run(test_3mf_workflow())
