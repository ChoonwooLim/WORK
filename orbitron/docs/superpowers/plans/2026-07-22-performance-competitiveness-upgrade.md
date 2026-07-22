# Orbitron 성능·경쟁력 업그레이드 마스터 플랜

> **For agentic workers:** 이 문서는 4개 Phase의 마스터 플랜이다. 각 Phase 착수 시점에
> superpowers:writing-plans로 해당 Phase의 상세 TDD 플랜(코드 전문 포함)을 별도 파일로
> 확장한 뒤, superpowers:subagent-driven-development 또는 superpowers:executing-plans로
> 실행한다. 체크박스는 태스크 완료 추적용.

**Goal:** Orbitron을 셀프호스팅 PaaS 진영(Coolify/Dokploy/CapRover) 최상위 수준의
배포 속도·신뢰성·DX로 끌어올린다. 클라우드 이주는 별도 플랜(차후)이며, 이 플랜의
모든 항목은 이주 전후 어느 환경에서도 유효한 순수 소프트웨어 개선이다.

**Architecture:** 기존 구조(Express 5 + dockerode + nginx blue-green + PostgreSQL)를
유지하고 그 위에 증분 개선한다. 대규모 리라이트 금지 — 27개 프로젝트가 운영 중인
플랫폼이므로 모든 변경은 하위호환 + 단계별 배포 가능해야 한다.

**Tech Stack:** Node.js (CommonJS), Express 5, dockerode + docker CLI, PostgreSQL,
nginx, node:test (신규 도입), BuildKit (신규 활성화)

**현재 성능 기준선 (2026-07-22 실측):**
- 호스트: 8코어 / 62GB RAM, load ~0.9 (10%), 27개 프로젝트 running
- Orbitron 대시보드: RSS 50MB, 4주 무중단
- 빌드: BuildKit 미사용 (legacy builder), 이미지 태그 `orbitron-<sub>` 단일 태그 덮어쓰기
- nginx: gzip on, resolver+변수 패턴 적용 완료
- 테스트 인프라: 없음 (ESLint + pre-commit만 존재)

---

## Phase 0: 테스트 하네스 (모든 Phase의 전제조건)

### Task 0.1: node:test 기반 최소 테스트 하네스
- [x] 완료 (2026-07-22 — 하네스 자체는 Task 4.1에서 선행 도입, 본 태스크에서 envUtils
  특성화 테스트 19개 추가(총 30개), tracked pre-commit 훅(orbitron/scripts/pre-commit,
  eslint+test 게이트) 신설·설치, lint 범위 test/ 확장. 잠복 버그 2건 특성화로 고정:
  ① isLocalHost의 '::1' 항목은 URL.hostname이 '[::1]'을 반환해 도달 불가,
  ② target URL 파싱 불가+current에 'localhost' 포함 시 raw 문자열 반환 — 추후 수정 태스크 후보)

**Files:**
- Create: `orbitron/test/` 디렉터리, `orbitron/test/envUtils.test.js` (첫 대상: 순수 함수)
- Modify: `orbitron/package.json` — `"test": "node --test test/"` 스크립트 추가
- Modify: `orbitron/.husky` 또는 기존 pre-commit 훅 — lint 뒤에 test 실행 추가

**이유:** 현재 저장소에 테스트가 0개다. 이후 모든 Phase가 TDD로 진행되려면 러너부터
필요하다. 외부 프레임워크 없이 Node 내장 `node:test` + `assert`만 사용 (의존성 0개 추가).

**첫 테스트 대상:** `services/envUtils.js`의 `managedDatabaseUrl` — 순수 함수이고,
과거 포트 정규화 버그(3362f6b)의 회귀 방지 가치가 실재한다.

**검증:** `npm test` 통과, pre-commit에서 자동 실행 확인.

---

## Phase 1: 배포 파이프라인 성능 (체감 성능의 핵심)

배포 속도는 PaaS의 제1 체감 지표다. Render의 평균 빌드 3~5분 대비
"푸시 후 1분 내 라이브"를 목표로 한다.

