import re

with open('/home/stevenlim/WORK/orbitron/public/pricing-en.html', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('<title>Orbitron - 요금제</title>', '<title>Orbitron - Pricing</title>'),
    ('Orbitron의 투명하고 예측 가능한 요금 정책. 개인 프로젝트부터 엔터프라이즈까지.', 'Orbitron transparent and predictable pricing. From personal projects to enterprise.'),
    ('<h1>투명하고 예측 가능한<br>요금 정책</h1>', '<h1>Transparent and Predictable<br>Pricing</h1>'),
    ('<p>개인 사이드 프로젝트부터 대규모 엔터프라이즈까지, 프로젝트 규모에 맞는 최적의 플랜을 선택하세요.</p>', '<p>Choose the optimal plan for your project scale, from personal side projects to large-scale enterprise.</p>'),
    
    ('개인 프로젝트와 사이드 프로젝트에 최적화', 'Optimized for personal and side projects'),
    ('무료 <span>/ 컴퓨트 비용 별도</span>', 'Free <span>/ Compute charges separate</span>'),
    ('무료로 시작하기 →', 'Start for Free →'),
    ('포함 사항:', 'Includes:'),
    ('풀스택 앱 즉시 배포', 'Instant Full-Stack App Deployment'),
    ('매니지드 데이터스토어', 'Managed Datastore'),
    ('커스텀 도메인', 'Custom Domains'),
    ('Cloudflare CDN & 터널링', 'Cloudflare CDN & Tunneling'),
    ('기본 보안 자동 적용', 'Built-in Security'),
    ('커뮤니티 서포트', 'Community Support'),
    
    ('소규모 팀의 프로덕션 애플리케이션에 적합', 'Perfect for small team production apps'),
    ('₩19,000 <span>/ 월 + 컴퓨트 비용</span>', '₩19,000 <span>/ mo + compute</span>'),
    ('Pro 시작하기 →', 'Start Pro →'),
    ('Starter의 모든 기능, 추가로:', 'Everything in Starter, plus:'),
    ('500 GB 대역폭 포함', '500 GB Bandwidth included'),
    ('최대 10명 팀 멤버 협업', 'Up to 10 team members'),
    ('무제한 프로젝트 & 환경', 'Unlimited Projects & Environments'),
    ('AI 에러 분석 (Claude / Gemini)', 'AI Error Analysis (Claude / Gemini)'),
    ('RemoteAGT 원격 관제 (텔레그램/카카오톡)', 'RemoteAGT Command (Telegram/KakaoTalk)'),
    ('프리뷰 환경 테스트', 'Preview Environments'),
    ('채팅 서포트', 'Chat Support'),
    
    ('<div class="plan-name">Team</div>', '<div class="plan-name">Team</div>'),
    ('확장 중인 조직에 특화된 플랜', 'Designed for growing organizations'),
    ('₩99,000 <span>/ 월 + 컴퓨트 비용</span>', '₩99,000 <span>/ mo + compute</span>'),
    ('Team플랜 도입하기 →', 'Get Team Plan →'),
    ('Pro의 모든 기능, 추가로:', 'Everything in Pro, plus:'),
    ('2 TB 대역폭 포함', '2 TB Bandwidth included'),
    ('무제한 팀 멤버', 'Unlimited Team Members'),
    ('프로젝트 접근 권한 제어 (RBAC)', 'Role-Based Access Control (RBAC)'),
    ('고급 성능 분석 대시보드', 'Advanced Performance Dashboard'),
    ('단독 지원 채널 (Slack/Teams)', 'Dedicated Support Channel (Slack/Teams)'),
    ('SOC2 / HIPAA 호환 인프라 옵션', 'SOC2 / HIPAA Compliant Infra Options'),
    
    ('<div class="plan-name">Enterprise</div>', '<div class="plan-name">Enterprise</div>'),
    ('보안 및 성능이 핵심인 대규모 기업용', 'For large enterprises prioritizing security & performance'),
    ('맞춤 견적', 'Custom Pricing'),
    ('영업팀에 문의하기 →', 'Contact Sales →'),
    ('Team의 모든 기능, 추가로:', 'Everything in Team, plus:'),
    ('독립된 VPC 및 Dedicated Host', 'Isolated VPC & Dedicated Host'),
    ('SSO 통합 (SAML, OIDC)', 'SSO Integration (SAML, OIDC)'),
    ('Custom SLA 및 프리미엄 서포트', 'Custom SLA & Premium Support'),
    ('전담 기술 계정 관리자 (TAM)', 'Dedicated Technical Account Manager (TAM)'),
    ('인프라 구조 설계 및 마이그레이션 지원', 'Infra Architecture & Migration Support'),
    
    # Compute Cost
    ('<h2 class="section-title">컴퓨트 요금 (Pay-as-you-go)</h2>', '<h2 class="section-title">Compute Pricing (Pay-as-you-go)</h2>'),
    ('<p class="section-sub">사용하신 리소스(CPU, 메모리, 스토리지)에 대해서만 초 단위로 투명하게 과금합니다.</p>', '<p class="section-sub">Transparent per-second billing only for the resources (CPU, Memory, Storage) you consume.</p>'),
    ('웹 서버 / 워커 (vCPU / RAM)', 'Web Server / Worker (vCPU / RAM)'),
    ('최저', 'From'),
    ('<span>/ 월 (최소 사양 기준)</span>', '<span>/ mo (min specs)</span>'),
    ('앱 구동 방식', 'App execution method'),
    ('자동 스케일링 (0으로 축소 포함)', 'Auto-scaling (scale to 0)'),
    ('초 단위 과금', 'Per-second billing'),
    ('글로벌 엣지 배포 (준비중)', 'Global Edge Deployment (Coming soon)'),
    ('매니지드 데이터베이스 (PostgreSQL / Redis)', 'Managed Database (PostgreSQL / Redis)'),
    ('데이터 저장, 백업, 관리', 'Data storage, backup, management'),
    ('자동 일일 스냅샷', 'Automated Daily Snapshots'),
    ('High Availability 구성 (선택)', 'High Availability Setup (Optional)'),
    ('데이터 전송 아웃 (Egress)', 'Data Transfer Out (Egress)'),
    ('<span>/ GB (최초 무료 제공 이후)</span>', '<span>/ GB (after free tier)</span>'),
    ('글로벌 CDN 캐싱', 'Global CDN Caching'),
    ('DDoS 방어 기본 포함', 'DDoS Protection included'),
    ('내부 통신 완전 무료', 'Free internal traffic'),
    
    # Comparison Table
    ('<h2 class="section-title">기능 비교표</h2>', '<h2 class="section-title">Feature Comparison</h2>'),
    ('<p class="section-sub">요구사항에 맞는 최적의 플랜을 꼼꼼히 비교해보세요.</p>', '<p class="section-sub">Compare functionality in detail to find the best plan for your needs.</p>'),
    ('기능 구분', 'Feature Category'),
    ('<tr class="cat-row"><td colspan="5">배포 및 컴퓨팅</td></tr>', '<tr class="cat-row"><td colspan="5">Deployments & Compute</td></tr>'),
    ('글로벌 엣지 배포', 'Global Edge Deployments'),
    ('준비 중', 'Coming Soon'),
    ('프리뷰 환경', 'Preview Environments'),
    ('없음', 'None'),
    ('프로젝트 당 최대 5개', 'Max 5 per project'),
    ('무제한', 'Unlimited'),
    ('자동 스케일링', 'Auto Scaling'),
    ('Custom SLA 보장', 'Custom SLA Guarantee'),
    ('<tr class="cat-row"><td colspan="5">협업 및 워크플로우</td></tr>', '<tr class="cat-row"><td colspan="5">Collaboration & Workflow</td></tr>'),
    ('팀 멤버 수', 'Team Members'),
    ('개인 전용', 'Personal Only'),
    ('최대 10명', 'Up to 10'),
    ('역할 기반 접근 제어 (RBAC)', 'Role-Based Access Control (RBAC)'),
    ('RemoteAGT (텔레그램/카카오톡 관제)', 'RemoteAGT (Telegram/Kakao C&C)'),
    ('AI 기반 에러 분석 (Gemin / Claude)', 'AI Error Analysis (Gemini / Claude)'),
    ('월 100건', '100 / mo'),
    ('무제한 사용', 'Unlimited Usage'),
    ('SSO / SAML 로그인', 'SSO / SAML Login'),
    ('<tr class="cat-row"><td colspan="5">보안 및 인프라</td></tr>', '<tr class="cat-row"><td colspan="5">Security & Infrastructure</td></tr>'),
    ('DDoS 마이그레이션', 'DDoS Mitigation'),
    ('L3/L4 기본 방어', 'L3/L4 Standard Defense'),
    ('L7 고급 봇 방어 포함', 'L7 Advanced Bot Defense'),
    ('무제한 엔터프라이즈 방어', 'Unlimited Enterprise Defense'),
    ('네트워크 격리', 'Network Isolation'),
    ('공유 VPC', 'Shared VPC'),
    ('단독 격리 VPC', 'Dedicated Isolated VPC'),
    ('SOC2 / HIPAA 호환 가이드', 'SOC2 / HIPAA Compliance Guide'),
    ('<tr class="cat-row"><td colspan="5">서포트</td></tr>', '<tr class="cat-row"><td colspan="5">Support</td></tr>'),
    ('지원 채널', 'Support Channels'),
    ('디스코드 커뮤니티', 'Discord Community'),
    ('이메일 및 채팅 (업무시간)', 'Email & Chat (Business Hours)'),
    ('단독 슬랙 채널 (24/7)', 'Dedicated Slack Channel (24/7)'),
    ('TAM (기술 고객 관리자)', 'Technical Account Manager (TAM)'),
    ('응답 시간 보장 (SLA)', 'Response Time Guarantee (SLA)'),
    ('베스트 에포트', 'Best Effort'),
    ('24시간 이내', 'Within 24 Hours'),
    ('1시간 이내 (심각 장애 시)', 'Within 1 Hour (Critical)'),
    ('15분 이내 (24/7)', 'Within 15 Min (24/7)'),
    
    # FAQ Section
    ('<h2 class="faq-title">자주 묻는 질문</h2>', '<h2 class="faq-title">Frequently Asked Questions</h2>'),
    ('컴퓨트 요금은 어떻게 계산되나요?', 'How is compute pricing calculated?'),
    ('Orbitron은 앱이 사용한 메모리와 CPU, 그리고 구동된 시간에 대해서만 초 단위로 과금합니다. 만약 트래픽이 없어 앱이 자동으로 0으로 축소(Scale-to-zero)된 상태라면 과금되지 않습니다.', 'Orbitron bills dynamically per second based only on the memory, CPU, and execution time your app consumes. If there is no traffic and your app scales to zero, you are not charged.'),
    ('다른 PaaS 서비스(Vercel, Heroku 등)에서 마이그레이션하기 쉽나요?', 'Is it easy to migrate from other PaaS providers (Vercel, Heroku, etc.)?'),
    ('네, 완벽하게 호환됩니다. 기존 사용 중이시던 GitHub 레포지토리를 그대로 연결하면 Orbitron이 자동으로 프레임워크를 감지하여 빌드 및 배포를 완료합니다.', 'Yes, it is fully compatible. Simply connect your existing GitHub repository and Orbitron will automatically detect the framework to build and deploy.'),
    ('Team 플랜과 Enterprise 플랜의 가장 큰 차이는 무엇인가요?', 'What is the biggest difference between the Team and Enterprise plans?'),
    ('Team 플랜은 대다수의 스타트업과 스케일업 기업에 적합하며 공유 리소스 환경 위에서 동작합니다. Enterprise 플랜은 보안 컴플라이언스(금융, 의료 등)를 위해 완전히 격리된 물리적/논리적 단독망(VPC) 구성이 보장됩니다.', 'The Team plan is suitable for most startups and scale-ups, running on optimized shared resources. The Enterprise plan guarantees a completely isolated physical/logical VPC for strict security compliance (finance, healthcare, etc.).'),
    ('무료 플랜 (Starter)에도 제한이 없나요?', 'Are there limits on the Free (Starter) plan?'),
    ('기간 제한은 없습니다. 자유롭게 개인 포트폴리오나 사이드 프로젝트를 배포하실 수 있습니다. 다만, 상업적 트래픽이 발생하거나 팀 구성원 추가가 필요해질 때 Pro 플랜 업그레이드를 권장합니다.', 'There is no time limit. You can freely deploy personal portfolios or side projects. However, we recommend upgrading to the Pro plan if you generate commercial traffic or need to add team members.'),
    ('결제 수단은 어떤 것들을 지원하나요?', 'What payment methods do you support?'),
    ('국내외 모든 주요 신용카드(Visa, Mastercard, AMEX, 국내 전 카드사)를 지원합니다. Enterprise 고객의 경우 세금계산서 발행을 통한 무통장 입금 방식도 가능합니다.', 'We support all major global credit cards (Visa, Mastercard, AMEX, etc.). Enterprise customers can also arrange for custom invoicing and wire transfers.'),

    ('<section class="cta-banner">', '<section class="cta-banner">'),
    ('<h2>어떤 플랜이 적합한지 고민이신가요?</h2>', '<h2>Not sure which plan is right for you?</h2>'),
    ('<p>Orbitron 세일즈 팀이 고객님의 비즈니스 성장에 가장 유리한 구조를 컨설팅해 드립니다.</p>', '<p>The Orbitron sales team will consult you on the most advantageous structure for your business growth.</p>'),
    ('<a href="#" class="btn-primary">도입 문의하기</a>', '<a href="#" class="btn-primary">Contact Us</a>'),
    
    ('<p>© 2026 Orbitron (SodamFN). All rights reserved.</p>', '<p>© 2026 Orbitron (SodamFN). All rights reserved.</p>'),
]

