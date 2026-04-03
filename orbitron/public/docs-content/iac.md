# Infrastructure as Code (orbitron.yaml) 완벽 가이드

대시보드 화면상에서 마우스를 이리저리 조작해가며 세팅을 바꾸는 것도 귀찮으신 베테랑 서버 개발자이신가요? 

**Infrastructure as Code (IaC)**, 이른바 '코드로 짜는 인프라' 기능은 프로젝트 소스 폴더 최상단(Root)에 `orbitron.yaml` 이라는 작은 텍스트 문서 하나만 툭 던져두는 것만으로 대시보드 접속 없이 배포의 모든 세팅(포트, 시작 명령어, 환경 변수 등)을 로봇처럼 자동 결정하는 절대 구문입니다.

---

## 📄 기본 설계 철학 (How it Works)

1. Orbitron 시스템은 GitHub에서 코드를 당겨올 때 가장 먼저 최상단에 `orbitron.yaml` 파일이 숨어있는지 탐색합니다.
2. 만약 발견된다면, 여러분이 대시보드의 웹 UI 폼에서 입력해 둔 값들보다 **이 YAML 파일 안의 명세서를 최우선(Override)**으로 읽고 복종하여 컨테이너 환경을 뚝딱 만들어냅니다.
3. 따라서 코드 로직이 바뀌면서 실행 명령어(Start Command)가 바뀌어야 할 때마다 대시보드에 들어올 필요 없이, 소스 코드랑 같이 YAML 파일 단 한 줄만 푸시해 버리면 서버 아키텍처까지 알아서 변경됩니다!

---

## 🧠 스마트 프로젝트 분석기 (Smart Project Analyzer)

> ✨ **2026.03 업데이트**: `orbitron.yaml` 파일이 없어도 Orbitron이 알아서 프로젝트 구조를 100% 스캔합니다!

Orbitron의 빌트인 **Smart Project Analyzer**는 배포 시 자동으로 다음을 감지합니다:

| 분석 항목 | 설명 |
|-----------|------|
| **런타임** | Node.js, Python, Go, Rust, Ruby, PHP, Java, Static |
| **프레임워크** | FastAPI, Django, Express, NestJS, Vite, Next.js, CRA 등 20종+ |
| **서비스 타입** | `web` (Docker), `static` (CF Pages), `worker` (백그라운드) |
| **포트** | 코드/설정에서 포트 자동 추출, 프레임워크별 기본값 적용 |
| **빌드/시작 명령** | `package.json`, `requirements.txt` 등에서 자동 추출 |
| **의존관계** | frontend→backend, backend→database 관계 자동 추론 |
| **배포 순서** | 의존관계 기반 토폴로지 정렬로 최적 배포 순서 결정 |

`orbitron.yaml`이 있으면 해당 파일이 **절대 권위(Authoritative Source)**로 사용되고, 없으면 자동 분석 결과가 적용됩니다.

---

## 🏗 기본 구조 — 단일 서비스

딱 하나의 `services` 블록 밑에 여러분의 앱을 정의하면 끝입니다.

```yaml
# orbitron.yaml — 가장 단순한 형태
services:
  web:
    build_command: "npm install && npm run build"
    start_command: "npm start"
    port: 3000
    env:
      - "NODE_ENV=production"
      - "API_VERSION=v2.5.1"
```

---

## 🚀 멀티 서비스 구조 (Multi-Service Deployment)

> ✨ **2026.03 신규**: 하나의 레포에 여러 앱(백엔드, 프론트엔드, 직원앱 등)이 있을 때, `services` 배열로 모두 정의하면 **각 서비스를 자동으로 올바른 타겟에 배포**합니다!

### 서비스 타입별 배포 타겟

| 타입 | 배포 타겟 | 설명 |
|------|-----------|------|
| `web` | Docker 컨테이너 | 서버 사이드 앱 (FastAPI, Express, Django 등) |
| `static` | Cloudflare Pages | 순수 프론트엔드 (React, Vue, Vite 등) — **자동 CDN 글로벌 배포** |
| `worker` | Docker 컨테이너 (포트 없음) | 백그라운드 작업 (큐 소비자, 크론 등) |

### 멀티 서비스 전체 문법

