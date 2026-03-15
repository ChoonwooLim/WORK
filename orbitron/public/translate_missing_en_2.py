import re
import os

filepath = '/home/stevenlim/WORK/orbitron/public/pricing-en.html'

replacements = [
    # Plan descriptions missed
    ('성장하는 팀의 확장성과 보안 요구에 대응', 'Meets scalability & security needs of growing teams'),
    ('대규모 조직의 보안, 성능, 지원 요구 충족', 'Fulfills security, performance, & support for large orgs'),
    
    # Pricing
    ('컴퓨트 프라이싱', 'Compute Pricing'),
    ('Per-second billing으로, 사용한 만큼만 지불합니다.', 'Per-second billing, pay only for what you use.'),
    ('시작가', 'Starting from'),
    ('무료', 'Free'),
    ('컴퓨트 비용', 'compute'),
    ('/ per month + 컴퓨트 비용', '/ mo + compute'),
    ('문의하기 →', 'Contact Us →'),

    # Features listed under Team/Enterprise
    ('1 TB 대역폭 포함', '1 TB Bandwidth included'),
    ('RemoteAGT RBAC & 감사 로그', 'RemoteAGT RBAC & Audit Logs'),
    ('GPU 스트리밍 우선 할당', 'Priority GPU Streaming allocation'),
    ('프라이빗 네트워크 확장', 'Private Network scaling'),
    ('프리미엄 서포트', 'Premium Support'),
    ('Team 시작하기 →', 'Start Team →'),
    ('중앙화된 팀 관리', 'Centralized Team Management'),
    ('SSO & SCIM 연동', 'SSO & SCIM Integration'),
    ('SLA 보장 업타임', 'SLA Guaranteed Uptime'),
    ('Dedicated GPU 클러스터', 'Dedicated GPU Clusters'),
    ('커스텀 온보딩 지원', 'Custom Onboarding Support'),
    ('고객 성공 매니저 배정', 'Dedicated Success Manager'),

    # Compute Feature lists
    ('초고속 CDN 배포', 'Ultra-fast CDN Deployment'),
    ('Git Push 자동 배포', 'Git Push Auto-deploy'),
    ('즉시 캐시 무효화', 'Instant Cache Invalidation'),
    ('자세히 보기 →', 'View Details →'),
    ('HTTP/2 + TLS 자동 적용', 'Auto HTTP/2 + TLS'),
    ('Node, Python, Go, Rust 등', 'Node, Python, Go, Rust, etc.'),
    ('커스텀 Docker 컨테이너', 'Custom Docker Containers'),
    ('무중단 배포 (Zero-Downtime)', 'Zero-Downtime Deployments'),
    ('완전 매니지드 PostgreSQL', 'Fully Managed PostgreSQL'),
    ('논리적 백업 보관 (유료)', 'Logical Backup Storage (Paid)'),
    ('어디서든 접속 가능', 'Accessible from anywhere'),
    ('확장형 스토리지 (₩350/GB)', 'Scalable Storage (₩350/GB)'),
    ('고가용성 (Pro 이상)', 'High Availability (Pro or higher)'),
    ('PITR 지원 (유료)', 'PITR Supported (Paid)'),
    ('매니지드 Redis 호환 캐싱', 'Managed Redis-compatible Caching'),
    ('Job 큐잉으로 가용성 극대화', 'Maximized Availability via Job Queuing'),
    ('Primary DB 부하 감소', 'Reduces Primary DB Load'),
    ('페이지/결과/프래그먼트 캐시', 'Page/Result/Fragment Cache'),
    
    # Storage / Edge
    ('오브젝트 스토리지 (S3 호환)', 'Object Storage (S3 Compatible)'),
    ('이미지, 비디오 등 정적 에셋 서빙', 'Serve static assets like images, video'),
    ('저렴하고 내구성 높은 아카이브', 'Cost-effective, highly durable archives'),
    ('글로벌 엣지 인프라 캐싱', 'Global Edge Infrastructure Caching'),
    ('트래픽 폭주 시에도 안정적', 'Stable even during traffic spikes'),
    ('엣지 네트워크 라우팅 (Cloudflare)', 'Edge Network Routing (Cloudflare)'),
    ('글로벌 사용자 대상 가장 가까운 엣지 서버에서 응답', 'Responds from closest edge server globally'),
    ('보안 위협(DDoS, 악성 봇) 사전 차단 후 트래픽 유입', 'Proactively blocks threats (DDoS, Bots) before entry'),
    ('WAF를 통한 애플리케이션 계층(L7) 공격 방어', 'WAF defense against L7 application layer attacks'),
    ('서브도메인 및 와일드카드 인증서 발급 지원', 'Subdomain & wildcard cert issuance supported'),
    ('최저 <span>/ 월 (최소 사양 기준)</span>', 'From <span>/ mo (min specs)</span>'),
    ('<span>/ GB (최초 무료 제공 이후)</span>', '<span>/ GB (after free tier)</span>'),

    # Comparison Grid missing bits
    ('제공', 'Available'),
    ('미제공', 'Not Available'),
    ('무제한 생성', 'Unlimited Creation'),
    ('포함', 'Included'),
    ('선택', 'Optional'),
    ('필요 시', 'If needed'),

    # Table rows
    ('<td class="check">✓</td>', '<td class="check">✓</td>'),
    ('<td class="cross">✕</td>', '<td class="cross">✕</td>'),
    ('<tr class="cat-row"><td colspan="5">데이터 및 데이터베이스</td></tr>', '<tr class="cat-row"><td colspan="5">Data & Databases</td></tr>'),
    ('매니지드 Postgres/Redis', 'Managed Postgres/Redis'),
    ('오브젝트 스토리지 영역', 'Object Storage Region'),
    ('추가 신청 시 배정', 'Assigned upon request'),
    ('단독 클러스터 할당', 'Dedicated Cluster Allocation'),
    ('<tr class="cat-row"><td colspan="5">네트워킹 및 모니터링</td></tr>', '<tr class="cat-row"><td colspan="5">Networking & Monitoring</td></tr>'),
    ('퍼블릭 인그레스 차단', 'Block Public Ingress'),
    ('Orbitron 시스템 모니터', 'Orbitron System Monitor'),
    ('사용자 지정 알럿/웹훅', 'Custom Alerts/Webhooks'),
    ('고급 APM 연동', 'Advanced APM Integration'),
]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

for ko, en in replacements:
    content = content.replace(ko, en)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
