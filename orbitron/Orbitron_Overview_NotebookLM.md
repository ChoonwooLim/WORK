# Orbitron: The Ultimate Serverless & Game Deployment Platform

## 1. 개요 (Overview)
**Orbitron(오비트론)**은 복잡한 서버 인프라 지식 없이도 누구나 자신의 웹 애플리케이션, 데이터베이스, 심지어 **언리얼 엔진(Unreal Engine) 및 유니티(Unity) 게임**까지 단 몇 번의 클릭으로 클라우드에 배포할 수 있도록 돕는 혁신적인 **올인원 배포 자동화 대시보드(All-in-One Deployment Dashboard)**입니다.

Orbitron은 개발자가 코딩과 콘텐츠 자체에만 집중할 수 있도록 "서버리스(Serverless)" 라이크한 경험을 제공하며, 내부적으로 Docker, Nginx, PM2, Cloudflare Tunnel 기반의 강력한 자동화 아키텍처를 갖추고 있습니다.

## 2. 타겟 고객 및 핵심 가치 (Target Audience & Value Proposition)
### 타겟 고객
- **인디 게임 개발자 및 스튜디오**: 언리얼/유니티로 만든 게임을 전 세계 유저들이 웹 환경에서 다운로드 없이 플레이(Pixel Streaming & WebGL)할 수 있게 만들고 싶을 때.
- **백엔드/프론트엔드 개발자**: GitHub에 코드를 푸시하기만 하면 즉시 서버에 빌드, 컨테이너화, 자동 배포가 이루어지는 CI/CD 환경을 원할 때.
- **IT 교육 기관 및 해커톤 참가자**: 서버 호스팅, 도메인 연결, 인증서 발급 등 번거로운 과정 없이 빠르게 프로토타입을 공개해야 할 때.

### 핵심 가치 (Value Propositions)
1. **Zero Configuration**: 포트 설정, 리버스 프록시, 도메인 연결 등 복잡한 네트워크 설정을 사용자 몰래 자동으로 처리합니다.
2. **다중 게임 엔진 지원**: 게임 클라이언트를 클라우드로 스트리밍하는 **언리얼 엔진 픽셀 스트리밍(Pixel Streaming)** 기능과 맵핑된 **유니티 WebGL** 빌드 자동 호스팅을 특별히 지원합니다.
3. **무중단 운영 자동화**: 서버 재부팅 시 앱 복구(Systemd/PM2), GitHub 훅 연동을 통한 무중단 CI/CD 롤백 기능 탑재.

---

## 3. 주요 핵심 기능 (Core Features)

### 🚀 1. 원클릭 무중단 배포 (Zero-Downtime) 및 자동화 CI/CD
사용자는 GitHub 레포지토리 주소만 입력하면 됩니다. 
Orbitron은 실시간으로 코드를 Pull하고, 자동으로 Docker 컨테이너를 빌드 및 실행합니다. 프로젝트 소스 코드에 변경이 발생하면 GitHub Webhook을 통해 감지하여 백그라운드에서 새로운 컨테이너를 구동하며, 기존 컨테이너와의 교체 순간에 **Nginx 리버스 프록시를 스냅 스위칭(Blue-Green)** 하여 단 1초의 끊김도 없는 **완벽한 무중단 배포(Zero-Downtime Deploy)**를 수행합니다.

### 🌐 2. 서버리스 네트워킹 & Cloudflare Tunnels 내장
배포된 모든 앱은 로컬 네트워크 밖에서도 즉시 접속할 수 있도록 **자동으로 서브도메인이 할당**됩니다 (`https://[프로젝트명].twinverse.org`).
Vercel이나 Netlify처럼 개발자가 복잡한 포트포워딩이나 인증서 발급(SSL/HTTPS)을 신경 쓸 필요 없이, 백엔드의 `Cloudflare Tunnel (cloudflared)` 서비스가 안전하고 빠른 글로벌 엣지 연결을 1초 만에 구성합니다.

