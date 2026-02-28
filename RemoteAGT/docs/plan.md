# 🪐 RemoteAGT — 프로젝트 종합 매뉴얼

> **모바일 SNS 기반 Antigravity AI 원격 지휘·통제 시스템**
> 
> 버전: 1.0.0 · 최종 업데이트: 2026-03-01

---

## 1. 프로젝트 비전

**RemoteAGT**는 카카오톡, 텔레그램, 슬랙 등 **일상적으로 사용하는 모바일 SNS 메신저**를 통해 어디서든 **Antigravity AI 코딩 어시스턴트**와 실시간 대화하고, 업무를 지시하며, 진행 상황을 정확하게 모니터링할 수 있게 하는 **AI 원격 지휘·통제(C2) 브릿지 시스템**입니다.

| 핵심 목표 | 설명 |
|-----------|------|
| 🗣️ **어디서든 대화** | 카카오톡·텔레그램 메시지로 Antigravity에게 자연어 업무 지시 |
| 📋 **업무 지시 & 큐잉** | 코드 수정, 배포, 디버깅 등 복잡한 작업을 원격으로 명령 |
| 📊 **실시간 모니터링** | 서버 상태, 컨테이너, 빌드 로그를 30초 주기로 수집·알림 |
| 🔒 **보안 인증** | JWT + bcrypt 인증, 역할 기반 접근 제어, 감사 로그 |
| 🛡 **관리자 총괄** | 최상위 관리자 대시보드로 전체 사용자·작업·활동 관리 |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
📱 Mobile (Telegram / KakaoTalk / Slack / Discord)
     │
     ▼
☁️  RemoteAGT Bridge Server (Node.js + Express)
     ├─ 📡 Message Gateway ─── Grammy (Telegram Bot API)
     ├─ 🔐 Auth Guard ──────── JWT + bcrypt + Role-Based Access
     ├─ ⚡ Command Parser ──── 슬래시 명령 + 자연어(Phase 2)
     ├─ 📬 Task Queue ──────── BullMQ + Redis(Phase 2)
     ├─ 📊 Monitor Engine ──── Dockerode + systeminformation
     ├─ 🔔 Notification Hub ── 알림 포맷터 + 알림 규칙 엔진
     └─ 🌐 Web Dashboard ──── SPA (HTML/CSS/JS)
            ├── 일반 사용자 대시보드
            └── 🛡 최상위 관리자 전용 대시보드
     │
     ▼
🤖 Antigravity AI + 🪐 Orbitron Ecosystem
     ├─ AI 코딩 어시스턴트 (파일 시스템, 터미널)
     ├─ Docker 컨테이너 (배포·관리)
     └─ PostgreSQL (공유 데이터베이스)
