import glob
import os

public_dir = '/home/stevenlim/WORK/orbitron/public'
html_files = glob.glob(os.path.join(public_dir, '*.html'))

old_dropdown_inner = """<div class="nav-dropdown-inner">
                        <a href="/ir.html">비전 및 재무 추정</a>
                        <a href="/comparison.html">경쟁사 비교 분석</a>
                    </div>"""

new_dropdown_inner = """<div class="nav-dropdown-inner">
                        <a href="/ir.html">비전 및 재무 추정</a>
                        <a href="/comparison.html">경쟁사 비교 분석</a>
                        <a href="/presentation.html">프레젠테이션 뷰 (발표용)</a>
                    </div>"""

for file in html_files:
    if 'dashboard.html' in file:
        continue
    if 'presentation.html' in file:
        continue
        
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    if old_dropdown_inner in content:
        content = content.replace(old_dropdown_inner, new_dropdown_inner)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Fixed dropdown logic")
