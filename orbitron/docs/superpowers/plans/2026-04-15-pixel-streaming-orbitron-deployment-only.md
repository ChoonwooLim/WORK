# Orbitron Pixel Streaming 플랫폼 — 배포 전용 구현 계획 (개정판)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**이전 버전**: [2026-04-15-pixel-streaming-orbitron-adapted.md](2026-04-15-pixel-streaming-orbitron-adapted.md) (전체 범위, 개정판으로 대체)

**Goal:** Orbitron 대시보드에 슬롯 기반 Pixel Streaming **배포·호스팅** 기능을 일급 시민으로 내장. UE5 빌드를 업로드하면 자동으로 GPU 서버에 배포·서브도메인 할당·on-demand 기동·세션 관리까지.

**Architecture:** Orbitron(192.168.219.101:4000 PM2)이 업로드·오케스트레이션·대시보드·API를 담당, UE5 런타임은 twinverse-ai(192.168.219.117 RTX 3090)에서 `network_mode: host` 컨테이너로 실행. Cloudflare Tunnel이 `<slot>.ps.twinverse.org` 라우팅, WebRTC 미디어는 CF Tunnel을 통한 시그널링 + WebRTC-over-WebSocket 기본 + 필요 시 CF Realtime TURN fallback.

**Tech Stack:** Node.js 24 / Express / PostgreSQL / tus-node-server / Docker (host network) / cloudflared / SSH+rsync / SSE

## 🚫 범위 외 (TwinverseDesk 개발 AI 담당)

- UE5 프로젝트 소스 · GameMode · PlayerController · Pawn · 맵 설계
- Replication · Multi-player Pixel Streaming 플러그인 설정
- Linux Shipping 패키징 (zip 결과물만 본 플랜의 **입력**으로 소비)
- UE5 실행 플래그의 **의미론적 명세**는 TwinverseDesk AI가 제공 → Orbitron은 전달만

## 📜 UE5 빌드 ↔ Orbitron 배포 인터페이스 계약

### 입력 계약 — Orbitron이 UE5 프로세스에 전달

```bash
<PackageRoot>/<GameName>/Binaries/Linux/<GameName>-Linux-Shipping \
  -PixelStreamingConnectionURL=ws://127.0.0.1:8888 \
  -PixelStreamingID=<session_id> \          # Orbitron 발급 UUID
  -MapOverride=<map_path> \                 # 대시보드 선택값 (옵션)
  -ResX=<width> -ResY=<height> -ForceRes \
  -RenderOffScreen -AudioMixer -Unattended -NoPause -log \
  [추가 플래그는 TwinverseDesk AI가 공급, Orbitron이 그대로 전달]
```

### 패키지 입력 계약 — 업로드되는 zip 구조

```
<GameName>-Linux-Shipping.zip
└── Package/
    └── Linux/
        ├── <GameName>/
        │   ├── Binaries/Linux/<GameName>-Linux-Shipping   ← 실행 바이너리 (필수)
        │   └── Content/Paks/*.ucas *.utoc                 ← 콘텐츠 (최소 1개)
        ├── Engine/                                        ← UE5 엔진 런타임
        ├── Manifest_NonUFSFiles_Linux.txt
        └── Manifest_UFSFiles_Linux.txt
```

Orbitron은 이 구조만 검증. 내부 컨텐츠(멀티플레이어 지원 여부, Replication 여부)는 **검증하지 않음** — 빌드 제공자 책임.

### 출력 계약 — UE5 빌드가 준수해야

1. **시그널링 등록**: 기동 후 60초 내에 `ws://127.0.0.1:8888`에 연결하여 `{"type":"endpointId","id":"<session_id>"}` 송신 (Wilbur 표준)
2. **로그 출력**: stdout/stderr 사용 (Orbitron이 `docker logs -f`로 SSE 스트림)
3. **종료 신호 대응**: `SIGTERM` 수신 후 10초 내 graceful exit. 10초 초과 시 Orbitron이 `SIGKILL`
4. **세션 수**: 단일 플레이어 또는 멀티플레이어 구분은 빌드 내부에서 결정. Orbitron은 `POST /api/ps2/spawn` 응답의 `max_players`를 신뢰하여 라우팅만 수행

### 장애 범위 책임 (Blame 경계)