### Task 1.1: BuildKit 활성화 + 캐시 마운트
- [x] 완료 (2026-07-22 — DOCKER_BUILDKIT=1 + --progress=plain을 docker build 2개 사이트에 강제,
  자동 생성 템플릿 7개 RUN 라인에 npm/pip 캐시 마운트(모듈 상수로 중앙화), pip --no-cache-dir 제거
  (마운트와 상충). 사용자 Dockerfile/compose 경로 무변경. 테스트 14개 추가(총 44). 호스트 docker
  29.2.1은 이미 BuildKit 기본이나 명시 고정. 리뷰 권고: maxBuffer 10MB 상향은 라이브 로그
  스트리밍 작업 시 함께)

**Files:**
- Modify: `orbitron/services/docker.js:30-170` (`buildImage`)

**변경 내용:**
1. `execFile('docker', ['build', ...])` 호출 시 `env: { ...process.env, DOCKER_BUILDKIT: '1' }` 추가.
2. Orbitron이 자동 생성하는 Dockerfile(`docker.js` 내 템플릿, ~line 534)의
   의존성 설치 스테이지에 캐시 마운트 적용:
   ```dockerfile
   RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
   ```
   (Python 프로젝트 템플릿에는 `--mount=type=cache,target=/root/.cache/pip`)
3. 사용자 제공 Dockerfile(`build.dockerfile` 명시 시)은 수정하지 않는다 —
   기존 원칙(자동 감지 비활성) 유지.

**기대 효과:** 의존성 무변경 재배포 시 빌드 시간 대폭 단축 (legacy builder의
레이어 캐시보다 BuildKit 캐시 마운트가 npm/pip 재다운로드 자체를 제거).

**검증:** 동일 프로젝트 2회 연속 배포, 2회차 빌드 로그에 `CACHED` 스테이지 확인
+ 빌드 시간 before/after를 deployments.logs에 기록해 비교.

**주의:** BuildKit은 `--progress=plain` 없이는 로그 형식이 달라진다. 대시보드
빌드 로그 파싱(AI Analyzer 포함)이 깨지지 않도록 `--progress=plain` 고정.

### Task 1.2: 배포별 이미지 태깅 (Task 2.1 롤백의 전제)
- [x] 완료 (2026-07-22 — 이중 태그 orbitron-<sub> + :d<deploymentId>, orbitron.deploy-image
  라벨로 24h prune 제외, 배포 성공 후 프로젝트별 retention(기본 3, DEPLOY_IMAGE_RETENTION env,
  숫자 정렬). deployments.image_tag 컬럼 + 첫 마이그레이션 파일(db/migrations/) 도입, 프로덕션
  적용 완료. compose/db/vps 경로는 image_tag NULL → Task 2.1에서 "롤백 불가"로 처리할 것.
  Task 2.1 이월: 프로젝트 삭제 시 라벨된 d-태그 잔존 정리 + 빌드 성공 후 실패한 배포의 태그 누적)

**Files:**
- Modify: `orbitron/services/docker.js:63,149` — `-t orbitron-<sub>` 에 더해
  `-t orbitron-<sub>:d<deploymentId>` 이중 태그
- Modify: `orbitron/services/deployer.js` — deployment 레코드 생성 후 id를
  buildImage에 전달
- Modify: `orbitron/db/schema.sql` + 마이그레이션 —
  `ALTER TABLE deployments ADD COLUMN image_tag VARCHAR(200);`
- Modify: 이미지 정리 로직(24h prune) — 최근 N개(기본 3) 배포 태그는 prune 제외

**검증:** 배포 후 `docker images orbitron-<sub>` 에 `latest`와 `d<id>` 태그 공존,
deployments.image_tag 채워짐, 4번째 배포 시 가장 오래된 태그만 정리됨.

### Task 1.3: 빌드 동시성 제어 (빌드 큐)
- [x] 완료 (2026-07-22 — services/buildQueue.js 무의존 FIFO 세마포어(MAX_CONCURRENT_BUILDS
  기본 2), buildImage 구간만 withSlot 래핑, 'queued' 배포 상태 엔드투엔드(DB·시작 시 stale
  queued/building 스윕·대시보드 배지). pip 캐시 sharing=locked 이월분 반영. 테스트 9개 추가(총 61).
  후속 후보: 운영 env 변수 문서화(MAX_CONCURRENT_BUILDS·DEPLOY_IMAGE_RETENTION), 5분 미만
  고아 행은 다음번 재시작에서만 회복되는 창)

