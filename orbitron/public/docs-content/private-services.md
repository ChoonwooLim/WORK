# 프라이빗 서비스 (Private Services)

인터넷(WWW)이라는 광활한 바다로 향하는 문을 완전히 닫아버리고, 오직 **안전한 Orbitron 내부망(Private Network)** 안에서만 소통할 수 있도록 격리된 특수 컨테이너 서비스입니다.

---

## 🔒 왜 프라이빗으로 배포하나요?

만약 여러분의 전체 아키텍처가 다음과 같다고 상상해 보세요.
1.  **Frontend (React)**: 유저가 폰으로 접속하는 화면 
2.  **API Gateway (Node.js)**: 프론트엔드가 요청을 보내는 관문
3.  **Payment Server (Java)**: 카드사 결제 비밀키를 다루고 결제를 승인하는 진짜 핵심 서버

이때 1번과 2번은 유저가 접속해야 하므로 퍼블릭(Public) 웹 서비스가 되어야 하지만, 3번(결제 서버)은 절대로 해커가 밖에서 주소를 치고 들어오면 안 됩니다. 
결제 서버는 오직 2번(API Gateway)만이 호출할 수 있도록 **프라이빗 서비스**로 숨겨두어야 합니다!

---

## 설정 및 호출 방법 (DNS Service Discovery)

프라이빗 서비스를 구축하고 나면 일반 웹 서비스처럼 `https://myapp.twinverse.org` 같은 멋진 외부 주소가 나오지 않습니다. 대신 Orbitron 커널이 관리하는 **내부 도메인 네임 (예: `http://payment-srv:8080`)** 이 발급됩니다.

1.  대시보드에서 `+ New Project` > **프라이빗 서비스(Private)** 배포를 선택합니다.
2.  포트를 평범하게(예: 8080) 열고 서버를 똑같이 띄웁니다.
3.  이제 다른 웹 서비스(API 관문)의 코드 (예: `axios`, `fetch` 등) 에서 이 결제 서버를 찌를 때는 URL란에 저 내부 도메인을 하드코딩해서 씁니다!

```javascript
// 프론트랑 닿아있는 API 관문 서버(Node.js)의 코드 예제
const axios = require('axios');

app.post('/api/checkout', async (req, res) => {
    // 밖에서는 절대 접속 못하는 내부망 프라이빗 결제 서버를 가리킴!
    // 포트 번호(8080)도 직접 명시해야 합니다.
    const result = await axios.post('http://payment-srv:8080/process', req.body);
    res.json(result.data);
});
```

> 💡 **알아두세요 (Docker Compose와의 차이)**
> `docker-compose.yml`을 쓰면 파일 하나에서 모든 걸 다루기 때문에 저절로 내부망이 형성되지만, 이 기능은 각기 독립된 프로젝트(레포지토리도 다름)로 만든 서비스들을 서로 통신하게끔 엮어주는 클러스터링(Clustering) 개념입니다.