| 증상 | 책임 |
|------|------|
| UE5 프로세스가 3초 내에 crash | TwinverseDesk (빌드 문제) |
| Wilbur에 스트리머 등록 안 됨 (60초) | TwinverseDesk (네트워크 로직) |
| Docker 컨테이너가 UE5 시작조차 못함 | **Orbitron** (환경변수/권한/마운트 문제) |
| CF Tunnel로 시그널링 도달 불가 | **Orbitron** (터널 config) |
| WebRTC 미디어 끊김 (LAN) | **Orbitron** (host network/UFW) |
| WebRTC 미디어 끊김 (외부) | 공동 책임 (Orbitron TURN 또는 TwinverseDesk ICE 서버 설정) |
| VRAM 부족으로 N번째 세션 실패 | **Orbitron** (동시 세션 한도 계산 · 차단) |
| 3명이 서로 못 만남 (싱글플레이어 빌드) | TwinverseDesk |

## Phase 0 — Pre-flight (완료된 항목 포함)

### ✅ 이미 검증된 사실 (2026-04-15 실측)

- UE5 5.7.4 바이너리가 `-RenderOffScreen` 모드로 RTX 3090에서 정상 기동됨
- LAN 내부에서 `network_mode: host` + UFW open 조합으로 **WebRTC 미디어 프레임 도달 확인됨** (1280x720, `readyState: 4`)
- `network_mode: bridge`는 ICE candidate가 Docker 내부 IP(172.18.0.2)로 나와 브라우저 도달 불가 → **반드시 host mode**
- UE5 인스턴스당 VRAM ~10GB → RTX 3090(24GB)에서 동시 2개 한도
- PS2 API(FastAPI)가 Orbitron과 `JWT_SECRET` 공유 (같은 토큰으로 인증)
- CF Tunnel은 twinverse-ai에서 직접 실행 중 (`cloudflared.service`, 터널 ID `51edb5fe-...`) — `ps2.twinverse.org`, `ps2-api.twinverse.org` 라우팅 설정됨
- Orbitron 호스트 LG U+ 인바운드 차단은 CF Tunnel outbound 연결로 우회됨

### Task 0-1: 레거시 Pixel Streaming 코드 철거

기존 `routes/pixelStreaming.js`(46줄 매치메이커) + `services/pixelStreaming.js`(109줄 6포트 세션풀)는 신규 슬롯 설계와 충돌 — 완전 제거.

- [ ] **0-1-1: 레거시 참조 전체 스캔**
  ```bash
  cd /home/stevenlim/WORK/orbitron
  grep -rn 'pixel-streaming\|pixelStreaming\|PIXEL_STREAM_IMAGE' \
    --include='*.js' --include='*.html' \
    --exclude-dir=node_modules --exclude-dir=deployments
  ```
  기대: `routes/pixelStreaming.js`, `services/pixelStreaming.js`, `server.js:81`, public 프론트 호출부.

- [ ] **0-1-2: 파일 삭제**
  ```bash
  git rm routes/pixelStreaming.js services/pixelStreaming.js
  ```
  [server.js:81](server.js) `app.use('/api/pixel-streaming', ...)` 한 줄 삭제.

- [ ] **0-1-3: 프론트 참조 제거** ([public/app.html](public/app.html), [public/js/app.js](public/js/app.js))

- [ ] **0-1-4: PM2 재기동 + 404 검증**
  ```bash
  pm2 restart orbitron
  curl -sI http://localhost:4000/api/pixel-streaming/status  # expect 404
  ```

- [ ] **0-1-5: Commit**
  ```bash
  git commit -m "refactor: remove legacy matchmaker pixel-streaming, replaced by slot system"
  ```

### Task 0-2: CF Tunnel 운영 전략 결정

신규 슬롯의 서브도메인(`<slot>.ps.twinverse.org`)을 어느 터널에 붙일지.

- **옵션 A — twinverse-ai 기존 터널에 ingress rule만 추가** (권장)
  - 장점: 이미 동작 중, outbound 연결 하나 재활용, 관리 단순
  - 단점: ingress rule list 길어짐
- **옵션 B — Orbitron 쪽 신규 터널 `cloudflared-devdeploy-psslots.service`**
  - 장점: PS 도메인이 별도 관리
  - 단점: Orbitron→twinverse-ai로 재프록시 필요 (2단 네트워크 홉)

