import glob
import os

public_dir = '/home/stevenlim/WORK/orbitron/public'
html_files = glob.glob(os.path.join(public_dir, '*.html'))

css = """
        /* Nav Dropdown for IR */
        .nav-dropdown {
            position: relative;
            display: inline-block;
            margin-left: 24px;
        }
        .nav-dropdown-btn {
            color: var(--text-muted);
            text-decoration: none;
            font-weight: 500;
            background: none;
            border: none;
            font-size: 16px;
            font-family: inherit;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: color 0.2s;
        }
        .nav-dropdown:hover .nav-dropdown-btn {
            color: var(--text-main);
        }
        .nav-dropdown-content {
            display: none;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(15, 23, 42, 0.95);
            min-width: 170px;
            box-shadow: 0px 8px 24px rgba(0,0,0,0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            z-index: 200;
            padding: 8px 0;
            margin-top: 24px;
            backdrop-filter: blur(10px);
        }
        .nav-dropdown-content a {
            color: var(--text-muted) !important;
            padding: 10px 20px !important;
            text-decoration: none;
            display: block;
            margin-left: 0 !important;
            font-size: 14px;
            transition: all 0.2s;
            text-align: center;
            font-weight: 400 !important;
        }
        .nav-dropdown-content a:hover {
            background-color: rgba(255, 255, 255, 0.05);
            color: var(--text-main) !important;
        }
        .nav-dropdown:hover .nav-dropdown-content {
            display: block;
        }
        
        /* Adjust for docs page */
        .navbar .nav-dropdown-content {
             margin-top: 15px;
        }
"""

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
        
    if 'nav-dropdown' not in content and '</style>' in content:
        content = content.replace('</style>', css + '\n    </style>')
        
    # Remove existing independent comparison/IR links
    import re
    content = re.sub(r'^\s*<a href="/comparison\.html">경쟁사 비교</a>\s*\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*<a href="/ir\.html">IR \(투자 정보\)</a>\s*\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^\s*<a href="/ir\.html">IR</a>\s*\n', '', content, flags=re.MULTILINE)

    if 'nav-dropdown' not in content:
        content = content.replace('<a href="/docs.html">문서</a>', '<a href="/docs.html">문서</a>\n' + dropdown_html)
        content = content.replace('<a href="/docs.html">Docs</a>', '<a href="/docs.html">Docs</a>\n' + dropdown_html)

    if original != content:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Updated public html navs")
