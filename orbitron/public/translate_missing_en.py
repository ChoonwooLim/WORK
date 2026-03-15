import re
import os

files_to_translate = ['pricing-en.html', 'docs-en.html', 'comparison-en.html', 'presentation-en.html']
base_dir = '/home/stevenlim/WORK/orbitron/public'

replacements = [
    # General & Nav
    ('대시보드 관리', 'Manage Dashboard'),
    ('내 프로젝트로 돌아가기 →', 'Back to Projects →'),
    ('Orbitron 시작하기 →', 'Get Started with Orbitron →'),
    ('무료로 시작하고, 성장에 맞춰 확장하세요.', 'Start for free and scale as you grow.'),
    ('지금 바로 프로젝트를 궤도에 올리세요', 'Put your project into orbit right now'),
    
    # Pricing Page
    ('Orbitron 공식 매뉴얼 및 기술 문서', 'Orbitron Official Manual & Technical Docs'),
    ('플랜 도입 문의', 'Contact Sales for Plan'),
    ('최소 단위 기준', 'Based on minimum unit'),
    ('초과 요금 발생 시 알림 설정 가능', 'Custom alerts for overage available'),
    ('포함된 기본 제공량 이후', 'After included free tier'),
    ('전용 가상 프라이빗 클라우드 구축', 'Build dedicated Virtual Private Cloud'),
    ('고객 전용', 'Exclusive for customer'),
    ('협의', 'Custom'),
    ('개인, 스타트업 및 소규모 프로젝트용 무료 요금제', 'Free plan for individuals, startups & small projects'),
    ('대규모 애플리케이션 및 팀 협업에 최적화된 플랜', 'Optimized for large apps & team collaboration'),
    ('기업 수준의 보안 리소스 및 관리형 권한 제어', 'Enterprise security resources & managed RBAC'),
    ('글로벌 트래픽 분산', 'Global Traffic Distribution'),
    ('네트워크 및 리소스 단독 사용 보장', 'Network & resources isolation guarantee'),
    ('다중 어베일러빌리티 존 구성을 통한 99.99%', '99.99% via Multi-AZ architecture'),
    ('지원 범위를 비교하여 팀과 서비스 확장에 대비하세요', 'Compare support to prepare for team & service scaling'),
    ('비즈니스 데이(목표)', 'Business Day (Target)'),
    ('영업시간 내 우선', 'Business Hours (Priority)'),
    ('전담 채널, 24/7 연중무휴', 'Dedicated channel, 24/7'),
    ('초 단위 과금 구조', 'Per-second billing structure'),
    ('필요에 따라 인프라 확장이 유연하게 지원됩니다', 'Flexible infra scaling supported as needed'),
    ('모든 플랜에 포함된 보안 아키텍처', 'Security architecture included in all plans'),
    ('엔터프라이즈 전용 SLA', 'Enterprise SLA'),
    ('인프라 구조 설계', 'Infra Architecture Design'),
    ('개인 포트폴리오, 블로그, 단순 파이프라인 전용', 'For personal portfolios, blogs, simple pipelines'),
    ('소규모 팀 단위 개발 및 B2C 초기 서비스', 'Small team dev & initial B2C services'),
    ('SaaS 기업, 대형 게임 스튜디오, e-Commerce 특화', 'SaaS, large game studios, e-Commerce focused'),
    ('보안 컴플라이언스가 엄격한 기업(금융, 병원)용', 'Strict compliance enterprises (finance, healthcare)'),
    ('무제한 (팀 당 과금)', 'Unlimited (Billed per team)'),
    ('추가', 'Add'),
    ('Enterprise 플랜 문의', 'Contact Enterprise Sales'),
    ('Orbitron Sales Team이 컨설팅해드립니다.', 'Orbitron Sales Team will provide consultation.'),
    ('팀 단위의 개발 파이프라인 구축부터', 'From building team dev pipelines'),
    ('비즈니스 환경에 적합한 플랜을 제안해 드립니다', 'We recommend the perfect plan for your business context'),
    ('요금제 상세 비교', 'Detailed Pricing Comparison'),
    
    # Features / Comparison Grid details missing 
    ('자동 수집 및 백업', 'Auto-collection & backup'),
    ('DDoS/WAF 관리형 적용', 'Managed DDoS/WAF applied'),
    ('개별 분리 불가능', 'Cannot be isolated separately'),
    ('다중 프로젝트', 'Multi-project'),
    ('모니터링 알럿, 프리뷰', 'Monitoring alerts, Preview'),
    ('전용 SLA 체결, SOC2 지원', 'Dedicated SLA agreement, SOC2 support'),
    ('월드클래스 게임 서버 지원', 'World-class game server support'),
    ('언리얼 픽셀 스트리밍 호스팅', 'Unreal Pixel Streaming hosting'),
    ('단순 빌드 파이프라인', 'Simple build pipeline'),
    ('실시간 로그 아카이빙 (3일 보관)', 'Real-time log archiving (3-day retention)'),
    ('실시간 로그 아카이빙 (30일 보관)', 'Real-time log archiving (30-day retention)'),
    ('실시간 로그 아카이빙 (90일 보관)', 'Real-time log archiving (90-day retention)'),
    ('무제한 로그 보관 주기 및 다운로드', 'Unlimited log retention & download'),
    ('전용 GPU', 'Dedicated GPU'),
    ('지원 안 함', 'Not Supported'),
    ('선택 지원', 'Optional Support'),
    ('기본 제공', 'Provided by default'),

    # More pricing details
    ('월 정액', 'Flat monthly rate'),
    ('비용 제한 (Cap) 설정 불가능', 'Cannot set cost caps (Cap)'),
    ('초 단위 사용량 기반 후불', 'Postpaid based on per-second usage'),
    ('미사용 시 완전 무료', 'Completely free when unused'),
    ('서버리스(Scale-to-zero) 지원', 'Serverless (Scale-to-zero) supported'),
    ('대역폭 (CDN Egress)', 'Bandwidth (CDN Egress)'),
    ('요청 (Requests)', 'Requests (Requests)'),
    ('제한 없음', 'Unlimited'),
    ('초과 시', 'When exceeded'),
    ('월', 'per month'),
    ('기본 포함', 'Included'),
    ('시간 당 사용', 'Usage per hour'),
    ('기가바이트 전송', 'Gigabyte transfer'),
    
    # FAQ details missing
    ('무료 요금제에서 유료 요금제로 언제든 변경할 수 있나요?', 'Can I upgrade from free to paid plan anytime?'),
    ('네, 언제든지 대시보드 내 "Billing" 설정에서 플랜을 즉각적으로 업그레이드하거나 다운그레이드 하실 수 있습니다. 데이터의 유실은 전혀 없습니다.', 'Yes, you can upgrade or downgrade immediately anytime in the "Billing" settings on your dashboard. There is no data loss.'),
    ('요금이 어떻게 청구되나요?', 'How am I billed?'),
    ('가입 시 등록하신 신용카드로 매월 1일에 전월 사용량(Pro/Team/Enterprise의 경우 기본 구독료 + 초과 리소스 요금)에 대해 자동 결제가 이루어집니다.', 'Your registered credit card is automatically charged on the 1st of every month for previous month\'s usage (base subscription + overage compute).'),
    ('Enterprise 플랜에 대해 더 알고 싶습니다.', 'I want to know more about the Enterprise plan.'),
    ('Enterprise 플랜은 조직의 규모와 요구사항에 맞춘 맞춤형 요금 체계를 제공합니다. 전용 GPU 클러스터, SLA 보장 업타임, 전담 고객 성공 매니저 등이 포함됩니다. <a href="mailto:contact@twinverse.org" style="color:var(--accent)">contact@twinverse.org</a>로 연락 주시면 상세히 안내드리겠습니다.', 'The Enterprise plan provides customized pricing tailored to your organization''s needs. It includes dedicated GPU clusters, SLA uptime, and a dedicated Success Manager. Contact <a href="mailto:contact@twinverse.org" style="color:var(--accent)">contact@twinverse.org</a>.'),

]

