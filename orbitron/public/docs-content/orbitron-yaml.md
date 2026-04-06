# orbitron.yaml 배포 설정 가이드

Orbitron은 프로젝트 루트에 `orbitron.yaml` 파일이 있으면 이를 최우선으로 읽어 배포 설정을 결정합니다.
**파일이 없어도** Orbitron은 소스 코드 구조를 분석하여 자동으로 설정을 감지하지만,
명시적으로 선언하면 더 정확하고 예측 가능한 배포가 가능합니다.

---

## 기본 구조

```yaml
# orbitron.yaml

# 1. 프로젝트 메타 정보 (선택)
project:
  name: my-app
  region: ap-northeast-2

# 2. 서비스 목록 (필수)
services:
  - name: api
    type: web
    runtime: node
    # ...

  - name: frontend
    type: static
    # ...

# 3. 데이터베이스 (선택)
databases:
  - name: main-db
    engine: postgres
```

---

## 서비스 설정 (services)

### 기본 속성

```yaml
services:
  - name: api              # 서비스 이름 (필수, 고유해야 함)
    type: web              # web | static | worker
    runtime: node          # node | python | go | rust | ruby | php | java | static
    rootDir: ./backend     # 소스 코드 경로 (기본: .)
    port: 3000             # 내부 포트 (자동 감지 가능)
```

| 속성 | 필수 | 기본값 | 설명 |
|------|:---:|--------|------|
| `name` | O | - | 서비스 식별자. 다른 서비스에서 `from:` 참조 시 사용 |
| `type` | - | `web` | `web`: Docker 컨테이너, `static`: Cloudflare Pages, `worker`: 백그라운드 |
| `runtime` | - | 자동감지 | 소스 코드에서 자동 감지 (`package.json` → node, `requirements.txt` → python 등) |
| `rootDir` | - | `.` | 모노레포에서 서비스 디렉토리 지정 |
| `port` | - | 자동감지 | `package.json`의 start 스크립트 또는 프레임워크 기본값에서 추론 |

### 빌드 & 실행 명령

```yaml
services:
  - name: api
    type: web
    build:
      command: "npm install && npm run build"
    start:
      command: "npm start"
```

**축약 문법** (호환):
```yaml
services:
  - name: api
    build_command: "npm install && npm run build"
    start_command: "npm start"
```

### 정적 사이트 (Cloudflare Pages)

```yaml
services:
  - name: landing
    type: static
    rootDir: ./website
    build:
      command: "npm run build"
    publish: dist           # 빌드 결과물 디렉토리
    pwa: true               # PWA 서비스 워커 활성화 (선택)
    routes:                 # SPA 라우팅 규칙
      - source: "/*"
        rewrite: "/index.html"
```

### 워커 (백그라운드 프로세스)

```yaml
services:
  - name: scheduler
    type: worker
    runtime: python
    rootDir: ./workers
    start:
      command: "python cron_worker.py"
```

> 워커는 외부 포트를 노출하지 않으며, Cloudflare 터널도 생성하지 않습니다.

### 헬스 체크

```yaml
services:
  - name: api
    type: web
    healthCheck:
      path: /api/health     # GET 요청을 보낼 경로
      interval: 30          # 초 단위 체크 주기
```

---

## 환경변수 (env) - 핵심 기능

orbitron.yaml의 가장 강력한 기능입니다. 단순 값 설정뿐 아니라 **서비스 간 자동 연결**과 **시크릿 자동 생성**을 지원합니다.

### 방법 1: 단순 값 설정

```yaml
services:
  - name: api
    env:
      - "NODE_ENV=production"
      - "LOG_LEVEL=info"
      - "MAX_UPLOAD_SIZE=10485760"
```

### 방법 2: 데이터베이스 자동 연결 (`from:`)

```yaml
databases:
  - name: main-db
    engine: postgres

services:
  - name: api
    env:
      - key: DATABASE_URL
        from: "database.main-db.connectionString"
```

