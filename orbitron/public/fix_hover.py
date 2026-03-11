import glob
import os

public_dir = '/home/stevenlim/WORK/orbitron/public'
html_files = glob.glob(os.path.join(public_dir, '*.html'))

for file in html_files:
    if 'dashboard.html' in file:
        continue
        
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # The issue is that the dropdown content has margin-top: 24px, 
    # creating a gap where the hover state is lost. 
    # We should use padding-top instead, or position it directly below the button.
    
    # 1. remove margin-top: 24px and replace with padding-top
    # 2. wrap the button and content in a way that hovering the padding keeps it open
    
    # Fix CSS
    new_css = """        .nav-dropdown-content {
            display: none;
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding-top: 20px; /* Instead of margin, to bridge the hover gap */
            z-index: 200;
        }
        .nav-dropdown-inner {
            background-color: rgba(15, 23, 42, 0.95);
            min-width: 170px;
            box-shadow: 0px 8px 24px rgba(0,0,0,0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px 0;
            backdrop-filter: blur(10px);
        }
        .nav-dropdown-inner a {
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
        .nav-dropdown-inner a:hover {
            background-color: rgba(255, 255, 255, 0.05);
            color: var(--text-main) !important;
        }
        .nav-dropdown:hover .nav-dropdown-content {
            display: block;
        }
"""
    
    # Let's just use string replacement on the old CSS block
    old_css_block = """        .nav-dropdown-content {
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
        }"""
        
    old_html_block = """            <div class="nav-dropdown">
                <button class="nav-dropdown-btn" onclick="window.location.href='/ir.html'">IR (투자 정보) <span style="font-size: 10px;">▼</span></button>
                <div class="nav-dropdown-content">
                    <a href="/ir.html">비전 및 재무 추정</a>
                    <a href="/comparison.html">경쟁사 비교 분석</a>
                </div>
            </div>"""
            
    new_html_block = """            <div class="nav-dropdown">
                <button class="nav-dropdown-btn" onclick="window.location.href='/ir.html'">IR (투자 정보) <span style="font-size: 10px;">▼</span></button>
                <div class="nav-dropdown-content">
                    <div class="nav-dropdown-inner">
                        <a href="/ir.html">비전 및 재무 추정</a>
                        <a href="/comparison.html">경쟁사 비교 분석</a>
                    </div>
                </div>
            </div>"""

    if old_css_block in content:
        content = content.replace(old_css_block, new_css)
        content = content.replace(old_html_block, new_html_block)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Fixed hover gap issue")