for r in replacements:
    content = content.replace(r[0], r[1])
    
with open('/home/stevenlim/WORK/orbitron/public/pricing-en.html', 'w', encoding='utf-8') as f:
    f.write(content)

with open('/home/stevenlim/WORK/orbitron/public/docs-en.html', 'r', encoding='utf-8') as f:
    docs_content = f.read()
    
# Basic doc English replacements
doc_replacements = [
    ('<title>Orbitron - 문서</title>', '<title>Orbitron - Docs</title>'),
    ('Orbitron 공식 매뉴얼 및 기술 문서', 'Orbitron Official Manual & Technical Documentation'),
    ('<h1>Orbitron 문서</h1>', '<h1>Orbitron Docs</h1>'),
    ('안내', 'Introduction'),
    ('빠른 시작', 'Quick Start'),
    ('지원 프레임워크', 'Supported Frameworks'),
    ('배포 및 호스팅', 'Deployment & Hosting'),
    ('환경변수 관리', 'Environment Variables'),
    ('데이터베이스 구성', 'Database Configuration'),
    ('고급 가이드', 'Advanced Guide'),
    ('RemoteAGT 텔레그램 관제', 'RemoteAGT Telegram Command'),
    ('CI/CD 파이프라인 연동', 'CI/CD Pipeline Integration'),
    ('커스텀 도메인 및 SSL 설정', 'Custom Domains & SSL'),
    ('오류 코드를 찾으시나요?', 'Looking for error codes?'),
    ('자주 발생하는 배포 에러 코드를 확인하세요', 'Check frequently occurring deployment error codes'),
    ('에러 노트 보러가기', 'View Error Notes')
]

for r in doc_replacements:
    docs_content = docs_content.replace(r[0], r[1])
    
with open('/home/stevenlim/WORK/orbitron/public/docs-en.html', 'w', encoding='utf-8') as f:
    f.write(docs_content)