- [ ] **0-2-1: 옵션 A 채택 확정**, 이후 Phase 4에서 twinverse-ai의 `/etc/cloudflared/config.yml`에 ingress rule append

### Task 0-3: WebRTC 미디어 경로 — 최종 결정

원본 Phase 0-A 결정(CF Realtime TURN 권장)은 **보류**. 이유:
- LAN 내부 직접 WebRTC 이미 성공 검증됨
- **외부(인터넷) 접속 여부는 아직 실측 안 됨** — CF Tunnel이 UDP 미지원이지만 UE5 PixelStreaming5는 WebSocket over TCP 또는 SDP-in-WS 모드가 있음 (미확인)

- [ ] **0-3-1: 외부 실측** — 핸드폰 4G/LTE로 `https://ps2.twinverse.org?StreamerId=<id>` 접속 → 프레임 도달 확인
  - ✅ 도달 → **TURN 불필요**, 현 구조 유지
  - ❌ 도달 안 함 → CF Realtime TURN 옵션 D 적용 ([이전 결정 보고서 §4 Task 4-B 참조](2026-04-15-phase0-webrtc-media-plane-decision.md))
- [ ] **0-3-2: 결과 기록 + Phase 4 반영 여부 결정**

## Phase 1 — DB 스키마 · 슬롯 CRUD

### 적응 포인트

- **마이그레이션**: `db/migrations/2026-04-15-ps-slots.sql` 생성 + `db/schema.sql` 끝에 `CREATE TABLE IF NOT EXISTS` append
- **DAO**: `services/psSlots/dao.js` + `services/psSlots/versionDao.js` (폴더 분리)
- **라우트 분리**: `routes/psSlots.js` · `routes/psUploads.js` · `routes/psRuntime.js` · `routes/psPublic.js`
- **server.js 마운트** — `/api/pixel-streaming` 제거 자리에 신규 4개 마운트

### Task 1-1: 마이그레이션 파일 생성

**Files:**
- Create: `db/migrations/2026-04-15-ps-slots.sql`
- Modify: `db/schema.sql` (append block)

- [ ] **1-1-1: 마이그레이션 SQL 작성**

```sql
-- /* db/migrations/2026-04-15-ps-slots.sql */
-- PS slot system tables (Phase B). Phase C reserves fields (owner_user_id, tenant_id, pinned).
-- DO NOT remove reserved fields during refactor — they are intentional.

CREATE TABLE IF NOT EXISTS ps_slots (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT DEFAULT '',
    thumbnail_url   VARCHAR(500),
    subdomain       VARCHAR(150) UNIQUE NOT NULL,
    container_port  INTEGER NOT NULL UNIQUE,
    active_version  INTEGER,
    state           VARCHAR(20) DEFAULT 'draft',
    idle_timeout_s  INTEGER DEFAULT 600,
    -- Phase C reserved (do not remove)
    owner_user_id   INTEGER REFERENCES users(id),
    tenant_id       INTEGER,
    pinned          BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS ps_versions (
    id              SERIAL PRIMARY KEY,
    slot_id         INTEGER NOT NULL REFERENCES ps_slots(id) ON DELETE CASCADE,
    version_label   VARCHAR(50) NOT NULL,
    upload_size_b   BIGINT NOT NULL CHECK (upload_size_b <= 21474836480),  -- 20GB
    image_tag       VARCHAR(200),
    build_status    VARCHAR(20) DEFAULT 'uploading',
    build_log       TEXT,
    uploaded_at     TIMESTAMP DEFAULT NOW(),
    uploaded_by     INTEGER REFERENCES users(id),
    UNIQUE (slot_id, version_label)
);

ALTER TABLE ps_slots
  ADD CONSTRAINT ps_slots_active_version_fkey
  FOREIGN KEY (active_version) REFERENCES ps_versions(id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_ps_slots_project ON ps_slots(project_id);
CREATE INDEX IF NOT EXISTS idx_ps_versions_slot ON ps_versions(slot_id);
```

