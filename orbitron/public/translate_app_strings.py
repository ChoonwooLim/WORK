import re
import json
import urllib.request
import os

html_file = "/home/stevenlim/WORK/orbitron/public/app.html"
js_file = "/home/stevenlim/WORK/orbitron/public/js/app.js"

korean_pattern = re.compile(r'[가-힣]+')

strings_to_translate = set()

# Extract from HTML
with open(html_file, "r", encoding="utf-8") as f:
    html_content = f.read()
    # Simple extraction of text between tags or quotes
    matches = re.findall(r'>([^<]+)<', html_content)
    for m in matches:
        if korean_pattern.search(m):
            strings_to_translate.add(m.strip())
    
    # Placeholders
    matches = re.findall(r'placeholder="([^"]+)"', html_content)
    for m in matches:
        if korean_pattern.search(m):
            strings_to_translate.add(m.strip())
            
    # Titles
    matches = re.findall(r'title="([^"]+)"', html_content)
    for m in matches:
        if korean_pattern.search(m):
            strings_to_translate.add(m.strip())

# Extract from JS
with open(js_file, "r", encoding="utf-8") as f:
    js_content = f.read()
    matches = re.findall(r"'([^']+)'", js_content)
    for m in matches:
        if korean_pattern.search(m):
            strings_to_translate.add(m.strip())
            
    matches = re.findall(r'"([^"]+)"', js_content)
    for m in matches:
        if korean_pattern.search(m):
            strings_to_translate.add(m.strip())
            
    matches = re.findall(r'`([^`]+)`', js_content)
    for m in matches:
        # Also could have variables like ${p.name}, let's remove them for translation key matching
        # Wait, the translation replaces exact strings. In JS template literals, 
        # the MutationObserver sees the evaluated string.
        # But we still need the static parts. 
        # For templates we can split by ${
        parts = re.split(r'\$\{.*?\}', m)
        for p in parts:
            if korean_pattern.search(p):
                strings_to_translate.add(p.strip())

strings_list = list(strings_to_translate)
strings_list.sort(key=len, reverse=True) # longest first

print(f"Found {len(strings_list)} strings to translate.")

# Save just in case
with open("extracted_strings.json", "w", encoding="utf-8") as f:
    json.dump(strings_list, f, ensure_ascii=False, indent=2)

print("Saved to extracted_strings.json. Running translation...")

# Translate using Gemini
API_KEY = os.environ.get("GEMINI_API_KEY")

prompt = f"""
Translate the following Korean UI strings into English. 
Provide the result as a raw JSON object where the keys are the exact Korean strings provided, and the values are their English translations.
Make the translation natural for a cloud platform / developer dashboard context.
Strings:
{json.dumps(strings_list, ensure_ascii=False)}

Output EXACTLY passing JSON object and nothing else.
"""

req = urllib.request.Request(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + API_KEY,
    headers={'Content-Type': 'application/json'},
    data=json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "response_mime_type": "application/json"}
    }).encode('utf-8')
)

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        content = res_data['candidates'][0]['content']['parts'][0]['text']
        translated_dict = json.loads(content)
        
        with open("translated_dict.json", "w", encoding="utf-8") as f:
            json.dump(translated_dict, f, ensure_ascii=False, indent=2)
            
        print("Translation successful!")
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
