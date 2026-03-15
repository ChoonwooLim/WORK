import os
import re

base_dir = '/home/stevenlim/WORK/orbitron/public'
pages = ['pricing', 'docs', 'ir', 'comparison', 'presentation', 'changelog']

common_replacements = [
    ('>기능 소개<', '>Features<'),
    ('>요금제<', '>Pricing<'),
    ('>문서<', '>Docs<'),
    ('>업데이트<', '>Updates<'),
    ('>로그인 · 회원가입<', '>Launch Dashboard<'),
    ('>IR (투자 정보)<', '>IR (Investors)<'),
    ('>비전 및 재무 추정<', '>Vision & Financials<'),
    ('>경쟁사 비교 분석<', '>Comparison<'),
    ('>프레젠테이션 뷰<', '>Presentation<'),
    ('href="/features.html"', 'href="/features-en.html"'),
    ('href="/pricing.html"', 'href="/pricing-en.html"'),
    ('href="/docs.html"', 'href="/docs-en.html"'),
    ('href="/changelog.html"', 'href="/changelog-en.html"'),
    ('href="/ir.html"', 'href="/ir-en.html"'),
    ('href="/comparison.html"', 'href="/comparison-en.html"'),
    ('href="/presentation.html"', 'href="/presentation-en.html"'),
    # Fix the toggle itself
]

for page in pages:
    ko_file = os.path.join(base_dir, f'{page}.html')
    en_file = os.path.join(base_dir, f'{page}-en.html')
    
    if not os.path.exists(ko_file):
        continue
        
    with open(ko_file, 'r', encoding='utf-8') as f:
        content = f.read()
        
    for r in common_replacements:
        content = content.replace(r[0], r[1])
        
    # Replace language toggle
    # In ko files it's typically <a href="/index-en.html">EN</a> or similar
    # We replace EN with KO and point to the ko file
    
    content = re.sub(r'<a href="/[^"]*-en\.html">EN</a>', f'<a href="/{page}.html">KO</a>', content)
    # the index.html actually points to `/index-en.html`. 
    content = content.replace('<a href="/index-en.html">EN</a>', f'<a href="/{page}.html">KO</a>')
    
    # Also patch index.html and features.html to point to new en URLs
    with open(en_file, 'w', encoding='utf-8') as f:
        f.write(content)

# Patch existing index-en.html and features-en.html to ensure navbars point to the right -en.html links
for existing in ['index-en.html', 'features-en.html']:
    filepath = os.path.join(base_dir, existing)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        for r in common_replacements:
            content = content.replace(r[0], r[1])
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

# Patch all Korean files to ensure their "EN" toggle points to their respective -en.html file
ko_pages_all = ['index', 'features', 'pricing', 'docs', 'ir', 'comparison', 'presentation', 'changelog']
for page in ko_pages_all:
    ko_file = os.path.join(base_dir, f'{page}.html')
    if os.path.exists(ko_file):
        with open(ko_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Ensure it has the EN toggle pointing correctly
        # Currently, index.html has `<a href="/index-en.html">EN</a>`
        # Other pages might just have `<a href="/index-en.html">EN</a>` incorrectly pointing to index-en
        content = re.sub(r'<a href="/index-en\.html">\s*EN\s*</a>', f'<a href="/{page}-en.html">EN</a>', content)
        
        with open(ko_file, 'w', encoding='utf-8') as f:
            f.write(content)