### 🎮 3. 언리얼 엔진 픽셀 스트리밍 (Unreal Engine Pixel Streaming) 전용 호스팅
고성능 데스크톱 앱인 언리얼 엔진 게임을 브라우저에서 실행할 수 있는 "클라우드 게이밍" 아키텍처를 내장했습니다. 
- GPU 할당을 최적화(`--gpus` 동적 할당 방식)하여 한 서버에서 여러 인스턴스가 독립적으로 구동되게 합니다. (Ex: `GTX 1080`과 같은 듀얼 GPU 자동 할당 등).
- 미사용 세션(디버그된 좀비 컨테이너)은 백그라운드에서 추적되어 1분마다 정리되어 불필요한 서버 자원 독점을 막습니다.

### 🎲 4. 유니티 WebGL (Unity WebGL) 자동 배포
데스크톱 빌드를 WebGL로 뽑은 ZIP 파일을 업로드하면, 즉시 경량 Nginx 컨테이너 환경에서 게임을 서비스합니다. 게임을 공유하기 위한 URL 생성까지 단 10초가 소요됩니다.

### 🗄 5. 멀티 컨테이너 오케스트레이션 (Docker Compose) & 매니지드 데이터베이스
프로젝트 루트에 `docker-compose.yml` 파일이 있으면, Orbitron은 단일 앱 빌드를 넘어 **수십 개의 복합 컨테이너(Node.js, Redis, Celery Worker 등)를 하나로 엮어 배포하는 대규모 시스템 오케스트레이션**을 자동 수행합니다.
또한, 프로젝트에 필요한 `PostgreSQL`이나 `Redis` 가상 데이터베이스를 클릭 한 번으로 가상 네트워크 망에 생성할 수 있습니다. 동일한 Orbitron 대시보드 내의 앱들은 서로 프라이빗 네트워크(`orbitron_internal`)를 통해 외부에 데이터베이스를 노출하지 않고 직접 고속 통신할 수 있습니다.
거기에 더해 통신 포트를 외부로 열지 않고 백그라운드 데이터 처리만 담당하는 **Background Worker** 무한 구동 모드까지 완벽하게 지원합니다.

### 🛡️ 6. 실시간 자원 모니터링 및 AI 어시스턴트 디버깅 (AI Analyzer)
대시보드 상에서 실행 중인 컨테이너의 콘솔을 확인하고 환경 변수를 실시간으로 주입(`Bulk Import .env`) 할 수 있습니다. 빌드 중 혹은 실행 중 에러가 발생한 경우, 엮어진 로그를 **내장된 AI 어시스턴트 엔진**에 넘겨 문제의 원인과 해결 코드를 즉석에서 추천받는 강력한 오류 대응력을 자랑합니다.

**[2026.04 신규] 🌱 트리플 LLM 라우팅 — Claude · Gemini · 로컬 Gemma 4**: 기존 Anthropic Claude / Google Gemini의 듀얼 클라우드 LLM에 더해, **로컬 Ollama 기반 Google Gemma 4 E4B** (8B 파라미터, Q4_K_M 양자화, 9.6GB)가 제3의 AI 엔진으로 추가되었습니다. 프로젝트 설정에서 `🌱 Gemma 4 E4B (로컬·무료, Ollama)`를 선택하면 해당 프로젝트의 모든 에러 분석 / AI 채팅 / 자동 코드 패치 생성이 로컬 GPU(CUDA)에서 처리되어 **외부 API 비용 0원, 인터넷 연결 불필요, 데이터가 서버 밖으로 나가지 않는** 완전 오프라인 모드가 가능합니다. Ollama daemon은 사용자 systemd 유닛(`~/.config/systemd/user/ollama.service`)으로 영속화되며, 모델 데이터는 시스템 디스크가 아닌 별도 데이터 드라이브(`OLLAMA_MODELS` 경로)에 저장됩니다. 향후 더 큰 variant(E2B, 26B MoE, 31B Dense)도 모델 ID 매핑 테이블에 등록만 추가하면 즉시 사용 가능합니다.

