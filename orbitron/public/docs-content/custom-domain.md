# 🌐 커스텀 도메인 연결 (Let's Encrypt 자동 SSL)

> ✨ **2026.04 v2.4 업데이트**: 이제 **전용 위저드 페이지**(사이드바 → 🌐 커스텀 도메인 연결)에서 진행합니다. 멀티 도메인 SAN, canonical 리다이렉트, 검색엔진 등록 안내, DNS 공급자별 단계별 가이드까지 한 화면에서.

> ✨ **2026.04 v2.3 신규**: 이제 Orbitron 유저는 자신의 도메인(예: `myapp.com`)을 프로젝트에 자유롭게 연결할 수 있으며, HTTPS 인증서는 Let's Encrypt로 **자동 발급·자동 갱신**됩니다.

배포된 프로젝트에 본인 도메인을 연결하면:
- `{subdomain}.twinverse.org` 대신 **`https://myapp.com`** 으로 서비스
- SSL 인증서는 Orbitron이 **자동 발급** (별도 설정 불필요)
- 90일 만료 전에 **자동 갱신** (daily cron)
- Cloudflare 같은 외부 CDN 의존 **없이** 바로 작동

---

## ⚡ 핵심 개념 먼저

**네임서버(NS)는 바꾸지 않습니다.** 지금 쓰시는 도메인 관리 회사(가비아·Squarespace·Cloudflare·Namecheap 등) 그대로 두고, 그 회사의 DNS 설정 페이지에서 **레코드 1~2개만** 추가/수정하면 됩니다.

**Orbitron 서버는 하나의 공인 IP(`116.33.16.12`)를 모든 프로젝트가 공유**합니다. 도메인 라우팅은 IP가 아니라 `server_name`(Host 헤더)으로 결정되므로, 어떤 프로젝트에 연결하든 같은 IP를 씁니다.

## 🚀 7단계 위저드 (2026.04 v2.4)

사이드바 → **🌐 커스텀 도메인 연결**을 클릭하면 열리는 전용 페이지에서 아래 순서로 진행:

### 1️⃣ 프로젝트 선택
연결할 Orbitron 프로젝트를 드롭다운에서 선택. 서브도메인·터널 URL·현재 연결된 도메인 상태가 자동 표시됩니다.

### 2️⃣ 도메인 입력 (독립 필드)

- **기본 도메인** 필드(필수) — 1개 입력. SSL 인증서의 기본 이름(cert-name)이 됨.
- **추가 도메인** — `+ 도메인 추가` 버튼으로 원하는 만큼 필드를 늘리고, 각 필드 옆 `✕`로 제거. 모든 도메인이 **하나의 SAN 인증서**에 SAN으로 포함됩니다.
- **🧭 자동 리다이렉트 체크박스**(기본 ON) — 활성화 시 `{subdomain}.twinverse.org` 주소는 `https://<기본 도메인>`으로 301 리다이렉트 (SEO 친화).

### 3️⃣ DNS 관리 회사 선택

6개 타일 중 해당 회사 클릭: 🟩 **Squarespace Domains** (구 Google Domains) · 🇰🇷 **가비아** · 🟧 **Cloudflare** · 🟦 **Namecheap** · 🟨 **AWS Route 53** · ❓ **기타**

### 4️⃣ DNS 레코드 설정 (회사별 맞춤 가이드 자동 표시)

선택한 회사의 실제 메뉴 경로·로그인 URL·삭제해야 할 기존 레코드까지 명시된 단계별 가이드가 자동 렌더링됩니다. 모든 값(IP, 호스트, 타겟)에 **📋 복사 버튼** — 클릭 시 클립보드 복사 후 "✓ 복사됨" 피드백.

일반적인 2개 레코드:

| 타입 | 호스트 | 값 | 용도 |
|------|--------|-----|-----|
| **`A`** | `@` (apex) | `116.33.16.12` | `myapp.com` 자체 |
| **`CNAME`** | `www` | `{subdomain}.twinverse.org` | `www.myapp.com` |

> apex(루트 도메인)는 반드시 `A` 레코드여야 합니다 (RFC상 CNAME apex 불가).

### 5️⃣ DNS 반영 확인

**🔍 DNS 검증** 버튼 클릭 — 각 도메인이 올바르게 서버를 가리키는지 개별 확인. 일부만 전파됐으면 어느 도메인이 실패했는지 표시됩니다.

### 6️⃣ SSL 발급 + 연결

**🔗 Let's Encrypt SSL 발급 + 연결** 버튼 클릭. 20-60초 안에:
- certbot이 모든 입력 도메인을 SAN으로 포함한 인증서 발급
- nginx에 HTTPS 서버 블록 자동 생성
- nginx 리로드
- 결과: `https://<기본 도메인>`, `https://<추가 도메인 1>`, … 모두 즉시 접속 가능

### 7️⃣ 검색엔진 등록 (SEO)

연결 완료 후 자동으로 펼쳐지는 섹션. 4개 주요 검색엔진에 대한 등록 가이드:

