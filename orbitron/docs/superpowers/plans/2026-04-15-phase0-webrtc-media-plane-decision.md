# Phase 0-A: WebRTC 미디어 플레인 전송 경로 결정 보고서

**작성일:** 2026-04-15
**상태:** Steven 승인 대기
**관련 플랜:** [2026-04-15-pixel-streaming-orbitron-adapted.md](2026-04-15-pixel-streaming-orbitron-adapted.md)

---

## 1. 문제 정의

UE5 Pixel Streaming은 브라우저와 UE5 애플리케이션 사이에서 **WebRTC 미디어 스트림**(UDP/ICE)을 사용한다. Orbitron의 기존 인프라는:

- 시그널링(WebSocket): CloudFlare Tunnel로 문제없이 전달 가능 (HTTPS/WS 프록시)
- **미디어 스트림(UDP/ICE): CF 일반 Tunnel은 UDP 미지원** → 별도 경로 필요

현재 `ps2.twinverse.org`는 LAN 내부에서만 작동하는 것으로 보인다 (근거: 기존 `/opt/twinverse-ps2/wilbur/config.json`의 `peer_options=""` — TURN/STUN 미설정).

### 네트워크 제약 (실측 검증)

| 항목 | 값 | 출처 |
|------|-----|------|
| Orbitron 공인 IP | 112.156.177.187 | ipify |
| ISP | LG U+ (가정용) | Steven |
| TCP 80/443 inbound | **ISP silent drop** | check-host.net 5개 노드 timeout |
| twinverse-ai UFW | 22/11434/8100/8200만 LAN(192.168.219.0/24) 허용, 외부 전면 차단 | `sudo ufw status` |
| 기존 CF Tunnel | HTTP/WebSocket만 (twinverse.org, twinverseai.twinverse.org, ps2.twinverse.org 등 13개 터널) | `/home/stevenlim/.cloudflared/*.yml` |

### UE5 PS 네트워크 요구사항

- 시그널링: WebSocket over HTTPS/443 ✅ CF Tunnel로 해결
- 미디어: WebRTC ICE/DTLS/SRTP, 기본 UDP 고용량 포트 (동적 할당)
- TURN fallback: Epic 공식 가이드에서 `peerConnectionOptions.iceServers`로 configure
- 1080p @ 30fps ≈ 5 Mbps 대역폭 (양방향)

---

## 2. 옵션 평가

원본 핸드오프 문서의 A/B/C 3안에 더해, 조사 중 발견한 **D안 (Cloudflare Realtime TURN)** 을 추가 평가한다.

### 옵션 A. 공인 IP 직노출 (twinverse-ai)

**구조:** twinverse-ai에 공인 IP 할당 또는 포트 포워딩. ICE가 GPU 서버 UDP 직접 연결.

| 항목 | 평가 |
|------|------|
| 구현 난이도 | 🟢 낮음 — UFW open + 라우터 포트 포워딩만 |
| 보안 | 🔴 GPU 서버를 공개 인터넷에 직접 노출 (22번 SSH는 제외해도 웹 포트 공개 리스크) |
| **LG U+ 인바운드 차단** | 🔴 **치명** — TCP 80/443 silent drop 확인됨. UDP 포트도 같은 가능성 높음 (미검증) |
| 대역폭 비용 | 🟢 인입만 LG U+ 포함가격 |
| 확장성 | 🔴 단일 호스트 바인딩. 멀티 GPU 서버 시 DNS round-robin 외 방법 없음 |
| 한국 CGNAT/방화벽 사용자 | 🔴 통과 불가 (흔한 기업 방화벽) |

**결론:** ISP 제약으로 **실용 불가**.

### 옵션 B. 자체 coturn 서버 (Orbitron 호스트 또는 별도 VPS)

**구조:** coturn을 Orbitron 호스트에 설치, TCP/443 fallback. 모든 WebRTC 트래픽이 coturn을 경유해 relay.