**Orbitron이 자동으로 생성하는 값:**
```
postgresql://orbitron_user:orbitron_db_pass@orbitron-{subdomain}-db:5432/orbitron_db
```

> `from:` 참조는 **배포 시점에 실제 컨테이너 호스트명과 포트로 해석**됩니다.
> Docker 내부 네트워크(`orbitron_internal`)를 통해 통신하므로 `localhost`가 아닌 컨테이너 이름을 사용합니다.

**사용 가능한 `from:` 참조:**

| 참조 패턴 | 해석 결과 | 예시 |
|-----------|----------|------|
| `database.{name}.connectionString` | 전체 DB 접속 URL | `postgresql://user:pass@host:5432/db` |
| `database.{name}.host` | DB 컨테이너 호스트명 | `orbitron-myapp-db` |
| `database.{name}.port` | DB 내부 포트 | `5432` |
| `database.{name}.username` | DB 사용자명 | `orbitron_user` |
| `database.{name}.password` | DB 비밀번호 | `orbitron_db_pass` |
| `service.{name}.url` | 다른 서비스의 내부 URL | `http://orbitron-myapp-api:3000` |
| `service.{name}.host` | 다른 서비스의 호스트명 | `orbitron-myapp-api` |

### 방법 3: 서비스 간 URL 자동 연결

```yaml
services:
  - name: api
    type: web
    port: 8000

  - name: frontend
    type: web
    env:
      - key: API_URL
        from: "service.api.url"
      # → http://orbitron-myapp-api:8000 으로 자동 해석
```

### 방법 4: 시크릿 자동 생성

```yaml
services:
  - name: api
    env:
      - key: JWT_SECRET
        generate: true
      # → 배포 시 랜덤 256-bit 키 자동 생성 (예: "a3f8b2c1d4e5...")
      
      - key: SESSION_SECRET
        generate: true
```

> `generate: true`로 생성된 키는 **최초 배포 시 한 번만 생성**되며, 이후 재배포 시에도 같은 값을 유지합니다.

### 방법 5: 복합 사용

```yaml
databases:
  - name: app-db
    engine: postgres

services:
  - name: api
    type: web
    runtime: python
    rootDir: ./backend
    port: 8000
    build:
      command: "pip install -r requirements.txt"
    start:
      command: "uvicorn main:app --host 0.0.0.0 --port 8000"
    env:
      - "NODE_ENV=production"
      - key: DATABASE_URL
        from: "database.app-db.connectionString"
      - key: SECRET_KEY
        generate: true
      - key: REDIS_URL
        from: "database.cache.connectionString"
      - "ALLOWED_ORIGINS=[\"http://localhost\",\"https://myapp.twinverse.org\"]"
    healthCheck:
      path: /api/health
      interval: 30

  - name: frontend
    type: static
    rootDir: ./frontend
    build:
      command: "npm run build"
    publish: dist
    env:
      - key: VITE_API_URL
        from: "service.api.url"
```

---

## 데이터베이스 (databases)

```yaml
databases:
  - name: main-db        # DB 식별자 (env의 from: 참조에 사용)
    engine: postgres      # postgres | redis
    region: ap-northeast-2
    plan: starter         # starter | pro | enterprise
```

| 속성 | 필수 | 기본값 | 설명 |
|------|:---:|--------|------|
| `name` | O | - | DB 식별자. `from: "database.{name}.connectionString"` 에서 참조 |
| `engine` | - | `postgres` | `postgres` 또는 `redis` |
| `region` | - | 기본 리전 | 배포 리전 (현재 단일 서버) |
| `plan` | - | `starter` | 리소스 할당 등급 |

**Orbitron이 자동으로 처리하는 것:**
- PostgreSQL/Redis Docker 컨테이너 자동 생성
- 영구 데이터 볼륨 자동 관리 (컨테이너 재시작 시에도 데이터 유지)
- `orbitron_internal` 네트워크 자동 연결
- 서비스 간 DNS 자동 해석 (`orbitron-{subdomain}-db` 호스트명)

