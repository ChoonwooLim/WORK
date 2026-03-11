import re

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace Domestic table headers
html = html.replace(
    '<th>기능 구분</th>\n                        <th class="td-orbitron">🪐 Orbitron</th>\n                        <th>Naver Cloud</th>\n                        <th>KT Cloud</th>\n                        <th>Gabia</th>\n                        <th>NHN Cloud</th>\n                        <th>Kakao Cloud</th>',
    '<th>기능 구분</th>\n                        <th class="td-orbitron">🪐 Orbitron</th>\n                        <th>Cafe24</th>\n                        <th>Gabia</th>\n                        <th>AWS (Amplify/EC2)</th>\n                        <th>GCP / Firebase</th>\n                        <th>Naver Cloud</th>'
)

# Function to replace domestic row data
def replace_dom_row(feature, old_data, new_data):
    global html
    # Construct a regex to find the domestic row for a specific feature, ignoring whitespace variations
    # The domestic table comes AFTER the global table. We need to make sure we only replace in the domestic table section.
    # domestic table starts roughly around line 980 currently.
    
    parts = html.split('<h2 class="section-title">국내 Top 5 클라우드 CSP 업체 비교표</h2>')
    if len(parts) == 2:
        global_part = parts[0]
        domestic_part = parts[1]
        
        # Build regex for the specific row inside domestic_part
        # e.g. <tr> \s* <td>Git 푸시 자동 배포 (CI/CD)</td> \s* <td ...> ... </td> \s* <td>...</td> \s* </tr>
        row_pattern = r'(<tr>\s*<td>\s*' + re.escape(feature) + r'\s*</td>\s*<td class="td-orbitron">.*?</td>)(.*?)(</tr>)'
        
        match = re.search(row_pattern, domestic_part, re.DOTALL)
        if match:
            new_row_data = ''
            for d in new_data:
                new_row_data += f'\n                        <td>{d}</td>'
            
            new_domestic_part = domestic_part[:match.start(2)] + new_row_data + "\n                    " + domestic_part[match.end(2):]
            html = global_part + '<h2 class="section-title">주요 국내외 웹 호스팅 & 클라우드 비교표</h2>' + new_domestic_part

# Feature data: [Cafe24, Gabia, AWS, GCP, Naver]
replace_dom_row('Git 푸시 자동 배포 (CI/CD)', 
    ['', '', '', '', ''], 
    ['<span class="cross">✘ (FTP 수동)</span>', '<span class="cross">✘ (FTP 수동)</span>', '<span class="check">✔ (Amplify)</span>', '<span class="check">✔ (Firebase)</span>', '<span class="partial">△ (DevOps 별도)</span>']
)

replace_dom_row('풀스택 (모노리포) 배포 자동화', 
    [], 
    ['<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="partial">△ (Amplify 제약)</span>', '<span class="partial">△ (제한적)</span>', '<span class="cross">✘</span>']
)

replace_dom_row('매니지드 데이터베이스 (PostgreSQL 등)', 
    [], 
    ['<span class="partial">△ (MySQL 기본)</span>', '<span class="partial">△ (DB 호스팅 별도)</span>', '<span class="check">✔ (RDS)</span>', '<span class="check">✔ (Cloud SQL)</span>', '<span class="check">✔</span>']
)

replace_dom_row('멀티 컨테이너 (Docker Compose 지원)', 
    [], 
    ['<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="partial">△ (ECS/EKS 복잡)</span>', '<span class="partial">△ (Cloud Run 제약)</span>', '<span class="check">✔ (K8s)</span>']
)

replace_dom_row('글로벌 Edge CDN 지원', 
    [], 
    ['<span class="partial">△ (국내 한정)</span>', '<span class="partial">△ (국내 한정)</span>', '<span class="check">✔ (CloudFront)</span>', '<span class="check">✔ (Cloud CDN)</span>', '<span class="partial">△ (별도 연동)</span>']
)

replace_dom_row('무료 엣지 SSL 및 커스텀 도메인', 
    [], 
    ['<span class="cross">✘ (유료 구매)</span>', '<span class="cross">✘ (유료 구매)</span>', '<span class="partial">△ (ACM 복잡)</span>', '<span class="check">✔</span>', '<span class="partial">△ (부가서비스)</span>']
)

replace_dom_row('기본 DDoS 방어 및 WAF 적용', 
    [], 
    ['<span class="partial">△ (기본형)</span>', '<span class="partial">△ (기본형)</span>', '<span class="partial">△ (Shield/WAF 과금)</span>', '<span class="partial">△ (Cloud Armor 호환)</span>', '<span class="partial">△ (유료 옵션)</span>']
)

replace_dom_row('배포 에러 AI 원인 진단 (RAG)', 
    [], 
    ['<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="cross">✘ (Q Developer 별도)</span>', '<span class="cross">✘</span>', '<span class="cross">✘</span>']
)

replace_dom_row('과거 커밋 즉각 롤백', 
    [], 
    ['<span class="cross">✘ (백업본 수동 복구)</span>', '<span class="cross">✘ (데이터 복원 요망)</span>', '<span class="partial">△ (Amplify 한정)</span>', '<span class="check">✔ (Firebase)</span>', '<span class="cross">✘</span>']
)

replace_dom_row('모바일 메신저 양방향 AI 서버 제어', 
    [], 
    ['<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="cross">✘</span>']
)

replace_dom_row('프라이빗 네트워크 (Zero-Port)', 
    [], 
    ['<span class="cross">✘ (공용 IP 노출)</span>', '<span class="cross">✘ (공용 환경)</span>', '<span class="check">✔ (VPC 구성 복잡)</span>', '<span class="check">✔ (VPC)</span>', '<span class="check">✔ (VPC)</span>']
)

replace_dom_row('Unreal Engine / 3D GPU 렌더링 호스팅', 
    [], 
    ['<span class="cross">✘</span>', '<span class="cross">✘</span>', '<span class="partial">△ (EC2 G 인스턴스/비쌈)</span>', '<span class="partial">△ (비용 고가)</span>', '<span class="cross">✘</span>']
)

replace_dom_row('Unity WebGL 전용 Gzip 링커 압축 엔진', 
    [], 
    ['<span class="cross">✘ (수동 설정 불가)</span>', '<span class="cross">✘</span>', '<span class="partial">△ (S3 메타데이터 수동 조작)</span>', '<span class="partial">△</span>', '<span class="cross">✘</span>']
)

# Also replace the empty columns for cat-header
html = html.replace(
    '<td class="td-orbitron"></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>',
    '<td class="td-orbitron"></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>'
)

# Ensure the empty cells in the domestic cat-header are 5 instead of 6 or matching the domestic structure.
# Find Domestic cat-headers and adjust empty tds
parts = html.split('<h2 class="section-title">주요 국내외 웹 호스팅 & 클라우드 비교표</h2>')
if len(parts) == 2:
    domestic_table = parts[1]
    import re
    # we need 5 empty <td> corresponding to Cafe24, Gabia, AWS, GCP, Naver
    domestic_table = re.sub(r'<tr class="cat-header">\s*<td>(.*?)</td>\s*<td class="td-orbitron"></td>(\s*<td></td>)+', r'<tr class="cat-header">\n                        <td>\1</td>\n                        <td class="td-orbitron"></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>\n                        <td></td>', domestic_table)
    html = parts[0] + '<h2 class="section-title">주요 국내외 웹 호스팅 & 클라우드 비교표</h2>' + domestic_table

# Write the updated HTML back to the file
with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated comparison.html domestic table successfully.")
