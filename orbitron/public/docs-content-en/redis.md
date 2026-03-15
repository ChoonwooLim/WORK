# 인메모리 캐시 시스템 (Redis)

데이터베이스(PostgreSQL)가 영원히 지워지지 않는 거대한 서류 보관소(하드디스크)라면, **Redis**는 전원을 끄면 날아가지만 처리 속도가 압도적으로 빠른 초고속 램(In-Memory RAM) 캐시 저장소입니다.

단순 데이터 저장뿐만 아니라 실시간 채팅(Pub/Sub), 세션 관리, 무거운 연산 결과물 저장 등에 매우 널리 쓰입니다.

---

## ⚡ 왜 Redis가 필요한가요?

사용자가 사이트 메인 페이지를 접속할 때마다 DB에서 "최신 게시글 50개"를 꺼내오는 복잡한 쿼리를 매번 실행하면 서버가 쉽게 죽습니다. 
Orbitron에서 Redis를 버튼 하나로 생성해두고, 첫 번째 유저가 들어올 때 쿼리 결과를 Redis에 살짝 저장(캐시)해 둡니다. 두 번째 유저부터는 DB에 가지 않고 **메모리(Redis)에서 0.001초 만에 결과를 던져주면** 트래픽이 100배 증가해도 서버가 버팁니다!

---

## 생성 및 연결 방법 (URL)

1. 대시보드에서 데이터베이스(Database) 생성 탭으로 이동하여 **Redis**를 선택합니다.
2. 생성 즉시 아래와 같은 고유한 **Redis URL (Connection String)** 주소가 떨어집니다.

```
redis://:mypassword123@redis-srv:6379/0
```

*   `redis://` 프로토콜을 사용하며, 비밀번호와 호스트명, 6379 포트를 모두 담고 있습니다.

### Node.js (Express 등) 연결 예제

당장 배포 중인 앱의 환경 변수에 `REDIS_URL` 로 위 주소를 등록한 후 코드를 작성하세요.

```javascript
const redis = require('redis');

// 환경변수에 등록한 저 요상한 접속 주소 한줄을 그대로 넣으면 됨!
const client = redis.createClient({
    url: process.env.REDIS_URL
});

client.on('error', (err) => console.log('Redis 에러:', err));

await client.connect();

// 아주 빠른 캐시 저장과 읽기
await client.set('best_user', 'steven');
const name = await client.get('best_user');
```

---

## 영속성 주의 (Eviction & Persistence)

Redis의 기본 설계 철학은 "언젠가는 지워져도 앱 동작에 치명적인 장애를 주지 않아야 하는(Stateless) 부가적 휘발성 데이터"를 다루는 데 있습니다.

*   서버 메모리가 한계(Max Memory)에 도달하면, Redis 엔진은 제일 오랫동안 쓰지 않은 캐시 데이터(LRU)부터 쫓아내며(Evict) 용량을 스스로 확보합니다.
*   따라서 절대 지워져선 안되는 금융 기록 같은 1급 데이터는 무조건 PostgreSQL에 넣으시고, 로그인 세션이나 임시 검색 결과 같은 것만 Redis에 담으시길 권장합니다.
