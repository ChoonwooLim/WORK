import urllib.request
import urllib.error
import json
import os
import glob
import time
import sys

API_KEY = "AIzaSyDKFAW4XLmCE22e88wkoSVEf0O9TAUcWOo"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={API_KEY}"

src_dir = '/home/stevenlim/WORK/orbitron/public/docs-content'
dst_dir = '/home/stevenlim/WORK/orbitron/public/docs-content-en'

with open('translation_errors.log', 'w') as f:
    f.write('Starting translation script...\n')

def log_error(msg):
    with open('translation_errors.log', 'a') as f:
        f.write(msg + '\n')
    print(msg)

def translate_markdown(content):
    prompt = "Translate the following Korean markdown technical document into natural, professional English suitable for a SaaS/PaaS documentation site. IMPORTANT: Preserve all markdown formatting exactly as it is (headers, bolding, code blocks, lists, links, HTML tags, frontmatter, etc.). Do NOT add any extra conversational text like 'Here is the translation' outside of the translation itself. Provide ONLY the translated markdown content. Here is the document:\n\n" + content
    
    headers = {
        "Content-Type": "application/json"
    }
    
    data = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2}
    }
    
    req = urllib.request.Request(API_URL, data=json.dumps(data).encode('utf-8'), headers=headers)
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                result = json.loads(response.read().decode('utf-8'))
                return result['candidates'][0]['content']['parts'][0]['text'].strip(), True
        except urllib.error.HTTPError as e:
            err_msg = ""
            if hasattr(e, 'read'):
                err_msg = e.read().decode('utf-8')
            if e.code == 429:
                log_error(f"Rate limited 429. Waiting 15 seconds. Details: {err_msg}")
                time.sleep(15)
            else:
                log_error(f"HTTP Error: {e.code}. Details: {err_msg}")
                time.sleep(5)
        except Exception as e:
            log_error(f"Error during translation, retrying: {e}")
            time.sleep(5)
    log_error("Failed after max retries")
    return content, False # Fallback 

files = glob.glob(os.path.join(src_dir, '*.md'))
files.sort()
for path in files:
    filename = os.path.basename(path)
    dst_path = os.path.join(dst_dir, filename)
    
    # We will overwrite fallback files if they are exactly the same size as source
    src_size = os.path.getsize(path)
    if os.path.exists(dst_path):
        dst_size = os.path.getsize(dst_path)
        if src_size != dst_size:
            continue # Safely translated, it's a different size
            
    # Also overwrite the first 5 that might be Korean ... wait, if translated they shrink or grow.
    
    log_error(f"Translating {filename}...")
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    translated_content, success = translate_markdown(content)
    
    if success and translated_content.startswith('```markdown') and translated_content.endswith('```'):
        translated_content = translated_content[11:-3].strip()
    
    with open(dst_path, 'w', encoding='utf-8') as f:
        f.write(translated_content)
        
    time.sleep(2) 
    
log_error("All translations complete.")