```

### 2.2 데이터 흐름

1. **인바운드**: 사용자 → SNS 메시지 → Gateway → Auth → Command Parser → Task Queue
2. **실행**: Task Queue → Antigravity / Orbitron API → 결과 반환
3. **아웃바운드**: 결과 → Notification Hub → SNS 알림 + 웹 대시보드 갱신

---

## 3. 기술 스택

| 계층 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| Runtime | Node.js | 20 LTS | Orbitron과 동일 런타임, ESM 지원 |
| Framework | Express.js | 4.x | 가볍고 유연한 REST API |
| Bot SDK | Grammy | 1.x | 타입 안전, 최신 Telegram Bot API |
| Auth | JWT + bcrypt | — | 무상태 인증, 안전한 비밀번호 해싱 |
| Database | PostgreSQL | 16 | Orbitron DB 공유, JSONB 지원 |
| Docker | Dockerode | 4.x | Docker Engine API 직접 접근 |
| Monitoring | systeminformation | 5.x | CPU/RAM/Disk 크로스플랫폼 수집 |
| Process | PM2 | — | 프로세스 관리, 자동 재시작 |
| Container | Docker | — | 컨테이너화 배포 옵션 |

---

## 4. 프로젝트 구조

```
RemoteAGT/
├── server.js                     # 메인 엔트리 (Express + 전체 초기화)
├── package.json                  # 의존성 & 스크립트
├── ecosystem.config.cjs          # PM2 프로세스 관리 설정
├── Dockerfile                    # Docker 컨테이너 빌드
├── .env                          # 환경변수 (비공개)
├── .env.example                  # 환경변수 템플릿
│
├── db/
│   ├── db.js                     # PostgreSQL 연결 풀 & 헬퍼
│   └── schema.sql                # 7개 테이블 스키마 (자동 초기화)
│
├── src/
│   ├── utils/
│   │   ├── config.js             # 중앙화 설정 관리
│   │   └── logger.js             # 컬러 콘솔 로거 (타임스탬프)
│   │
│   ├── middleware/
│   │   └── auth.js               # JWT 인증 미들웨어 (authRequired, adminRequired, superAdminRequired)
│   │
│   ├── routes/
│   │   ├── auth.js               # 인증 API (로그인, 회원가입, 프로필)
│   │   └── admin.js              # 최상위 관리자 API (사용자 CRUD, 감사 로그, 통계)
│   │
│   ├── auth/
│   │   └── userRegistry.js       # SNS 사용자 등록·인증·감사
│   │
│   ├── gateways/
│   │   └── telegram.js           # 텔레그램 봇 게이트웨이 (Grammy, 10+ 명령어)
│   │
│   ├── bridge/
│   │   └── orbitronClient.js     # Orbitron REST API 클라이언트 (자동 인증)
│   │
│   ├── monitor/
│   │   ├── collector.js          # 시스템 + Docker 메트릭 수집기
│   │   └── alertRules.js         # 임계값 기반 알림 규칙 엔진
│   │
│   └── notifications/
│       └── formatter.js          # 한국어 메시지 포맷터
│
├── public/
│   ├── index.html                # 메인 대시보드 SPA (9개 페이지)
│   ├── login.html                # 로그인/회원가입 페이지
│   ├── css/style.css             # 프리미엄 다크 테마 CSS
│   └── js/app.js                 # 프론트엔드 JS (인증 인식)
│
├── docs/
│   └── plan.md                   # 이 매뉴얼 (웹 대시보드에서 열람 가능)
│
└── logs/                         # PM2 로그 (자동 생성)
```

---

## 5. 구현 완료 모듈 상세

### 5.1 🔐 인증 시스템 (Auth)

#### 웹 대시보드 인증
| 기능 | 상태 | 설명 |
|------|------|------|
| 로그인 | ✅ | 이메일 + 비밀번호, JWT 토큰 발급 (7일 유효) |
| 회원가입 | ✅ | bcrypt 해싱, 첫 사용자 자동 superadmin 승격 |
| 프로필 조회 | ✅ | `GET /api/auth/me` 현재 사용자 정보 |
| 자동 리다이렉트 | ✅ | 비인증 시 `/login`으로 이동 |

#### 역할 기반 접근 제어 (RBAC)
| 역할 | 권한 |
|------|------|
| `user` | 대시보드, 모니터링, 작업 이력 (본인 것만) |
| `admin` | + 전체 작업 이력 열람 |
| `superadmin` | + 사용자 관리, 역할 변경, 비밀번호 초기화, 감사 로그, 시스템 제어 |

#### SNS 사용자 인증
| 기능 | 상태 | 설명 |
|------|------|------|
| Telegram ID 인증 | ✅ | 관리자 ID 화이트리스트 |
| 감사 로그 | ✅ | 모든 명령 실행 기록 추적 |

### 5.2 📡 텔레그램 봇 게이트웨이

Grammy 기반 Telegram Bot으로 모바일에서 직접 서버 관리:

| 명령 | 설명 | 권한 |
|------|------|------|
| `/start` | 봇 소개 및 인사 | 전체 |
| `/help` | 전체 명령어 도움말 | 전체 |
| `/status` | 시스템 상태 (CPU/RAM/Disk) + 컨테이너 현황 | L1 조회 |
| `/containers` | Docker 컨테이너 목록 & 상태 | L1 조회 |
| `/projects` | Orbitron 등록 프로젝트 목록 | L1 조회 |
| `/disk` | 디스크 사용량 상세 | L1 조회 |
| `/uptime` | 서버 업타임 & 가동 시간 | L1 조회 |
| `/plan` | 구축계획서 요약 | L1 조회 |
| `/logs [이름]` | 컨테이너 로그 조회 (최근 30줄) | L2 수정 |
| `/deploy [이름]` | Orbitron 프로젝트 원격 배포 | L3 배포 |

### 5.3 📊 모니터링 엔진

#### 수집 항목 (30초 주기)
| 메트릭 | 소스 | 단위 |
|--------|------|------|
| CPU 사용률 | systeminformation | % |
| 메모리 사용량 | systeminformation | GB / % |
| 디스크 사용량 | systeminformation | GB / % |
| Docker 컨테이너 상태 | Dockerode | running/exited/created |
| 컨테이너 이미지/포트 | Dockerode | 문자열 |

#### 알림 규칙 엔진
| 규칙 | 임계값 | 쿨다운 |
|------|--------|--------|
| CPU 과부하 | > 90% | 5분 |
| 메모리 부족 | > 90% | 5분 |
| 디스크 공간 부족 | > 85% | 10분 |
| 컨테이너 다운 | state ≠ running | 5분 |
| 다중 컨테이너 동시 다운 | ≥ 2개 | 5분 |

### 5.4 🪐 Orbitron 연동

| 기능 | API | 상태 |
|------|-----|------|
| 자동 로그인 | `POST /api/auth/login` | ✅ |
| 프로젝트 목록 | `GET /api/projects/:groupId` | ✅ |
| 원격 배포 | `POST /api/projects/:id/deploy` | ✅ |
| 컨테이너 로그 | `docker logs` | ✅ |
| 인증 만료 자동 갱신 | 자동 재로그인 | ✅ |

### 5.5 🌐 웹 대시보드

#### 일반 사용자 페이지 (6개)
| 페이지 | 설명 |
|--------|------|
| 📊 **대시보드** | CPU/RAM/Disk 실시간 게이지 + Orbitron 컨테이너 현황 + 최근 작업 |
| 🐳 **컨테이너** | 전체 Docker 컨테이너 테이블 (상태/이미지/포트) |
| 📦 **프로젝트** | Orbitron 프로젝트 카드 (배포 버튼 + 로그 조회) |
| 📋 **작업 이력** | 명령 실행 기록 (상태/시간/결과) |
| 📖 **구축계획서** | 이 매뉴얼 (Markdown → HTML 렌더링) |
| 💬 **텔레그램 연동** | 봇 설정 가이드 + 연동 상태 + 명령어 레퍼런스 |

#### 🛡 최상위 관리자 전용 페이지 (3개)
| 페이지 | 설명 |
|--------|------|
| 🏠 **관리자 홈** | 전체 사용자 수, 주간 활성 사용자, 오늘 로그인 수, 시스템 현황, 최근 가입자 목록 |
| 👥 **사용자 관리** | 검색/필터, 역할 변경 (user↔admin↔superadmin), 계정 활성화/비활성화, 비밀번호 초기화 |
| 📜 **활동 로그** | 전체 감사 이력 — 로그인, 가입, 배포, 관리자 조작 등 시간순 기록 |

### 5.6 💾 데이터베이스 스키마

PostgreSQL 7개 테이블 (Orbitron DB 공유):

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|----------|
| `ragt_web_users` | 웹 대시보드 사용자 | email, password_hash, role, login_count |
| `ragt_users` | SNS 연동 계정 | platform, platform_user_id, auth_level |
| `ragt_tasks` | 작업 큐 이력 | command_raw, intent, status, priority |
| `ragt_metrics` | 시계열 메트릭 | metric_name, metric_value, labels(JSONB) |
| `ragt_notifications` | 알림 이력 | message_type, content, is_delivered |
| `ragt_audit_log` | 보안 감사 로그 | action, details(JSONB), ip_address |
| `ragt_sessions` | 활성 로그인 세션 | token_hash, expires_at, user_agent |

---

## 6. API 레퍼런스

### 6.1 공개 API (인증 불필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/health` | 서버 상태 확인 |
| `POST` | `/api/auth/login` | 로그인 (JWT 발급) |
| `POST` | `/api/auth/register` | 회원가입 |
| `GET` | `/api/plan` | 구축계획서 HTML |
| `GET` | `/api/telegram/status` | 텔레그램 봇 연동 상태 |