- 🔵 **Google Search Console**
- 🟢 **네이버 서치어드바이저**
- 🟦 **Bing Webmaster Tools**
- 🟠 **Daum / Kakao 검색 등록**

각 서비스에 대해 소유권 검증 방식(DNS TXT / HTML 파일 / 메타태그) + sitemap/메인 URL 자동 생성·복사 + 추천 체크리스트(sitemap.xml, robots.txt 템플릿, 필수 메타태그, 인덱싱 타임라인) 포함.

### 🔒 자동 갱신은 알아서

- 인증서는 90일 만료 전에 daily cron(`orbitron-cert-renew.timer`)이 **자동 갱신**
- 위저드와 연결된 상태 카드에서 "🔐 SSL 남은 일수" 실시간 표시
- 필요 시 **🔄 SSL 갱신** 버튼으로 즉시 재발급

---

## 🛡 작동 원리

```
 [사용자 브라우저]
       │ https://myapp.com
       ▼
 [사용자 DNS (가비아/Cloudflare/…)]
       │ A 레코드: myapp.com → <Orbitron 공인 IP>
       ▼
 [사용자 라우터/방화벽]
       │ 포트 443/80
       ▼
 [dev-nginx (Docker)]
       │ server_name myapp.com → HTTPS 블록 매치
       │ SSL: /etc/letsencrypt/live/myapp.com/{fullchain,privkey}.pem
       │ proxy_pass http://orbitron-<project>-<deployHash>:<port>
       ▼
 [프로젝트 컨테이너] ✅
```

**SSL 인증서 발급 흐름 (HTTP-01 challenge)**:
1. 유저가 연결 버튼 클릭 → `POST /api/projects/:id/domain/connect`
2. Orbitron이 `certbot certonly --webroot` 실행
3. certbot이 `/home/stevenlim/WORK/orbitron/webroot-acme/.well-known/acme-challenge/<token>` 파일 생성
4. Let's Encrypt 서버가 `http://myapp.com/.well-known/acme-challenge/<token>` GET
5. dev-nginx가 webroot 볼륨에서 해당 파일 응답
6. Let's Encrypt 검증 성공 → `fullchain.pem` / `privkey.pem` 발급
7. `/home/stevenlim/letsencrypt/config/live/myapp.com/`에 저장 (dev-nginx에 read-only로 마운트)
8. `services/nginx.js`가 HTTPS 블록을 자동 생성해 nginx conf에 추가
9. nginx reload → HTTPS 서빙 시작

---

## 📋 FAQ

**Q1. apex 도메인(`myapp.com` 자체)도 연결 가능한가요?**
네. 옵션 A(A 레코드)를 쓰면 apex도 됩니다. CNAME은 RFC상 apex에 붙일 수 없어서, CNAME 옵션은 서브도메인(`www.myapp.com`)에서만 유효합니다.

**Q2. DNS 설정 후 얼마나 기다려야 하나요?**
대부분의 DNS 서비스는 수 분 이내 반영되지만, 일부는 최대 48시간까지 걸립니다. 대시보드의 **🔍 DNS 검증** 버튼으로 언제든 확인 가능합니다.

**Q3. `www.myapp.com`과 `myapp.com` 둘 다 연결하려면?**
**v2.4부터 지원** — 위저드 ②단계에서 "기본 도메인"에 apex를 넣고 "+ 도메인 추가"로 www 버전을 추가하세요. 하나의 Let's Encrypt SAN 인증서로 두 도메인 모두 커버됩니다.

**Q3-1. 공식 주소 하나로 모아주고 싶어요 (SEO 친화)**
위저드 ②단계의 **🧭 자동 리다이렉트** 체크박스를 켜두세요 (기본값). 그러면 `{subdomain}.twinverse.org` 주소는 브라우저 주소창에서도 자동으로 `https://<기본 도메인>`로 바뀝니다.

**Q4. Let's Encrypt 발급이 실패합니다.**
가장 흔한 원인:
- DNS 전파가 아직 안 됨 → 5-10분 후 재시도
- A 레코드가 Orbitron IP가 아닌 다른 곳을 가리킴 → 다시 확인
- 포트 80이 방화벽에 막힘 → HTTP-01 challenge는 80 포트로 도착해야 함
- 같은 도메인에 대해 1시간 내 5회 이상 시도 → Let's Encrypt rate limit. 테스트는 `staging=true` 옵션 사용

**Q5. SSL 인증서 수동 갱신하려면?**
대시보드 → 🌐 커스텀 도메인 연결 → 프로젝트 선택 → 연결된 상태 카드의 **🔄 SSL 갱신** 버튼.
이 버튼은 certbot이 "만료 임박이 아니면 갱신하지 않는" 정책을 따르므로, 강제 재발급은 연결 해제 후 다시 연결하세요.