**[2026.04 v2.2 신규] 🖥 분산 GPU 추론 아키텍처**: 대시보드 프로덕션 호스트와 AI 추론을 담당하는 **전용 GPU 서버(Threadripper 3970X + RTX 3090 24GB + 128GB RAM)**를 분리 운영합니다. 무거운 LLM 워크로드(31B 등)를 전용 머신으로 오프로드하여 대시보드 재시작이 진행 중인 AI 추론을 끊지 않습니다. 환경변수(`OLLAMA_HOST`)만 바꾸면 GPU 서버를 여러 대로 확장 가능. Ollama `OLLAMA_KEEP_ALIVE=30s` 정책으로 사용 중일 때만 VRAM을 점유해 동일 GPU에서 다른 워크로드와 충돌하지 않습니다.

**[신규 아키텍처] 📱 텔레그램 & 카카오톡 모바일 웹 시뮬레이터 (SSE 탑재):**
- RemoteAGT 대시보드 내에 스마트폰 화면과 100% 동일한 **텔레그램 및 카카오톡 앱 시뮬레이터 UI**를 내장하여, 봇 토큰 없이도 완벽한 AI 제어 모의 테스트가 가능합니다.
- 명령어 전송 시, 백엔드 라우터에서 **SSE(Server-Sent Events) 비동기 스트리밍** 기술과 **Webhook Mocking**을 결합하여, 백그라운드 구동 환경의 제약(`VSCODE_IPC_HOOK_CLI` 할당 문제)을 완벽히 우회하고 실시간으로 마크다운 UI 응답을 받아옵니다.

### ⚙️ 7. Infrastructure-as-Code (IaC) 적용
개발자가 프로젝트 루트 폴더에 `orbitron.yaml` 파일만 넣어두면, 빌드 명령어, 시작 명령어, 포트 설정 및 내부 환경 변수를 Orbitron 엔진이 감지하여 프로젝트 설정들을 대시보드의 개입 없이 동적으로 덮어씌웁니다 (`Override`). 

---

