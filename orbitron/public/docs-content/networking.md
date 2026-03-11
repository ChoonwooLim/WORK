# Cloudflare 터널 및 커스텀 도메인 네트워킹

내 프로젝트 서버가 인터넷에 노출(Public)될 때, 라우터(공유기)의 포트포워딩이나 위험한 포트를 억지로 열어두는 구시대적 방식은 보안상 최악의 선택입니다. 

Orbitron은 배포되는 즉시, 모든 애플리케이션에 해커 공격을 방어하는 글로벌 방파제 **Cloudflare Edge 파이프 터널**을 자동으로 개통합니다.

---

## 🛡️ Cloudflare 터널의 마법

사용자(개발자)는 복잡한 네트워크 지식을 전혀 몰라도 됩니다.
시스템이 당신의 서비스를 배포(Deploy)하는 순간, 백그라운드 엔진이 Cloudflare API와 통신하여 다음과 같은 기적의 보안망을 1초 만에 구축해버립니다.

1.  **DDoS 완벽 방어:** 해커가 좀비 PC 10만 대를 동원해 여러분의 서버 주소를 동시 공격해도, 글로벌 Cloudflare 망에서 모든 트래픽 폭탄을 흡수하고 튕겨냅니다. 실제 여러분의 Orbitron 서버 CPU는 1%도 닳지 않습니다.
2.  **은밀한 아웃바운드 연결:** 세상 밖(인터넷)에서 여러분 서버의 공인 IP 주소로 "들어오는(Inbound)" 문은 모조리 막혀 있습니다. 오직 여러분 서버가 안에서 밖으로 Cloudflare를 향해 뚫고 나간(Outbound) 얇은 터널 파이프 하나만을 통해 유저 데이터가 안전하게만 왕복합니다.
3.  **무료 자동 SSL 인증서:** HTTPS 자물쇠가 달린 보안 접속을 위해 매번 Let's Encrypt를 발급받을 필요가 없습니다. 터널이 구축됨과 동시에 은행급 TLS 보안이 영구적으로 자동 적용됩니다.

---

## 🌐 자동 부여 도메인 (`twinverse.org`)

새 프로젝트를 배포하면, 프로젝트 이름(예: `my-cool-app`)을 기반으로 한 서브도메인이 자동으로 할당됩니다. 여러분은 어떠한 DNS 설정 셋업도 할 필요 없이 즉시 친구들에게 아래와 같은 주소로 자랑할 수 있습니다.

```
https://my-cool-app.twinverse.org
```

이 고유 주소는 백엔드든 웹 서비스든 프론트엔드든 상관없이 오직 '해당 프로젝트 카드'에 영구 귀속됩니다.

---

## 🔗 커스텀 도메인(개인 도메인) 연결

자신이 직접 구매한 멋진 도메인(예: `www.steven-company.com`)을 프로젝트에 연결할 수 있습니다.

### 연결 과정 (3단계)

Orbitron 대시보드의 **Settings > 커스텀 도메인** 섹션에서 간편하게 설정할 수 있습니다:

1.  **도메인 입력**: 연결하고 싶은 도메인 주소를 입력합니다 (예: `app.mycompany.com`)
2.  **DNS 검증**: "DNS 검증" 버튼을 클릭하면 시스템이 해당 도메인의 DNS 레코드가 올바르게 설정되었는지 자동 확인합니다
3.  **자동 연결**: 검증이 통과되면 "연결" 버튼 하나로 Cloudflare 터널 DNS 라우팅, Nginx 리버스 프록시, SSL 인증서가 모두 자동 설정됩니다

### 도메인 구매 후 DNS 설정 방법

도메인을 구매한 등록기관(가비아, Namecheap 등)의 DNS 관리 페이지에서 아래와 같이 **CNAME 레코드**를 추가하세요:

| 항목 | 값 |
|------|-----|
| **타입** | CNAME |
| **이름/호스트** | `@` 또는 원하는 서브도메인 (예: `www`, `app` 등) |
| **값/대상** | `{프로젝트서브도메인}.twinverse.org` |
| **TTL** | 자동 또는 300 |

> **💡 팁:** 루트 도메인(`example.com` 자체)에 CNAME을 쓸 수 없는 등록기관이 있습니다. 이런 경우 `www.example.com` 같은 서브도메인으로 설정하면 됩니다.

#### 가비아(Gabia) 설정 예시

1. 가비아 관리 콘솔 → 도메인 관리 → DNS 설정
2. 레코드 추가: 타입 `CNAME`, 호스트 `www`, 값 `my-cool-app.twinverse.org`
3. 저장 후 Orbitron 대시보드에서 "DNS 검증" 클릭

#### Namecheap 설정 예시

1. Namecheap Dashboard → Domain List → Manage → Advanced DNS
2. Add New Record: Type `CNAME`, Host `www`, Value `my-cool-app.twinverse.org`
3. 저장 후 Orbitron 대시보드에서 "DNS 검증" 클릭

#### Cloudflare 설정 예시

1. Cloudflare Dashboard → DNS → Records → Add Record
2. Type `CNAME`, Name `www`, Target `my-cool-app.twinverse.org`, Proxy off
3. 저장 후 Orbitron 대시보드에서 "DNS 검증" 클릭

---

## 🔜 도메인 구매 기능 (구현 예정)

> **🚧 향후 업데이트 예정 기능입니다**

Orbitron 대시보드 안에서 도메인을 검색하고 구매까지 원스톱으로 처리하는 기능을 준비 중입니다:

| 기능 | 설명 | 상태 |
|------|------|------|
| **도메인 검색** | 대시보드 내에서 원하는 도메인 이름의 등록 가능 여부를 실시간 검색 | 🔜 구현 예정 |
| **원클릭 구매** | 가비아 리셀러 API 또는 Namecheap API를 통해 도메인을 즉시 구매 | 🔜 구현 예정 |
| **자동 DNS 연동** | 구매 즉시 CNAME 레코드가 자동 설정되어 별도 DNS 설정 불필요 | 🔜 구현 예정 |
| **도메인 갱신 관리** | 만료 예정 도메인 알림 및 자동 갱신 | 🔜 구현 예정 |
| **결제 시스템 연동** | 도메인 비용 결제를 위한 PG사 연동 | 🔜 구현 예정 |

### 검토 중인 API 파트너

- **가비아(Gabia)**: 한국 시장 최적, OAuth 2.0 REST API, .kr 도메인 강점 — 리셀러 파트너 계약 필요
- **Namecheap**: 글로벌 TLD 지원, Sandbox 테스트 환경, 종합적인 도메인 관리 API
- **Cloudflare Registrar**: 원가 도메인 등록, 기존 인프라 자연 통합 — Enterprise 플랜 필요