| 항목 | 평가 |
|------|------|
| 구현 난이도 | 🟡 중간 — coturn 설정, TLS 인증서, systemd |
| 보안 | 🟡 장기 인증/크리덴셜 관리, DoS 타겟 가능성 |
| **LG U+ 인바운드 차단** | 🔴 **치명** — Orbitron 호스트 자체가 LG U+ 뒤라 TURN 리스닝 불가. 별도 VPS 필요 → 월 비용 $5-20 추가 |
| 대역폭 비용 | 🟡 VPS 대역폭 한도 (Linode/DO 1TB 월 기본) |
| 확장성 | 🟡 coturn 1대 → ~100 동시 세션, 이후 LB 필요 |
| 레이턴시 (한국 사용자 기준) | 🟡 해외 VPS면 150~200ms 추가, 국내 VPS면 좋음 |
| 운영 부담 | 🔴 coturn 버전 관리, 인증서 갱신, 로깅 모니터링 |

**결론:** 기술적으로 가능하지만 **별도 VPS 필요 + 운영 부담**. 데모·투자자 시연 페이즈에서 오버엔지니어링.

### 옵션 C. Cloudflare Spectrum (Enterprise 유료)

**구조:** CF가 UDP 포트까지 Edge로 라우팅. 일반 CF Tunnel의 UDP 확장판.

| 항목 | 평가 |
|------|------|
| 구현 난이도 | 🟢 낮음 — 기존 Tunnel infra 재사용, Spectrum app 추가 |
| 보안 | 🟢 CF Edge 방패 |
| **LG U+ 인바운드 차단** | 🟢 CF anycast로 우회 |
| 대역폭 비용 | 🔴 **Enterprise 플랜 필요** — 가격 협상 기반, 월 수천 달러~ |
| 확장성 | 🟢 CF 글로벌 네트워크 |
| 운영 부담 | 🟢 매니지드 |

**결론:** 기술적으론 깨끗하지만 **Enterprise 가격표** — 데모 규모에 과잉 지출.

### 🟢 옵션 D. Cloudflare Realtime TURN (신규 — 권장)

조사 중 발견. CF가 제공하는 **매니지드 TURN 서비스**. 2024-2025년에 GA.

**구조:**
```
브라우저 ─── WSS ──→ Cloudflare Tunnel ──→ Orbitron Wilbur (시그널링)
     │                                          │
     │                                          └─ iceServers: [CF Realtime TURN]
     │                                                         │
     └──── WebRTC over TCP/443 ────→ CF Realtime TURN ◀────────┘ (TURN relay)
                                          │
                                          └── UDP/WebRTC ──→ twinverse-ai Wilbur streamer
```

**공식 출처:** [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/)

| 항목 | 평가 |
|------|------|
| 구현 난이도 | 🟢 낮음 — Wilbur `peer_options.iceServers`에 CF TURN 엔드포인트 + 크리덴셜 JSON 삽입만 |
| 보안 | 🟢 CF 글로벌 인프라 + 단기 TURN credential (10분 만료 토큰) |
| **LG U+ 인바운드 차단** | 🟢 **완전 우회** — TURN 서버가 CF anycast, 클라이언트→CF만 아웃바운드. twinverse-ai → CF도 아웃바운드 (UDP 홀펀칭) |
| **TCP/443 fallback** | 🟢 지원 — 기업 방화벽 뒤 사용자도 통과 |
| 대역폭 비용 | 🟢 **$0.05/GB (outbound CF→client 방향만)**. 1080p 5Mbps × 1시간 = 2.25GB = **$0.11/hour/user** |
| 확장성 | 🟢 CF 글로벌 anycast, 각 TURN allocation 50-100 Mbps · 5-10 kpps 한도 |
| 레이턴시 (한국) | 🟢 CF ICN edge (국내 서울 데이터센터) ~5-10ms 추가만 |
| 운영 부담 | 🟢 매니지드 (coturn 운영 불필요) |
| 월 비용 추정 (demo 규모) | **<$10/month** (500 user-hours 기준) |
| 월 비용 추정 (투자자 시연 피크) | ~$20-50/month (500-1500 user-hours) |