## 4. 인프라 아키텍처 및 보안 (Architecture & Security)
- **Host System**: 리눅스 기반 Docker 호스트 엔진. Systemd 데몬으로 서버 레벨의 재시작 시 자동 복구를 지원.
- **Traffic Routing**: Cloudflare Tunnels -> 로컬 Nginx Reverse Proxy -> 개별 Docker 컨테이너 및 Pixel Streaming Session 간 다이나믹 매핑. 터널 도메인은 `TUNNEL_DOMAIN` 환경변수로 커스터마이징 가능.
- **Data Protection**: 환경 변수(`env_vars`)나 API Key 등의 민감한 정보는 AES-256-GCM 기반 암호화(`db/crypto.js`)를 거쳐 Database에 저장. JWT 인증 시크릿은 필수 환경변수(`JWT_SECRET`)로 관리되며 하드코딩된 폴백 없음. 추가로, 사용자 의도 없이 데이터가 유실되지 않도록 **전체 자동 드라이브 백업(Project & Media Backup)** 파이프라인이 매 배포마다 동작.
- **배포 안정성 (2026.04)**: Docker 레이어 캐싱으로 빌드 속도 2~3배 향상, 60분 배포 타임아웃(타이머 누수 방지), 512KB 로그 크기 제한, 미사용 이미지 자동 정리(24시간), DB 커넥션 풀 제한(max 20), Graceful Shutdown, 터널 지수 백오프 재시도.
- **코드 리뷰 핵심 수정 (2026.04)**: Cloudflare Named 터널 생성 실패 원인이었던 `_writeConfig` async/await 버그 수정, 중복 `stopTunnel` 메서드 병합(Systemd 터널 미정지 해결), 환경변수 암호화 따옴표 버그 수정(복호화 실패 해결), Health Check 실제 포트 사용, apk.txt 개행 파싱 regex 수정.
- **RemoteAGT 아키텍처 리팩토링 (2026.04)**: server.js 748줄→230줄(-69%) 경량화, 텔레그램/카카오 시뮬레이터 80% 중복 코드를 `simulator.js` 공통 핸들러 1개로 통합, 자체 정규식 마크다운 렌더러를 `marked`+`DOMPurify`로 교체(XSS 3개 벡터 완전 차단).
- **복구 경로 및 암호화 안정화 (2026.04.11, v2.1)**:
  - **Blue-Green 컨테이너 복구 prefix 매칭**: 서버 시작 시 복구 로직이 `orbitron-{subdomain}` 정확 일치만 시도해 deployHash 접미사가 붙은 살아있는 컨테이너를 못 찾고 새 컨테이너를 만들다 호스트 포트 충돌(`Bind for 0.0.0.0:3480 failed`)이 나던 버그를 prefix 매칭으로 해결. 살아있는 컨테이너 발견 시 `--restart unless-stopped` 정책만 갱신하고 `container_id`를 동기화 — 불필요한 컨테이너 재생성 0건.
  - **`spawn E2BIG` 진짜 원인 수정**: 복구 경로가 `project.env_vars`(암호화된 hex 문자열)를 복호화하지 않고 `dockerService.startContainer()`에 그대로 전달 → `Object.keys(envVars)`가 string의 각 문자를 키로 인식 → `-e 0='2' -e 1='c' ...` × 12,748글자 → 명령어 길이 ~128KB → `MAX_ARG_STRLEN` 한계로 execve가 `E2BIG` 반환. `decryptProjectEnvVars()` 헬퍼를 server.js에 추가하고, `docker.js startContainer()`에 type guard를 추가하여 이중 방어.
  - **이전 키 암호화 행 안전 복구**: 이전 `JWT_SECRET`으로 암호화된 4개 행(Twinverse, RemoteAGT, KcontentsHub, K-ContentHub_DB)이 매 요청마다 `Decryption failing` 로그를 내며 `error.log`를 31MB까지 부풀리던 문제를, raw 값을 `backups/broken-env-vars-2026-04-11.json`에 메타데이터와 함께 백업한 후 빈 객체로 reset하여 해결. 이전 키를 나중에 발견하면 백업 파일에서 복구 가능. 최종 reload 후 30초 모니터링에서 모든 데시벨 로그 0건 확인.