- [ ] **1-1-2: 두 번 실행해서 idempotent 검증**
  ```bash
  PGPASSWORD=devpass123 psql -h localhost -U devuser -d devdb -f db/migrations/2026-04-15-ps-slots.sql
  PGPASSWORD=devpass123 psql -h localhost -U devuser -d devdb -f db/migrations/2026-04-15-ps-slots.sql  # no error
  PGPASSWORD=devpass123 psql -h localhost -U devuser -d devdb -c '\d ps_slots'
  ```

- [ ] **1-1-3: `db/schema.sql`에 같은 블록 append** (부트 시 자동 생성용)

- [ ] **1-1-4: Commit** `feat(db): add ps_slots + ps_versions schema with Phase C reserved fields`

### Task 1-2: 슬롯 DAO (`services/psSlots/dao.js`)

**Files:**
- Create: `services/psSlots/dao.js`
- Create: `tests/psSlots/dao.test.js`

- [ ] **1-2-1: 실패 테스트 먼저**

```javascript
// tests/psSlots/dao.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dao = require('../../services/psSlots/dao');
const db = require('../../db/db');

test('create + findById + listByProject', async () => {
  const project_id = 1;  // assume fixture
  const slot = await dao.create({
    project_id,
    name: 'test-slot',
    display_name: 'Test Slot',
    subdomain: 'test-slot.ps.twinverse.org',
    container_port: 8091,
  });
  assert.equal(slot.name, 'test-slot');
  assert.equal(slot.state, 'draft');

  const found = await dao.findById(slot.id);
  assert.equal(found.id, slot.id);

  const list = await dao.listByProject(project_id);
  assert.ok(list.some(s => s.id === slot.id));

  // preserved fields present
  assert.ok('owner_user_id' in found, 'reserved field owner_user_id must be read');
  assert.ok('tenant_id' in found);
  assert.ok('pinned' in found);

  await dao.remove(slot.id);
});

test('findByName scoped to project', async () => {
  // setup two projects, create same name → no conflict
  // ...
});
```

- [ ] **1-2-2: 실행해서 실패 확인** `node --test tests/psSlots/dao.test.js` → FAIL (module not found)

- [ ] **1-2-3: DAO 구현**

```javascript
// services/psSlots/dao.js
const db = require('../../db/db');

async function listByProject(project_id) {
  const { rows } = await db.query(
    'SELECT * FROM ps_slots WHERE project_id = $1 ORDER BY id',
    [project_id]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM ps_slots WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByName(project_id, name) {
  const { rows } = await db.query(
    'SELECT * FROM ps_slots WHERE project_id = $1 AND name = $2',
    [project_id, name]
  );
  return rows[0] || null;
}

async function create({ project_id, name, display_name, description, thumbnail_url, subdomain, container_port, idle_timeout_s, owner_user_id }) {
  const { rows } = await db.query(
    `INSERT INTO ps_slots (project_id, name, display_name, description, thumbnail_url, subdomain, container_port, idle_timeout_s, owner_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,600),$9)
     RETURNING *`,
    [project_id, name, display_name, description || '', thumbnail_url || null, subdomain, container_port, idle_timeout_s, owner_user_id || null]
  );
  return rows[0];
}

async function update(id, patch) {
  const allowed = ['display_name', 'description', 'thumbnail_url', 'state', 'idle_timeout_s', 'active_version'];
  const keys = Object.keys(patch).filter(k => allowed.includes(k));
  if (keys.length === 0) return findById(id);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map(k => patch[k]);
  const { rows } = await db.query(
    `UPDATE ps_slots SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM ps_slots WHERE id = $1', [id]);
}

async function nextAvailablePort() {
  // 8081~8999 range, pick min unused
  const { rows } = await db.query('SELECT container_port FROM ps_slots ORDER BY container_port');
  const used = new Set(rows.map(r => r.container_port));
  for (let p = 8081; p <= 8999; p++) {
    if (!used.has(p)) return p;
  }
  throw new Error('No container port available in 8081-8999 range');
}

