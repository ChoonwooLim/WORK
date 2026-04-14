# 🌐 커스텀 도메인 연결 (Let's Encrypt 자동 SSL)

> ✨ **2026.04 v2.3 신규**: 이제 Orbitron 유저는 자신의 도메인(예: `myapp.com`)을 프로젝트에 자유롭게 연결할 수 있으며, HTTPS 인증서는 Let's Encrypt로 **자동 발급·자동 갱신**됩니다.

배포된 프로젝트에 본인 도메인을 연결하면:
- `{subdomain}.twinverse.org` 대신 **`https://myapp.com`** 으로 서비스
- SSL 인증서는 Orbitron이 **자동 발급** (별도 설정 불필요)
- 90일 만료 전에 **자동 갱신** (daily cron)
- Cloudflare 같은 외부 CDN 의존 **없이** 바로 작동

---

## 🚀 빠른 시작 (3단계)

### 1️⃣ DNS 레코드 추가

도메인 등록/관리 서비스(가비아, Cloudflare, Namecheap, AWS Route53 등)에서 아래 **둘 중 하나**를 설정:

| 옵션 | 타입 | 호스트 | 값 |
|------|------|--------|-----|
| **A — apex 또는 www 모두 가능 (권장)** | `A` | `@` (apex) 또는 `www` | **{orbitron 공인 IP}** |
| **B — 서브도메인에만 가능 (apex 불가)** | `CNAME` | `www` 또는 임의 서브도메인 | `{project-subdomain}.twinverse.org` |

> 💡 공인 IP는 대시보드의 도메인 연결 화면에서 자동으로 표시됩니다.

### 2️⃣ Orbitron 대시보드에서 연결

1. 프로젝트 → **⚙️ 설정** 탭 이동
2. **🌐 커스텀 도메인** 섹션에 도메인 입력 (예: `myapp.com` 또는 `www.myapp.com`)
3. **🔍 DNS 검증** → DNS가 올바르게 우리 서버를 가리키면 "✅ DNS 검증 성공"
4. **🔗 연결** 버튼 클릭 → Orbitron이 자동으로:
   - Let's Encrypt HTTP-01 challenge로 SSL 인증서 발급 (보통 20-60초)
   - nginx HTTPS 서버 블록 생성
   - nginx 리로드
5. 완료되면 `https://myapp.com` 으로 바로 접속 가능

### 3️⃣ 완료 — 자동 갱신

- 인증서는 90일 만료 전에 daily cron(`orbitron-cert-renew.timer`)이 **자동 갱신**
- 대시보드에는 남은 일수 표시 (예: "🔐 인증서 만료 83일 남음")
- 필요 시 **🔄 갱신** 버튼으로 즉시 재발급 가능

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
현재 MVP는 프로젝트당 1개 커스텀 도메인만 지원합니다. 대안:
- (A) DNS에서 `myapp.com` → `www.myapp.com` 리다이렉트 설정 (도메인 서비스 제공 기능)
- (B) 각각 별도 프로젝트 생성 (같은 GitHub 리포에서 같은 컨테이너로 수동 라우팅)
- 추후 다중 도메인 지원은 v2.4에 예정.

**Q4. Let's Encrypt 발급이 실패합니다.**
가장 흔한 원인:
- DNS 전파가 아직 안 됨 → 5-10분 후 재시도
- A 레코드가 Orbitron IP가 아닌 다른 곳을 가리킴 → 다시 확인
- 포트 80이 방화벽에 막힘 → HTTP-01 challenge는 80 포트로 도착해야 함
- 같은 도메인에 대해 1시간 내 5회 이상 시도 → Let's Encrypt rate limit. 테스트는 `staging=true` 옵션 사용

**Q5. SSL 인증서 수동 갱신하려면?**
대시보드 → 프로젝트 설정 → 🌐 커스텀 도메인 → **🔄 갱신** 버튼.
이 버튼은 certbot이 "만료 임박이 아니면 갱신하지 않는" 정책을 따르므로, 강제 재발급은 연결 해제 후 다시 연결하세요.

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
| 프로젝트당 다중 커스텀 도메인 | 📋 v2.4 |
| 와일드카드 SSL (DNS-01 challenge) | 📋 v2.4 |
| DNS provider API 통합 (자동 레코드 생성) | 📋 v2.5 |