**제약:**
- CF 계정의 Realtime 앱 생성 필요 (기존 CF 토큰 scope 확장: `Account:Cloudflare Realtime:Edit`)
- 각 TURN allocation 50-100 Mbps 한도 → 동시 1080p 10~20명/allocation, 많은 동시 접속은 allocation 병렬 분산 로직 필요 (Phase C 이슈)

**결론:** 데모~시연 규모에서 **압도적으로 우월**. 구현 최소, 비용 예측 가능, ISP 제약 완전 우회, 운영 부담 0.

---

## 3. 비교 매트릭스 (요약)

| 기준 | A (직노출) | B (자체 coturn) | C (CF Spectrum) | **D (CF Realtime TURN)** |
|------|:----------:|:---------------:|:---------------:|:------------------------:|
| ISP 제약 우회 | ❌ | ❌ (별 VPS 필요) | ✅ | ✅ |
| TCP/443 fallback | ❌ | 🟡 | ✅ | ✅ |
| 초기 설정 시간 | 🟢 | 🔴 2-3일 | 🟢 | 🟢 <1일 |
| 운영 부담 | 🟡 | 🔴 | 🟢 | 🟢 |
| 데모 규모 월 비용 | $0 | $5-20 (VPS) | $500+ (Enterprise) | **<$10** |
| 피크 시연 월 비용 | $0 | $10-30 | $500+ | **$20-50** |
| 레이턴시 (한국) | 🟢 LAN급 | 🟡 국내 VPS면 좋음 | 🟢 CF ICN | 🟢 CF ICN |
| 확장성 | ❌ | 🟡 | 🟢 | 🟢 (allocation 분산 필요) |
| 보안 (GPU 서버 노출) | ❌ | 🟢 | 🟢 | 🟢 |

---

## 4. 권장안

### 🎯 옵션 D (Cloudflare Realtime TURN) 채택

**근거:**
1. LG U+ ISP 인바운드 차단을 **유일하게 완전 우회**하면서 초기 비용 $0, 데모 규모 $10/월 이내
2. 기존 CF 토큰 + Tunnel 인프라 재사용, 추가 VPS 도입 불필요
3. TCP/443 fallback 기본 지원으로 기업 방화벽 뒤 투자자 · 고객 모두 접근 가능
4. 운영 부담 0 (매니지드)
5. Phase C에서 CF Realtime SFU로 업그레이드 시 TURN은 무료 전환 (같은 CF 계정)

**채택 시 구현 변경점 (원본 플랜 대비):**
- Phase 0-A 결정 보고 ← **이 문서**
- Phase 0-A-1 "coturn 설치 조사" → **폐기**, 대신 "CF Realtime 앱 생성 + 크리덴셜 발급" 태스크로 교체
- Phase 0-C "CF 토큰 권한 범위" → **`Account:Cloudflare Realtime:Edit` 권한 추가**
- Phase 4-B "WebRTC 미디어 경로 배치" → **"Wilbur peer_options.iceServers에 CF TURN endpoint 삽입 + 단기 크리덴셜 발급 API 연동"** 으로 재정의
- 슬롯 프로비저닝 시 TURN 크리덴셜 발급 로직을 `services/psSlots/turnCredentials.js`에 분리

### 단기 크리덴셜 패턴

CF Realtime TURN은 static credential 대신 **short-lived credential** (기본 10분 만료)를 발급. 클라이언트 접속 시:

```
브라우저 → Orbitron /api/projects/:id/ps-slots/:slotId/turn-credential
         ← {urls: [...], username, credential, expiresAt}  (10분짜리)
         → (Wilbur player.html에서 peer_options.iceServers에 주입)
```

