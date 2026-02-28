# 🚀 RemoteAGT — 구축계획서

> **모바일 SNS 기반 Antigravity 원격 지휘·통제 시스템**

---

## 1. 프로젝트 비전

**RemoteAGT**는 카카오톡, 텔레그램, 슬랙 등 **일상적으로 사용하는 모바일 SNS 메신저**를 통해 어디서든 **Antigravity AI 코딩 어시스턴트**와 실시간 대화하고, 업무를 지시하며, 진행 상황을 정확하게 모니터링할 수 있게 하는 **AI 원격 지휘·통제(Command & Control) 브릿지 시스템**입니다.

### 핵심 목표

| 목표 | 설명 |
|------|------|
| 🗣️ **어디서든 대화** | 카카오톡·텔레그램 메시지로 Antigravity에게 자연어 업무 지시 |
| 📋 **업무 지시 & 큐잉** | 코드 수정, 배포, 디버깅 등 복잡한 작업을 원격으로 명령 |
| 📊 **실시간 모니터링** | 작업 진행률, 서버 상태, 빌드 로그를 SNS로 푸시 알림 수신 |
| 🔒 **보안 인증** | 인가된 사용자만 명령 실행 가능, 모든 통신 암호화 |

---

## 2. 시스템 아키텍처

### 전체 구조
- **📱 Mobile Layer**: 카카오톡, 텔레그램, 슬랙, 디스코드
- **☁️ RemoteAGT Bridge Server**: Message Gateway → Auth Guard → Command Parser → Task Queue → Monitor Engine → Notification Hub
- **🤖 Antigravity Layer**: AI 코딩 어시스턴트, 파일 시스템, 터미널
- **🪐 Orbitron Ecosystem**: 배포 대시보드, Docker, PostgreSQL

---

## 3. 핵심 모듈

### 3.1 📡 Message Gateway
외부 SNS 플랫폼으로부터 수신되는 모든 메시지를 단일 파이프라인으로 통합하는 인바운드 라우터

| 플랫폼 | 연동 방식 | 우선순위 |
|--------|----------|---------|
| **텔레그램** | Bot API + Webhook | 🔴 1순위 (가장 빠른 구현) |
| **카카오톡** | 카카오 i 오픈빌더 + REST API | 🟡 2순위 |
| **슬랙** | Slack App + Events API | 🟢 3순위 |
| **디스코드** | Discord.js Bot | 🔵 4순위 |

### 3.2 🔐 Auth Guard
- 화이트리스트 기반 인가
- OTP 인증 (최초 연결)
- 명령 등급 분류: 조회(L1) → 수정(L2) → 배포·삭제(L3)
- 감사 로그 AES-256 암호화 저장

### 3.3 ⚡ Command Parser
자연어 메시지를 구조화된 실행 가능한 명령으로 변환

**슬래시 명령어:**
- `/status` — 시스템 상태
- `/deploy <project>` — 프로젝트 배포
- `/logs <project>` — 컨테이너 로그
- `/projects` — 프로젝트 목록
- `/containers` — 컨테이너 목록
- `/disk` — 디스크 사용량
- `/tasks` — 진행 중 작업
- `/plan` — 구축계획서
- `/help` — 도움말

### 3.4 📬 Task Queue (BullMQ + Redis)
- Priority Queue: Critical → High → Normal → Low
- 상태: QUEUED → RUNNING → COMPLETED / FAILED / CANCELLED

### 3.5 📊 Monitor Engine
- Docker 컨테이너 상태, CPU, 메모리, 네트워크 I/O (30초)
- 시스템 디스크, RAM, CPU Load (60초)
- 자동 알림 트리거 (디스크 85%, 메모리 90%, 컨테이너 다운 등)

### 3.6 🔔 Notification Hub
- 배포 완료/실패 알림
- 시스템 이상 징후 알림
- 일일/주간 리포트 자동 생성

---

## 4. 기술 스택

| 계층 | 기술 | 선정 이유 |
|------|------|----------|
| Runtime | Node.js 20 LTS | Orbitron과 동일 런타임 |
| Framework | Express.js | Orbitron과 일관된 API |
| Bot SDK | Grammy (Telegram) | 타입 안전, 최신 Bot API |
| Task Queue | BullMQ + Redis | 우선순위 큐, 재시도 |
| Database | PostgreSQL (공유) | Orbitron DB 통합 |
| Monitoring | Dockerode + systeminformation | Docker API 직접 접근 |
| Security | JWT + OTP + AES-256 | Orbitron 보안 체계 재활용 |

---

## 5. Orbitron 연동

| 연동 포인트 | 방식 | 용도 |
|------------|------|------|
| 프로젝트 목록/상태 | REST API | 프로젝트 정보 조회 |
| 배포 실행 | API + Webhook | 원격 배포 트리거 |
| 빌드 로그 | SSE | 실시간 빌드 상황 |
| 컨테이너 모니터링 | Docker API | CPU/메모리/상태 직접 수집 |
| 에러 분석 | AI Analyzer | 에러 로그 자동 분석 |

---

## 6. 개발 로드맵

### Phase 1: Foundation (1~2주) 🔴 MVP ← **현재**
- ✅ 프로젝트 초기 설정
- ✅ 텔레그램 봇 Gateway 연동
- ✅ Auth Guard 기본 인증
- ✅ 기본 슬래시 명령어
- ✅ Orbitron API 연동
- ✅ 시스템 메트릭 수집기
- ✅ 웹 대시보드

### Phase 2: Command & Control (2~3주) 🟡
- 자연어 Commander Parser
- BullMQ 작업 큐
- 원격 배포 트리거
- Antigravity 연동
- 작업 진행률 실시간 푸시

### Phase 3: Intelligence (3~4주) 🟢
- 고급 모니터링 + 알림 규칙
- 일일/주간 리포트
- AI 에러 분석
- Error Knowledge DB 연동

### Phase 4: Multi-Platform (4~5주) 🔵
- 카카오톡 챗봇
- 슬랙 앱
- 디스코드 봇
- 관리자 웹 대시보드 확장

---

## 7. 기대 효과

| Before | After |
|--------|-------|
| PC 앞에서만 Antigravity 사용 | 📱 어디서든 SNS로 업무 지시 |
| SSH 접속해서 서버 상태 확인 | 📊 30초 자동 모니터링 + 즉시 알림 |
| 대시보드 접속해서 배포 | 🚀 "배포해줘" 한 마디로 완료 |
| 에러 발생 후 나중에 확인 | 🔴 즉시 텔레그램 알림 + AI 분석 |
| 작업 추적 어려움 | 📋 자동 리포트 생성 |
