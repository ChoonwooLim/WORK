# Orbitron Pixel Streaming 플랫폼 — Orbitron 적응 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Orbitron 대시보드에 슬롯 기반 Pixel Streaming 호스팅 기능을 일급 시민으로 내장한다. 사용자가 UE5 Linux 빌드 zip을 업로드하면 자동으로 이미지 빌드·원격 GPU 서버 배포·서브도메인 할당·on-demand 기동까지 수행.

**Architecture:** 업로드·오케스트레이션은 Orbitron(192.168.219.101:4000 PM2), 실제 UE5 런타임은 twinverse-ai(192.168.219.117 RTX 3090)에서 실행. Cloudflare Tunnel이 `<slot>.ps.twinverse.org` 시그널링(WebSocket)을 라우팅, WebRTC 미디어 플레인은 별도 경로(Phase 0 결정).

**Tech Stack:** Node.js 24 / Express / PostgreSQL / tus-node-server / Docker CDI runtime / cloudflared / SSH+rsync / SSE

**Source-of-Truth 참조 문서 (둘 다 shared drive `Z:\OrbitronHandoff\`):**
- 설계 스펙: `2026-04-15-pixel-streaming-platform-design.md` (계약 기준 — 플랜과 충돌 시 스펙이 승)
- 원본 플랜: `2026-04-15-pixel-streaming-platform.md` (Phase 0-7, ~35 task 단위 TDD)

**이 문서의 역할:** 원본 플랜을 Orbitron 실제 상태에 맞춰 **적응·보강**. 원본이 추상화한 부분을 구체 파일 경로·레거시 제거·환경 팩트 수정으로 채워 외부 AI가 바로 실행 가능하게 만든다.

---

## Pre-flight: 실환경 팩트 수정 (핸드오프 README 오류 반영)

구현 착수 전 외부 AI/개발자가 반드시 인지해야 할 실환경 상태. 원본 README-handoff.md의 오류 내용을 실측값으로 교체한다.

| 항목 | 원본 문서 | 실제 (2026-04-15 검증) |
|------|----------|----------------------|
| Orbitron 런타임 | `systemd devdeploy.service` | **PM2** — `pm2 restart orbitron`. `/home/stevenlim/WORK/orbitron/devdeploy.service` 파일은 **고아 stub** (WorkingDirectory 경로가 `devdeploy/`로 잘못됨, systemctl 미등록). 실행은 `pm2 list` → id=1 orbitron 프로세스. |
| GPU 서버 OS | Ubuntu 22.04 | **Ubuntu 24.04.4 LTS** (kernel 6.8.0-107) |
| Docker NVIDIA 접근 | "NVIDIA runtime" 암묵적 가정 | **CDI spec** 기반. compose/run 시 `--runtime=nvidia` 금지, 대신 `--device nvidia.com/gpu=all` 또는 `--gpus all`. Docker 29.4.0. |
| `.env` 위치 | `/home/stevenlim/WORK/orbitron/.env` | ✅ 정확. 단 **`DATABASE_URL` 없음** — DB 접속(`devuser/devpass123@localhost/devdb`)은 `db/db.js` 내 하드코딩/기본값. 필요 시 env 주입 지원 추가 필요. |
| 보안 경고 | 없음 | ⚠️ `.env`에 `SUDO_PASSWORD` 평문. `ADMIN_PASSWORD=admin1234` 약함. 외부 AI 핸드오프 전 **반드시 .env 공유 금지 + 계정 회전** |
| 한국 ISP 인바운드 | 언급 없음 | 🔴 LG U+ 회선에서 TCP 80/443 인바운드 **ISP silent drop**. Orbitron으로의 외부 진입은 **반드시 Cloudflare Tunnel 경유**. HTTP-01 ACME 직접 불가. |

---

## Pre-flight: 레거시 Pixel Streaming 코드 철거

**문제:** Orbitron에 이미 `routes/pixelStreaming.js`(46줄) + `services/pixelStreaming.js`(109줄)가 존재. 이것은:
- 포트 8888-8893 6슬롯 **매치메이커** 패턴
- **로컬 dual GTX 1080** 가정 (`--gpus device=0|1`)
- 세션당 컨테이너 하나, projectName 기반 이미지 이름 (`orbitron-${projectName}`)
- 신규 슬롯 기반 설계와 **스키마·URL·GPU 호스트·수명주기 모두 충돌**

**결정:** 신규 시스템과 경로를 분리하고 레거시는 완전 제거.

| 레거시 경로 | 조치 |
|-------------|------|
| `app.use('/api/pixel-streaming', ...)` ([server.js:81](server.js)) | **삭제** |
| [routes/pixelStreaming.js](routes/pixelStreaming.js) | **삭제** (신규는 `routes/psSlots.js` 경로로) |
| [services/pixelStreaming.js](services/pixelStreaming.js) | **삭제** (신규는 `services/psSlots/*.js`) |
| `PIXEL_STREAM_IMAGE` env 사용처 | grep 후 일괄 제거 |
| 프론트 호출부 (`/api/pixel-streaming/match` 등) | grep 후 일괄 제거 |

구현 체크:

- [ ] **A-1: 레거시 참조 전체 스캔**
  ```bash
  cd /home/stevenlim/WORK/orbitron
  grep -rn 'pixel-streaming\|pixelStreaming\|PIXEL_STREAM_IMAGE' \
    --include='*.js' --include='*.html' \
    --exclude-dir=node_modules --exclude-dir=deployments
  ```
  Expected: `routes/pixelStreaming.js`, `services/pixelStreaming.js`, `server.js:81`, public 프론트 호출부. 결과를 브리프 제출.

- [ ] **A-2: 레거시 파일 삭제 + server.js 라우트 제거**
  ```bash
  git rm routes/pixelStreaming.js services/pixelStreaming.js
  ```
  [server.js:81](server.js) `app.use('/api/pixel-streaming', ...)` 한 줄 삭제.

- [ ] **A-3: 프론트 참조 제거 (A-1 스캔 결과 기반)**
  public HTML/JS에서 `/api/pixel-streaming/*` 호출부 전부 삭제.

- [ ] **A-4: PM2 재기동 후 404 검증**
  ```bash
  pm2 restart orbitron
  curl -sI http://localhost:4000/api/pixel-streaming/status
  ```
  Expected: HTTP/1.1 404 Not Found.

- [ ] **A-5: Commit**
  ```bash
  git add -A
  git commit -m "refactor: remove legacy matchmaker pixel-streaming in favor of slot system"
  ```

---

## Phase 0 — 사전 조사 & 스캐폴딩

### 원본 플랜 Task 0-1 ~ 0-4를 기반으로, 아래 Orbitron-특화 조사 항목을 **추가**한다.

### Task 0-A: WebRTC 미디어 플레인 전송 경로 결정 🔴 Critical

원본 스펙은 시그널링(`<slot>.ps.twinverse.org` WebSocket)이 CF Tunnel 경유로 라우팅됨을 가정하지만, **WebRTC 미디어 스트림(UDP/ICE)은 CF 일반 Tunnel이 전달 못 함**. 3개 옵션 중 선택 후 Steven 승인:

| 옵션 | 구조 | 장단 |
|------|------|------|
| **A. 공인 IP 직노출** | twinverse-ai에 공인 IP 할당 또는 포트포워딩, ICE가 GPU 서버 IP:port 직접 연결 | 🔴 LG U+ ISP 차단 (80/443 외 포트도 drop) — 테스트 필요. 단순하지만 리스크. |
| **B. TURN over TCP/443 (coturn)** | Orbitron 호스트 또는 별도 VPS에 coturn, 모든 WebRTC 트래픽을 TURN relay. CF Tunnel은 TURN 포트까지만 통과 | 🟡 대역폭 병목 가능, coturn 서버 증설 필요 |
| **C. Cloudflare Spectrum (유료 Enterprise)** | UDP 포트까지 CF Edge로 라우팅 | 🔴 가격 협상 필요, 오버엔지니어링 가능성 |

**권장 초안**: Phase B는 **B안** (coturn on Orbitron host, TURN/443 TCP fallback)으로 일단 착수. 테스트 결과 따라 A 또는 C로 업그레이드.

구현 체크:

- [ ] **0-A-1: coturn 설치 가능성 & 리소스 영향 조사**
  Orbitron 호스트 디스크/CPU 여유, UFW rule 필요 여부, CF Tunnel과의 포트 충돌 확인.
- [ ] **0-A-2: 결정 보고서 작성**: 선택된 옵션과 근거, 예상 설정, Phase 3/5에서의 영향 한 장짜리 메모.
- [ ] **0-A-3: Steven 승인 게이트** — 승인 없이 Phase 1 진행 금지.

### Task 0-B: 한국 ISP 제약 조건 고정 기록

- [ ] **0-B-1: `docs/pixel-streaming/runtime-constraints.md` 작성**
  - LG U+ TCP 80/443 inbound silent drop (검증 기록: 공유 문서 [infra_korean_isp_inbound_block.md](../../../memory/infra_korean_isp_inbound_block.md))
  - 공인 IP `112.156.177.187` (ipify 기준 진실, 공유기 표시값 신뢰 X)
  - 결론: **모든 외부 진입은 CF Tunnel 경유 필수**, HTTP-01 ACME 직접 발급 금지
- [ ] **0-B-2: Commit**: `docs: freeze ISP/CF-only runtime constraints for pixel streaming`

### Task 0-C: cloudflared 터널 인프라 현황 문서화 (원본 0-3 확장)

원본 플랜은 "Tunnel 설정 파일 위치는 Phase 0 조사 대상"으로 둠. 실제는 이미 파악됨:

- 위치: `/home/stevenlim/.cloudflared/config-devdeploy-<proj>.yml` (프로젝트당 1개)
- Systemd 유닛: `cloudflared-devdeploy-<proj>.service` (시스템 레벨)
- 이미 실행 중인 유닛 10+개 (dashboard, iiff, iiff-db, kcontentshub, k-contenthub-db, remoteagt, sodamfn, twinverse, twinverseai, twinverseai-db, wra)
- ⚠️ **좀비 유닛**: `cloudflared-devdeploy-my-retry-worker.service` 가 activating/auto-restart 상태로 flapping 중. 신규 PS 작업은 **이 유닛 건드리지 말 것**.

- [ ] **0-C-1: 신규 터널 유닛 네이밍 결정**: `cloudflared-devdeploy-psslots.service` (또는 슬롯별 분리 vs 통합 결정)
- [ ] **0-C-2: 결정 보고서 + Steven 승인**

### Task 0-D: Docker CDI runtime 템플릿 검증

원본 스펙 §7 "NVIDIA runtime" → 실제 **CDI**. 원본 플랜 Task 3-1 Dockerfile 템플릿과 Task 3-4 compose 템플릿이 올바른 플래그를 쓰는지 사전 검증.

- [ ] **0-D-1: 테스트용 `docker run --device nvidia.com/gpu=all nvidia/cuda:12.0.0-base nvidia-smi` 실행**
  twinverse-ai에서 수행. 성공 시 compose 템플릿에 동일 패턴 반영.
- [ ] **0-D-2: `docker info | grep -iE 'runtimes|cdi'` 결과를 문서에 기록**

### Task 0-E: 원본 플랜 Task 0-1 ~ 0-4 그대로 수행

`2026-04-15-pixel-streaming-platform.md`의 Task 0-1(브랜치 생성), 0-2(프론트 스택 조사), 0-3(Wilbur API 조사), 0-4(상수 파일) 그대로 이행. 본 문서에서는 중복 기술 생략.

**Phase 0 완료 게이트:** 위 모든 보고서 Steven 리뷰 → 승인 → Phase 1 착수.

---

## Phase 1 — 데이터 모델 & 슬롯 CRUD

원본 플랜 Phase 1 그대로 수행하되 아래 Orbitron-특화 수정.

### 적응 포인트

- **마이그레이션 위치**: 원본 플랜이 경로 비특정. Orbitron은 `db/schema.sql` 단일 파일 + 부트 시 idempotent 실행 방식 채택 중 (검증: [db/db.js](db/db.js)). 신규 테이블은 해당 파일 끝에 `CREATE TABLE IF NOT EXISTS ps_slots (...) ...` 형태로 추가 + 별도 `db/migrations/2026-04-15-ps-slots.sql` 에 원본 저장.
- **DAO 배치**: 원본 플랜 Task 1-3/1-4는 `src/dao/*`을 가정. Orbitron 실제 구조는 `services/*.js`에 비즈니스 + SQL 혼재. 본 플랜은 **`services/psSlots/dao.js` + `services/psSlots/versionDao.js`** 로 명명 (폴더 분리해 파일 크기 관리).
- **라우트 배치**: `routes/psSlots.js` (슬롯 CRUD) + `routes/psUploads.js` (tus) + `routes/psRuntime.js` (start/stop/status) + `routes/psPublic.js` (랜딩). 원본 플랜의 단일 라우트 파일 가정을 4개로 분리.
- **server.js 마운트**:
  ```js
  // server.js, 기존 projects/domains 라우트 근처
  app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/psSlots'));
  app.use('/api/uploads', authMiddleware, require('./routes/psUploads'));
  app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/psRuntime'));
  app.use('/api/public', require('./routes/psPublic'));  // 인증 없음 + rate-limit
  ```
- **authMiddleware / viewerGuard**: 기존 [middleware/auth.js](middleware/auth.js), [middleware/viewerGuard.js](middleware/viewerGuard.js) 재사용.

### Phase 1 체크 (원본 Task 1-1 ~ 1-5 참조)

- [ ] **1-1: 스키마 추가** — `db/migrations/2026-04-15-ps-slots.sql` 생성 + `db/schema.sql`에 `CREATE TABLE IF NOT EXISTS` 블록 append. 원본 스펙 §3 SQL 그대로 사용하되 `active_version` FK는 `DEFERRABLE INITIALLY DEFERRED` 유지.

- [ ] **1-2: 마이그레이션 idempotent 검증**
  ```bash
  PGPASSWORD=devpass123 psql -h localhost -U devuser -d devdb -f db/migrations/2026-04-15-ps-slots.sql
  PGPASSWORD=devpass123 psql -h localhost -U devuser -d devdb -c '\d ps_slots'
  ```
  두 번 실행해도 에러 없어야 함.

- [ ] **1-3: `services/psSlots/dao.js`** — `listByProject`, `findById`, `create`, `update`, `remove`, `findByName`.
- [ ] **1-4: `services/psSlots/versionDao.js`** — `listBySlot`, `findById`, `create`, `remove`, `findActive`, `enforceFifoN3`.
- [ ] **1-5: `routes/psSlots.js`** — `GET/POST /api/projects/:projectId/ps-slots`, `PATCH/DELETE /api/projects/:projectId/ps-slots/:slotId`. 포트 자동 배정(8081-8999 범위에서 DB 조회 + 사용 중 제외) · subdomain 자동 생성 · Cloudflare/ingress는 Phase 4에 훅.

**⚠️ 스키마 필드 보존 경고** (외부 AI 주의):
`owner_user_id`, `tenant_id`, `pinned` 컬럼은 **Phase C 예비**. 현재 사용처 없음. 외부 AI가 "unused column → 제거"하지 않도록 **마이그레이션 파일 상단에 명시 주석** + `dao.js` 인터페이스에서 해당 필드를 읽고 유지(수정은 안 함)하도록 설계. 불변 테스트(`fields preserved`) 추가.

- [ ] **1-6: 불변 테스트** — `ps_slots` SELECT 결과에 `owner_user_id`, `tenant_id`, `pinned` 3개 필드 존재 여부 확인.

---

## Phase 2 — 업로드 & 압축 해제 검증

원본 플랜 Phase 2 그대로 수행. 아래 Orbitron-특화 수정.

### 적응 포인트

- **업로드 저장 루트**: `/srv/pixelstreaming/` 생성 권한은 root. stevenlim 사용자 소유로 변경 (`sudo mkdir -p /srv/pixelstreaming && sudo chown stevenlim:stevenlim /srv/pixelstreaming`) — 설치 스크립트 `scripts/setup-ps-storage.sh` 제공.
- **tus 구현**: `tus-node-server` v1.x 사용. Orbitron `package.json` dependencies에 추가. 파일 저장소 드라이버는 `FileStore`, 업로드 루트 `/srv/pixelstreaming/_uploads/`로 분리 후 finalize 시 `versions/v<N>/upload.zip`으로 이동.
- **20GB 제한**: tus `maxSize: 20 * 1024 ** 3`. 또한 PG 체크 제약(`ps_versions.upload_size_b <= 21474836480`) 추가.
- **파일 검증**: Node의 `unzipper` 스트리밍 + path traversal 차단(`entry.path.includes('..')` 또는 `path.isAbsolute`). UE5 필수 파일 매처는 정규식 기반:
  ```js
  const REQUIRED = [
    /^Package\/Linux\/[^/]+\/Binaries\/Linux\/[^/]+-Linux-Shipping$/,
    /^Package\/Linux\/[^/]+\/Content\/Paks\/.+\.ucas$/,
  ];
  ```

### Phase 2 체크 (원본 Task 2-1 ~ 2-5)

원본 플랜 그대로 이행. 구현 파일 경로만 Orbitron 규칙으로 교체:
- `routes/psUploads.js` — tus 엔드포인트
- `services/psSlots/extractor.js` — zip 검증/추출 유틸
- `services/psSlots/pipeline.js` — finalize → 빌드 파이프라인 오케스트레이터
- `tests/psSlots/extractor.test.js` — path traversal 공격 벡터 3종 (dotdot, symlink bomb, abs path) 유닛 테스트

---

## Phase 3 — Docker 이미지 빌드 & GPU 호스트 전송

원본 플랜 Phase 3 그대로 수행. 아래 적응.

### 적응 포인트

- **Dockerfile 템플릿 위치**: `/home/stevenlim/WORK/orbitron/templates/pixel-streaming/Dockerfile`. 원본 플랜 Task 3-1의 스텁에 **CDI 호환** (`--device nvidia.com/gpu=all`) 주석 추가.
- **base 이미지**: `nvidia/cuda:12.0.0-runtime-ubuntu22.04` (Ubuntu 22.04가 UE5 Pixel Streaming 호환성 검증된 baseline — 호스트 24.04와 별개). 내부에 Wilbur + xvfb + UE5 shipping binary 실행.
- **이미지 전송**: Phase B는 `docker save <tag> | ssh stevenlim@192.168.219.117 docker load`. SSH 키는 이미 설치됨(검증: `ssh -o BatchMode=yes stevenlim@192.168.219.117 echo OK` 통과). 인증 실패 시 `ssh-copy-id` 재실행.
- **원격 compose 파일**: twinverse-ai `/opt/ps-slots/<slot>/docker-compose.yml`을 **원격에서 렌더링 & 재시작**. 원격 수행은 `ssh ... 'cd /opt/ps-slots/<slot> && docker compose up -d'`. 압축 해제·render 로직은 `services/psSlots/remoteDeploy.js`에 분리.
- **빌드 로그 SSE**: 기존 Orbitron에는 SSE 예시가 `services/deployer.js`의 배포 로그 스트림 패턴 있음 ([services/deployer.js](services/deployer.js) 참조 후 동일 패턴 사용). 별도 구현 말고 재사용.

### Phase 3 체크 (원본 Task 3-1 ~ 3-6)

- [ ] **3-1 ~ 3-6**: 원본 플랜 그대로. 경로만 위 규칙으로 변환.
- [ ] **3-A (신규): CDI runtime 테스트 컨테이너 실제 기동** — Dockerfile 완성 직후 소형 UE5 더미 빌드로 `docker run --device nvidia.com/gpu=all <image>` 성공 확인. 실패하면 Phase 4 진입 금지.

---

## Phase 4 — 버전 활성화, 롤백, Cloudflare DNS + Tunnel Ingress

원본 플랜 Phase 4 그대로 수행. 아래 적응.

### 적응 포인트

- **Cloudflare API 토큰**: 현재 `~/.cloudflare-orbitron.env` (mode 600, 검증: [infra 메모리](../../../memory/project_iiffnextwave_handoff_2026_04_15.md)). 단 **2026-04-15 기준 revoke 잔여** — 신규 PS 작업에 맞춰 **새 토큰 발급** + 기존 토큰 revoke + env 파일 교체. 외부 AI에게 절대 이 env 내용 노출 금지.
- **DNS 자동화**: 기존 Orbitron [services/tunnel.js](services/tunnel.js) 및 [routes/domains.js](routes/domains.js)가 이미 CF API 호출 패턴 보유. 재사용. 신규 토큰 스코프: `Zone:DNS:Edit` + `Zone:Page Rules:Edit` + `Account:Cloudflare Tunnel:Edit`.
- **cloudflared ingress reload**: 현재 Orbitron은 각 프로젝트별 config 파일 + 별도 systemd 유닛. PS 슬롯은 **공용 config 파일 `config-devdeploy-psslots.yml`** 에 ingress rule만 append + `systemctl --user reload cloudflared-devdeploy-psslots` (또는 `pkill -HUP cloudflared`) 패턴.
- **⚠️ Phase 0-A에서 선택한 미디어 플레인 경로 반영**: WebRTC TURN/Spectrum 설정은 이 Phase에서 함께 배치. 시그널링 ingress + TURN 설정 둘 다 원자적.

### Phase 4 체크

원본 Task 4-1 ~ 4-6 그대로. 추가:
- [ ] **4-A (신규): Cloudflare API 토큰 회전** — 기존 토큰 revoke + 새 토큰 발급 + `~/.cloudflare-orbitron.env` 교체 + Orbitron PM2 재기동.
- [ ] **4-B (신규): WebRTC 미디어 경로 배치** — Phase 0-A 결정 반영 (coturn 설치 / Spectrum config / 직노출 rule). E2E로 실제 미디어 스트림 도달 여부 검증.

---

## Phase 5 — On-demand 기동 & 유휴 자동 stop

원본 플랜 Phase 5 그대로. 아래 적응.

### 적응 포인트

- **Wilbur 세션 수 조회**: Wilbur signaling server 자체 admin API는 UE5 Epic 공식 문서 참조. TwinversePS2-Deploy 리포에서 이미 사용 중인 패턴이 있다면 재사용 (Phase 0-E Task 0-3에서 조사 완료 가정).
- **유휴 워커 프로세스**: Orbitron 내부 setInterval로 30초 폴링. PM2가 프로세스 관리하므로 별도 worker process 불필요. `services/psSlots/idleWorker.js` 단일 파일 + `server.js` 부팅 시 `require` 1회.
- **SSH 명령 실행**: `services/psSlots/remoteDeploy.js`의 `ssh twinverse-ai ...` 래퍼 재사용. 실패 시 backoff 재시도 3회.

### Phase 5 체크

원본 Task 5-1 ~ 5-4 그대로.

---

## Phase 6 — UI

원본 플랜 Phase 6 그대로. 아래 적응.

### 적응 포인트

- **Orbitron 대시보드 프론트 스택**: SPA 아님. [public/app.html](public/app.html) 단일 HTML + [public/js/app.js](public/js/app.js) vanilla JS + 페이지 전환은 `navigateTo(page)` + id=`page-<name>` div 토글 방식 (예: `page-project-settings`, `page-domain-connect`). 업로드 UI는 이 패턴 따라 `page-ps-slots` 신규 div + `pageTitles['ps-slots']` 등록.
- **tus-js-client**: `public/js/vendor/tus.min.js` 로컬 저장 또는 CDN. Orbitron은 일반적으로 로컬 저장 선호 (오프라인 가능성).
- **사이드바 추가**: [public/app.html:120-140](public/app.html#L120) 근처 "도메인 & SSL" 섹션 위 또는 아래에 **"Pixel Streaming"** 섹션 추가:
  ```html
  <div class="nav-section-label">Pixel Streaming</div>
  <a class="nav-item" onclick="navigateTo('ps-slots')" id="nav-ps-slots">
    <span class="nav-icon">🎮</span>
    <span>슬롯 관리</span>
  </a>
  ```
- **TwinverseAI 랜딩**: [orbitron/deployments/twinverseai/](deployments/twinverseai/) 프론트엔드에 `/pixel-streaming` 라우트 추가. React + Vite. 공개 API `/api/public/projects/twinverseai/ps-slots` 호출.
- **Play 버튼**: 전체 페이지 리다이렉트 기본 (스펙 §6). iframe 옵션은 Phase C.

### Phase 6 체크

- [ ] **6-1 ~ 6-3**: 원본 플랜 그대로. 경로만 Orbitron 규칙으로 변환.
- [ ] **6-A (신규): Orbitron 대시보드 사이드바 한 줄 추가** — [public/app.html](public/app.html) 해당 섹션.
- [ ] **6-B (신규): 기존 `page-<name>` 패턴 검증** — [public/js/app.js:240](public/js/app.js#L240) 근처 `pageTitles` 맵에 `'ps-slots': '🎮 Pixel Streaming 슬롯'` 등록.

---

## Phase 7 — 마이그레이션 & 컷오버

원본 플랜 Phase 7 그대로. 아래 적응.

### 적응 포인트

- **기존 프로젝트 id=27 `twinverse-ps2`** (DB 조회 확인됨). 이 프로젝트를 `office` 슬롯으로 이관.
- **기존 GPU 서버 경로 `/opt/twinverse-ps2/`**: docker-compose.yml, Dockerfile, Orbitron.yaml 등 존재. 백업 후 정리.
- **하위 호환 리다이렉트**: `ps2.twinverse.org` / `ps2-api.twinverse.org` → `office.ps.twinverse.org` 301. CF Page Rule 또는 Redirect Rule 생성.
- **좀비 유닛 정리**: `cloudflared-devdeploy-my-retry-worker.service` — 이 작업과 직접 관련 없지만 Pre-flight에서 확인된 flapping 이슈. 별도 조치 권장 (Steven에게 별도 보고 — 본 플랜 범위 외).

### Phase 7 체크

- [ ] **7-1 ~ 7-5**: 원본 플랜 그대로.
- [ ] **7-A (신규): 좀비 유닛 상태 검증만 수행** — 본 플랜에서 수정하지 않음. 별도 이슈로 보고.

---

## Cross-cutting 규칙

### 커밋 규칙
- 각 Task 단위 1 커밋 (bite-sized TDD)
- Prefix: `feat:` `fix:` `refactor:` `docs:` `test:`
- PR 묶음이 아니라 트렁크 기반 커밋 연쇄

### 테스트 위치
- 기존 Orbitron은 `tests/` 단일 디렉터리 + Mocha or Node test runner 미상. Phase 0-E Task 0-2(프론트/백 스택 조사)에서 확정 후 본 플랜 업데이트.
- 본 플랜은 **Node v22 built-in test runner** (`node --test`) 기본 가정. 미사용 시 vitest로 전환.

### 접근 경로 (외부 AI용)
- **git 쓰기**: fork + PR 플로우 전제. main push 금지.
- **PG 접근**: `devuser/devpass123@localhost/devdb`는 로컬 only. 외부 AI는 SSH 포트포워드 (`ssh -L 5432:localhost:5432 stevenlim@192.168.219.101`) 또는 Steven이 별도 계정 발급.
- **GPU 서버 SSH**: 외부 AI용 ed25519 키는 Steven이 별도 발급 → `~/.ssh/authorized_keys`에 주석 태그로 식별.
- **비밀번호 공유 절대 금지** — `.env` 내용, `~/.cloudflare-orbitron.env` 내용 노출 X.

### 품질 기준 재정의
원본 README의 "세계 어떤 플랫폼보다 뛰어난가?"는 AI 관점에서 측정 불가 → 구체 기준으로 대체:
- **보안**: path traversal / command injection / SSRF / 권한 상승 / env 파일 노출 **0건**. OWASP ASVS L1 체크리스트 통과.
- **관측성**: 모든 배포 단계가 `build_log` 기록 + SSE 실시간 스트림 + 실패 시 원인 포함 로그.
- **롤백**: 모든 상태 변경 역연산 가능 — atomic symlink swap, 3-버전 FIFO 보관, DNS 회수 가능.
- **성능 목표**: 업로드 → 활성화까지 8GB 빌드 기준 **<10분**. on-demand 콜드 스타트 **<90초**.

---

## Self-Review 체크리스트

플랜 완성 후 Steven/AI가 자체 검토:

- [ ] 설계 스펙의 §1~11 각 섹션마다 이 플랜에 대응 Task 존재 여부 (특히 §4 API 계약 17개 엔드포인트 vs Phase 1·2·4·5의 커버리지)
- [ ] Pre-flight 레거시 제거 수행 여부 (A-1 ~ A-5)
- [ ] 실환경 팩트 수정 반영 (PM2, Ubuntu 24.04, CDI runtime, CF tunnel 필수)
- [ ] Phase 0-A WebRTC 미디어 경로 **결정 게이트** 통과 여부
- [ ] `owner_user_id`/`tenant_id`/`pinned` 필드 보존 테스트(1-6) 존재
- [ ] 모든 Task에 구체 파일 경로 + 실행 명령 + 기대 출력 명시

---

## 실행 방식 (Execution Handoff)

**옵션 1. Subagent-Driven (권장)**: fresh subagent per task + 두 단계 review. `superpowers:subagent-driven-development` 스킬 사용.

**옵션 2. Inline Execution**: 현재 세션에서 단계별 수행 + checkpoint. `superpowers:executing-plans` 스킬 사용.

**어느 방식으로 실행할지 Steven에게 질의 후 진행.**
