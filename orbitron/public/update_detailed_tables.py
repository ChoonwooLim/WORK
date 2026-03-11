import re

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'r', encoding='utf-8') as f:
    html = f.read()

table_section_start = html.find('<section class="table-section" style="padding-bottom: 40px;">')
if table_section_start == -1:
    table_section_start = html.find('<section class="table-section"')
    
cta_banner_start = html.find('<div class="cta-banner">')

if table_section_start == -1 or cta_banner_start == -1:
    print("Could not find sections!")
    exit(1)

new_tables = """    <section class="table-section" style="padding-bottom: 40px;">
        <h2 class="section-title">글로벌 Top 5 경쟁사 비교표</h2>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>기능 구분</th>
                        <th class="td-orbitron">🪐 Orbitron</th>
                        <th>Vercel</th>
                        <th>Heroku</th>
                        <th>Netlify</th>
                        <th>Render</th>
                        <th>Fly.io</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="cat-header">
                        <td>핵심 배포 인프라</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Git 푸시 자동 배포 (CI/CD)</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                    </tr>
                    <tr>
                        <td>풀스택 (모노리포) 배포 자동화</td>
                        <td class="td-orbitron"><span class="check">✔ (자동 매핑)</span></td>
                        <td><span class="partial">△ (제한적 백엔드)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△ (프론트/서버리스 위주)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△ (멀티 머신)</span></td>
                    </tr>
                    <tr>
                        <td>매니지드 데이터베이스 (PostgreSQL 등)</td>
                        <td class="td-orbitron"><span class="check">✔ (자동 백업)</span></td>
                        <td><span class="check">✔ (Vercel DB)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                    </tr>
                    <tr>
                        <td>멀티 컨테이너 (Docker Compose 지원)</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="partial">△ (Heroku yml)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="partial">△ (Render yaml)</span></td>
                        <td><span class="partial">△ (Fly Machine 연동)</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>네트워크 & 트래픽</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>글로벌 Edge CDN 지원</td>
                        <td class="td-orbitron"><span class="check">✔ (Cloudflare)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△</span></td>
                        <td><span class="check">✔</span></td>
                    </tr>
                    <tr>
                        <td>무료 엣지 SSL 및 커스텀 도메인</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                    </tr>
                    <tr>
                        <td>기본 DDoS 방어 및 WAF 적용</td>
                        <td class="td-orbitron"><span class="check">✔ (엔터프라이즈 급)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△ (애드온 필요)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△ (제한적)</span></td>
                        <td><span class="partial">△ (제한적)</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>고급 기능 & AI</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>배포 에러 AI 원인 진단 (RAG)</td>
                        <td class="td-orbitron"><span class="check">✔ (Gemini/Claude)</span></td>
                        <td><span class="partial">△ (v0 제한적)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>과거 커밋 즉각 롤백</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="partial">△ (이미지 재배포)</span></td>
                        <td><span class="partial">△ (로컬 환경 필요)</span></td>
                    </tr>
                    <tr>
                        <td>모바일 메신저 양방향 AI 서버 제어</td>
                        <td class="td-orbitron"><span class="check">✔ (RemoteAGT 연동)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>프라이빗 네트워크 (Zero-Port)</td>
                        <td class="td-orbitron"><span class="check">✔ (Cloudflare 100%)</span></td>
                        <td><span class="check">✔ (Enterprise)</span></td>
                        <td><span class="check">✔ (Private Spaces)</span></td>
                        <td><span class="check">✔ (Enterprise)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔ (IPv6 WireGuard)</span></td>
                    </tr>
                    <tr>
                        <td>Unreal Engine / 3D GPU 렌더링 호스팅</td>
                        <td class="td-orbitron"><span class="check">✔ (Pixel Streaming)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="partial">△ (Fly GPU, Beta)</span></td>
                    </tr>
                    <tr>
                        <td>Unity WebGL 전용 Gzip 링커 압축 엔진</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="partial">△ (정적 호스팅)</span></td>
                        <td><span class="partial">△ (임베딩 튜닝 요망)</span></td>
                        <td><span class="partial">△ (정적 호스팅)</span></td>
                        <td><span class="partial">△ (정적 호스팅)</span></td>
                        <td><span class="partial">△ (Nginx 수동)</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>

    <section class="table-section" style="padding-top: 0;">
        <h2 class="section-title">국내 Top 5 클라우드 CSP 업체 비교표</h2>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>기능 구분</th>
                        <th class="td-orbitron">🪐 Orbitron</th>
                        <th>Naver Cloud</th>
                        <th>KT Cloud</th>
                        <th>Gabia</th>
                        <th>NHN Cloud</th>
                        <th>Kakao Cloud</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="cat-header">
                        <td>핵심 배포 인프라</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>Git 푸시 자동 배포 (CI/CD)</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="partial">△ (DevOps 별도 구성)</span></td>
                        <td><span class="partial">△ (수동 구성)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="partial">△ (수동)</span></td>
                        <td><span class="partial">△ (수동)</span></td>
                    </tr>
                    <tr>
                        <td>풀스택 (모노리포) 배포 자동화</td>
                        <td class="td-orbitron"><span class="check">✔ (자동 매핑)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>매니지드 데이터베이스 (PostgreSQL 등)</td>
                        <td class="td-orbitron"><span class="check">✔ (자동 백업)</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                        <td><span class="check">✔</span></td>
                    </tr>
                    <tr>
                        <td>멀티 컨테이너 (Docker Compose 지원)</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="check">✔ (K8s/Container)</span></td>
                        <td><span class="check">✔ (K8s/Container)</span></td>
                        <td><span class="check">✔ (K8s/Container)</span></td>
                        <td><span class="check">✔ (K8s)</span></td>
                        <td><span class="check">✔ (K8s)</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>네트워크 & 트래픽</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>글로벌 Edge CDN 지원</td>
                        <td class="td-orbitron"><span class="check">✔ (Cloudflare 100%)</span></td>
                        <td><span class="check">✔ (Global Edge)</span></td>
                        <td><span class="check">✔ (CDN)</span></td>
                        <td><span class="partial">△ (국내 위주)</span></td>
                        <td><span class="check">✔ (CDN)</span></td>
                        <td><span class="check">✔ (CDN)</span></td>
                    </tr>
                    <tr>
                        <td>무료 엣지 SSL 및 커스텀 도메인</td>
                        <td class="td-orbitron"><span class="check">✔ (Full 리소스 커버)</span></td>
                        <td><span class="partial">△ (유료 연동/인증서 구매)</span></td>
                        <td><span class="partial">△ (유료 연동)</span></td>
                        <td><span class="cross">✘ (별도 구매)</span></td>
                        <td><span class="partial">△ (유료 연동)</span></td>
                        <td><span class="partial">△ (유료 연동)</span></td>
                    </tr>
                    <tr>
                        <td>기본 DDoS 방어 및 WAF 적용</td>
                        <td class="td-orbitron"><span class="check">✔ (엔터프라이즈 급)</span></td>
                        <td><span class="partial">△ (유료 Security 부가)</span></td>
                        <td><span class="partial">△ (유료 옵션)</span></td>
                        <td><span class="partial">△ (부가서비스)</span></td>
                        <td><span class="partial">△ (유료 옵션)</span></td>
                        <td><span class="partial">△ (유료 옵션)</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>고급 기능 & AI</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>배포 에러 AI 원인 진단 (RAG)</td>
                        <td class="td-orbitron"><span class="check">✔ (Gemini/Claude)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>과거 커밋 즉각 롤백</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="cross">✘ (서버 스냅샷으로 복원)</span></td>
                        <td><span class="cross">✘ (서버 스냅샷)</span></td>
                        <td><span class="cross">✘ (백업본 수동 복원)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                    <tr>
                        <td>모바일 메신저 양방향 AI 서버 제어</td>
                        <td class="td-orbitron"><span class="check">✔ (RemoteAGT 연동)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>

                    <tr class="cat-header">
                        <td>엔터프라이즈 & 특수 환경</td>
                        <td class="td-orbitron"></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td>프라이빗 네트워크 (Zero-Port)</td>
                        <td class="td-orbitron"><span class="check">✔ (Cloudflare 100%)</span></td>
                        <td><span class="check">✔ (VPC 망)</span></td>
                        <td><span class="check">✔ (VPC 망)</span></td>
                        <td><span class="check">✔ (VPC 망)</span></td>
                        <td><span class="check">✔ (VPC 망)</span></td>
                        <td><span class="check">✔ (VPC 망)</span></td>
                    </tr>
                    <tr>
                        <td>Unreal Engine / 3D GPU 렌더링 호스팅</td>
                        <td class="td-orbitron"><span class="check">✔ (Pixel Streaming)</span></td>
                        <td><span class="partial">△ (GPU Server 인프라 대여)</span></td>
                        <td><span class="partial">△ (GPU Server 대여)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="partial">△ (GPU Server 대여)</span></td>
                        <td><span class="partial">△ (GPU Server 대여)</span></td>
                    </tr>
                    <tr>
                        <td>Unity WebGL 전용 Gzip 링커 압축 엔진</td>
                        <td class="td-orbitron"><span class="check">✔</span></td>
                        <td><span class="cross">✘ (직접 웹서버 설정)</span></td>
                        <td><span class="cross">✘ (직접 서버 설정)</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                        <td><span class="cross">✘</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
"""

new_html = html[:table_section_start] + new_tables + html[cta_banner_start:]

with open('/home/stevenlim/WORK/orbitron/public/comparison.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("Tables updated with detailed features and Netlify included.")