- **로컬 LLM 인프라 — Ollama 통합 (2026.04.11, v2.1)**: 데이터 드라이브 기반 Ollama 배포 + Gemma 4 E4B 통합. Ollama 바이너리/모델 모두 별도 데이터 드라이브에 두어 시스템 디스크 분리, `OLLAMA_MODELS` 환경변수로 경로 지정, `~/.config/systemd/user/ollama.service` 사용자 systemd 유닛으로 영속화, NVIDIA CUDA 12 + GTX 1080 ×2 자동 인식. 트리플 LLM 라우팅(Claude/Gemini/Gemma)으로 클라우드 비용 0원 옵션 제공.
- **커스텀 도메인 UX 대개편 — 전용 위저드 + 멀티 SAN + Canonical 리다이렉트 + SEO (2026.04.14 오후, v2.4)**:
  - 커스텀 도메인 연결 기능을 프로젝트 설정 탭에서 꺼내 **전용 사이드바 메뉴 "🌐 커스텀 도메인 연결"**로 승격. 7단계 위저드: 프로젝트 선택 → 독립 필드 방식 도메인 입력(+/✕로 무한 추가/삭제) → DNS 관리 회사 6개 타일 선택(Squarespace/Gabia/Cloudflare/Namecheap/Route53/기타) → 회사별 맞춤 단계별 가이드(실제 메뉴명·로그인 URL·삭제해야 할 기존 레코드까지 명시) → DNS 검증 → Let's Encrypt 발급 + 연결 → 검색엔진 등록(Google/Naver/Bing/Daum). 모든 DNS 값에 📋 복사 버튼.
  - **멀티 도메인 SAN 인증서**: apex + www + 추가 서브도메인을 하나의 Let's Encrypt SAN 인증서로 묶어 발급. `services/letsencrypt.js:issueCert`가 `string | string[]` 수용, `--cert-name <primary> --expand`로 SAN 리스트 변경 시에도 같은 cert-name 유지.
  - **Canonical 리다이렉트**: 새 `projects.redirect_to_custom_domain` 컬럼. 체크 시 `{subdomain}.twinverse.org` → `https://<기본 도메인>` 301 자동 이동(SEO 중복 콘텐츠 제거). ACME `/.well-known/acme-challenge/` 경로는 리다이렉트에서 예외 처리돼 Let's Encrypt 갱신 정상 동작. `PATCH /api/projects/:id/domain/redirect`로 재발급 없이 즉시 On/Off.
  - **7단계 검색엔진 등록**: 연결 완료 시 자동 노출. Google Search Console / 네이버 서치어드바이저 / Bing Webmaster Tools / Daum·Kakao 4개 서비스 각각의 등록 경로 + 소유권 검증 방식(DNS TXT / HTML 파일 / 메타태그) + sitemap·메인 URL 자동 생성 + 기본 SEO 체크리스트(robots.txt, 필수 메타태그).
  - **공인 IP 4중 방어 리졸버**(`services/publicIp.js`): `.env PUBLIC_IP` > 어드민 런타임 수동 설정 > 6개 external provider 순차 자동 조회(ipify/ipify-v2/ifconfig/icanhaz/seeip/myip, 4s timeout, 1h 캐시) > 실패 시 진단 힌트. 신규 `routes/system.js`를 `/api/system`에 분리 마운트해서 `routes/projects.js`의 `GET /:id` 패턴이 `/api/projects/public-ip`를 가로채던 버그 회피. 운영은 `.env`의 `PUBLIC_IP=116.33.16.12`로 응답 1ms.
  - **IP 자동 조회 실패 시 어드민 안내 모달**: "IP를 어떻게 찾는가" 자체를 상황별(공유기 뒤 서버 / 클라우드 콘솔 / SSH+curl)로 설명 + 외부 조회 사이트 4개 링크(whatismyipaddress.com · whatismyip.com · api.ipify.org · 네이버 "내 아이피") + IPv4 검증 입력 + `.env` 영구 설정 레시피 + 실패 원인 진단(아웃바운드 443 차단, DNS 오류, TLS intercept 등).
  - 대응 commit: `31b28ec3 feat: dedicated Custom Domain wizard + multi-domain SAN + canonical redirect`