```yaml
# orbitron.yaml — 매장 관리 시스템 (백엔드 + 관리자 앱 + 직원 앱)
project:
  name: sodam-fn
  region: ap-northeast-2  # 서울

services:
  # ─── 백엔드 API ───
  - name: sodam-backend
    type: web
    runtime: python
    rootDir: SodamApp/backend
    build:
      command: "pip install -r requirements.txt"
    start:
      command: "gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT"
    env:
      - key: DATABASE_URL
        from: database.sodam-db.connectionString   # ← DB 자동 연결!
      - key: SECRET_KEY
        generate: true                              # ← 시크릿 자동 생성!
      - key: STAFF_APP_URL
        from: service.sodam-staff.url               # ← 서비스 간 URL 자동 주입!
    healthCheck:
      path: /api/health
      interval: 30

  # ─── 관리자 프론트엔드 (Vite + React) ───
  - name: sodam-frontend
    type: static              # ← Cloudflare Pages로 자동 배포!
    rootDir: SodamApp/frontend
    build:
      command: "npm install && npm run build"
    publish: ./dist
    env:
      - key: VITE_API_URL
        from: service.sodam-backend.url
    routes:
      - source: "/*"
        rewrite: /index.html   # SPA 라우팅 폴백

  # ─── 직원용 PWA 앱 ───
  - name: sodam-staff
    type: static
    rootDir: SodamApp/staff-app
    build:
      command: "npm install && npm run build"
    publish: ./dist
    env:
      - key: VITE_API_URL
        from: service.sodam-backend.url
    pwa: true                  # PWA(서비스 워커) 활성화

databases:
  - name: sodam-db
    engine: postgres
    region: ap-northeast-2
    plan: starter
```

### `from:` 참조 문법 (서비스 간 자동 연결)

서비스 사이의 URL이나 연결 문자열을 하드코딩할 필요 없습니다! `from:` 키워드로 다른 서비스/데이터베이스를 참조하면 Orbitron이 배포 시 실제 값으로 자동 치환합니다.

| 참조 문법 | 설명 |
|-----------|------|
| `service.{이름}.url` | 해당 서비스의 배포 URL |
| `database.{이름}.connectionString` | DB 연결 문자열 |
| `generate: true` | 랜덤 시크릿 키 자동 생성 |

---

## 💡 실전 예제 (Framework Examples)

### 1. Next.js (SSR Node 환경)

```yaml
services:
  web:
    type: web-service
    build_command: "npm ci && npm run build"
    start_command: "npm run start"
    port: 3000
    env:
      - "NODE_ENV=production"
```

### 2. Python Django + Gunicorn (방탄 서버)

파이썬의 경우는 내장 `manage.py runserver`로 상용 배포하면 절대 안 됩니다! 반드시 `pip install gunicorn`을 선행한 뒤, `gunicorn` 이라는 튼튼한 총알받이 서버 모듈로 돌려야 수십 명의 동시 접속 트래픽에 파이프가 터지지 않습니다.

```yaml
services:
  web:
    type: web-service
    build_command: "pip install -r requirements.txt && python manage.py migrate"
    start_command: "gunicorn myproject.wsgi:application --bind 0.0.0.0:8000"
    port: 8000
    env:
      - "DJANGO_SETTINGS_MODULE=myproject.settings.prod"
```

### 3. 정적 사이트 React CRA (Vite, Svelte 등)

```yaml
services:
  web:
    type: static-site
    build_command: "npm install && npm run build"
    publish_dir: "build"  # Vite나 Svelte라면 "dist" 로 적으세요
```

---

## 🔄 배포 파이프라인 자동 흐름

`orbitron.yaml`이 있는 프로젝트의 배포 과정:

1. **📥 소스 코드 가져오기** — GitHub에서 clone/pull
2. **🧠 프로젝트 구조 분석** — `orbitron.yaml` 파싱 또는 자동 감지 (Smart Project Analyzer)
3. **📊 매니페스트 생성** — 모든 서비스 목록, 타입, 의존관계 확정
4. **📄 Static 서비스 배포** — `type: static` → Cloudflare Pages 자동 빌드/배포
5. **🔨 Docker 이미지 빌드** — `type: web` → Docker 컨테이너 빌드/시작
6. **🌐 프록시 설정** — Nginx 리버스 프록시 자동 갱신
7. **🔗 터널 연결** — Cloudflare Tunnel로 외부 접속 활성화
8. **✅ 배포 완료** — 3개, 5개, 10개 서비스든 한 번의 재배포로 끝!

아주 간단하죠? Orbitron은 똑똑한 지니 요정처럼 이 종이 한 장을 읽고 인프라를 지어냅니다.

---

## ⚙️ 환경변수 기반 빌드 제어 (2026.04 신규)

> ✨ **2026.04 업데이트**: `orbitron.yaml` 외에도 프로젝트 환경변수로 빌드 동작을 미세 조정할 수 있게 되었습니다.

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `DOCKER_NO_CACHE` | `false` | `true`로 설정 시 Docker 빌드 캐시를 비활성화하고 전체 리빌드를 수행합니다. 의존성 캐시가 꼬였을 때 유용합니다. |
| `TUNNEL_DOMAIN` | `twinverse.org` | 프로젝트에 할당되는 서브도메인의 루트 도메인을 변경합니다. 자체 Cloudflare 도메인이 있는 경우 사용합니다. |

### 사용 예시

```yaml
# orbitron.yaml
services:
  web:
    build_command: "npm ci && npm run build"
    start_command: "npm start"
    port: 3000
    env:
      - "NODE_ENV=production"
      - "DOCKER_NO_CACHE=true"    # 이번 배포는 완전 클린 빌드로!
```

또는 대시보드의 **Settings > 환경 변수** 탭에서 `DOCKER_NO_CACHE=true`를 추가해도 동일하게 작동합니다.
