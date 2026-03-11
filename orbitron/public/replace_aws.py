import re

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace header in the table
html = html.replace('<th>AWS</th>', '<th>DigitalOcean</th>')
html = html.replace('<th>AWS (Amplify/EC2)</th>', '<th>DigitalOcean</th>')

# Function to replace AWS column with DigitalOcean column in the table
def replace_do_row(feature, new_do_content):
    global html
    parts = html.split('<h2 class="section-title">주요 웹 호스팅 & 클라우드 비교표</h2>')
    if len(parts) == 2:
        global_part = parts[0]
        domestic_part = parts[1]
        
        # Build regex for the specific row inside domestic_part
        # We know columns are: Cafe24 | Gabia | AWS | GCP | Naver
        # So we need to match:
        # <tr>...<td>feature</td>...<td orbitron>...</td>...<td>cafe24</td>...<td>gabia</td>...<td>aws</td>...
        
        # Regex to capture the exact structure
        pattern = r'(<tr>\s*<td>\s*' + re.escape(feature) + r'\s*</td>\s*<td class="td-orbitron">.*?</td>\s*<td>.*?</td>\s*<td>.*?</td>\s*)(<td>.*?</td>)(.*?</tr>)'
        
        match = re.search(pattern, domestic_part, re.DOTALL)
        if match:
            new_td = f'<td>{new_do_content}</td>'
            new_domestic_part = domestic_part[:match.start(2)] + new_td + match.group(3) + domestic_part[match.end(3):]
            html = global_part + '<h2 class="section-title">주요 웹 호스팅 & 클라우드 비교표</h2>' + new_domestic_part

# Replace specifically in the competitors grid
# Find the card with AWS and replace it with DigitalOcean
aws_card_pattern = r'<div class="comp-card"[^>]*>.*?<h3>AWS</h3>.*?</div>'
do_card = '''<div class="comp-card" style="border-top: 4px solid #0080FF;">
                <div class="rank-badge">Global 1</div>
                <h3>DigitalOcean</h3>
                <div class="comp-category">Cloud Computing Platform</div>
                <p class="comp-desc">개발자 친화적인 인터페이스와 합리적인 가격의 VPS(Droplet) 및 App Platform을 제공합니다.</p>
                <div class="metric-box">
                    <div class="metric-label">Est. Annual Revenue</div>
                    <div class="metric-value">$692M+</div>
                </div>
            </div>'''
html = re.sub(aws_card_pattern, do_card, html, flags=re.DOTALL)

replace_do_row('Git 푸시 자동 배포 (CI/CD)', '<span class="check">✔ (App Platform)</span>')
replace_do_row('풀스택 (모노리포) 배포 자동화', '<span class="partial">△ (App Platform 제약)</span>')
replace_do_row('매니지드 데이터베이스 (PostgreSQL 등)', '<span class="check">✔ (Managed DB)</span>')
replace_do_row('멀티 컨테이너 (Docker Compose 지원)', '<span class="partial">△ (별도 VPS/K8s)</span>')
replace_do_row('글로벌 Edge CDN 지원', '<span class="partial">△ (Cloudflare 제휴/CDN)</span>')
replace_do_row('무료 엣지 SSL 및 커스텀 도메인', '<span class="check">✔</span>')
replace_do_row('기본 DDoS 방어 및 WAF 적용', '<span class="partial">△ (기본 제공)</span>')
replace_do_row('배포 에러 AI 원인 진단 (RAG)', '<span class="cross">✘</span>')
replace_do_row('과거 커밋 즉각 롤백', '<span class="partial">△ (App Platform 한정)</span>')
replace_do_row('모바일 메신저 양방향 AI 서버 제어', '<span class="cross">✘</span>')
replace_do_row('프라이빗 네트워크 (Zero-Port)', '<span class="check">✔ (VPC)</span>')
replace_do_row('Unreal Engine / 3D GPU 렌더링 호스팅', '<span class="cross">✘ (GPU 제약)</span>')
replace_do_row('Unity WebGL 전용 Gzip 링커 압축 엔진', '<span class="cross">✘</span>')

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated comparison with DO")