module.exports = { listByProject, findById, findByName, create, update, remove, nextAvailablePort };
```

- [ ] **1-2-4: 테스트 통과 확인** `node --test tests/psSlots/dao.test.js` → PASS

- [ ] **1-2-5: Commit** `feat(psSlots): add slot DAO with reserved Phase C fields`

### Task 1-3: 버전 DAO (`services/psSlots/versionDao.js`)

원본 스펙 §3 ps_versions 테이블. TDD 동일 패턴.

- [ ] **1-3-1: `tests/psSlots/versionDao.test.js` 작성** — `create`, `findBySlot`, `findActive`, `enforceFifoN3`(4번째 업로드 시 v1 자동 삭제) 시나리오
- [ ] **1-3-2: 실패 확인 후 `services/psSlots/versionDao.js` 구현**
- [ ] **1-3-3: Commit**

### Task 1-4: 슬롯 CRUD 라우트 (`routes/psSlots.js`)

**엔드포인트:**
- `GET /api/projects/:projectId/ps-slots` (목록)
- `POST /api/projects/:projectId/ps-slots` (생성: subdomain 자동 할당, 포트 자동 배정, CF+ingress는 Phase 4에서 훅)
- `PATCH /api/projects/:projectId/ps-slots/:slotId`
- `DELETE /api/projects/:projectId/ps-slots/:slotId`

- [ ] **1-4-1: 라우트 통합 테스트** — supertest + 메모리 DB 또는 실DB 트랜잭션 롤백
- [ ] **1-4-2: `routes/psSlots.js` 구현**
- [ ] **1-4-3: server.js에 마운트**
  ```js
  app.use('/api/projects', authMiddleware, viewerGuard, require('./routes/psSlots'));
  ```
- [ ] **1-4-4: PM2 재기동 + `curl` smoke** `POST /api/projects/27/ps-slots` (project 27 = twinverse-ps2 DB row)
- [ ] **1-4-5: Commit**

## Phase 2 — 업로드 & 검증

### 적응 포인트

- **저장 루트**: `/srv/pixelstreaming/` (setup 스크립트 `scripts/setup-ps-storage.sh` 제공, root 권한 필요)
- **tus-node-server v1.x**: Orbitron `package.json` dependencies 추가
- **20GB 제한**: tus `maxSize` + PG CHECK 제약 이중
- **검증기 (`services/psSlots/extractor.js`)**:
  - path traversal (`..`, absolute, symlink bomb) 차단
  - UE5 필수 파일 정규식:
    - `^Package/Linux/[^/]+/Binaries/Linux/[^/]+-Linux-Shipping$`
    - `^Package/Linux/[^/]+/Content/Paks/.+\.ucas$`

### Task 2-1~2-5 (원본 Phase 2 참조)

각 Task가 [원본 개정판](2026-04-15-pixel-streaming-orbitron-adapted.md#phase-2) 그대로 이행되되, 실측된 패키지 구조(TwinverseDesk Linux ZIP)를 정답 템플릿으로 사용:

```
Linux/
├── Engine/
├── Manifest_NonUFSFiles_Linux.txt
├── Manifest_UFSFiles_Linux.txt
├── TwinverseDesk/
│   ├── Binaries/Linux/TwinverseDesk-Linux-Shipping   ← 필수
│   ├── Content/
│   └── Samples/
└── TwinverseDesk.sh                                   ← 편의 실행 스크립트
```

- [ ] **2-1: tus 업로드 엔드포인트** (`routes/psUploads.js`)
- [ ] **2-2: finalize 훅** → `services/psSlots/pipeline.js` 트리거
- [ ] **2-3: extractor 유닛 테스트** (path traversal 3종 공격 벡터)
- [ ] **2-4: extractor 구현 + 검증 통과**
- [ ] **2-5: pipeline 오케스트레이터 기본 구조** (추출 → 이후 Phase 3에서 확장)

## Phase 3 — 패키지 배포 파이프라인 (이미지 빌드 대체)

### 🔄 설계 변경: Docker 이미지 빌드 생략

**원안**: UE5 패키지 → Dockerfile 렌더 → docker build → save|ssh load
**개정안**: UE5 패키지 → **rsync to twinverse-ai `/opt/ps-slots/<slot>/current/`** → 컨테이너는 공용 러너 이미지 + 볼륨 마운트

**근거 (실측)**:
- 8.1GB 패키지 rsync LAN 109 MB/s = **75초** (vs Docker build + save + load는 수 분+)
- 기존 twinverse-ps2 구조가 `/opt/ue5` 볼륨 마운트 + 공용 러너 이미지로 이미 동작 중
- 공용 러너 이미지(`twinverse/ps2:latest`) 한 번만 빌드, 슬롯별 변경 없음 → 관리 단순화

### 공용 러너 이미지 구조

```
twinverse/ps-runner:latest (Dockerfile 위치: templates/pixel-streaming/Dockerfile.runner)
├── base: nvidia/cuda:12.0.0-runtime-ubuntu22.04
├── Wilbur signaling server (내장)
├── PS2 FastAPI spawner (내장)
├── xvfb, Vulkan 런타임, libvulkan1, libpulse0
└── ENTRYPOINT: /entrypoint.sh — /opt/ue5/ 마운트 확인 → Wilbur + PS2 API 기동
```

이미지 빌드는 초기 1회. 이후 슬롯마다 `/opt/ps-slots/<slot>/current/` 볼륨만 바뀜.

### Task 3-1: 공용 러너 이미지 구현

- [ ] **3-1-1: `templates/pixel-streaming/Dockerfile.runner` 작성** (기존 `/opt/twinverse-ps2/Dockerfile` 베이스)
- [ ] **3-1-2: `templates/pixel-streaming/entrypoint.sh`** — UE_PACKAGED_PATH 검증 + Wilbur 기동 + PS2 API 기동
- [ ] **3-1-3: 이미지 빌드 + twinverse-ai로 전송 (`docker save | ssh load`)** — 이건 1회성
- [ ] **3-1-4: 테스트 — 빈 `/opt/ps-slots/test/current/` 마운트 후 컨테이너 기동, 헬스체크 통과 확인**
- [ ] **3-1-5: Commit + 이미지 태그 `twinverse/ps-runner:1.0.0`**

### Task 3-2: 패키지 원격 전송 (`services/psSlots/remoteDeploy.js`)

```javascript
// services/psSlots/remoteDeploy.js
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const GPU_HOST = process.env.PS_GPU_HOST || 'stevenlim@192.168.219.117';

