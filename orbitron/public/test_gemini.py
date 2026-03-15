import urllib.request
import json

API_KEY = "AIzaSyDKFAW4XLmCE22e88wkoSVEf0O9TAUcWOo"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"

headers = {
    "Content-Type": "application/json"
}
data = {
    "contents": [{"parts": [{"text": "Hello, translation test"}]}]
}
req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        print("Success!")
        result = json.loads(response.read().decode('utf-8'))
        print(result['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
