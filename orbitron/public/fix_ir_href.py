import os
import glob

directory = '/home/stevenlim/WORK/orbitron/public'
files = glob.glob(os.path.join(directory, '*-en.html'))

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if the file contains the old link
    if "window.location.href='/ir.html'" in content:
        content = content.replace("window.location.href='/ir.html'", "window.location.href='/ir-en.html'")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")
    else:
        print(f"Skipped {filepath} (no match)")