- **커스텀 도메인 멀티테넌트 + Let's Encrypt 자동 SSL (2026.04.14, v2.3)**:
  - 신규 기능: Orbitron 유저가 본인 소유 도메인(`myapp.com` 같은 apex 포함)을 프로젝트에 자유롭게 연결. A 레코드(공인 IP) 또는 CNAME(`{sub}.twinverse.org`) 양방 지원.
  - `services/letsencrypt.js` — certbot webroot 모드 래퍼. sudo 없이 stevenlim 계정으로 실행되며 `/home/stevenlim/letsencrypt/`에 인증서 저장. `issueCert / renewAll / revokeCert / certInfo` 노출.
  - `services/nginx.js` — `_httpsBlock()` 추가. 커스텀 도메인에 live 인증서가 있으면 자동으로 TLSv1.2/1.3 HTTPS 서버 블록을 생성.
  - `infrastructure/docker-compose.yml` — dev-nginx에 두 볼륨 추가 (read-only): `/home/stevenlim/letsencrypt/config → /etc/letsencrypt`, `webroot-acme → /var/www/certbot`.
  - `infrastructure/nginx/conf.d/default.conf` — 공유 ACME challenge 위치 추가, 모든 요청에서 `/.well-known/acme-challenge/*`를 webroot로 서빙.
  - `routes/domains.js` — 전면 재작성. `/verify` (A 또는 CNAME 어느 쪽이든 우리 서버 가리키면 OK), `/connect` (Let's Encrypt 발급 + nginx 재생성 + reload), `/status` (cert expiry + DNS 매치), `/disconnect` (revoke + 제거), `/renew`. 이전의 Cloudflare 터널 route dns 의존성 제거.
  - UI — 대시보드 프로젝트 설정의 커스텀 도메인 섹션이 DNS 가이드(공인 IP 자동 표시, A vs CNAME 분리 안내, 가비아/Cloudflare 예시), 인증서 만료 카운트다운, 🔄 갱신 버튼, 해제 버튼으로 개편.
  - 자동 갱신 — `~/.config/systemd/user/orbitron-cert-renew.{service,timer}` (매일 00:45 + 0-1h 랜덤 지연). 갱신 후 자동 nginx reload.
  - `twinverse.org` apex 도메인 자체도 이번에 Render에서 Orbitron 터널로 마이그레이션 (`cloudflared tunnel route dns --overwrite-dns` 사용, commit `37e0befe`). 동시에 v2.1 recovery regex bug 수정 — `docker ps --filter "name=^orbitron-twinverse"`가 `orbitron-twinverseai-*`까지 매칭하던 prefix 충돌을 post-filter regex로 해결.
  - 후속 핫픽스 (commit `a6bcc828`): 부팅 복구 loop이 Docker Compose 프로젝트(IIFF)의 `container_id`를 형제 프로젝트의 DB 컨테이너로 덮어쓰던 버그 수정. `container_id`가 `compose-*`로 시작하면 prefix 매칭 스킵 + 기존 `container_id`가 실제 살아있는 컨테이너면 그대로 유지하는 2중 가드 추가. `↪ <name>: compose project — skip prefix match` 로그로 가드 동작 확인 가능.
  - 신규 문서: `public/docs-content/custom-domain.md` (+ 영문판) — 3단계 빠른 시작, HTTP-01 challenge 아키텍처 다이어그램, FAQ, 운영 가이드.

- **분산 GPU 아키텍처 (2026.04.13, v2.2)**:
  - **전용 GPU 서버 twinverse-ai 도입** (Threadripper 3970X 32C/64T + RTX 3090 24GB + 128GB DDR4 + Dual 10GbE, Ubuntu 24.04 LTS). SSH key-only, UFW LAN 전용(192.168.219.0/24), systemd linger, 350W power-limit systemd 유닛, CUDA Toolkit 12.0.
  - **Gemma 4 원격 라우팅**: Orbitron `.env`에 `OLLAMA_HOST=http://192.168.219.117:11434` 한 줄로 추론 속도 ~46→~133 tok/s(2.9×), warmup 43.5s→5.2s(8.4×).
  - **VRAM 효율**: Ollama `OLLAMA_KEEP_ALIVE=30s`로 사용 중일 때만 VRAM 점유 → 30초 idle 시 자동 언로드. 동일 GPU를 다른 워크로드와 시간 분할 공유 가능.
  - **보안·운영 정리**: `trust proxy=1`(rate-limit 스푸핑 차단), morgan `/stats` 폴링 스킵(로그 158MB→47줄), pm2-logrotate(10MB/7d/compress), `npm audit fix`(6건 취약점 패치), Docker builder + image prune(278GB 회수), `.env` 권한 600 전체 적용, SSH 비밀번호 로그인 비활성.

---

## 5. 결론: 왜 Orbitron인가?
- 기존의 AWS EC2, GCP 서버 관리 방식을 아는 **DevOps 엔지니어가 팀에 없어도**,
- 개발자 본인이 인프라 트러블슈팅에 긴 밤을 지새우지 않아도,
- 단타성 게임 프로토타입이나 무거운 언리얼 빌드를 누구나 즉시 시연할 수 있게 해주는 **"개발자를 위한 우주정거장(Orbitron)"**입니다.
