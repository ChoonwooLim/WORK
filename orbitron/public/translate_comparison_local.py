import os

replacements = [
    # IR dropdown
    ('IR (투자 정보)', 'IR (Investors)'),
    ('<title>Orbitron 문서 (Docs)</title>', '<title>Orbitron Docs</title>'),
    
    # comparison-en.html remnants
    ('고급 기능 &amp; AI', 'Advanced Features &amp; AI'),
    ('배포 에러 AI 원인 진단 (RAG)', 'AI Root Cause Diagnosis for Deploy Errors (RAG)'),
    ('과거 커밋 즉각 롤백', 'Instant Rollback to Previous Commits'),
    ('이미지 재배포', 'Redeploy Image'),
    ('로컬 환경 필요', 'Requires Local Env'),
    ('모바일 메신저 양방향 AI 서버 제어', 'Two-Way AI Server Control via Mobile Messenger'),
    ('RemoteAGT 연동', 'RemoteAGT Intg.'),
    ('확장 서비스 &amp; 플랫폼 생태계', 'Extended Services &amp; Platform Ecosystem'),
    ('상시 컨테이너 기반', 'Always-on Container Based'),
    ('직접 컨테이너 구동 요망', 'Requires Manual Container Run'),
    ('외부 스토리지 연동 요망', 'Requires External Storage Intg.'),
    ('엔터프라이즈 &amp; 특수 환경', 'Enterprise &amp; Special Environments'),
    ('프라이빗 네트워크 (Zero-Port)', 'Private Network (Zero-Port)'),
    ('VPC 망', 'VPC Network'),
    ('Unreal Engine / 3D GPU 렌더링 호스팅', 'Unreal Engine / 3D GPU Rendering Hosting'),
    ('GPU Server 인프라 대여', 'GPU Server Infra Rental'),
    ('GPU Server 대여', 'GPU Server Rental'),
    ('Unity WebGL 전용 Gzip 링커 압축 엔진', 'Dedicated Gzip Linker Compression Engine for Unity WebGL'),
    ('정적 호스팅', 'Static Hosting'),
    ('임베딩 튜닝 요망', 'Requires Embedding Tuning'),
    ('Nginx 수동', 'Manual Nginx'),
    ('직접 웹서버 설정', 'Manual Web Server Setup'),
    ('직접 서버 설정', 'Manual Server Setup'),
    ('제한적', 'Limited'),
    
    ('기능 구분', 'Feature Category'),
    ('주요 국내외 웹 호스팅 &amp; 클라우드 비교표', 'Major Domestic &amp; Global Web Hosting / Cloud Comparison'),
    ('핵심 배포 인프라', 'Core Deployment Infrastructure'),
    ('Git 푸시 자동 배포 (CI/CD)', 'Git Push Auto-Deploy (CI/CD)'),
    ('FTP 수동', 'Manual FTP'),
    ('DevOps 별도', 'Separate DevOps'),
    ('풀스택 (모노리포) 배포 자동화', 'Full-stack (Monorepo) Deploy Automation'),
    ('자동 매핑', 'Auto-Mapping'),
    ('매니지드 데이터베이스 (PostgreSQL 등)', 'Managed DB (PostgreSQL, etc.)'),
    ('자동 백업', 'Auto-Backup'),
    ('멀티 컨테이너 (Docker Compose 지원)', 'Multi-container (Docker Compose)'),
    ('네트워크 &amp; 트래픽', 'Network &amp; Traffic'),
    ('글로벌 Edge CDN 지원', 'Global Edge CDN Support'),
    ('국내 위주', 'Domestic Focus'),
    ('무료 엣지 SSL 및 커스텀 도메인', 'Free Edge SSL &amp; Custom Domain'),
    ('Full 리소스 커버', 'Full Resource Coverage'),
    ('유료 연동/인증서 구매', 'Paid Intg. / Cert Purchase'),
    ('유료 연동', 'Paid Intg.'),
    ('별도 구매', 'Separate Purchase'),
    ('기본 DDoS 방어 및 WAF 적용', 'Basic DDoS Protection &amp; WAF'),
    ('엔터프라이즈 급', 'Enterprise Grade'),
    ('유료 Security 부가', 'Paid Security Add-on'),
    ('유료 옵션', 'Paid Option'),
    ('부가서비스', 'Add-on Service'),
    ('서버 스냅샷으로 복원', 'Restore via Server Snapshot'),
    ('서버 스냅샷', 'Server Snapshot'),
    ('백업본 수동 복원', 'Manual Backup Restore'),
    
    ('지금 바로 Orbitron과 함께 차세대 인프라를 경험하세요', 'Experience Next-Gen Infrastructure with Orbitron Today'),
    ('어떤 스택이든 손쉽고 안전하게 배포하고 AI의 감시를 받으세요.', 'Deploy any stack easily and securely, under AI supervision.'),
    ('시작하기', 'Get Started'),
]

files_to_check = [
    '/home/stevenlim/WORK/orbitron/public/comparison-en.html',
    '/home/stevenlim/WORK/orbitron/public/ir-en.html',
]

for filepath in files_to_check:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for k, e in replacements:
            content = content.replace(k, e)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")