**Files:**
- Create: `orbitron/services/buildQueue.js` — 동시 빌드 상한(기본 2, env
  `MAX_CONCURRENT_BUILDS`) + FIFO 대기열. 외부 의존성 없이 Promise 기반 구현.
- Modify: `orbitron/services/deployer.js` — 빌드 구간을 큐로 감싸기
- Modify: 대시보드 — 대기 중 상태 표시 (`status='queued'`)

**이유:** 현재는 동시 배포 수 제한이 없다. webhook이 몰리면 8코어에서 빌드
N개가 경합해 전부 느려지고 최악엔 OOM. 상한 2개면 단일 빌드 속도를 보장한다.

**Task 1.1 리뷰에서 이월된 요구사항:** 동시 빌드 도입 시 pip 캐시 마운트에
`sharing=locked` 추가 필수 (docker.js의 `PIP_CACHE_MOUNT` 상수 한 줄 수정).
pip wheel 캐시는 재사용 시 해시 재검증이 없어 동시 쓰기 오염/교차 프로젝트
포이즈닝 여지가 있음. npm 캐시(cacache)는 동시 접근 안전 설계라 `shared` 유지.

**검증:** 프로젝트 3개 동시 배포 트리거 → 2개 빌드 진행 + 1개 queued 확인,
전체 완료 시간이 무제한 동시 실행보다 짧거나 같음.

