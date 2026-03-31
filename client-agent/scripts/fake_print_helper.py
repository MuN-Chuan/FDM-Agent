import os
import sys
import json
import zipfile
import argparse
import http.client
import urllib.parse
from pathlib import Path

def create_3mf(gcode_content, output_path):
    """
    Creates a minimal .gcode.3mf file.
    A .gcode.3mf is essentially a ZIP file containing the G-code in Metadata/plate_1.gcode.
    """
    with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_STORED) as zip_file:
        # Bambu printers expect the G-code in this specific path within the ZIP
        zip_file.writestr('Metadata/plate_1.gcode', gcode_content)

def get_upload_url(access_token, region, filename, size):
    """
    Calls the Bambu Cloud API to get a presigned OSS upload URL.
    """
    host = "api.bambulab.cn" if region == "cn" else "api.bambulab.com"
    conn = http.client.HTTPSConnection(host)
    
    params = urllib.parse.urlencode({
        'filename': filename,
        'size': size
    })
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'User-Agent': 'BambuStudio/01.08.03.89',
        'Accept': 'application/json'
    }
    
    conn.request("GET", f"/v1/iot-service/api/user/upload?{params}", headers=headers)
    response = conn.getresponse()
    data = response.read().decode()
    conn.close()
    
    if response.status >= 400:
        raise Exception(f"Failed to get upload URL: {response.status} {data}")
        
    return json.loads(data)

def upload_file(upload_url, file_path):
    """
    Uploads the file to the presigned OSS URL using a PUT request.
    """
    parsed_url = urllib.parse.urlparse(upload_url)
    host = parsed_url.netloc
    path = parsed_url.path
    if parsed_url.query:
        path += "?" + parsed_url.query
        
    conn = http.client.HTTPSConnection(host)
    
    with open(file_path, 'rb') as f:
        file_content = f.read()
        
    # Standard S3/OSS PUT upload
    # Some S3 implementations are picky about headers, but User-Agent is usually safe
    headers = {
        'Content-Length': str(len(file_content)),
        'User-Agent': 'BambuStudio/01.08.03.89'
    }
    
    conn.request("PUT", path, body=file_content, headers=headers)
    response = conn.getresponse()
    status = response.status
    data = response.read().decode()
    conn.close()
    
    if status >= 400:
        raise Exception(f"Upload failed: {status} {data}")
        
    return True

def verify_token(access_token, region):
    """
    Verifies if the access token is valid by fetching the user profile.
    """
    host = "api.bambulab.cn" if region == "cn" else "api.bambulab.com"
    conn = http.client.HTTPSConnection(host)
    headers = {
        'Authorization': f'Bearer {access_token}',
        'User-Agent': 'BambuStudio/01.08.03.89'
    }
    conn.request("GET", "/v1/user-service/my/profile", headers=headers)
    response = conn.getresponse()
    data = response.read().decode()
    conn.close()
    
    if response.status >= 400:
        raise Exception(f"Token verification failed (HTTP {response.status}): {data}")
    return json.loads(data)

def main():
    parser = argparse.ArgumentParser(description='Bambu Fake Print Helper')
    parser.add_argument('--token', required=True, help='Bambu Cloud Access Token')
    parser.add_argument('--region', default='cn', help='region (cn or global)')
    parser.add_argument('--model', default='P1S', help='Printer model name')
    
    args = parser.parse_args()
    
    # Read G-code from stdin
    gcode_content = sys.stdin.read()
    if not gcode_content:
        print(json.dumps({"success": False, "error": "No G-code received via stdin"}))
        sys.exit(1)
        
    temp_dir = os.environ.get('TEMP') or os.environ.get('TMP') or "."
    temp_3mf = os.path.join(temp_dir, f"temp_task_{os.getpid()}.3mf")
    filename = "print_task.3mf"
    
    try:
        # 0. Verify Token
        verify_token(args.token, args.region)
        
        # 1. Create the 3MF
        create_3mf(gcode_content, temp_3mf)

        file_size = os.path.getsize(temp_3mf)
        
        # 2. Get Upload URL
        upload_info = get_upload_url(args.token, args.region, filename, file_size)
        
        # Some Bambu APIs wrap the response in a 'data' field
        data_block = upload_info.get('data', upload_info) if isinstance(upload_info, dict) else upload_info

        # The API can return a direct upload_url or an array of urls (new format)
        upload_url = data_block.get('upload_url')
        if not upload_url and 'urls' in data_block:
            # Sort or find the most appropriate URL
            # Usually 'filename' type is the main content upload
            for item in data_block['urls']:
                if item.get('type') == 'filename':
                    upload_url = item.get('url')
                    break
            # Fallback to first URL if 'filename' type not found but list is not empty
            if not upload_url and len(data_block['urls']) > 0:
                upload_url = data_block['urls'][0].get('url')
        
        if not upload_url:
             # Include the raw response in the error message so it's captured by Node.js
             error_ctx = json.dumps(upload_info)
             suggestion = "Token might be invalid or region mismatch."
             if "urls" in data_block and not data_block["urls"]:
                 suggestion = "The API returned zero upload slots. Check if your account is logged in correctly to the right region (China vs Global)."
             raise Exception(f"Could not find upload_url in response. {suggestion} Structure: {error_ctx}")
             
        # 3. Upload
        upload_file(upload_url, temp_3mf)
        
        # 4. Success - Output JSON for Node processing
        result = {
            "success": True,
            "url": data_block.get('url') or data_block.get('file_url') or data_block.get('file_id'),
            "file_id": data_block.get('file_id'),
            "filename": filename
        }
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
    finally:
        if os.path.exists(temp_3mf):
            os.remove(temp_3mf)

if __name__ == "__main__":
    main()
