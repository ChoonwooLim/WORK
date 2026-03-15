import urllib.request
import json

API_KEY = "***REDACTED_ANTHROPIC_KEY_ROTATE_IN_CONSOLE***"
API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-3-5-sonnet-20241022"

headers = {
    "x-api-key": API_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
}
data = {
    "model": MODEL,
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello"}]
}
req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
