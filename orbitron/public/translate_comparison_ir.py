import os
import json
import urllib.request
import urllib.error
import time
from bs4 import BeautifulSoup

def translate_html_with_gemini(filepath):
    print(f"Translating {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')

    # Find all text nodes that might contain Korean
    # Heuristic: Korean characters exist in the text
    import re
    korean_pattern = re.compile(r'[\u3131-\uD79D]')

    text_nodes = []
    # Collect translatable text nodes
    for element in soup.find_all(string=True):
        if element.parent.name in ['style', 'script', 'head', 'title', 'meta']:
            # we will handle title manually if needed, or let's include title
            if element.parent.name != 'title':
                continue
        text = element.strip()
        if text and korean_pattern.search(text):
            text_nodes.append(element)

    print(f"Found {len(text_nodes)} text nodes with Korean.")

    if not text_nodes:
        print("No Korean text found.")
        return

    # Extract texts
    texts_to_translate = [t.strip() for t in text_nodes]

    # Use Gemini API
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        from dotenv import load_dotenv
        load_dotenv('/home/stevenlim/WORK/orbitron/.env')
        api_key = os.environ.get('GEMINI_API_KEY')

    if not api_key:
        print("GEMINI_API_KEY not found.")
        return

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    # We will translate in batches of 30 to avoid huge prompts
    batch_size = 30
    for i in range(0, len(texts_to_translate), batch_size):
        batch = texts_to_translate[i:i+batch_size]
        print(f"Translating batch {i//batch_size + 1}...")

        prompt = "Translate the following Korean text array into English. Provide the exact same number of translated string items in a JSON array format. Only output the JSON array, nothing else. Preserve formatting like <span> tags if they are inside the text.\n"
        prompt += json.dumps(batch, ensure_ascii=False)

        data = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "response_mime_type": "application/json"}
        }

        req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})

        max_retries = 3
        for attempt in range(max_retries):
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    translated_text = result['candidates'][0]['content']['parts'][0]['text']
                    
                    try:
                        translated_batch = json.loads(translated_text)
                    except json.JSONDecodeError:
                        print("Failed to parse JSON response. Skipping batch.")
                        translated_batch = batch # fallback

                    if len(translated_batch) == len(batch):
                        for j, element in enumerate(text_nodes[i:i+batch_size]):
                            element.replace_with(translated_batch[j])
                    else:
                        print(f"Length mismatch! Expected {len(batch)}, got {len(translated_batch)}. Skipping.")
                    break

            except urllib.error.HTTPError as e:
                print(f"HTTP Error: {e.code}")
                if e.code == 429:
                    print("Rate limited. Waiting 30s...")
                    time.sleep(30)
                else:
                    time.sleep(5)
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(5)

    # Save back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print(f"Saved {filepath}")

# Translate comparison-en.html
translate_html_with_gemini('/home/stevenlim/WORK/orbitron/public/comparison-en.html')

# For ir-en.html which only has tiny bits
translate_html_with_gemini('/home/stevenlim/WORK/orbitron/public/ir-en.html')
