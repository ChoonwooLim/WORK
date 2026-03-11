import glob
import os

public_dir = '/home/stevenlim/WORK/orbitron/public'
html_files = glob.glob(os.path.join(public_dir, '*.html'))

dropdown_html = """            <div class="nav-dropdown">
                <button class="nav-dropdown-btn" onclick="window.location.href='/ir.html'">IR (투자 정보) <span style="font-size: 10px;">▼</span></button>
                <div class="nav-dropdown-content">
                    <a href="/ir.html">비전 및 재무 추정</a>
                    <a href="/comparison.html">경쟁사 비교 분석</a>
                </div>
            </div>"""

for file in html_files:
    if 'dashboard.html' in file:
        continue
        
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
        
    # Check if the actual HTML element is in there, not just the CSS class
    if '<div class="nav-dropdown">' not in content:
        content = content.replace('<a href="/docs.html">문서</a>', '<a href="/docs.html">문서</a>\n' + dropdown_html)
        content = content.replace('<a href="/docs.html">Docs</a>', '<a href="/docs.html">Docs</a>\n' + dropdown_html)

    if original != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Fixed dropdown HTML")