async function rsyncPackage(localDir, slotName, versionLabel) {
  const remotePath = `/opt/ps-slots/${slotName}/versions/${versionLabel}/`;
  await execFileP('ssh', [GPU_HOST, `mkdir -p ${remotePath}`]);
  const { stdout, stderr } = await execFileP('rsync', [
    '-a', '--delete',
    `${localDir}/`,
    `${GPU_HOST}:${remotePath}`,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return { stdout, stderr };
}

async function activateVersion(slotName, versionLabel) {
  // atomic symlink swap: /opt/ps-slots/<slot>/current -> versions/<label>
  const target = `/opt/ps-slots/${slotName}/versions/${versionLabel}`;
  const link = `/opt/ps-slots/${slotName}/current`;
  const tmp = `${link}.tmp.${Date.now()}`;
  await execFileP('ssh', [GPU_HOST,
    `ln -sfn ${target} ${tmp} && mv -Tf ${tmp} ${link}`
  ]);
}

async function enforceFifoN3(slotName) {
  // keep latest 3 versions, delete older
  const script = `
    cd /opt/ps-slots/${slotName}/versions 2>/dev/null &&
    ls -t | tail -n +4 | xargs -r rm -rf
  `;
  await execFileP('ssh', [GPU_HOST, script]);
}

module.exports = { rsyncPackage, activateVersion, enforceFifoN3 };
```

- [ ] **3-2-1: 단위 테스트** (SSH 대상을 로컬 `stevenlim@127.0.0.1`로 mocking 또는 실제 twinverse-ai 통합 테스트 디렉터리 사용)
- [ ] **3-2-2: 구현 + 실측** 8GB 패키지 rsync 시간 기록 (기대: <90초 LAN)
- [ ] **3-2-3: Commit**

### Task 3-3: 파이프라인 조합 (`services/psSlots/pipeline.js`)

```
[finalize] → extractor.extract() → remoteDeploy.rsyncPackage() →
remoteDeploy.activateVersion() → remoteDeploy.enforceFifoN3() →
versionDao.update(status='ready')
```

각 단계 SSE 브로드캐스트 — 진행률 0→100.

- [ ] **3-3-1: 파이프라인 함수 `runBuildPipeline(slotId, versionId)` 구현**
- [ ] **3-3-2: finalize 훅에서 호출**
- [ ] **3-3-3: SSE 엔드포인트 `GET /api/.../versions/:versionId/build-log`**
- [ ] **3-3-4: 통합 테스트 — 소형 더미 패키지(1MB)로 E2E 검증**

## Phase 4 — 활성화 · 롤백 · Cloudflare 자동화

### 적응 포인트

- **원자적 심볼릭 교체**: Task 3-2의 `activateVersion` 재사용
- **롤백 API**: `POST /api/.../versions/:versionId/activate` — 과거 버전으로 링크 재연결 + 실행 중 컨테이너 재시작
- **Cloudflare 터널 ingress 갱신**:
  - **위치**: twinverse-ai `/etc/cloudflared/config.yml` (호스트 측 운영 파일, 실측으로 확인됨)
  - **갱신 방법**: Orbitron이 SSH로 config 파일을 append + `sudo systemctl reload cloudflared`
  - **템플릿**:
    ```yaml
    - hostname: <slot>.ps.twinverse.org
      service: http://localhost:8080
      originRequest:
        noTLSVerify: true
        connectTimeout: 30s
    ```
- **DNS 자동화**: 기존 Orbitron [services/tunnel.js](services/tunnel.js)의 CF API 클라이언트 재사용, CNAME `<slot>.ps.twinverse.org` → 터널 UUID `51edb5fe-...`

### Task 4-1~4-4 (원본 Phase 4 단순화)

- [ ] **4-1: `services/psSlots/cfTunnel.js`** — CF DNS CNAME 생성/삭제
- [ ] **4-2: `services/psSlots/cfIngress.js`** — SSH로 twinverse-ai config.yml 수정 + reload
- [ ] **4-3: 슬롯 생성 라우트에서 4-1 + 4-2 호출**
- [ ] **4-4: 슬롯 삭제 라우트에서 역연산**

### Task 4-5: 외부 실측 결과 반영 (Phase 0-3 의존)

- [ ] **4-5-1: 외부 접속 성공한 경우** → 추가 작업 없음
- [ ] **4-5-2: 외부 접속 실패한 경우** → [CF Realtime TURN 통합 Task 4-B (원본 결정 보고서)](2026-04-15-phase0-webrtc-media-plane-decision.md#phase-4-b-태스크-상세-채택-시)
  - `services/psSlots/turnCredentials.js` (단기 크리덴셜 발급)
  - `routes/psRuntime.js`에 `GET /:slotId/turn-credential`
  - Wilbur `peer_options` 런타임 주입 (UE5 빌드가 지원하면)

## Phase 5 — On-demand 기동 · 세션 관리 · VRAM 가드

### 적응 포인트

- **기동 API**: 기존 PS2 API `POST /api/ps2/spawn` 재사용. Orbitron이 JWT 서명 후 proxy 호출.
- **Wilbur 세션 조회**: PS2 API `GET /api/ps2/sessions` 사용 (이미 존재)
- **유휴 감지**: Orbitron 내부 `setInterval` (PM2 단일 프로세스) — 별도 워커 불필요
- **VRAM 가드 (신규)**:
  - 기동 전 `nvidia-smi --query-gpu=memory.used,memory.total --format=csv` 조회 (SSH)
  - 예상 소요 VRAM (환경변수 `PS_UE5_VRAM_MB`, 기본 10000) × active + 요청 하나 ≤ (total - safety_margin 2000)?
  - 넘으면 `503 Insufficient GPU memory` 반환 + 대시보드 안내

### Task 5-1~5-5

- [ ] **5-1: Orbitron proxy 라우트 `routes/psRuntime.js`**
  - `POST /api/projects/:projectId/ps-slots/:slotId/start` → PS2 API `/spawn`
  - `POST .../stop` → PS2 API `/terminate`
  - `GET .../status` → PS2 API `/sessions` 필터
- [ ] **5-2: VRAM 가드 미들웨어** `services/psSlots/gpuGuard.js`
- [ ] **5-3: 유휴 감지 워커** `services/psSlots/idleWorker.js`
- [ ] **5-4: 공개 API `/api/public/projects/:slug/ps-slots`** (rate-limit 60/min per IP)
- [ ] **5-5: 통합 테스트** + Commit

## Phase 6 — UI

### 적응 포인트

- **기존 Orbitron UI 스택**: SPA 아님. [public/app.html](public/app.html) 단일 HTML + [public/js/app.js](public/js/app.js) vanilla JS, `navigateTo(page)` + `page-<name>` div 토글
- **사이드바**: 기존 "도메인 & SSL" 섹션 근처에 "🎮 Pixel Streaming" 섹션 추가
- **tus-js-client**: `public/js/vendor/tus.min.js` 로컬 저장
- **UE5 빌드 업로드 UI**: drag & drop + tus 진행바 + 빌드 로그 SSE

### Task 6-1~6-4

- [ ] **6-1: 사이드바 메뉴 추가** [public/app.html](public/app.html)
- [ ] **6-2: `page-ps-slots` 섹션 추가** — 슬롯 목록 테이블 + 새 슬롯 모달
- [ ] **6-3: 슬롯 상세 — tus 업로드 + 버전 히스토리 + 런타임 컨트롤**
- [ ] **6-4: TwinverseAI 랜딩** [deployments/twinverseai/](deployments/twinverseai/) `/pixel-streaming` 라우트 + 공개 API 연동 + Play 버튼

## Phase 7 — 기존 환경 마이그레이션

- [ ] **7-1: 기존 `/opt/twinverse-ps2/` 현 상태 백업** (운영 중이면 다운타임 계획)
- [ ] **7-2: 첫 슬롯 `office` 생성** — TwinverseDesk Linux zip 업로드 (이미 `/media/stevenlim/TwinverseFolder/Linux/` 에 있음)
- [ ] **7-3: `office.ps.twinverse.org` 정상 동작 확인** (수준 1 멀티플레이어 빌드 도착 후)
- [ ] **7-4: 하위 호환 리다이렉트** — `ps2.twinverse.org` → `office.ps.twinverse.org` 301 (CF Page Rule)
- [ ] **7-5: 구 `/opt/twinverse-ps2/` 정리** (DB project id=27 아카이브 후 삭제)
- [ ] **7-6: TwinversePS2-Deploy GitHub repo archive**

## Cross-cutting

### 커밋 규칙
- Task 단위 1 커밋
- Prefix: `feat:` `fix:` `refactor:` `docs:` `test:`

### 테스트 위치
- `tests/psSlots/` (Node v22 built-in test runner `node --test`)
- `tests/integration/ps-slots.test.js` (supertest + 테스트 DB)

### 품질 기준 (측정 가능)
- **보안**: path traversal / command injection / SSRF / 권한 상승 / env 파일 노출 **0건**
- **관측성**: 모든 배포 단계 `build_log` 기록 + SSE 실시간 + 실패 시 원인 포함
- **롤백**: atomic symlink swap, 3버전 FIFO, DNS 회수 가능, CF ingress 회수 가능
- **성능**: 8GB 업로드 → 활성화 **<10분** (rsync 90초 + 검증 30초 + symlink 1초 + 기타)
- **콜드 스타트**: start 호출 → 첫 프레임 **<90초**
- **VRAM 가드**: 예상치 초과 시 503 반환, 실제 OOM 방지

## Phase 완료 게이트

각 Phase 완료마다 Steven 리뷰:
- 데모 (화면 녹화 또는 라이브)
- 변경 파일 diff 요약
- 테스트 결과
- 남은 리스크·질문

## Self-Review 체크리스트

- [ ] UE5 프로젝트 수정 항목이 플랜에 없는가? (범위 외)
- [ ] 각 Phase가 UE5 빌드 없이도 단독으로 진행·테스트 가능한가? (Mock 빌드/소형 패키지로)
- [ ] 인터페이스 계약 §4가 명확하여 TwinverseDesk AI가 자기 책임을 이해할 수 있는가?
- [ ] Phase 3 rsync 기반 배포가 Phase 1 원안(Docker 빌드)의 모든 요구를 커버하는가?
- [ ] VRAM 가드가 실제 운영에서 OOM을 막을 수 있는가?
- [ ] CF Tunnel ingress 자동화가 SSH+sudo 권한을 안전하게 처리하는가? (passwordless sudo 한정 커맨드 설정)

## 실행 방식

**옵션 1. Subagent-Driven** (권장) — fresh subagent per task + 2단계 review
**옵션 2. Inline Execution** — 현재 세션에서 단계별 + checkpoint

Steven 선택 후 Phase 0-1(레거시 제거)부터 실행 시작.