### 6.2 인증 필요 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/auth/me` | 현재 사용자 정보 |
| `PUT` | `/api/auth/profile` | 프로필 수정 |
| `GET` | `/api/metrics` | 시스템 + Docker 메트릭 |
| `GET` | `/api/tasks` | 작업 이력 (역할별 필터) |
| `GET` | `/api/orbitron/projects` | Orbitron 프로젝트 목록 |
| `POST` | `/api/orbitron/projects/:id/deploy` | 프로젝트 배포 |
| `GET` | `/api/orbitron/projects/:id/logs` | 컨테이너 로그 |

### 6.3 최상위 관리자 전용 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/admin/stats` | 전체 통계 (사용자/작업/시스템) |
| `GET` | `/api/admin/users` | 사용자 목록 (검색/필터/페이지네이션) |
| `GET` | `/api/admin/users/:id` | 사용자 상세 (연동계정/활동/작업통계) |
| `PUT` | `/api/admin/users/:id` | 역할/상태 변경 |
| `DELETE` | `/api/admin/users/:id` | 사용자 비활성화 (소프트 삭제) |
| `POST` | `/api/admin/users/:id/reset-password` | 비밀번호 초기화 |
| `GET` | `/api/admin/audit` | 감사 로그 (페이지네이션) |
| `GET` | `/api/admin/tasks` | 전체 작업 이력 |
| `POST` | `/api/admin/system/collect-metrics` | 강제 메트릭 수집 |

