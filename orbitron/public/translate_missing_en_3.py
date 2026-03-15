import re
import os

filepath = '/home/stevenlim/WORK/orbitron/public/pricing-en.html'

replacements = [
    ('IR (투자 정보)', 'IR (Investor Relations)'),
    ('프로젝트 수', 'Projects'),
    ('3개', '3'),
    ('Included 대역폭', 'Included Bandwidth'),
    ('맞춤', 'Custom'),
    ('빌드 파이프라인', 'Build Pipeline'),
    ('500분/per month', '500 min/mo'),
    ('500분/유저/per month', '500 min/user/mo'),
    ('Docker Compose 지원', 'Docker Compose Support'),
    ('무중단 배포 (Blue-Green)', 'Zero-Downtime Deploy (Blue-Green)'),
    ('Cloudflare Pages 자동 배포', 'Cloudflare Pages Auto Deploy'),
    ('멀티 서비스 오케스트레이션', 'Multi-service Orchestration'),
    ('PostDeploy 훅', 'PostDeploy Hooks'),
    ('PostgreSQL 백업 보관', 'PostgreSQL Backup Retention'),
    ('3일', '3 days'),
    ('7일', '7 days'),
    ('미디어 백업 (DATA 드라이브)', 'Media Backup (DATA Drive)'),
    ('Git Clone 백업', 'Git Clone Backup'),
    ('확장형 스토리지', 'Scalable Storage'),
    ('AI 에러 분석 (자동)', 'AI Error Analysis (Auto)'),
    ('AI 챗봇 어시스턴트', 'AI Chatbot Assistant'),
    ('Claude 3.5 / Gemini 모델 Optional', 'Claude 3.5 / Gemini Optional'),
    ('Unity WebGL 호스팅', 'Unity WebGL Hosting'),
    ('듀얼 GPU 로드밸런싱', 'Dual GPU Load Balancing'),
    ('웹 기반 Pixel Streaming', 'Web-based Pixel Streaming'),
    ('자동 매치메이커 구성', 'Auto Matchmaker Config'),
    ('Vulkan + 가상 오디오 자동 설정', 'Vulkan + Virtual Audio Auto Setup'),
    ('Gzip/Brotli 사전 압축', 'Gzip/Brotli Pre-compression'),
    ('Nginx 최적화 WASM 서빙', 'Nginx Optimized WASM Serving'),
    ('MIME 타입 자동 설정', 'Auto MIME Type Config'),
    ('초고속 로딩 최적화', 'Ultra-fast Loading Optimization'),
    ('Pro 이상', 'Pro & Up'),
    ('Antigravity AI 원격 개발', 'Antigravity AI Remote Dev'),
    ('AI 원격 지휘·통제 대시보드', 'AI Remote C&C Dashboard'),
    ('텔레그램 봇 원격 관제', 'Telegram Bot Remote C&C'),
    ('카카오톡 챗봇 연동', 'KakaoTalk Chatbot Integration'),
    ('실시간 시스템 모니터링', 'Real-time System Monitoring'),
    ('원격 배포 & 로그 조회', 'Remote Deploy & Log Viewer'),
    ('기능 상세 비교', 'Detailed Feature Comparison'),
    ('플랜별 기능을 한눈에 비교하세요.', 'Compare features by plan at a glance.'),
    ('Cloudflare DDoS 보호', 'Cloudflare DDoS Protection'),
    ('자동 HTTPS / TLS', 'Auto HTTPS / TLS'),
    ('프라이빗 네트워크', 'Private Network'),
    ('감사 로그 (Audit Logs)', 'Audit Logs'),
    ('팀 멤버', 'Team Members'),
    ('디스코드 커뮤니티', 'Discord Community'),
    ('이메일 및 채팅', 'Email & Chat'),
    
    # Missing from previous grep but likely there
    ('이메일 서포트', 'Email Support'),
    ('우선 순위 지원', 'Priority Support'),
    ('전담 서포트 엔지니어', 'Dedicated Support Engineer'),
    ('엔터프라이즈 SLA', 'Enterprise SLA'),
    ('커스텀 SLA', 'Custom SLA'),
    ('영업일 기준', 'Business Days'),
    ('24시간 365일', '24/7/365'),
    ('기본 로그 보관', 'Basic Log Retention'),
    ('커스텀 도메인 무제한', 'Unlimited Custom Domains'),
    ('서버리스 함수', 'Serverless Functions'),
    ('글로벌 엣지', 'Global Edge'),
    ('<tr class="cat-row"><td colspan="5">AI 및 게임 퍼블리싱</td></tr>', '<tr class="cat-row"><td colspan="5">AI & Game Publishing</td></tr>'),
]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

for ko, en in replacements:
    content = content.replace(ko, en)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
