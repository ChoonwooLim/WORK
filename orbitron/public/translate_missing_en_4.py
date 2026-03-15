import re
import os

filepath = '/home/stevenlim/WORK/orbitron/public/pricing-en.html'

replacements = [
    ('1명', '1 User'),
    ('리소스 모니터링 대시보드', 'Resource Monitoring Dashboard'),
    ('고객 성공 매니저', 'Customer Success Manager'),
    ('풀스택 자동 감지', 'Full-stack Auto Detection'),
    ('커밋 Optional 배포', 'Optional Commit Deploy'),
    ('백그라운드 워커', 'Background Workers'),
    ('환경 변수 관리', 'Environment Variables Manager'),
    ('🪐 RemoteAGT (원격 관제)', '🪐 RemoteAGT (Remote C&C)'),
    ('RemoteAGT 원격 대시보드', 'RemoteAGT Remote Dashboard'),
    ('카카오톡 챗봇 원격 관제', 'KakaoTalk Chatbot Remote C&C'),
    ('활동 감사 로그 (Audit)', 'Activity Audit Logs'),
    ('요금은 어떻게 청구되나요?', 'How am I billed?'),
    ('워크스페이스 플랜 비용과 사용한 컴퓨트 리소스 비용이 매per month 말 합산 청구됩니다. compute은 초 단위로 비례 배분되어, 서비스를 하루만', 'Workspace plan costs and used compute resources are billed tracking. Compute is pro-rated per second, so if you use it for one day'),
    ('사용했다면 하루치만 결제됩니다.', 'you only pay for one day’s usage.'),
    ('활동이 없는 달에도 요금이 부과되나요?', 'Am I charged in months with no activity?'),
    ('워크스페이스에 서비스(라이브 또는 일시정지)가 없고 활동이 없는 달에는 멤버 요금이 면제됩니다.', 'Member fees are waived in months with no services (live or paused) and no activity in the workspace.'),
    ('Free 플랜의 제한 사항은 무엇인가요?', 'What are the Free plan limitations?'),
    ('Starter 플랜은 최대 3 프로젝트, 100GB per month 대역폭, 1인 사용으로 제한됩니다. 개인 프로젝트와 학습 목적으로 설계되어 있으며,', 'Starter plan is limited to 3 projects, 100GB/mo bandwidth, and 1 user. Designed for personal projects and learning,'),
    ('AI 에러 분석과 GPU 스트리밍 기능은 Pro & Up 플랜에서 사용 가능합니다.', 'AI error analysis and GPU streaming are available on Pro & Up plans.'),
    ('결제 수단은 무엇을 지원하나요?', 'What payment methods are supported?'),
    ('주요 신용카드 및 체크카드를 모두 지원합니다. 결제 정보는 Stripe를 통해 안전하게 처리되며, 당사 서버에는 저장되지 않습니다.', 'All major credit and debit cards are supported. Payment info is securely processed by Stripe and not stored on our servers.'),
    ('플랜을 언제든지 변경할 수 있나요?', 'Can I change my plan anytime?'),
    ('네, 언제든지 대시보드에서 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 업그레이드 시 즉시 적용되며, 다운그레이드는 현재 결제 주기 종료', 'Yes, you can upgrade or downgrade anytime in the dashboard. Upgrades apply immediately, downgrades apply at the'),
    ('후 적용됩니다.', 'end of the current billing cycle.'),
    ('Unreal Pixel Streaming은 어떻게 과금되나요?', 'How is Unreal Pixel Streaming billed?'),
    ('GPU 인스턴스 사용 시간에 따라 초 단위로 과금됩니다. Dual GPU Load Balancing은 Team 이상 플랜에서 지원되며, 단일 GPU 스트리밍은', 'Billed per second based on GPU instance usage time. Dual GPU Load Balancing supports Team and up, single GPU streaming is'),
    ('Pro 플랜부터 사용 가능합니다.', 'available from Pro plan.'),
    ('Enterprise 플랜은 조직의 규모와 요구사항에 맞춘 Custom형 요금 체계를 Available합니다. Dedicated GPU Clusters, SLA Guaranteed Uptime, 전담 고객', 'Enterprise plan offers custom pricing tailored to your org’s needs. Features Dedicated GPU Clusters, SLA Guaranteed Uptime, Dedicated Customer'),
    ('성공 매니저 등이 Included됩니다. <a href="mailto:contact@twinverse.org"', 'Success Manager. Contact <a href="mailto:contact@twinverse.org"'),
    ('로 연락 주시면 상세히 안내드리겠습니다.', 'for detailed consultation.'),
]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

for ko, en in replacements:
    content = content.replace(ko, en)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