---

## 7. 설치 & 실행 가이드

### 7.1 최초 설치

```bash
# 1. 의존성 설치
cd /home/stevenlim/WORK/RemoteAGT
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 값 설정

# 3. PM2로 실행
pm2 start ecosystem.config.cjs

# 4. 상태 확인
pm2 list
curl http://localhost:4100/api/health
```

### 7.2 환경변수 (.env)

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | 4100 | 서버 포트 |
| `NODE_ENV` | development | 환경 |
| `DB_HOST` | localhost | PostgreSQL 호스트 |
| `DB_PORT` | 5432 | PostgreSQL 포트 |
| `DB_USER` | devuser | DB 사용자 |
| `DB_PASSWORD` | devpass123 | DB 비밀번호 |
| `DB_NAME` | devdb | DB 이름 |
| `JWT_SECRET` | remoteagt_dev_secret | JWT 시크릿 키 (프로덕션에서 변경 필수) |
| `TELEGRAM_BOT_TOKEN` | — | 텔레그램 봇 토큰 |
| `TELEGRAM_ADMIN_ID` | — | 텔레그램 관리자 ID |
| `ORBITRON_API_URL` | http://localhost:4000/api | Orbitron API 주소 |
| `METRIC_COLLECT_INTERVAL` | 30000 | 메트릭 수집 주기 (ms) |
| `ALERT_COOLDOWN` | 300000 | 알림 쿨다운 (ms) |

### 7.3 텔레그램 봇 연동