---

## Docker Compose 프로젝트

프로젝트에 `docker-compose.yml`이 있으면 Orbitron은 자동으로 Docker Compose 모드로 배포합니다.

### Orbitron이 자동으로 처리하는 것

1. **포트 충돌 방지**: `ports: "80:80"` → 프로젝트 할당 포트로 자동 재매핑
2. **네트워크 주입**: `orbitron_internal` 네트워크를 compose 파일에 자동 추가
3. **모든 서비스 네트워크 연결**: compose 내 모든 컨테이너를 내부 네트워크에 연결
4. **Nginx 프록시 자동 감지**: compose 내 `nginx`/`proxy` 서비스를 감지하여 올바른 upstream 설정
5. **`.env` 자동 생성**: `HTTP_PORT` 등 Orbitron 관련 변수를 `.env`에 자동 기록

### 로컬과 동일한 compose 파일 사용

```yaml
# docker-compose.yml (로컬에서도, Orbitron에서도 동일하게 동작)
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "${POSTGRES_PORT:-5433}:5432"       # 로컬: 5433, Orbitron: 자동
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-myapp_db}
      POSTGRES_USER: ${POSTGRES_USER:-myapp_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}

  backend:
    build: ./backend
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-myapp_user}:${POSTGRES_PASSWORD:-dev_password}@postgres:5432/${POSTGRES_DB:-myapp_db}

  frontend:
    build: ./frontend

  nginx:
    image: nginx:alpine
    ports:
      - "${HTTP_PORT:-80}:80"               # 로컬: 80, Orbitron: 자동 재매핑
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
      - frontend
```

> **팁:** 환경변수에 `${VAR:-default}` 문법을 사용하면 로컬 기본값과 Orbitron 배포 값을 분리할 수 있습니다.
> Orbitron은 배포 시 `.env` 파일을 자동 생성하여 `HTTP_PORT`, `POSTGRES_PORT` 등을 주입합니다.

---

## 레거시 형식 (하위 호환)

이전 버전의 최소 설정도 계속 지원됩니다:

```yaml
# 최소 설정 (레거시)
build_command: "npm install"
start_command: "npm start"
port: 3000
env_vars:
  NODE_ENV: "production"
```

```yaml
# 풀스택 설정 (레거시)
type: fullstack
frontend:
  path: ./frontend
  build: npm run build
backend:
  path: ./backend
  runtime: node
  port: 3000
```

> 레거시 형식은 계속 작동하지만, 새 프로젝트에서는 `services` 배열 형식을 권장합니다.

---

## 실전 예제

### 예제 1: Next.js + PostgreSQL

```yaml
databases:
  - name: app-db
    engine: postgres

services:
  - name: web
    type: web
    runtime: node
    build:
      command: "npm install && npm run build"
    start:
      command: "npm start"
    port: 3000
    env:
      - "NODE_ENV=production"
      - key: DATABASE_URL
        from: "database.app-db.connectionString"
      - key: NEXTAUTH_SECRET
        generate: true
```

### 예제 2: FastAPI + React (풀스택)

```yaml
databases:
  - name: main-db
    engine: postgres

services:
  - name: api
    type: web
    runtime: python
    rootDir: ./backend
    port: 8000
    build:
      command: "pip install -r requirements.txt"
    start:
      command: "uvicorn main:app --host 0.0.0.0 --port 8000"
    env:
      - key: DATABASE_URL
        from: "database.main-db.connectionString"
      - key: SECRET_KEY
        generate: true
      - "ALLOWED_ORIGINS=[\"https://myapp.twinverse.org\"]"
    healthCheck:
      path: /api/health
      interval: 30

  - name: frontend
    type: static
    rootDir: ./frontend
    build:
      command: "npm run build"
    publish: dist
    env:
      - key: VITE_API_URL
        from: "service.api.url"
```

### 예제 3: 마이크로서비스 (3개 서비스 + DB + Redis)

