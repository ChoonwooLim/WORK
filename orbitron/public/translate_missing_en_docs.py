import re
import os

filepath = '/home/stevenlim/WORK/orbitron/public/docs-en.html'

replacements = [
    ('Orbitron 문서 (Docs)', 'Orbitron Docs'),
    ('IR (투자 정보)', 'IR (Investor Relations)'),
    ('빠른 배포 가이드', 'Quick Deployment Guide'),
    ('Orbitron 핵심 개념', 'Orbitron Core Concepts'),
    ('백엔드 웹 서비스', 'Backend Web Services'),
    ('정적 사이트 (Static)', 'Static Sites'),
    ('Docker 커스텀 배포', 'Docker Custom Deploy'),
    ('Unreal 픽셀 스트리밍', 'Unreal Pixel Streaming'),
    ('프라이빗 서비스', 'Private Services'),
    ('프리뷰 환경 (Preview)', 'Preview Environments'),
    ('커스텀 CI/CD 통합', 'Custom CI/CD Integration'),
    ('하이브리드 시스템 백업', 'Hybrid System Backup'),
    ('RemoteAGT 완벽 가이드', 'RemoteAGT Complete Guide'),
    ('Orbitron.yaml 완벽 가이드', 'Orbitron.yaml Complete Guide'),
    ('AI 트러블슈팅 및 분석기', 'AI Analyzer & Troubleshooting'),
    ('앱 메트릭 및 시스템 로그', 'App Metrics & System Logs'),
    ('커스텀 관제 대시보드', 'Custom Monitoring Dashboards'),
    ('Cloudflare 터널 & 보안망', 'Cloudflare Tunnels & Security Network'),
    ('WAF 및 L7 DDoS 방어', 'WAF & L7 DDoS Protection'),
    ('배포 상태 알림 (Slack/Discord)', 'Deploy Status Alerts (Slack/Discord)'),
    ('Datadog APM 모니터링', 'Datadog APM Monitoring'),
    ('멤버 초대 및 권한 제어 (RBAC)', 'Member Invites & RBAC'),
    ('인프라 보안 감사 로그', 'Infrastructure Security Audit Logs'),
    ('[예정]', '[Upcoming]'),
    ('문서를 찾을 수 없습니다 (404)', 'Document Not Found (404)'),
    ('요청하신 ${docId}.md 파일이 아직 작성되지 않았거나 삭제되었습니다.', 'The requested ${docId}.md file has not been created yet or has been deleted.'),
    ('좌측 메뉴에서 다른 문서를 선택해 주세요.', 'Please select another document from the left menu.'),
]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

for ko, en in replacements:
    content = content.replace(ko, en)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
