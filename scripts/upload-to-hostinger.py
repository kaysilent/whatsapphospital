import os
import sys
import requests

UPLOAD_URL = "https://srv1825-files.hstgr.io/rest/828c05dea715df80/api/tus/public_html"
AUTH_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjoxLCJsb2NhbGUiOiJlbl9VUyIsInZpZXdNb2RlIjoibGlzdCIsInNpbmdsZUNsaWNrIjpmYWxzZSwicmVkaXJlY3RBZnRlckNvcHlNb3ZlIjpmYWxzZSwicGVybSI6eyJhZG1pbiI6ZmFsc2UsImV4ZWN1dGUiOmZhbHNlLCJjcmVhdGUiOnRydWUsInJlbmFtZSI6dHJ1ZSwibW9kaWZ5Ijp0cnVlLCJkZWxldGUiOnRydWUsInNoYXJlIjpmYWxzZSwiZG93bmxvYWQiOnRydWV9LCJjb21tYW5kcyI6W10sImxvY2tQYXNzd29yZCI6dHJ1ZSwiaGlkZURvdGZpbGVzIjpmYWxzZSwiZGF0ZUZvcm1hdCI6ZmFsc2UsInVzZXJuYW1lIjoidTc5MzQzMTQzMyIsImFjZUVkaXRvclRoZW1lIjoiIn0sImlzcyI6IkZpbGUgQnJvd3NlciIsImV4cCI6MTc5MTUwNzE5NiwiaWF0IjoxNzkxNDg1NTk2fQ.ROzHUpJ6aZCFDPYMpg0FbzBLAKazHnAB5vnMAAu4q_8"
REST_AUTH_KEY = "85d18cb1f9e2e42b21428d7ddde3b0b1c686ff392c2a5566efe02da611e9af00-828c05dea715df80"
FILE_PATH = "whatsapphospital-deploy.zip"
TARGET_NAME = "whatsapphospital-deploy.zip"

if not os.path.exists(FILE_PATH):
    print(f"File {FILE_PATH} not found!")
    sys.exit(1)

size = os.path.getsize(FILE_PATH)
print(f"Uploading {FILE_PATH} (size: {size} bytes)...")

target_url = f"{UPLOAD_URL}/{TARGET_NAME}?override=true"

headers_post = {
    "X-Auth": AUTH_KEY,
    "X-Auth-Rest": REST_AUTH_KEY,
    "Tus-Resumable": "1.0.0",
    "Upload-Length": str(size),
    "Upload-Offset": "0"
}

print(f"Step 1: POST to {target_url}...")
resp_post = requests.post(target_url, headers=headers_post)
print(f"POST response: {resp_post.status_code}")
if resp_post.status_code not in [200, 201, 204]:
    print(f"POST failed: {resp_post.text}")
    sys.exit(1)

headers_patch = {
    "X-Auth": AUTH_KEY,
    "X-Auth-Rest": REST_AUTH_KEY,
    "Tus-Resumable": "1.0.0",
    "Content-Type": "application/offset+octet-stream",
    "Upload-Offset": "0"
}

print(f"Step 2: PATCH bytes to {target_url}...")
with open(FILE_PATH, "rb") as f:
    data = f.read()

resp_patch = requests.patch(target_url, headers=headers_patch, data=data)
print(f"PATCH response: {resp_patch.status_code}")
if resp_patch.status_code in [200, 204]:
    print("SUCCESS: Upload completed successfully!")
else:
    print(f"PATCH failed: {resp_patch.text}")
    sys.exit(1)