**Q5-1. DNS 가이드에 "IP 확인 불가"가 뜨면?**
Orbitron 서버가 외부 IP 조회 API에 도달하지 못한 경우입니다 (아웃바운드 방화벽, DNS 문제, 일시적 네트워크 hiccup). 해결:
- **영구(권장)**: 서버 `.env`에 `PUBLIC_IP=116.33.16.12`(실제 공인 IP) 추가 후 `pm2 reload orbitron --update-env` — 외부 호출 없이 1ms 내 반환
- **임시**: UI의 **✏️ 수동 입력** 버튼 → 팝업 모달에서 네트워크별 IP 찾는 법 안내(공유기 뒤 서버 / 클라우드 콘솔 / SSH + `curl icanhazip.com` / 외부 조회 사이트 4개 링크) → IPv4 입력 후 저장 (재시작 전까지 유효)
- **진단**: 서버 터미널에서 `curl https://api.ipify.org` 실행해서 아웃바운드 443이 막혀 있는지 확인. 이게 막히면 Let's Encrypt 발급·갱신에도 영향을 주므로 네트워크 관리자 점검 필요.

**Q6. 연결 해제하면 인증서는?**
즉시 폐기(revoke)됩니다. `/home/stevenlim/letsencrypt/config/live/<도메인>/` 디렉토리도 삭제되어, 이후 같은 도메인을 다시 연결할 때 새 인증서를 발급합니다.

**Q7. Cloudflare로 도메인을 관리하고 있는데 proxy(orange-cloud)를 써도 되나요?**
**DNS Only (gray-cloud) 권장**. Orange-cloud(Proxied)로 하면 요청이 Cloudflare를 거쳐 오는데, Let's Encrypt HTTP-01 challenge 경로가 가려지거나 캐시되어 발급이 실패할 수 있습니다. 일단 gray-cloud로 발급받은 뒤 orange-cloud로 전환해도 됩니다.

---

## 🛠 고급 — 관리자/운영

### 인증서 목록 조회 (서버 셸)
```bash
certbot certificates \
  --config-dir /home/stevenlim/letsencrypt/config \
  --work-dir /home/stevenlim/letsencrypt/work \
  --logs-dir /home/stevenlim/letsencrypt/logs
```

### 갱신 cron
- 유닛: `~/.config/systemd/user/orbitron-cert-renew.timer`
- 실행: 매일 00:45 + 최대 1시간 랜덤 지연
- 로그: `journalctl --user -u orbitron-cert-renew -f`
- 수동 실행: `systemctl --user start orbitron-cert-renew.service`

### 환경변수 (Orbitron `.env`)
```bash
PUBLIC_IP=116.33.16.12         # (auto-detected from api.ipify.org if unset)
LE_EMAIL=admin@twinverse.org   # Let's Encrypt account email
LE_STAGING=0                   # set to 1 during testing (don't issue real certs)
LE_WEBROOT=/home/stevenlim/WORK/orbitron/webroot-acme
LE_CONFIG_DIR=/home/stevenlim/letsencrypt/config
```

### dev-nginx 볼륨 마운트 (`infrastructure/docker-compose.yml`)
```yaml
volumes:
  - /home/stevenlim/letsencrypt/config:/etc/letsencrypt:ro
  - /home/stevenlim/WORK/orbitron/webroot-acme:/var/www/certbot:ro
```

### Let's Encrypt rate limit
- 같은 도메인: 주 5회 발급
- 같은 등록 도메인: 주 50회
- 테스트는 `staging=true` 로 하세요 — staging 쿼터는 훨씬 넉넉합니다

---

## 🔐 보안

- Let's Encrypt 계정 키(`account/`), 사설 키(`privkey.pem`)는 모두 **Orbitron 운영 계정(stevenlim)만 읽기 가능** 권한 (600) — 다른 시스템 사용자도 못 봅니다
- dev-nginx는 `/etc/letsencrypt`를 **read-only**로 마운트 — 컨테이너 침해 시에도 인증서 탈취/변조 불가
- webroot는 ACME 챌린지 파일만 잠깐 있을 뿐, 민감 데이터 없음
- 프로젝트 오너만 자기 프로젝트의 도메인 API에 접근 가능 (`authMiddleware + viewerGuard`)
- 어드민은 `skipVerify: true` 옵션으로 DNS 검증을 우회할 수 있음 (긴급 복구용)

---

## 🗺 로드맵

| 기능 | 상태 |
|------|------|
| A 레코드 / CNAME 양방 지원 | ✅ v2.3 |
| Let's Encrypt HTTP-01 자동 발급 | ✅ v2.3 |
| 자동 갱신 (systemd timer) | ✅ v2.3 |
| 인증서 상태 UI (남은 일수 표시) | ✅ v2.3 |
| **프로젝트당 다중 커스텀 도메인 (SAN)** | ✅ **v2.4** |
| **전용 위저드 페이지 + 공급자별 가이드 (6개)** | ✅ **v2.4** |
| **Canonical 리다이렉트 (터널 → 공식 도메인 301)** | ✅ **v2.4** |
| **검색엔진 등록 안내 (Google/Naver/Bing/Daum)** | ✅ **v2.4** |
| **공인 IP 4중 방어 리졸버 + 수동 입력 UI** | ✅ **v2.4** |
| 와일드카드 SSL (DNS-01 challenge) | 📋 v2.5 |
| DNS provider API 통합 (자동 레코드 생성) | 📋 v2.5 |