Orbitron은 CF API `POST /accounts/{id}/calls/turn_keys/{key_id}/credentials`로 매 세션마다 신규 발급. 크리덴셜 유출 시 영향 범위 = 10분.

### Phase 4-B 태스크 상세 (채택 시)

- [ ] **4-B-1: CF Dashboard에서 Realtime 앱 생성** → `TURN_TOKEN_ID` + `TURN_TOKEN_SECRET` 획득
- [ ] **4-B-2: `~/.cloudflare-orbitron.env`에 `CF_REALTIME_TOKEN_ID`, `CF_REALTIME_TOKEN_SECRET` 추가** (토큰 스코프에 `Cloudflare Realtime:Edit` 포함 확인)
- [ ] **4-B-3: `services/psSlots/turnCredentials.js`** — CF API 래퍼:
  ```js
  async function issueTurnCredential(ttlSeconds = 600) {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CF_REALTIME_TOKEN_ID}/credentials/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CF_REALTIME_TOKEN_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl: ttlSeconds })
    });
    return res.json(); // { iceServers: { urls: [...], username, credential } }
  }
  ```
- [ ] **4-B-4: `routes/psRuntime.js`에 `GET /:slotId/turn-credential`** — 세션 시작 시 호출, 10분 크리덴셜 반환
- [ ] **4-B-5: Wilbur `config.json` 템플릿 수정** — `peer_options` 필드에 `iceServers` 주입 (또는 player.html 측에서 런타임 주입 — Wilbur 구현에 따라)
- [ ] **4-B-6: E2E 검증** — 외부 브라우저(모바일 4G)에서 `<slot>.ps.twinverse.org` 접속 → 스트림 도달 확인. `chrome://webrtc-internals`로 ICE candidate가 `relay (turn)` 유형임을 확인

### 리스크 & 완화책

| 리스크 | 완화책 |
|-------|--------|
| CF Realtime GA 지속 여부 | 계약 변경 시 Wilbur `iceServers` 단 한 줄 수정으로 coturn/타 TURN 전환 가능. 벤더 락인 최소 |
| 50-100 Mbps per allocation 한도 | 세션당 별도 allocation 발급 패턴으로 자연 분산. 투자자 시연(동시 20명+) 시 allocation 병렬 |
| 비용 예측 초과 | CF Dashboard 사용량 알림 설정, Orbitron 대시보드에 월간 GB 집계 카드 추가 (Phase 5 범위) |
| 크리덴셜 TTL 만료 시 세션 끊김 | UE5 PS 세션은 보통 10분 이내. 장시간 세션 필요 시 TTL 1800초 확장 또는 WebRTC renegotiation |

---

## 5. 대안 보관 (D 거부 시)

Steven이 D안 거부 시 **B안 변형** — 국내 VPS에 coturn:

- 국내 VPS (Conoha/Vultr Tokyo, 또는 KT Cloud) 월 $5
- coturn + Let's Encrypt + systemd, TCP/443 fallback
- 관리 부담 있음, 하지만 벤더 독립
- 예상 구축 시간 2-3일

A안/C안은 앞선 평가로 **비권장** (A=ISP 제약, C=Enterprise 과잉).

---

## 6. Steven 승인 요청

다음 결정을 내려주세요:

- [ ] **D안 (Cloudflare Realtime TURN) 채택** — Phase 0-A 종료, Phase 0-B/C/D/E 병렬 진행
- [ ] **B안 (국내 VPS coturn) 채택** — D 거부 시 대안
- [ ] **추가 질의 / 파일럿 요청** — (내용 명시)

승인 후 본 문서를 Phase 0-A 결과로 확정하고, [메인 플랜](2026-04-15-pixel-streaming-orbitron-adapted.md) Phase 4-B 섹션을 선택된 옵션으로 교체 커밋합니다.
