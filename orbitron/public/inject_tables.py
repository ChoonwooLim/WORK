import re

def inject_tables():
    with open('comparison.html', 'r', encoding='utf-8') as f:
        comp_html = f.read()

    with open('presentation.html', 'r', encoding='utf-8') as f:
        pres_html = f.read()

    # Extract CSS
    css_start = comp_html.find('/* Comparison Table */')
    css_end_marker = 'tr.cat-header td.td-orbitron {'
    css_end = comp_html.find('}', comp_html.find(css_end_marker)) + 1
    css_block = comp_html[css_start:css_end]

    # Add presentation specific CSS adjustments
    css_block += """
        /* Presentation Table Adjustments */
        .table-section { padding: 0 !important; }
        .table-wrap { box-shadow: none !important; }
        .reveal table { font-size: 14px; }
        .reveal th, .reveal td { padding: 10px 14px; }
"""

    # Extract Global Table (from Global title down to first </section>)
    global_start = comp_html.find('<section class="table-section">')
    global_end = comp_html.find('</section>', global_start) + len('</section>')
    global_block = comp_html[global_start:global_end]
    global_block = global_block.replace('<section class="table-section">', '<section>\n<h2><span class="gradient-blue">Global Top 5</span> PaaS Competitors</h2>')

    # Extract Domestic Table
    dom_start = comp_html.find('<section class="table-section" style="padding-top: 0;">')
    dom_end = comp_html.find('</section>', dom_start) + len('</section>')
    dom_block = comp_html[dom_start:dom_end]
    dom_block = dom_block.replace('<section class="table-section" style="padding-top: 0;">', '<section>\n<h2><span class="gradient-green">Domestic Top 5</span> Cloud Competitors</h2>')
    dom_block = dom_block.replace('<h2 class="section-title">주요 국내외 웹 호스팅 & 클라우드 비교표</h2>', '')


    # Inject CSS
    pres_html = pres_html.replace('        /* Reveal slide fixes to enforce width */', css_block + '\n        /* Reveal slide fixes to enforce width */')

    # Inject HTML
    target_marker = '<!-- 8. Target Market -->'
    insertion_html = f"\n            <!-- 7-3. Global Table -->\n            {global_block}\n\n            <!-- 7-4. Domestic Table -->\n            {dom_block}\n\n            "
    pres_html = pres_html.replace(target_marker, insertion_html + target_marker)

    with open('presentation.html', 'w', encoding='utf-8') as f:
        f.write(pres_html)

    print("Successfully injected tables and CSS.")

if __name__ == '__main__':
    inject_tables()