1. [@BotFather](https://t.me/BotFather)에게 `/newbot` 명령으로 봇 생성
2. 받은 토큰을 `.env`의 `TELEGRAM_BOT_TOKEN`에 입력
3. [@userinfobot](https://t.me/userinfobot)에서 자신의 Telegram ID 확인
4. ID를 `TELEGRAM_ADMIN_ID`에 입력
5. 서버 재시작: `pm2 restart remoteagt`

### 7.4 최초 관리자 계정 생성

1. 브라우저에서 `http://localhost:4100/login` 접속
2. "회원가입" 탭 클릭
3. 정보 입력 후 가입 → **첫 번째 가입자가 자동으로 최상위 관리자(superadmin)**
4. 이후 가입하는 모든 사용자는 일반 사용자(user)로 등록
5. 관리자 페이지에서 역할 변경 가능

### 7.5 PM2 관리 명령

```bash
pm2 start ecosystem.config.cjs     # 시작
pm2 restart remoteagt               # 재시작
pm2 stop remoteagt                  # 정지
pm2 logs remoteagt                  # 실시간 로그
pm2 logs remoteagt --lines 50      # 최근 50줄
pm2 list                            # 프로세스 상태
```

---

## 8. 관리자 운영 가이드

### 8.1 사용자 관리

**사용자 목록 확인**: 사이드바 → 🛡 최상위 관리자 → 👥 사용자 관리
- 이름/이메일 검색, 역할별 필터링 가능
- 각 사용자의 로그인 횟수, 마지막 로그인 시간 확인

**역할 변경**: 사용자 행의 ✏️ 버튼 → 역할 선택 → 저장
- `user` ↔ `admin` ↔ `superadmin`
- 자신의 superadmin 권한은 변경 불가 (보안)

**비밀번호 초기화**: 사용자 행의 🔑 버튼 → 새 비밀번호 입력

**계정 비활성화**: ✏️ 버튼 → 상태를 "비활성"으로 변경 → 저장

### 8.2 활동 모니터링

**감사 로그**: 사이드바 → 📜 활동 로그
- 모든 로그인, 가입, 배포, 관리자 조작 기록
- 시간, 사용자, 행동, 상세 정보, IP 주소 확인

### 8.3 시스템 모니터링

**관리자 홈**: 한눈에 보는 전체 현황
- 전체 사용자 수 / 주간 활성 사용자 / 오늘 로그인
- CPU / 메모리 / 디스크 / 컨테이너 실시간 상태

---

## 9. 개발 로드맵

### Phase 1: Foundation ✅ **완료**
- ✅ Node.js 프로젝트 설정 & 의존성
- ✅ Express 서버 + REST API
- ✅ PostgreSQL 스키마 (7 테이블)
- ✅ 텔레그램 봇 게이트웨이 (10+ 명령어)
- ✅ Dockerode + systeminformation 메트릭 수집
- ✅ 임계값 기반 알림 규칙 엔진
- ✅ Orbitron REST API 클라이언트 (자동 인증)
- ✅ 프리미엄 다크 테마 웹 대시보드 (6 페이지 SPA)
- ✅ JWT 인증 시스템 (로그인/회원가입)
- ✅ 역할 기반 접근 제어 (user/admin/superadmin)
- ✅ 최상위 관리자 대시보드 (사용자 관리/감사 로그/통계)
- ✅ PM2 배포 + GitHub 푸시

### Phase 2: Command & Control 🟡 **다음**
- 자연어 Commander Parser (Antigravity 연동)
- BullMQ 작업 큐 (우선순위, 재시도)
- 실시간 작업 진행률 WebSocket 푸시
- 자동 빌드/배포 파이프라인 연동
- 작업 결과 SNS 알림

### Phase 3: Intelligence 🟢
- AI 에러 분석 (Error Knowledge DB 연동)
- 일일/주간 자동 리포트 생성
- 트렌드 분석 (메트릭 시계열 차트)
- 이상 징후 자동 감지

### Phase 4: Multi-Platform 🔵
- 카카오톡 챗봇 (카카오 i 오픈빌더)
- 슬랙 앱 (Events API)
- 디스코드 봇 (Discord.js)
- 웹 대시보드 알림 센터

---

## 10. 기대 효과

| Before | After |
|--------|-------|
| PC 앞에서만 Antigravity 사용 | 📱 어디서든 SNS로 업무 지시 |
| SSH 접속해서 서버 상태 확인 | 📊 30초 자동 모니터링 + 즉시 알림 |
| 대시보드 접속해서 배포 | 🚀 `/deploy` 한 마디로 완료 |
| 에러 발생 후 나중에 확인 | 🔴 즉시 텔레그램 알림 + AI 분석 |
| 개별 사용자 관리 불가 | 🛡 관리자 대시보드로 전체 통제 |
| 누가 뭘 했는지 추적 불가 | 📜 전체 감사 로그 자동 기록 |