### Task 1.4: 정적 자산 캐시 헤더 (런타임 응답 성능)
- [x] 완료 (2026-07-22 — 품질 리뷰가 원안(expires+무조건 add_header)의 업스트림
  Cache-Control(private/no-store) 덮어쓰기 = 엣지 캐시 프라이버시 회귀를 적발, map 기반으로
  재설계: 00-orbitron-cache.conf(http-context map, # orbitron:manual 보호)가 업스트림 침묵 시에만
  1일 public 기본값 적용, private/no-store/immutable은 그대로 통과. TTL도 7d→1d 하향(브라우저
  캐시는 배포 후 퍼지 불가). 생성 conf는 다음 재배포부터 정적 location 획득(점진 롤아웃).
  nginx -t 검증 + 리로드 완료. 테스트 12개 추가(총 73))

**Files:**
- Modify: `orbitron/services/nginx.js:109-` (`generateConfig`) — 생성 conf에 추가:
  ```nginx
  location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|woff2?)$ {
      # 동일한 resolver+$upstream 패턴 유지 (회귀 가드 통과 필수)
      expires 7d;
      add_header Cache-Control "public, max-age=604800, stale-while-revalidate=86400";
      ...proxy_pass http://$upstream;...
  }
  ```
- 회귀 가드(`addProject`의 resolver/변수 검사)가 신규 location 블록에도
  통과하는지 확인 — 가드는 conf 전체 문자열 검사이므로 기존 로직 유지됨.

**주의:** 캐시는 nginx가 아니라 브라우저/Cloudflare 엣지에 지시하는 헤더다.
Cloudflare 프록시 구간에서 엣지 캐시가 동작하면 원 서버 트래픽 자체가 줄어든다.
HTML은 절대 캐시하지 않는다 (SPA 배포 직후 구버전 고착 방지).

**검증:** 배포된 프로젝트의 .js 응답 헤더에 Cache-Control 확인, HTML 응답에는 없음 확인.

---

## Phase 2: 신뢰성 (Render와의 실질 격차 해소)

### Task 2.1: 원클릭 롤백
- [x] 완료 (2026-07-22 — deployer options seam({rollbackImageTag,...})으로 clone/build만 대체
  (retag :d<id>→latest), 나머지 기동/스위치/실패 경로 전부 재사용. POST /api/deployments/:id/rollback
  (소유권+구분된 에러 코드, DEPLOY_IN_PROGRESS 안정 계약 — 2.2 자동 롤백이 의존). keep-list prune:
  최신 N개 '고유' 성공 태그 + 방금 실행 태그 보호, DB 실패 시 prune 스킵. 프로젝트 삭제 시 전체
  d-태그 정리 + 실패 배포 태그 누적 해소(이월분). 대시보드 ⏪ 버튼. 신규 rollbackRules.js 순수 모듈,
  테스트 17개 추가(총 90). ⚠️ 플랫폼 후속 발견: 배포 흐름이 구 컨테이너를 먼저 정지 후 신규 기동
  (호스트 포트 재사용) — 실패 시 무서빙 창. 진정한 blue-green 포트 스왑은 별도 태스크 후보)

**전제:** Task 1.2 (배포별 이미지 태그)

**Files:**
- Create: `orbitron/routes/deployments.js`에 `POST /api/deployments/:id/rollback`
- Modify: `orbitron/services/deployer.js` — `rollbackTo(deploymentId)`:
  1. 대상 deployment의 image_tag 존재 + 이미지 실존 확인 (`docker image inspect`)
  2. 기존 blue-green 경로 재사용: 새 컨테이너를 old 이미지로 기동 →
     헬스체크 → nginx 스위치 → 구 컨테이너 제거 (빌드 단계만 생략된 배포)
  3. deployments에 `status='rolled-back-to'` 메타 기록 + 새 deployment 행 생성
     (`commit_message: 'rollback to d<id>'`)
- Modify: 대시보드 배포 이력 UI — 성공한 과거 배포에 "이 버전으로 롤백" 버튼

**핵심 설계 원칙:** 롤백은 "빌드 없는 배포"다. 별도 경로를 만들지 않고
deployer의 기동/스위치/정리 로직을 그대로 재사용해야 blue-green·nginx 가드·
복구 루프와의 정합성이 유지된다.

**검증:** v1 배포 → v2 배포 → v1로 롤백 → 응답이 v1 내용, 다운타임 0
(롤백 중 1초 간격 curl 무실패), projects.container_id 정합.

### Task 2.2: 능동 헬스체크 + 텔레그램 알림
- [x] 완료 (2026-07-22 — services/monitor.js(주입 가능 의존성 클래스, 60s tick, 프로세스 생존
  프로브 5s, redirect manual) + services/alerts.js(Telegram, 4000자 절단, 미설정 시 콘솔 폴백).
  3연속 실패→outage당 1회 docker restart, 6연속→'unhealthy'+알림(30분 쿨다운), 복구 시 알림+상태
  복원(재시작 후 영속 unhealthy도 복구). compose-* 는 재시작 금지·알림만. 부팅 스윕이 unhealthy도
  복구 대상에 포함. HEALTH_MONITOR=off 킬스위치. 대시보드 7개 상태 맵에 '응답 없음' 추가.
  테스트 22개 추가(총 112). 🩺 운영 반영·기동 확인. 활성화하려면 .env에 TELEGRAM_BOT_TOKEN/
  TELEGRAM_CHAT_ID 설정(미설정 시 콘솔 폴백). 후속 칩: 대시보드 상태 맵 7중복 정리)

**Files:**
- Create: `orbitron/services/monitor.js` —
  - 60초 주기로 `status='running'` 프로젝트의 로컬 포트에 HTTP 요청
    (컨테이너 내부 포트, `/proc/net/tcp` 감지 결과 재사용)
  - 연속 3회 실패 시: `docker restart` 1회 시도 → 재실패 시 알림 발송 +
    `status='unhealthy'` 마킹
  - 플래핑 방지: 프로젝트당 알림 쿨다운 30분
- Create: `orbitron/services/alerts.js` — 텔레그램 Bot API 발송
  (`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` env, 미설정 시 콘솔 로그로 폴백)
- Modify: `orbitron/server.js` — monitor 기동/종료 (graceful shutdown 포함)
- Modify: 대시보드 — 프로젝트 카드에 최근 체크 상태 표시(녹/황/적)

**주의:** IGOS 같은 수동 등록 프로젝트(`container_id LIKE 'compose-manual-%'`)는
자동 재시작 대상에서 제외하고 알림만 보낸다.

**검증:** 테스트 프로젝트 컨테이너 `docker stop` → 3분 내 자동 재시작 확인,
재시작 불가 상황(이미지 삭제) 연출 → 텔레그램 수신 확인.

### Task 2.3: 리소스 메트릭 수집 + 대시보드 차트
- [ ] 완료

**Files:**
- Create: `orbitron/services/metrics.js` — 60초 주기 `docker stats --no-stream`
  파싱 → 프로젝트별 CPU%/RAM을 in-memory ring buffer(24h, 1440포인트)에 적재.
  DB 저장은 1시간 집계본만 (`metrics` 테이블: project_id, ts, cpu_avg, mem_avg) —
  raw 초단위 DB 적재 금지 (지난 로그 158MB 사태 재발 방지).
- Create: `GET /api/projects/:id/metrics?range=1h|24h|7d`
- Modify: 대시보드 프로젝트 상세 — 스파크라인 차트 (기존 프론트 스택에 맞춰
  경량 SVG 직접 렌더, 외부 차트 라이브러리 추가 금지)

**검증:** 24h 가동 후 ring buffer 메모리 증가가 상수 유지(누수 없음),
API 응답 < 50ms, 차트 표시 확인.

---

## Phase 3: DX 경쟁력 (Vercel/Render급 개발자 경험)

### Task 3.1: PR 프리뷰 배포
- [ ] 완료

**Files:**
- Modify: `orbitron/routes/webhooks.js` — GitHub `pull_request` 이벤트
  (opened/synchronize/closed) 처리
- Modify: `orbitron/services/deployer.js` — 프리뷰 모드:
  서브도메인 `pr-<n>-<sub>`, 컨테이너 `orbitron-pr-<n>-<sub>-<hash>`,
  nginx conf/터널은 기존 addProject 경로 재사용
- Create: `preview_deployments` 테이블 (project_id, pr_number, subdomain,
  container_id, created_at) + PR closed 시 + 7일 TTL 자동 정리 (기존 정리
  루프에 편입)
- Modify: webhook 응답으로 GitHub PR에 프리뷰 URL 코멘트 (GitHub token은
  프로젝트별 env_vars의 기존 암호화 경로 사용, `encryptForJsonb` 준수)

**리소스 가드:** 프리뷰는 빌드 큐(Task 1.3)를 공유하고, 프로젝트당 동시
프리뷰 상한 3개. DB가 필요한 프로젝트는 프리뷰에서 본 DB를 **읽기 전용으로
공유하지 않고** 프리뷰 전용 임시 DB 컨테이너를 생성 여부를 프로젝트 설정으로
선택 (기본: DB 없이 기동 시도).

**검증:** 테스트 repo에 PR 생성 → 5분 내 `pr-1-<sub>.twinverse.org` 응답,
PR 머지/클로즈 → 컨테이너·conf·DNS 정리 확인.

### Task 3.2: Orbitron CLI (`npx orbitron-cli`)
- [ ] 완료

**Files:**
- Create: `orbitron/cli/` — 독립 npm 패키지 (bin: `orbitron`)
  - `orbitron login` (JWT 발급, `~/.orbitronrc` 저장)
  - `orbitron deploy [--project <name>]` (현재 디렉터리 git remote로 프로젝트 자동 매칭)
  - `orbitron logs <project> [-f]` (SSE 스트리밍 — 기존 로그 엔드포인트 재사용)
  - `orbitron rollback <project>` (Task 2.1 API 호출)
  - `orbitron status` (프로젝트 목록 + 상태 테이블)
- Modify: `orbitron/routes/auth.js` — CLI용 장기 토큰(PAT) 발급/폐기 엔드포인트

**원칙:** CLI는 대시보드가 쓰는 동일한 REST API만 호출한다. CLI 전용 서버
로직 추가 금지 (API 일관성 유지).

**검증:** 외부 PC에서 `npx` 설치 → login → deploy → logs -f 전체 플로우.

### Task 3.3: 로그 검색 + cron job
- [ ] 완료

**Files:**
- 로그 검색: `GET /api/projects/:id/logs/search?q=` — `docker logs` 출력
  grep 필터 (512KB 상한 기존 정책 유지), 대시보드 검색창
- cron: `scheduled_jobs` 테이블 (project_id, schedule, command, last_run,
  last_status) + `orbitron/services/cron.js` (60초 tick, `docker exec` 실행,
  실패 시 Task 2.2 알림 경로 재사용) + 대시보드 관리 UI

**검증:** `* * * * *` 잡 등록 → 3회 연속 실행 기록 확인, 실패 명령 등록 → 알림 수신.

---

## Phase 4: 운영 보호 장치 (기존 대화에서 확인된 결함 보완)

### Task 4.1: 수동 nginx conf 보호 플래그
- [x] 완료 (2026-07-22, merge d7e249d — 스펙 리뷰 + 품질 리뷰 2회전 통과. 스펙 대비 확장:
  전 도메인 라우트 5곳에 인증서 발급/폐기 이전 409 사전 차단 추가, 소유권 스코프 누출 수정,
  removeProject는 경고 후 파일 보존. 테스트 하네스(node:test) 이 태스크에서 선행 도입 — 11 tests)

**Files:**
- Modify: `orbitron/services/nginx.js` `addProject()` — conf 파일 첫 512바이트에
  `# orbitron:manual` 마커가 있으면 덮어쓰기를 거부하고 명시적 에러 반환
  (대시보드에 "이 프로젝트의 nginx 설정은 수동 관리 중" 표시)
- Modify: `infrastructure/nginx/conf.d/igos.conf`, `igos-s3.conf`,
  `deskrpg.conf` 등 수제 conf에 마커 추가

**이유:** IGOS 등록 논의에서 확인된 실제 위험 — 실수로 배포/도메인 수정 클릭
한 번에 수제 conf(https Caddy 패스스루)가 표준 템플릿으로 교체되어 502 발생.

**검증:** 마커 있는 프로젝트에 배포 시도 → conf 원본 유지 + 에러 메시지 확인.

### Task 4.2: 배포 전 자동 스모크 체크 강화
- [ ] 완료

**Files:**
- Modify: `orbitron/services/deployer.js` — nginx 스위치 전 신규 컨테이너에
  HTTP 200/3xx 응답 확인(현재 포트 리슨 확인만 존재)을 추가하고, 실패 시
  스위치 중단 + 구 컨테이너 유지 + 빌드 로그에 사유 기록.
  헬스 경로는 프로젝트 설정 `health_path` (기본 `/`, orbitron.yaml로 재정의 가능).

**검증:** 의도적으로 500만 반환하는 앱 배포 → 스위치 미발생, 기존 버전 무중단 유지.

---

## 실행 순서와 의존성

```
Phase 0 (테스트 하네스)
  └─→ Phase 1 (1.1 BuildKit → 1.2 태깅 → 1.3 큐 → 1.4 캐시헤더)
        └─→ Phase 2 (2.1 롤백[1.2 필요] → 2.2 헬스체크 → 2.3 메트릭)
              └─→ Phase 3 (3.1 프리뷰[1.3 필요] → 3.2 CLI[2.1 필요] → 3.3)
Phase 4는 독립 — 언제든 선행 가능 (4.1은 즉시 착수 권장: 현존 위험 제거)
```

**권장 착수 순서:** 4.1 (반나절, 현존 위험 제거) → 0.1 → 1.1~1.3 (성능 체감 최대)
→ 2.1 (경쟁력 체감 최대) → 2.2 → 이후 순차.

## 명시적 비목표 (YAGNI)

- Kubernetes/Swarm 전환, 마이크로서비스화 — 현 규모에 불필요한 복잡도
- 외부 모니터링 스택(Prometheus/Grafana) 도입 — Task 2.3의 자체 경량 구현으로 충분
- 멀티 노드 스케줄링 — 클라우드 이주 플랜(별도 문서)에서 다룸
- 대시보드 프론트엔드 프레임워크 교체 — 기능과 무관한 리라이트

## 진행 로그

- 2026-07-22: 마스터 플랜 작성 (성능 기준선 실측 포함)
