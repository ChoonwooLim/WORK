import os
import glob
import re

directory = '/home/stevenlim/WORK/orbitron/public'
files = glob.glob(os.path.join(directory, '*.html'))

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    filename = os.path.basename(filepath)
    is_en_file = filename.endswith('-en.html')
    
    # We want to insert the language toggle right before the RemoteAGT link if it's missing
    # <a href="https://RemoteAGT.twinverse.org">RemoteAGT</a>
    
    has_ko_toggle = 'KO</a>' in content or 'KR</a>' in content
    has_en_toggle = 'EN</a>' in content
    
    if is_en_file and not has_ko_toggle:
        print(f"{filename} is missing KO toggle")
        content = content.replace(
            '<a href="https://RemoteAGT.twinverse.org">RemoteAGT</a>',
            f'<a href="https://RemoteAGT.twinverse.org">RemoteAGT</a>\n            <a href="/{filename.replace("-en.html", ".html")}">KO</a>'
        )
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
    elif not is_en_file and not has_en_toggle:
        if filename != 'login.html' and filename != 'index.html': # Exclude some files if necessary, let's just do it for all docs pages
            print(f"{filename} is missing EN toggle")
            content = content.replace(
                '<a href="https://RemoteAGT.twinverse.org">RemoteAGT</a>',
                f'<a href="https://RemoteAGT.twinverse.org">RemoteAGT</a>\n            <a href="/{filename.replace(".html", "-en.html")}">EN</a>'
            )
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