regex_replacements = [
    (r'>\s*지원 프레임워크\s*<', '>Supported Frameworks<'),
    (r'>\s*배포 및 호스팅\s*<', '>Deployments & Hosting<'),
    (r'>\s*환경변수 관리\s*<', '>Environment Variables<'),
    (r'>\s*데이터베이스 구성\s*<', '>Databases<'),
    (r'>\s*고급 가이드\s*<', '>Advanced Guides<'),
    (r'>\s*RemoteAGT 텔레그램 관제\s*<', '>RemoteAGT Telegram C&C<'),
    (r'>\s*CI/CD 파이프라인 연동\s*<', '>CI/CD Pipelines<'),
    (r'>\s*커스텀 도메인 및 SSL 설정\s*<', '>Custom Domains & SSL<'),
    (r'>\s*오류 코드를 찾으시나요\?\s*<', '>Looking for error codes?<'),
    (r'>\s*자주 발생하는 배포 에러 코드를 확인하세요\s*<', '>Check frequently occurring deployment errors<'),
    (r'>\s*에러 노트 보러가기\s*<', '>View Error Notes<'),
]

for filename in files_to_translate:
    filepath = os.path.join(base_dir, filename)
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    for ko, en in replacements:
        content = content.replace(ko, en)

    for pattern, en in regex_replacements:
        content = re.sub(pattern, en, content)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

