import glob
import os
import re

public_dir = '/home/stevenlim/WORK/orbitron/public'

# 1. Update docs.html to remove IR sidebar group
docs_path = os.path.join(public_dir, 'docs.html')
with open(docs_path, 'r', encoding='utf-8') as f:
    docs_content = f.read()

ir_group = """            <div class="sidebar-group">
                <div class="sidebar-title">Company & IR</div>
                <a href="#/ir-financials" class="sidebar-link" data-md="ir-financials">Orbitron IR & 10개년 재무추정</a>
            </div>"""

if ir_group in docs_content:
    docs_content = docs_content.replace(ir_group, '')
    docs_content = docs_content.replace('\n\n\n        </aside>', '\n        </aside>')
    with open(docs_path, 'w', encoding='utf-8') as f:
        f.write(docs_content)

# 2. Add <a href="/ir.html">IR (투자 정보)</a> to nav-links in all html files
html_files = glob.glob(os.path.join(public_dir, '*.html'))

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'href="/ir.html"' in content:
        continue
        
    content = content.replace('docs.html">문서</a>', 'docs.html">문서</a>\n            <a href="/ir.html">IR (투자 정보)</a>')
    content = content.replace('docs.html">Docs</a>', 'docs.html">Docs</a>\n            <a href="/ir.html">IR</a>')
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

# 3. Create ir.html based on docs.html
# Use the updated docs_content as base
ir_content = docs_content
ir_content = re.sub(r'<aside class="sidebar">.*?</aside>', '', ir_content, flags=re.DOTALL)
ir_content = ir_content.replace('docs.html" class="active"', 'docs.html"') # in case Docs was active
# add active to IR if needed, but not strictly necessary

ir_content = ir_content.replace("const hash = window.location.hash.replace('#/', '') || 'quickstart';", "const hash = 'ir-financials';")
ir_content = ir_content.replace("<title>Orbitron - 기술 문서</title>", "<title>Orbitron - IR (투자 정보)</title>")

# Fix CSS layout and remove sidebar styling easily by overriding
style_override = """
        .docs-container { max-width: 1000px; margin: 0 auto; display: block; border-left: 1px solid var(--border-color); border-right: 1px solid var(--border-color); min-height: calc(100vh - 80px); }
        .main-content { padding: 48px; }
"""
ir_content = ir_content.replace("</style>", style_override + "\n    </style>")

with open(os.path.join(public_dir, 'ir.html'), 'w', encoding='utf-8') as f:
    f.write(ir_content)

print("Done modifications")