```yaml
databases:
  - name: user-db
    engine: postgres
  - name: cache
    engine: redis

services:
  - name: auth-service
    type: web
    runtime: node
    rootDir: ./services/auth
    port: 4001
    env:
      - key: DATABASE_URL
        from: "database.user-db.connectionString"
      - key: REDIS_URL
        from: "database.cache.connectionString"
      - key: JWT_SECRET
        generate: true

  - name: api-gateway
    type: web
    runtime: node
    rootDir: ./services/gateway
    port: 4000
    env:
      - key: AUTH_SERVICE_URL
        from: "service.auth-service.url"
      - key: REDIS_URL
        from: "database.cache.connectionString"

  - name: admin-panel
    type: static
    rootDir: ./admin
    build:
      command: "npm run build"
    publish: dist
    env:
      - key: VITE_API_URL
        from: "service.api-gateway.url"
```

### 예제 4: 워커 + API

```yaml
databases:
  - name: jobs-db
    engine: postgres

services:
  - name: api
    type: web
    runtime: python
    port: 8000
    env:
      - key: DATABASE_URL
        from: "database.jobs-db.connectionString"

  - name: background-worker
    type: worker
    runtime: python
    rootDir: ./worker
    start:
      command: "python celery_worker.py"
    env:
      - key: DATABASE_URL
        from: "database.jobs-db.connectionString"
      - "CELERY_BROKER_URL=redis://orbitron-myapp-cache:6379"
```

---

## 설정 우선순위

Orbitron은 다음 우선순위로 배포 설정을 결정합니다:

```
1. orbitron.yaml (최우선)
   ↓ 없으면
2. docker-compose.yml / docker-compose.yaml
   ↓ 없으면
3. # CUSTOM 마크가 있는 Dockerfile
   ↓ 없으면
4. 소스 코드 자동 분석 (Smart Detect)
   - package.json → Node.js
   - requirements.txt → Python
   - frontend/ + backend/ → 풀스택
   - index.html만 → 정적 사이트
```

---

## 자주 묻는 질문

### Q: orbitron.yaml 없이도 배포 가능한가요?
**A:** 네. Orbitron은 소스 코드 구조를 분석하여 10종 이상의 프로젝트 타입을 자동 감지합니다. orbitron.yaml은 **자동 감지로 부족한 부분을 명시적으로 선언**할 때 사용합니다.

### Q: 환경변수의 `from:` 참조가 해석되는 시점은?
**A:** **배포 시점**입니다. Orbitron이 소스 코드를 빌드하기 전에 orbitron.yaml을 파싱하고, `from:` 참조를 실제 값으로 해석하여 Docker 컨테이너의 환경변수로 주입합니다.

### Q: `generate: true`로 생성된 시크릿은 재배포 시 바뀌나요?
**A:** 아니요. 최초 배포 시 한 번만 생성되며, 이후 재배포 시에도 동일한 값이 유지됩니다. 대시보드의 환경변수 페이지에서 확인/변경할 수 있습니다.

### Q: Docker Compose 프로젝트에서도 orbitron.yaml이 필요한가요?
**A:** 아니요. `docker-compose.yml`이 있으면 Orbitron이 자동으로 Compose 모드로 배포합니다. 포트 충돌 방지, 네트워크 주입 등을 자동으로 처리합니다. 로컬에서 쓰던 compose 파일을 **수정 없이** 그대로 사용할 수 있습니다.

### Q: 프로젝트 그룹(멀티서비스)과 orbitron.yaml의 services 배열은 다른 건가요?
**A:** 네. `orbitron.yaml`의 `services`는 **하나의 프로젝트 안의 서비스 구성**이고, 프로젝트 그룹은 **여러 독립 프로젝트를 묶어서 의존성 순서 배포**하는 것입니다. 대시보드의 "프로젝트 그룹" 기능에서 DB→Backend→Frontend 순서 배포, DATABASE_URL 자동 주입 등을 사용할 수 있습니다.
