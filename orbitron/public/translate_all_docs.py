import urllib.request
import json
import os
import glob
import time

API_KEY = "***REDACTED_ANTHROPIC_KEY_ROTATE_IN_CONSOLE***"
API_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-3-5-sonnet-20241022"

src_dir = '/home/stevenlim/WORK/orbitron/public/docs-content'
dst_dir = '/home/stevenlim/WORK/orbitron/public/docs-content-en'

os.makedirs(dst_dir, exist_ok=True)

def translate_markdown(content):
    prompt = "Translate the following Korean markdown document into natural, professional English suitable for a SaaS/PaaS documentation site. IMPORTANT: Preserve all markdown formatting exactly as it is (headers, bolding, code blocks, lists, links, HTML tags, etc.). Do NOT add any extra conversational text outside of the translation itself. Here is the document:\n\n" + content
    
    headers = {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    data = {
        "model": MODEL,
        "max_tokens": 8192,
        "system": "You are a professional technical translator specializing in Cloud/PaaS documentation.",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=headers)
    
    max_retries = 3
    for _ in range(max_retries):
        try:
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result['content'][0]['text'].strip()
        except Exception as e:
            time.sleep(2)
            print(f"Error during translation, retrying: {e}")
    return content # Fallback to original if completely fails

files = glob.glob(os.path.join(src_dir, '*.md'))
for path in files:
    filename = os.path.basename(path)
    dst_path = os.path.join(dst_dir, filename)
    
    if os.path.exists(dst_path) and os.path.getsize(dst_path) > 0:
        continue # Skip already generated files
        
    print(f"Translating {filename}...")
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    translated_content = translate_markdown(content)
    
    with open(dst_path, 'w', encoding='utf-8') as f:
        f.write(translated_content)
        
print("All translations complete.")
